import { calculateOVR, normalizeStats } from './stats'

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

    // Generate delta between -5 and +5 (excluding 0 for meaningful change)
    let deltaOvr = 0
    while (deltaOvr === 0) {
      deltaOvr = Math.floor(Math.random() * 11) - 5 // -5 to +5
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
