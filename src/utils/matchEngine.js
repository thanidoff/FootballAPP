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
  return clamp(0.5 + (attack - defense) / 120 + modifier, 0.08, 0.92)
}

function teamControl(players) {
  return average(players, 'PAS') * 0.40 + average(players, 'DRI') * 0.25 + average(players, 'DEF') * 0.15 + average(players, 'PAC') * 0.10 + average(players, 'PHY') * 0.10
}

function creatorWeight(player) {
  return ({ MF: 0.45, DEF: 0.25, FWD: 0.25, GK: 0.05 }[player.position] || 0.1) * (0.5 + stat(player, 'PAS') / 100)
}

function shooterWeight(player) {
  const position = { FWD: 1.60, MF: 1, DEF: 0.45, GK: 0.05 }[player.position] || 0.5
  return position * (stat(player, 'SHO') * 0.55 + stat(player, 'DRI') * 0.25 + stat(player, 'PAC') * 0.15 + stat(player, 'PHY') * 0.05)
}

export function simulatePossession({ attacking, defending, team, minute, random }) {
  const creator = weightedPick(attacking, creatorWeight, random)
  const defender = weightedPick(defending.filter(player => player.position !== 'GK'), player => stat(player, 'DEF') * 0.6 + stat(player, 'PHY') * 0.4, random)
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
  const buildupChance = contestProbability(attackPower, defensePower)
  if (random() > buildupChance) return { type: action === 'dribble' ? 'dispossessed' : 'bad_pass', team, minute, player: creator, opponent: defender }

  const shooter = weightedPick(attacking, shooterWeight, random)
  const blocker = weightedPick(defending.filter(player => player.position !== 'GK'), player => stat(player, 'DEF') + stat(player, 'PHY') * 0.4, random)
  const goalkeeper = defending.find(player => player.position === 'GK') || defending.at(-1)
  const preparation = stat(shooter, 'SHO') * 0.45 + stat(shooter, 'DRI') * 0.35 + stat(shooter, 'PAC') * 0.20
  const blockPower = stat(blocker, 'DEF') * 0.55 + stat(blocker, 'PHY') * 0.25 + stat(blocker, 'PAC') * 0.20
  const blockChance = clamp(0.34 + (blockPower - preparation) / 180, 0.08, 0.68)
  if (random() < blockChance) return { type: 'blocked_shot', team, minute, player: shooter, opponent: blocker }

  const pressure = Math.max(0, blockPower - preparation) * 0.18
  const accuracy = stat(shooter, 'SHO') * 0.65 + stat(shooter, 'DRI') * 0.20 + stat(shooter, 'PAC') * 0.05 - pressure
  const onTargetChance = clamp(0.32 + accuracy / 180, 0.18, 0.88)
  if (random() > onTargetChance) {
    const misses = ['shot_wide', 'shot_over', 'hit_post']
    return { type: misses[Math.min(misses.length - 1, Math.floor(random() * misses.length))], team, minute, player: shooter }
  }

  const finishing = stat(shooter, 'SHO') * 0.60 + stat(shooter, 'DRI') * 0.20 + stat(shooter, 'PHY') * 0.10 + stat(shooter, 'PAC') * 0.10
  const goalkeeperPower = stat(goalkeeper, 'SAV') * 0.65 + stat(goalkeeper, 'GKA') * 0.25 + stat(goalkeeper, 'PHY') * 0.10
  const scoringChance = contestProbability(finishing, goalkeeperPower, -0.16)
  const roll = random()
  if (roll >= scoringChance) return { type: 'save', team, minute, player: shooter, goalkeeper }
  const saveChance = 1 - scoringChance
  const error = saveChance >= 0.8
  const assist = creator.id !== shooter.id && action !== 'dribble' ? creator : null
  return { type: 'goal', team, minute, player: shooter, scorer: shooter, assist, goalkeeper, error: error ? 'goalkeeper_error' : null }
}

export function simulateMatchSequences(homePlayers, awayPlayers, options = {}) {
  const random = options.random || createSeededRandom(options.seed ?? 'football-match')
  const possessions = options.possessions ?? 36
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
