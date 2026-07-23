import { MOCK_PLAYERS } from '../data/mockGameData'
import { simulateMatchSequences } from './matchEngine'

// Shuffle array using Fisher-Yates
function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr
}

export function generateInitialDraft(clubs, allPlayers, startingBudget) {
  const lockedIds = new Set(clubs.flatMap(club => (club.startingRoster || []).map(player => player.id)))
  const availablePlayers = allPlayers.filter(player => !lockedIds.has(player.id))
  
  const draftedTeams = clubs.map(club => {
    // Generate an isolated team state
    const teamState = {
      club_id: club.id,
      club_name: club.name,
      badge_url: club.badge_url,
      badge_color: club.badge_color,
      budget: club.startingBudget ?? startingBudget ?? 0,
      roster: [...(club.startingRoster || [])],
      locked_player_ids: (club.startingRoster || []).map(player => player.id),
    }
    return teamState
  })

  return rollDraft(draftedTeams, availablePlayers)
}

export function rollDraft(currentTeams, currentAvailablePlayers, targetTeamIndex = null) {
  let newTeams = JSON.parse(JSON.stringify(currentTeams))
  let availablePlayers = [...currentAvailablePlayers]

  // If rolling specific team, return its current roster to the available pool
  if (targetTeamIndex !== null) {
    const teamToReset = newTeams[targetTeamIndex]
    const lockedIds = new Set(teamToReset.locked_player_ids || [])
    availablePlayers.push(...teamToReset.roster.filter(player => !lockedIds.has(player.id)))
    teamToReset.roster = teamToReset.roster.filter(player => lockedIds.has(player.id))
  } else {
    // Re-roll all: Return all rosters to pool
    for (let team of newTeams) {
      const lockedIds = new Set(team.locked_player_ids || [])
      availablePlayers.push(...team.roster.filter(player => !lockedIds.has(player.id)))
      team.roster = team.roster.filter(player => lockedIds.has(player.id))
    }
  }

  // Shuffle available pool to ensure randomness
  availablePlayers = shuffle(availablePlayers)

  // Determine which teams need drafting
  const teamsToDraft = targetTeamIndex !== null ? [targetTeamIndex] : newTeams.map((_, i) => i)

  for (let tIndex of teamsToDraft) {
    const team = newTeams[tIndex]
    
    const positionsNeeded = ['GK', 'DEF', 'MF', 'FWD']
    for (const player of team.roster) {
      const coveredIndex = positionsNeeded.indexOf(player.position)
      if (coveredIndex !== -1) positionsNeeded.splice(coveredIndex, 1)
    }
    while (positionsNeeded.length < Math.max(0, 5 - team.roster.length)) positionsNeeded.push('ANY')
    
    for (const posReq of positionsNeeded) {
      let foundIndex = -1
      
      if (posReq === 'ANY') {
        foundIndex = Math.floor(Math.random() * availablePlayers.length)
      } else {
        foundIndex = availablePlayers.findIndex(p => p.position === posReq)
      }

      // Fallback: If not enough players for that position (rare), just pick a random one
      if (foundIndex === -1 && availablePlayers.length > 0) {
         foundIndex = Math.floor(Math.random() * availablePlayers.length)
      }

      if (foundIndex !== -1) {
        team.roster.push(availablePlayers[foundIndex])
        availablePlayers.splice(foundIndex, 1) // Remove from pool
      }
    }
  }

  return { newTeams, remainingPlayers: availablePlayers }
}

export function generateSchedule(teamIds) {
  const ids = [...teamIds]
  if (ids.length % 2 !== 0) {
    ids.push(null) // Bye week
  }
  
  const totalRounds = ids.length - 1
  const matchesPerRound = ids.length / 2
  const schedule = []

  // Generate First Half of Season (Home)
  for (let round = 0; round < totalRounds; round++) {
    const roundMatches = []
    for (let match = 0; match < matchesPerRound; match++) {
      const home = ids[match]
      const away = ids[ids.length - 1 - match]
      if (home !== null && away !== null) {
        roundMatches.push({ home, away, played: false, homeScore: 0, awayScore: 0 })
      }
    }
    schedule.push({ week: round + 1, matches: roundMatches })
    // Rotate array, keeping the first element fixed
    ids.splice(1, 0, ids.pop())
  }

  // Generate Second Half of Season (Away)
  const secondHalf = schedule.map(round => ({
    week: round.week + totalRounds,
    matches: round.matches.map(m => ({ home: m.away, away: m.home, played: false, homeScore: 0, awayScore: 0 }))
  }))

  return [...schedule, ...secondHalf]
}

export function generateMockRoster(club, strengthOffset = 0) {
  const positions = ['GK', 'DEF', 'MF', 'MF', 'FWD']
  return positions.map((position, index) => {
    const template = MOCK_PLAYERS.find(player => player.position === position) || MOCK_PLAYERS[index]
    return {
      ...template,
      id: `${club.id}-generated-player-${index + 1}`,
      name: `${club.short_name || club.name.slice(0, 3).toUpperCase()} Player ${index + 1}`,
      club_id: club.id,
      ovr: Math.max(65, (template.ovr || 70) - strengthOffset),
      stats: template.stats || {
        PAC: template.stat_pac, SHO: template.stat_sho, PAS: template.stat_pas,
        DRI: template.stat_dri, DEF: template.stat_def, PHY: template.stat_phy,
        DIV: template.stat_div, HAN: template.stat_han, KIC: template.stat_kic,
        REF: template.stat_ref, SPD: template.stat_spd, POS: template.stat_pos,
      },
    }
  })
}

export function simulateMatch(homeTeam, awayTeam, seed = `${homeTeam.club_id}-${awayTeam.club_id}`) {
  const events = simulateMatchSequences((homeTeam.roster || []).slice(0, 5), (awayTeam.roster || []).slice(0, 5), { seed, possessions: 36 })
  return {
    homeScore: events.filter(event => event.type === 'goal' && event.team === 'home').length,
    awayScore: events.filter(event => event.type === 'goal' && event.team === 'away').length,
    events,
  }
}
