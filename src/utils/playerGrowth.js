import { calculateOVR, normalizeStats } from './stats'
import { getCoachEffects } from './coachEffects'

/**
 * Generates seasonal player stat adjustments (growth / decline) for ~10 random players.
 * Rating change per player is between -5 OVR and +5 OVR.
 * Stat changes are distributed across realistic attributes for the player's position.
 *
 * @param {Array} teams Array of team objects in the draft save
 * @param {Array} freeAgents Array of free agent player objects in the draft save
 * @param {number} count Number of players to adjust (default 10)
 * @returns {Object} { updatedTeams, updatedFreeAgents, seasonAdjustments }
 */
export function applySeasonalPlayerAdjustments(teams = [], freeAgents = [], count = 30) {
  // Collect all available players from teams and free agents
  const allPlayers = []

  teams.forEach(team => {
    (team.roster || []).forEach(player => {
      allPlayers.push({ player, teamId: team.club_id, isFreeAgent: false })
    })
  })

  freeAgents.forEach(player => {
    allPlayers.push({ player, teamId: null, isFreeAgent: true })
  })

  if (allPlayers.length === 0) {
    return { updatedTeams: teams, updatedFreeAgents: freeAgents, seasonAdjustments: [] }
  }

  // Adjust count random players ('all', number, or default 30)
  let selectedEntries = []
  if (count === 'all' || count === null || count === undefined || count >= allPlayers.length) {
    selectedEntries = [...allPlayers]
  } else {
    const numCount = Number(count) || 30
    selectedEntries = [...allPlayers].sort(() => Math.random() - 0.5).slice(0, Math.min(numCount, allPlayers.length))
  }

  const adjustmentsMap = new Map() // playerId -> adjustment record
  const seasonAdjustments = []

  selectedEntries.forEach(entry => {
    const { player, teamId, isFreeAgent } = entry
    const team = teamId ? teams.find(t => t.club_id === teamId) : null
    const oldStats = normalizeStats(player.stats)
    const oldOvr = player.ovr || calculateOVR(player.position, oldStats)

    const coachEffect = getCoachEffects(team?.coaches || [])
    // Coached players trend upward and are more stable. Free agents remain deliberately volatile.
    const minDelta = isFreeAgent ? -7 : coachEffect.hasCoach ? -3 : -6
    const maxDelta = isFreeAgent ? 5 : coachEffect.hasCoach ? 6 : 5
    const developmentBias = coachEffect.hasCoach ? Math.round(((coachEffect.MGT || 0) * 0.65 + (coachEffect.PHY || 0) * 0.35) / 4) : 0
    let deltaOvr = 0
    while (deltaOvr === 0) {
      deltaOvr = Math.max(minDelta, Math.min(maxDelta, Math.floor(Math.random() * (maxDelta - minDelta + 1)) + minDelta + developmentBias))
    }

    // Position-weighted probability pool for realistic growth/decline
    const WEIGHTED_POOLS = {
      GK:  ['SAV', 'SAV', 'SAV', 'SAV', 'GKA', 'GKA', 'GKA', 'PAS', 'PHY', 'PAC'],
      DEF: ['DEF', 'DEF', 'DEF', 'DEF', 'PHY', 'PHY', 'PHY', 'PAC', 'PAC', 'PAS', 'PAS', 'DRI', 'SHO'],
      MF:  ['PAS', 'PAS', 'PAS', 'DRI', 'DRI', 'DRI', 'DEF', 'DEF', 'PHY', 'PHY', 'PAC', 'SHO'],
      FWD: ['SHO', 'SHO', 'SHO', 'SHO', 'DRI', 'DRI', 'DRI', 'PAC', 'PAC', 'PHY', 'PHY', 'PAS', 'DEF'],
    }

    const statPool = WEIGHTED_POOLS[player.position] || WEIGHTED_POOLS.MF

    // Clone stats object to mutate
    const newStats = { ...oldStats }

    // Stat adjustment points approx deltaOvr * 2.2 distributed
    let pointsToDistribute = Math.round(deltaOvr * 2.2)
    const steps = Math.abs(pointsToDistribute)
    const stepDirection = deltaOvr > 0 ? 1 : -1

    for (let i = 0; i < steps; i++) {
      const targetStat = statPool[Math.floor(Math.random() * statPool.length)]
      const currentVal = newStats[targetStat] ?? 50
      // Elite ratings have diminishing returns: growth remains possible above
      // 100, but every additional point becomes progressively rarer.
      const growthChance = currentVal >= 120 ? 0.08 : currentVal >= 110 ? 0.2 : currentVal >= 100 ? 0.45 : currentVal >= 95 ? 0.75 : 1
      if (stepDirection > 0 && Math.random() > growthChance) continue
      const newVal = Math.max(30, Math.min(140, currentVal + stepDirection))
      newStats[targetStat] = newVal
    }

    const newOvr = calculateOVR(player.position, newStats)
    const actualDeltaOvr = newOvr - oldOvr

    const adjustmentRecord = {
      playerId: player.id,
      name: player.name,
      photo_url: player.photo_url || null,
      nationality: player.nationality || null,
      position: player.position,
      oldOvr,
      newOvr,
      deltaOvr: actualDeltaOvr,
      oldStats,
      newStats,
      clubName: team?.club_name || team?.name || null,
      clubBadge: team?.badge_url || null,
      developmentSource: isFreeAgent ? 'Free agent' : coachEffect.label,
    }

    adjustmentsMap.set(player.id, { newStats, newOvr, adjustmentRecord })
    seasonAdjustments.push(adjustmentRecord)
  })

  // Apply updates to teams
  const updatedTeams = teams.map(team => ({
    ...team,
    roster: (team.roster || []).map(player => {
      if (adjustmentsMap.has(player.id)) {
        const { newStats, newOvr } = adjustmentsMap.get(player.id)
        return {
          ...player,
          stats: newStats,
          ovr: newOvr,
        }
      }
      return player
    }),
  }))

  // Apply updates to free agents
  const updatedFreeAgents = freeAgents.map(player => {
    if (adjustmentsMap.has(player.id)) {
      const { newStats, newOvr } = adjustmentsMap.get(player.id)
      return {
        ...player,
        stats: newStats,
        ovr: newOvr,
      }
    }
    return player
  })

  // Sort adjustments by old OVR descending
  seasonAdjustments.sort((a, b) => b.oldOvr - a.oldOvr || b.newOvr - a.newOvr)

  return {
    updatedTeams,
    updatedFreeAgents,
    seasonAdjustments,
  }
}

export function applySeasonalCoachAdjustments(teams = [], freeAgents = [], count = 'all') {
  const entries = [
    ...teams.flatMap(team => (team.coaches || []).map(coach => ({ coach, teamId: team.club_id, clubName: team.club_name, clubBadge: team.badge_url }))),
    ...freeAgents.map(coach => ({ coach, teamId: null, clubName: null, clubBadge: null })),
  ]
  const selected = count === 'all' || Number(count) >= entries.length
    ? entries
    : [...entries].sort(() => Math.random() - 0.5).slice(0, Math.max(1, Number(count) || 10))
  const updates = new Map()
  const seasonAdjustments = selected.map(({ coach, clubName, clubBadge }) => {
    const oldStats = { ...coach.stats }
    const keys = ['TAC', 'MGT', 'MOT', 'ATT', 'DEF', 'PHY']
    const oldOvr = Number(coach.ovr) || Math.round(keys.reduce((sum, key) => sum + Number(oldStats[key] || 70), 0) / keys.length)
    const newStats = { ...oldStats }
    const direction = Math.random() < 0.62 ? 1 : -1
    const steps = Math.floor(Math.random() * 5) + 2
    for (let index = 0; index < steps; index += 1) {
      const key = keys[Math.floor(Math.random() * keys.length)]
      const current = Number(newStats[key] || 70)
      const growthChance = current >= 120 ? 0.08 : current >= 110 ? 0.2 : current >= 100 ? 0.45 : 1
      if (direction > 0 && Math.random() > growthChance) continue
      newStats[key] = Math.max(30, Math.min(140, current + direction))
    }
    const newOvr = Math.round(keys.reduce((sum, key) => sum + Number(newStats[key] || 70), 0) / keys.length)
    updates.set(String(coach.id), { newStats, newOvr })
    return {
      playerId: coach.id, name: coach.name, photo_url: coach.photo_url || null,
      nationality: coach.nationality || null, position: 'COACH', oldOvr, newOvr,
      deltaOvr: newOvr - oldOvr, oldStats, newStats, clubName, clubBadge,
      developmentSource: clubName ? 'Club coach' : 'Free agent',
    }
  }).sort((a, b) => b.oldOvr - a.oldOvr)
  const apply = coach => {
    const update = updates.get(String(coach.id))
    return update ? { ...coach, stats: update.newStats, ovr: update.newOvr } : coach
  }
  return {
    updatedTeams: teams.map(team => ({ ...team, coaches: (team.coaches || []).map(apply) })),
    updatedFreeAgents: freeAgents.map(apply),
    seasonAdjustments,
  }
}
