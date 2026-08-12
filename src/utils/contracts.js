export const DEFAULT_CONTRACT_SEASONS = 3
export const CONTRACT_ADMIN_FEE = 500_000

export function contractFeeFor(annualWage, seasons, { freeAgent = false } = {}) {
  const wage = Math.max(0, Number(annualWage) || 0)
  const years = Math.max(0, Math.round(Number(seasons) || 0))
  if (!years) return 0
  return Math.round(wage * years * (freeAgent ? 0.25 : 0.15) + CONTRACT_ADMIN_FEE)
}
export const DEFAULT_EXTERNAL_INCOME = {
  league: { min: 55_000_000, max: 85_000_000 },
  cup: { min: 15_000_000, max: 35_000_000 },
}

export function marketValueForOvr(ovrValue, isCoach = false) {
  const ovr = Math.max(50, Number(ovrValue) || 70)
  const playerBands = [[70, 15], [75, 25], [80, 35], [85, 55], [90, 90], [95, 160], [100, 240]]
  const coachBands = [[70, 2], [75, 3], [80, 5], [85, 8], [90, 12], [95, 18], [100, 25]]
  const bands = isCoach ? coachBands : playerBands
  const upperIndex = bands.findIndex(([rating]) => ovr <= rating)
  if (upperIndex <= 0) return bands[0][1] * 1_000_000
  if (upperIndex < 0) return bands.at(-1)[1] * 1_000_000
  const [lowerOvr, lowerValue] = bands[upperIndex - 1]
  const [upperOvr, upperValue] = bands[upperIndex]
  const interpolated = lowerValue + ((ovr - lowerOvr) / (upperOvr - lowerOvr)) * (upperValue - lowerValue)
  return Math.round(interpolated) * 1_000_000
}

export function annualWageFor(person) {
  const stats = person?.stats || {}
  const coachStats = ['TAC', 'MGT', 'MOT', 'ATT', 'DEF', 'PHY']
    .map(key => Number(stats[key] ?? person?.[`stat_${key.toLowerCase()}`]))
    .filter(Number.isFinite)
  const isCoach = !person?.position && coachStats.length > 0
  const calculatedCoachOvr = coachStats.length
    ? Math.round(coachStats.reduce((sum, value) => sum + value, 0) / coachStats.length)
    : 0
  const ovr = Number(person?.ovr_v2 ?? person?.ovr) || calculatedCoachOvr
  const marketWage = (Number(person?.market_value) || 0) * 0.08

  if (!ovr) {
    return Math.max(500_000, Math.round(marketWage / 100_000) * 100_000)
  }

  const ratingAbove70 = Math.max(0, ovr - 70)
  const eliteRating = Math.max(0, ovr - 85)
  const ovrWage = isCoach
    ? 500_000 + ratingAbove70 * 150_000 + eliteRating * 200_000
    : 500_000 + ratingAbove70 * 300_000 + eliteRating * 400_000
  const blendedWage = ovrWage * 0.7 + marketWage * 0.3

  return Math.max(500_000, Math.round(blendedWage / 100_000) * 100_000)
}

export function withDefaultContract(person, seasons = DEFAULT_CONTRACT_SEASONS) {
  return {
    ...person,
    contract: {
      ...(person?.contract || {}),
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

function randomIncome(range, random) {
  const min = Math.max(0, Math.min(Number(range?.min) || 0, Number(range?.max) || 0))
  const max = Math.max(min, Number(range?.max) || Number(range?.min) || 0)
  const step = 1_000_000
  return Math.round((min + random() * (max - min)) / step) * step
}

export function applyExternalCompetitionIncome(teams = [], previousSeason, cups = [], ranges, random = Math.random) {
  if (!previousSeason) return { teams, incomes: [] }
  const configured = ranges || previousSeason?.prizeSettings?.externalIncome || DEFAULT_EXTERNAL_INCOME
  const leagueIds = new Set((previousSeason.teamIds || []).map(String))
  const relevantCups = cups.filter(cup => String(cup.seasonId) === String(previousSeason.id))
  const cupIds = new Set(relevantCups.flatMap(cup => [
    ...(cup.qualifiedIds || []), ...(cup.invitedIds || []),
    ...Object.values(cup.rounds || {}).flat().flatMap(match => [match?.home, match?.away]),
  ]).filter(Boolean).map(String))
  const incomes = []
  const updatedTeams = teams.map(team => {
    const clubId = String(team.club_id)
    const leagueIncome = leagueIds.has(clubId) ? 0 : randomIncome(configured.league || DEFAULT_EXTERNAL_INCOME.league, random)
    const cupIncome = cupIds.has(clubId) ? 0 : randomIncome(configured.cup || DEFAULT_EXTERNAL_INCOME.cup, random)
    const amount = leagueIncome + cupIncome
    if (amount) incomes.push({ clubId: team.club_id, clubName: team.club_name, amount, leagueIncome, cupIncome })
    return { ...team, budget: (Number(team.budget) || 0) + amount }
  })
  return { teams: updatedTeams, incomes }
}
