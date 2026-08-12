export const DEFAULT_CONTRACT_SEASONS = 3

export function annualWageFor(person) {
  return Math.max(500_000, Math.round((Number(person?.market_value) || 0) * 0.08 / 100_000) * 100_000)
}

export function withDefaultContract(person, seasons = DEFAULT_CONTRACT_SEASONS) {
  return {
    ...person,
    contract: {
      seasonsRemaining: Number(person?.contract?.seasonsRemaining ?? seasons),
      annualWage: Number(person?.contract?.annualWage ?? annualWageFor(person)),
    },
  }
}

export function processSeasonContracts(teams = [], freeAgents = [], freeAgentCoaches = []) {
  const releasedPlayers = []
  const releasedCoaches = []
  const payrolls = []
  const updatedTeams = teams.map(team => {
    let payroll = 0
    const roster = (team.roster || []).map(person => withDefaultContract(person)).filter(person => {
      payroll += person.contract.annualWage
      person.contract = { ...person.contract, seasonsRemaining: person.contract.seasonsRemaining - 1 }
      if (person.contract.seasonsRemaining <= 0) {
        releasedPlayers.push({ ...person, club_id: null, club: null, contract: null })
        return false
      }
      return true
    })
    const coaches = (team.coaches || []).map(person => withDefaultContract(person)).filter(person => {
      payroll += person.contract.annualWage
      person.contract = { ...person.contract, seasonsRemaining: person.contract.seasonsRemaining - 1 }
      if (person.contract.seasonsRemaining <= 0) {
        releasedCoaches.push({ ...person, club_id: null, club: null, contract: null })
        return false
      }
      return true
    })
    payrolls.push({ clubId: team.club_id, clubName: team.club_name, amount: payroll })
    return { ...team, roster, coaches, budget: (Number(team.budget) || 0) - payroll }
  })
  return {
    teams: updatedTeams,
    freeAgents: [...freeAgents, ...releasedPlayers],
    freeAgentsCoaches: [...freeAgentCoaches, ...releasedCoaches],
    releasedPlayers,
    releasedCoaches,
    payrolls,
  }
}
