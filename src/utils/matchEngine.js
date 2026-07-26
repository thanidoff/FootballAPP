import { normalizeStats } from './stats'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function hashSeed(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createSeededRandom(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

const stat = (player, key) => normalizeStats(player?.stats)[key]
const average = (players, key) => players.length ? players.reduce((sum, player) => sum + stat(player, key), 0) / players.length : 50

function weightedPick(players, weightFor, random) {
  if (!players.length) return null
  const weights = players.map(player => Math.max(0.01, weightFor(player)))
  let cursor = random() * weights.reduce((sum, weight) => sum + weight, 0)
  for (let index = 0; index < players.length; index += 1) {
    cursor -= weights[index]
    if (cursor <= 0) return players[index]
  }
  return players.at(-1)
}

function contestProbability(attack, defense, modifier = 0) {
  // Sigmoid-like smooth scaling: Stronger stats yield ~70-85% win rate in individual duels, with 15-30% upset variance
  return clamp(0.5 + (attack - defense) / 100 + modifier, 0.06, 0.94)
}

function teamControl(players) {
  return average(players, 'PAS') * 0.35 + average(players, 'DRI') * 0.25 + average(players, 'DEF') * 0.20 + average(players, 'PAC') * 0.10 + average(players, 'PHY') * 0.10
}

function creatorWeight(player, isGk = false) {
  if (isGk) return 0.04 * (0.5 + stat(player, 'PAS') / 100) // Rare long-range assist chance
  return ({ MF: 0.45, DEF: 0.25, FWD: 0.25, GK: 0.04 }[player.position] || 0.1) * (0.5 + stat(player, 'PAS') / 100)
}

function shooterWeight(player, isGk = false) {
  if (isGk) return 0.008 * (stat(player, 'SHO') / 100) // Extremely rare long-range goal attempt
  const position = { FWD: 1.60, MF: 1, DEF: 0.45, GK: 0.008 }[player.position] || 0.5
  return position * (stat(player, 'SHO') * 0.55 + stat(player, 'DRI') * 0.25 + stat(player, 'PAC') * 0.15 + stat(player, 'PHY') * 0.05)
}

export function simulatePossession({ attacking, defending, team, minute, random }) {
  const creator = weightedPick(attacking, (player) => creatorWeight(player, player.id === attacking[4]?.id), random)
  const outfieldDefenders = defending.slice(0, 4).filter(Boolean)
  const defendersToUse = outfieldDefenders.length ? outfieldDefenders : defending
  const defender = weightedPick(defendersToUse, player => stat(player, 'DEF') * 0.6 + stat(player, 'PHY') * 0.4, random)
  if (!creator || !defender) return { type: 'turnover', team, minute }

  const actionRoll = random()
  const action = actionRoll < 0.52 ? 'pass' : actionRoll < 0.82 ? 'dribble' : 'direct'
  const attackPower = action === 'dribble'
    ? stat(creator, 'DRI') * 0.55 + stat(creator, 'PAC') * 0.30 + stat(creator, 'PHY') * 0.15
    : action === 'direct'
      ? stat(creator, 'PAS') * 0.45 + stat(creator, 'PAC') * 0.35 + stat(creator, 'PHY') * 0.20
      : stat(creator, 'PAS') * 0.60 + stat(creator, 'DRI') * 0.20 + stat(creator, 'PAC') * 0.20
  const defensePower = action === 'dribble'
    ? stat(defender, 'DEF') * 0.50 + stat(defender, 'PAC') * 0.25 + stat(defender, 'PHY') * 0.25
    : stat(defender, 'DEF') * 0.55 + stat(defender, 'PAC') * 0.25 + stat(defender, 'PHY') * 0.20
  
  // Check for foul during contest
  const foulChance = clamp(0.12 + (stat(defender, 'PHY') - stat(creator, 'DRI')) / 250, 0.04, 0.22)
  if (random() < foulChance) {
    const cardRoll = random()
    const card = cardRoll < 0.05 ? 'red' : cardRoll < 0.35 ? 'yellow' : null
    return { type: 'foul', team: team === 'home' ? 'away' : 'home', minute, player: defender, card, victim: creator }
  }

  // Higher buildup chance for high-tempo attacking opportunities
  const buildupChance = contestProbability(attackPower, defensePower, 0.10)
  if (random() > buildupChance) return { type: action === 'dribble' ? 'dispossessed' : 'bad_pass', team, minute, player: creator, opponent: defender }

  const shooter = weightedPick(attacking, (player) => shooterWeight(player, player.id === attacking[4]?.id), random)
  const blocker = weightedPick(defendersToUse, player => stat(player, 'DEF') + stat(player, 'PHY') * 0.4, random)
  // 🧤 Lock Goalkeeper strictly to the 5th player (Index 4 of Starting 5)
  const goalkeeper = defending[4] || defending.find(player => player.position === 'GK') || defending.at(-1)
  
  const isGkShooter = shooter.id === attacking[4]?.id
  const preparation = stat(shooter, 'SHO') * 0.45 + stat(shooter, 'DRI') * 0.35 + stat(shooter, 'PAC') * 0.20
  const blockPower = stat(blocker, 'DEF') * 0.55 + stat(blocker, 'PHY') * 0.25 + stat(blocker, 'PAC') * 0.20
  const blockChance = clamp(0.24 + (blockPower - preparation) / 200, 0.05, 0.55)
  if (random() < blockChance) return { type: 'blocked_shot', team, minute, player: shooter, opponent: blocker }

  const pressure = Math.max(0, blockPower - preparation) * 0.12
  const accuracy = stat(shooter, 'SHO') * 0.70 + stat(shooter, 'DRI') * 0.20 + stat(shooter, 'PAC') * 0.10 - pressure
  // Goalkeeper long-range shots have lower accuracy & lower onTargetChance
  const onTargetChance = clamp((isGkShooter ? 0.18 : 0.40) + accuracy / 160, 0.10, 0.92)
  if (random() > onTargetChance) {
    const misses = ['shot_wide', 'shot_over', 'hit_post']
    return { type: misses[Math.min(misses.length - 1, Math.floor(random() * misses.length))], team, minute, player: shooter }
  }

  // 🧤 Dynamic Goalkeeper vs Finishing Contest:
  // - High SHO strikers (88-99) gain strong conversion boost against average GKs
  // - World-class GKs (88-99 SAV/REF/GKA) significantly reduce scoringChance and make crucial saves
  const finishing = stat(shooter, 'SHO') * 0.65 + stat(shooter, 'DRI') * 0.18 + stat(shooter, 'PHY') * 0.10 + stat(shooter, 'PAC') * 0.07
  const goalkeeperPower = stat(goalkeeper, 'SAV') * 0.55 + stat(goalkeeper, 'GKA') * 0.30 + stat(goalkeeper, 'PHY') * 0.15

  // Long range GK goal attempts apply penalty modifier (-0.25) making GK goals rare miracles
  const scoringChance = contestProbability(finishing, goalkeeperPower, isGkShooter ? -0.25 : -0.09)
  const roll = random()
  if (roll >= scoringChance) return { type: 'save', team, minute, player: shooter, goalkeeper }
  
  const saveChance = 1 - scoringChance
  const error = saveChance >= 0.82
  const assist = creator.id !== shooter.id && action !== 'dribble' ? creator : null
  return { type: 'goal', team, minute, player: shooter, scorer: shooter, assist, goalkeeper, error: error ? 'goalkeeper_error' : null }
}

export function simulateMatchSequences(homePlayers, awayPlayers, options = {}) {
  const random = options.random || createSeededRandom(options.seed ?? 'football-match')
  // Increased default possessions for higher match tempo (36 -> 40)
  const possessions = options.possessions ?? 40
  const startMinute = options.startMinute ?? 1
  const endMinute = options.endMinute ?? 90
  const homeControl = teamControl(homePlayers)
  const awayControl = teamControl(awayPlayers)
  const homePossession = clamp(0.5 + (homeControl - awayControl) / 180 + 0.015, 0.35, 0.65)
  const events = []
  for (let index = 0; index < possessions; index += 1) {
    const homeAttacks = random() < homePossession
    const minute = Math.max(startMinute, Math.min(endMinute, Math.round(startMinute + ((index + random()) / possessions) * (endMinute - startMinute))))
    events.push(simulatePossession({ attacking: homeAttacks ? homePlayers : awayPlayers, defending: homeAttacks ? awayPlayers : homePlayers, team: homeAttacks ? 'home' : 'away', minute, random }))
  }
  return events.sort((a, b) => a.minute - b.minute)
}
