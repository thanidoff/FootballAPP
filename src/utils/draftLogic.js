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
  // We need to keep track of players who have been drafted
  const availablePlayers = [...allPlayers]
  
  const draftedTeams = clubs.map(club => {
    // Generate an isolated team state
    const teamState = {
      club_id: club.id,
      club_name: club.name,
      badge_url: club.badge_url,
      badge_color: club.badge_color,
      budget: startingBudget,
      roster: []
    }
    return teamState
  })

  // Perform the draft
  return rollDraft(draftedTeams, availablePlayers)
}

export function rollDraft(currentTeams, currentAvailablePlayers, targetTeamIndex = null) {
  let newTeams = JSON.parse(JSON.stringify(currentTeams))
  let availablePlayers = [...currentAvailablePlayers]

  // If rolling specific team, return its current roster to the available pool
  if (targetTeamIndex !== null) {
    const teamToReset = newTeams[targetTeamIndex]
    availablePlayers.push(...teamToReset.roster)
    teamToReset.roster = []
  } else {
    // Re-roll all: Return all rosters to pool
    for (let team of newTeams) {
      availablePlayers.push(...team.roster)
      team.roster = []
    }
  }

  // Shuffle available pool to ensure randomness
  availablePlayers = shuffle(availablePlayers)

  // Determine which teams need drafting
  const teamsToDraft = targetTeamIndex !== null ? [targetTeamIndex] : newTeams.map((_, i) => i)

  for (let tIndex of teamsToDraft) {
    const team = newTeams[tIndex]
    
    // Requirements: 1 GK, 1 DEF, 1 MF, 1 FWD, 1 Any
    const positionsNeeded = ['GK', 'DEF', 'MF', 'FWD', 'ANY']
    
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

export function simulateMatch(homeTeam, awayTeam) {
  // Simple calculation based on Avg OVR
  const homeAvg = homeTeam.roster.reduce((sum, p) => sum + p.ovr, 0) / (homeTeam.roster.length || 1)
  const awayAvg = awayTeam.roster.reduce((sum, p) => sum + p.ovr, 0) / (awayTeam.roster.length || 1)

  // Home advantage + random dice roll
  const homeAdvantage = 2
  const homeScoreBase = Math.max(0, (homeAvg + homeAdvantage - awayAvg) / 10)
  const awayScoreBase = Math.max(0, (awayAvg - homeAvg) / 10)

  // Add random element (0 to 3 goals)
  const homeScore = Math.floor(homeScoreBase + Math.random() * 4)
  const awayScore = Math.floor(awayScoreBase + Math.random() * 4)

  return { homeScore, awayScore }
}
