import { beforeEach, describe, expect, it } from 'vitest'
import { MOCK_CLUBS, MOCK_PLAYERS } from '../data/mockGameData'
import { generateMockRoster, generateSchedule } from '../utils/draftLogic'
import { annualWageFor, applyExternalCompetitionIncome, contractFeeFor, processSeasonContracts, withDefaultContract } from '../utils/contracts'
import {
  completeDraftCupMatch,
  completeDraftNationalCupMatch,
  completeDraftMatch,
  createDraftState,
  createDraftNationalCup,
  finalizeDraftSeasonAwards,
  loadDraftState,
  transferDraftCoach,
  transferDraftPlayer,
  updateDraftState,
} from '../services/draftSave'

const emptyStats = () => ({ PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 })

function makeTeams(count = 5) {
  return MOCK_CLUBS.slice(0, count).map((club, index) => ({
    club_id: club.id,
    club_name: club.name,
    badge_url: club.badge_url,
    badge_color: club.badge_color,
    budget: 500_000_000,
    roster: MOCK_PLAYERS.slice(index * 5, index * 5 + 5).map(player => ({ ...player, club_id: club.id })),
    stats: emptyStats(),
  }))
}

describe('complete career simulation', () => {
  beforeEach(() => localStorage.clear())

  it('runs transfers, a 5-team double round robin, and an 8-team cup to completion', async () => {
    const generatedRoster = generateMockRoster(MOCK_CLUBS[7])
    expect(generatedRoster).toHaveLength(5)
    expect(new Set(generatedRoster.map(player => player.id)).size).toBe(5)
    expect(generatedRoster.map(player => player.position)).toEqual(['GK', 'DEF', 'MF', 'MF', 'FWD'])

    const leagueTeams = makeTeams(5)
    const outsider = {
      club_id: MOCK_CLUBS[5].id,
      club_name: MOCK_CLUBS[5].name,
      badge_color: MOCK_CLUBS[5].badge_color,
      budget: 500_000_000,
      roster: [],
      stats: emptyStats(),
    }
    const freeAgents = MOCK_PLAYERS.slice(25)
    const teamIds = leagueTeams.map(team => team.club_id)
    const schedule = generateSchedule(teamIds)
    const customLeaguePrizes = {
      placements: [111_000_000, 77_000_000, 55_000_000, 33_000_000, 22_000_000],
      awards: { topScorers: 17_000_000, topAssists: 16_000_000, mostMvps: 18_000_000 },
      matchPrizes: { win: 7_000_000, draw: 4_000_000, loss: 1_000_000 },
    }
    const customCupPrizes = [88_000_000, 66_000_000, 44_000_000, 33_000_000, 22_000_000, 16_000_000, 12_000_000, 10_000_000]
    const customCupMatchPrizes = { win: 9_000_000, loss: 4_000_000 }
    const saveId = await createDraftState({
      name: 'Automated full-season QA',
      teams: [...leagueTeams, outsider],
      freeAgents,
      currentWeek: 1,
      settings: {
        seasons: [{
          id: 1,
          teamIds,
          matches: schedule,
          stats: { topScorers: {}, topAssists: {}, mostMvps: {}, mostFouls: {} },
          prizeSettings: customLeaguePrizes,
          status: 'active',
        }],
        cups: [],
      },
    })

    const signing = freeAgents[0]
    const negotiatedFee = 60_500_000
    let state = await transferDraftPlayer(saveId, signing.id, teamIds[0], negotiatedFee)
    expect(state.teams[0].roster.some(player => player.id === signing.id)).toBe(true)
    expect(state.teams[0].roster.find(player => player.id === signing.id).market_value).toBe(signing.market_value)
    const signingFee = contractFeeFor(annualWageFor(signing), 3, { freeAgent: true })
    expect(state.teams[0].budget).toBe(500_000_000 - signingFee)
    expect(state.freeAgents.some(player => player.id === signing.id)).toBe(false)
    expect(state.transferHistory).toHaveLength(1)

    // A solvent club may complete one deal that takes it into debt, but cannot
    // make another signing until its balance recovers.
    state.teams[0].budget = 1_000_000
    await updateDraftState(saveId, state)
    state = await transferDraftPlayer(saveId, freeAgents[1].id, teamIds[0], 20_000_000)
    const secondSigningFee = contractFeeFor(annualWageFor(freeAgents[1]), 3, { freeAgent: true })
    expect(state.teams[0].budget).toBe(1_000_000 - secondSigningFee)
    await expect(transferDraftPlayer(saveId, freeAgents[2].id, teamIds[0], 1_000_000))
      .rejects.toThrow('in debt')

    for (let week = 1; week <= schedule.length; week += 1) {
      state = await loadDraftState(saveId)
      const activeSeason = state.settings.seasons.find(season => season.status === 'active')
      const matches = activeSeason.matches.find(item => item.week === week).matches
      for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index]
        const home = state.teams.find(team => team.club_id === match.home) || state.teams[0]
        const away = state.teams.find(team => team.club_id === match.away) || state.teams[1]
        const homeBudgetBefore = home.budget
        const awayBudgetBefore = away.budget
        const scorer = home.roster[0]
        const assist = home.roster[1]
        const fouler = away.roster[0]
        const completedMatchState = await completeDraftMatch(saveId, week, index, {
          homeScore: (week + index) % 4,
          awayScore: (week * 2 + index) % 3,
          events: [
            { type: 'goal', player: scorer, assist },
            { type: 'foul', player: fouler },
          ],
          mvp: scorer,
        })
        if (week === 1 && index === 0) {
          expect(completedMatchState.teams.find(team => team.club_id === home.club_id).budget).toBe(homeBudgetBefore + customLeaguePrizes.matchPrizes.loss)
          expect(completedMatchState.teams.find(team => team.club_id === away.club_id).budget).toBe(awayBudgetBefore + customLeaguePrizes.matchPrizes.win)
        }
        if (week === 1 && index === 0) {
          await expect(completeDraftMatch(saveId, week, index, {
            homeScore: 9, awayScore: 0, events: [], mvp: null,
          })).rejects.toThrow('already been completed')
        }
      }
      state = await loadDraftState(saveId)
      if (week < schedule.length) expect(state.currentWeek).toBe(week + 1)
    }

    state = await loadDraftState(saveId)
    const season = state.settings.seasons[0]
    expect(season.status).toBe('completed')
    expect(season.matches).toHaveLength(11)
    expect(season.matches.flatMap(week => week.matches)).toHaveLength(21)
    expect(season.matches.flatMap(week => week.matches).every(match => match.played)).toBe(true)
    expect(season.standings).toHaveLength(5)
    expect(season.standings.some(row => row.club_id === outsider.club_id)).toBe(false)
    expect(season.standings.every(row => row.stats.W + row.stats.D + row.stats.L === 8)).toBe(true)
    expect(season.champion).toBe(season.standings[0].club_id)
    expect(season.prizesPaidAt).toBeTruthy()
    expect(season.prizePayouts.filter(payout => payout.type === 'placement')).toHaveLength(5)
    expect(season.prizePayouts.filter(payout => payout.type === 'player_award')).toHaveLength(0)
    expect(season.prizePayouts.find(payout => payout.label === 'League position 1').amount).toBe(customLeaguePrizes.placements[0])
    expect(Object.values(season.stats.topScorers).reduce((sum, value) => sum + value, 0)).toBe(21)
    expect(Object.values(season.stats.topAssists).reduce((sum, value) => sum + value, 0)).toBe(21)
    const historicalPlayerId = Object.keys(season.stats.topScorers)[0]
    const historicalSnapshot = season.stats.playerSnapshots[historicalPlayerId]
    expect(historicalSnapshot.club.id).toBeTruthy()
    expect(historicalSnapshot.nationality).toBeTruthy()

    const destination = state.teams.find(team => team.club_id !== historicalSnapshot.club.id)
    await transferDraftPlayer(saveId, historicalPlayerId, destination.club_id, 1_000_000)
    state = await loadDraftState(saveId)
    expect(state.settings.seasons[0].stats.playerSnapshots[historicalPlayerId].club.id)
      .toBe(historicalSnapshot.club.id)
    expect(Object.values(season.stats.mostFouls).reduce((sum, value) => sum + value, 0)).toBe(21)
    expect(Object.values(season.stats.mostMvps).reduce((sum, value) => sum + value, 0)).toBe(21)

    const cupTeamIds = MOCK_CLUBS.map(club => club.id)
    const qfMatches = Array.from({ length: 4 }, (_, index) => ({
      home: cupTeamIds[index * 2], away: cupTeamIds[index * 2 + 1], played: false,
    }))
    await updateDraftState(saveId, {
      ...state,
      settings: {
        ...state.settings,
        cups: [{ id: 1, seasonId: 1, teamIds: cupTeamIds, status: 'active', round: 1, rounds: { 1: qfMatches }, prizeSettings: customCupPrizes, matchPrizes: customCupMatchPrizes }],
      },
    })

    for (let round = 1; round <= 3; round += 1) {
      state = await loadDraftState(saveId)
      const cup = state.settings.cups[0]
      const roundMatches = cup.rounds[round]
      for (let index = 0; index < roundMatches.length; index += 1) {
        const isFinal = round === 3
        const cupHomeBudgetBefore = state.teams.find(team => team.club_id === roundMatches[index].home)?.budget
        const cupAwayBudgetBefore = state.teams.find(team => team.club_id === roundMatches[index].away)?.budget
        const cupStatPayload = round === 1 && index === 0 ? {
          events: [{ type: 'goal', player: leagueTeams[0].roster[0], assist: leagueTeams[0].roster[1], team: 'home' }],
          mvp: leagueTeams[0].roster[0],
        } : { events: [] }
        const completedCupMatchState = await completeDraftCupMatch(saveId, round, index, isFinal
          ? { homeScore: 1, awayScore: 1, penaltyWinner: roundMatches[index].away, ...cupStatPayload }
          : { homeScore: 2, awayScore: 1, ...cupStatPayload })
        if (round === 1 && index === 0) {
          expect(completedCupMatchState.teams.find(team => team.club_id === roundMatches[index].home).budget).toBe(cupHomeBudgetBefore + customCupMatchPrizes.win)
          expect(completedCupMatchState.teams.find(team => team.club_id === roundMatches[index].away).budget).toBe(cupAwayBudgetBefore + customCupMatchPrizes.loss)
        }
        if (round === 1 && index === 0) {
          await expect(completeDraftCupMatch(saveId, round, index, {
            homeScore: 4, awayScore: 0, events: [],
          })).rejects.toThrow('already been completed')
        }
      }
    }

    state = await loadDraftState(saveId)
    const cup = state.settings.cups[0]
    expect(cup.status).toBe('completed')
    expect(cup.rounds[1]).toHaveLength(4)
    expect(cup.rounds[2]).toHaveLength(2)
    expect(cup.rounds[3]).toHaveLength(1)
    expect(cup.rounds[3][0].decidedOnPenalties).toBe(true)
    expect(cup.rounds[3][0].penalties).toEqual({ home: 4, away: 5 })
    expect(cup.champion).toBe(cup.rounds[3][0].away)
    expect(cup.prizesPaidAt).toBeTruthy()
    expect(cup.prizePayouts).toHaveLength(8)
    expect(cup.prizePayouts.map(payout => payout.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(cup.prizePayouts[0].amount).toBe(customCupPrizes[0])
    const completedSeason = state.settings.seasons[0]
    expect(completedSeason.prizePayouts.filter(payout => payout.type === 'player_award')).toHaveLength(3)
    expect(completedSeason.prizePayouts.filter(payout => payout.type === 'player_award').every(payout => payout.scope === 'all_competitions')).toBe(true)
    expect(completedSeason.awardsPaidAt).toBeTruthy()
    expect(completedSeason.prizePayouts.find(payout => payout.label === 'Top Scorer').amount).toBe(customLeaguePrizes.awards.topScorers)
    expect(completedSeason.prizePayouts.find(payout => payout.label === 'Top Assists').amount).toBe(customLeaguePrizes.awards.topAssists)
    expect(completedSeason.prizePayouts.find(payout => payout.label === 'Most MVP').amount).toBe(customLeaguePrizes.awards.mostMvps)
    expect(Object.values(completedSeason.stats.topScorers).reduce((sum, value) => sum + value, 0)).toBe(22)
    expect(Object.values(completedSeason.stats.topAssists).reduce((sum, value) => sum + value, 0)).toBe(22)
    expect(Object.values(completedSeason.stats.mostMvps).reduce((sum, value) => sum + value, 0)).toBe(22)
  })

  it('plays three consecutive seasons with transfers, payrolls, expiry, and outside income', async () => {
    const teams = makeTeams(6).map(team => ({
      ...team,
      budget: 150_000_000,
      roster: team.roster.map(player => withDefaultContract(player, 3)),
      coaches: [],
    }))
    const leagueIds = teams.slice(0, 5).map(team => team.club_id)
    const outsideId = teams[5].club_id
    const externalRange = {
      league: { min: 60_000_000, max: 60_000_000 },
      cup: { min: 20_000_000, max: 20_000_000 },
    }
    const saveId = await createDraftState({
      name: 'Three season regression',
      teams,
      freeAgents: MOCK_PLAYERS.slice(30).map(player => ({ ...player, club_id: null })),
      currentWeek: 1,
      settings: { seasons: [], cups: [] },
    })

    for (let seasonNumber = 1; seasonNumber <= 3; seasonNumber += 1) {
      let state = await loadDraftState(saveId)
      const schedule = generateSchedule(leagueIds)
      state.settings.seasons.push({
        id: seasonNumber,
        teamIds: leagueIds,
        matches: schedule,
        stats: { topScorers: {}, topAssists: {}, mostMvps: {}, mostFouls: {} },
        prizeSettings: {
          placements: [100_000_000, 70_000_000, 50_000_000, 30_000_000, 20_000_000],
          awards: { topScorers: 15_000_000, topAssists: 15_000_000, mostMvps: 15_000_000 },
          matchPrizes: { win: 5_000_000, draw: 3_000_000, loss: 2_000_000 },
          externalIncome: externalRange,
        },
        status: 'active',
      })
      state.currentWeek = 1
      await updateDraftState(saveId, state)

      for (let week = 1; week <= schedule.length; week += 1) {
        for (let index = 0; index < schedule[week - 1].matches.length; index += 1) {
          state = await loadDraftState(saveId)
          const match = state.settings.seasons.at(-1).matches[week - 1].matches[index]
          const home = state.teams.find(team => team.club_id === match.home) || state.teams[0]
          const away = state.teams.find(team => team.club_id === match.away) || state.teams[1]
          await completeDraftMatch(saveId, week, index, {
            homeScore: (seasonNumber + week + index) % 4,
            awayScore: (seasonNumber * 2 + week + index) % 3,
            events: [{ type: 'goal', player: home.roster[0], assist: home.roster[1] }],
            mvp: away.roster[0],
          })
        }
      }

      state = await loadDraftState(saveId)
      expect(state.settings.seasons.at(-1).status).toBe('completed')
      expect(state.settings.seasons.at(-1).standings).toHaveLength(5)
      expect(state.settings.seasons.at(-1).prizesPaidAt).toBeTruthy()

      const movable = state.teams[0].roster.at(-1)
      const destination = state.teams[1]
      if (destination.budget < 0) destination.budget = 1_000_000
      await updateDraftState(saveId, state)
      state = await transferDraftPlayer(saveId, movable.id, destination.club_id, 1_000_000, 3)
      expect(state.teams[1].roster.some(player => player.id === movable.id)).toBe(true)

      const contracts = processSeasonContracts(state.teams, state.freeAgents, state.freeAgentsCoaches || [])
      const external = applyExternalCompetitionIncome(
        contracts.teams,
        state.settings.seasons.at(-1),
        state.settings.cups,
        externalRange,
        () => 0.5,
      )
      const outsiderBefore = contracts.teams.find(team => team.club_id === outsideId).budget
      const outsiderAfter = external.teams.find(team => team.club_id === outsideId).budget
      expect(outsiderAfter - outsiderBefore).toBe(80_000_000)
      state.teams = external.teams
      state.freeAgents = contracts.freeAgents
      state.freeAgentsCoaches = contracts.freeAgentsCoaches
      await updateDraftState(saveId, state)
    }

    const finalState = await loadDraftState(saveId)
    expect(finalState.settings.seasons).toHaveLength(3)
    expect(finalState.settings.seasons.every(season => season.status === 'completed')).toBe(true)
    expect(finalState.transferHistory).toHaveLength(3)
    expect(finalState.freeAgents.length).toBeGreaterThan(0)
    expect(finalState.teams.every(team => Number.isFinite(team.budget))).toBe(true)
    expect(finalState.teams.every(team => team.roster.every(player => player.contract?.seasonsRemaining > 0))).toBe(true)
  })
})

describe('career transfer budget protection', () => {
  beforeEach(() => localStorage.clear())

  it('allows one coach deal into debt, then blocks the next purchase', async () => {
    const teams = makeTeams(2)
    teams[0].budget = 1_000_000
    const coach = { id: 'qa-coach', name: 'QA Coach', market_value: 25_000_000, club_id: null, stats: { TAC: 80, MGT: 80, MOT: 80, ATT: 80, DEF: 80, PHY: 80 } }
    const secondCoach = { ...coach, id: 'qa-coach-2', name: 'Second Coach' }
    const saveId = await createDraftState({
      name: 'Coach transfer QA',
      teams,
      freeAgents: [],
      freeAgentsCoaches: [coach, secondCoach],
    })

    let state = await transferDraftCoach(saveId, coach.id, teams[0].club_id, 25_000_000)
    expect(state.teams[0].coaches.map(item => item.id)).toContain(coach.id)
    const signingFee = contractFeeFor(annualWageFor(coach), 3, { freeAgent: true })
    expect(state.teams[0].budget).toBe(1_000_000 - signingFee)
    expect(state.freeAgentsCoaches).toHaveLength(1)
    await expect(transferDraftCoach(saveId, secondCoach.id, teams[0].club_id, 1_000_000)).rejects.toThrow('in debt')

    state = await transferDraftCoach(saveId, coach.id, 'free_agent', 0)
    expect(state.teams[0].coaches).toHaveLength(0)
    expect(state.freeAgentsCoaches.map(item => item.id)).toContain(coach.id)
  })
})

describe('season reward closing', () => {
  beforeEach(() => localStorage.clear())

  it('pays editable player and annual awards exactly once when a cup is skipped', async () => {
    const teams = makeTeams(2)
    const winner = teams[0].roster[0]
    const saveId = await createDraftState({
      name: 'Skipped cup rewards', teams, freeAgents: [], currentWeek: 1,
      settings: { seasons: [{
        id: 1, status: 'completed', teamIds: teams.map(team => team.club_id), champion: teams[0].club_id,
        stats: {
          topScorers: { [winner.id]: 9 }, topAssists: { [winner.id]: 7 }, mostMvps: { [winner.id]: 5 },
          playerSnapshots: { [winner.id]: { ...winner, club: { id: teams[0].club_id, name: teams[0].club_name } } },
        },
        prizeSettings: { awards: { topScorers: 21_000_000, topAssists: 22_000_000, mostMvps: 23_000_000, ballonDor: 24_000_000, bestGK: 5_000_000, bestDEF: 6_000_000, bestMF: 7_000_000, bestFWD: 8_000_000 } },
      }], cups: [] },
    })
    const before = teams[0].budget
    let state = await finalizeDraftSeasonAwards(saveId, 1)
    const afterFirst = state.teams[0].budget
    expect(afterFirst).toBeGreaterThan(before)
    expect(state.settings.seasons[0].prizePayouts.some(payout => payout.amount === 21_000_000)).toBe(true)
    expect(state.settings.seasons[0].prizePayouts.some(payout => payout.amount === 24_000_000)).toBe(true)
    state = await finalizeDraftSeasonAwards(saveId, 1)
    expect(state.teams[0].budget).toBe(afterFirst)
  })
})

describe('career national cup', () => {
  beforeEach(() => localStorage.clear())

  it('uses the season match size and completes an 8-team tournament', async () => {
    const nations = ['Argentina', 'Brazil', 'England', 'France', 'Germany', 'Italy', 'Japan', 'Thailand']
    const roster = nations.flatMap((nationality, nationIndex) => ['FWD', 'MF', 'GK'].map((position, index) => ({
      id: `${nationIndex}-${index}`, name: `${nationality} ${position}`, nationality, position,
      ovr: 80 + nationIndex, overall: 80 + nationIndex, stats: { PAC: 80, SHO: 80, PAS: 80, DRI: 80, DEF: 80, PHY: 80, SAV: 80, GKA: 80 },
    })))
    const team = { club_id: 'career-club', club_name: 'Career Club', budget: 100_000_000, roster, stats: emptyStats() }
    const saveId = await createDraftState({
      name: 'National cup QA', teams: [team], freeAgents: [], currentWeek: 1,
      settings: { seasons: [{ id: 1, status: 'active', nationalCupEnabled: true, matchSize: 3, teamIds: [], matches: [], stats: {} }], nationalCups: [] },
    })
    let state = await createDraftNationalCup(saveId, nations)
    expect(state.settings.nationalCups[0].participants).toHaveLength(8)
    expect(state.settings.nationalCups[0].participants.every(country => country.roster.length >= 3)).toBe(true)
    expect(state.settings.nationalCups[0].participants.every(country => country.roster[2].position === 'GK')).toBe(true)
    for (let round = 1; round <= 3; round += 1) {
      state = await loadDraftState(saveId)
      const matches = state.settings.nationalCups[0].rounds[round]
      for (let index = 0; index < matches.length; index += 1) {
        const home = state.settings.nationalCups[0].participants.find(country => country.id === matches[index].home)
        await completeDraftNationalCupMatch(saveId, round, index, { homeScore: 1, awayScore: 0, events: [{ type: 'goal', player: home.roster[0] }], mvp: home.roster[0] })
      }
    }
    state = await loadDraftState(saveId)
    expect(state.settings.nationalCups[0].status).toBe('completed')
    expect(state.settings.nationalCups[0].championPlayerIds).toHaveLength(3)
    expect(state.settings.seasons[0].annualAwards.finalizedAt).toBeTruthy()
  })
})

describe('career save isolation', () => {
  beforeEach(() => localStorage.clear())

  it('keeps edits and transfers inside one save without changing another save or master data', async () => {
    const masterPlayer = MOCK_PLAYERS[0]
    const masterSnapshot = structuredClone(masterPlayer)
    const saveATeams = makeTeams(2)
    const saveBTeams = makeTeams(2)
    const freeAgent = { ...MOCK_PLAYERS[12], club_id: null }

    const saveA = await createDraftState({ name: 'Save A', teams: saveATeams, freeAgents: [freeAgent] })
    const saveB = await createDraftState({ name: 'Save B', teams: saveBTeams, freeAgents: [freeAgent] })

    const stateA = await loadDraftState(saveA)
    stateA.teams[0].roster[0] = {
      ...stateA.teams[0].roster[0],
      ovr: 99,
      stats: { ...stateA.teams[0].roster[0].stats, PAC: 99 },
    }
    await updateDraftState(saveA, stateA)
    await transferDraftPlayer(saveA, freeAgent.id, stateA.teams[0].club_id, 1_000_000)

    const updatedA = await loadDraftState(saveA)
    const untouchedB = await loadDraftState(saveB)

    expect(updatedA.teams[0].roster[0].ovr).toBe(99)
    expect(updatedA.teams[0].roster.some(player => player.id === freeAgent.id)).toBe(true)
    expect(untouchedB.teams[0].roster[0].ovr).toBe(masterSnapshot.ovr)
    expect(untouchedB.freeAgents.some(player => player.id === freeAgent.id)).toBe(true)
    expect(MOCK_PLAYERS[0]).toEqual(masterSnapshot)
  })
})
