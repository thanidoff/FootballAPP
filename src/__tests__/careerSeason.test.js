import { beforeEach, describe, expect, it } from 'vitest'
import { MOCK_CLUBS, MOCK_PLAYERS } from '../data/mockGameData'
import { generateMockRoster, generateSchedule } from '../utils/draftLogic'
import {
  completeDraftCupMatch,
  completeDraftMatch,
  createDraftState,
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
    await expect(transferDraftPlayer(saveId, signing.id, teamIds[0], 600_000_000))
      .rejects.toThrow('Insufficient budget')
    let state = await transferDraftPlayer(saveId, signing.id, teamIds[0], negotiatedFee)
    expect(state.teams[0].roster.some(player => player.id === signing.id)).toBe(true)
    expect(state.teams[0].roster.find(player => player.id === signing.id).market_value).toBe(negotiatedFee)
    expect(state.teams[0].budget).toBe(500_000_000 - negotiatedFee)
    expect(state.freeAgents.some(player => player.id === signing.id)).toBe(false)
    expect(state.transferHistory).toHaveLength(1)

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
})

describe('career transfer budget protection', () => {
  beforeEach(() => localStorage.clear())

  it('moves coaches between the free-agent pool and clubs without allowing debt', async () => {
    const teams = makeTeams(2)
    const coach = { id: 'qa-coach', name: 'QA Coach', market_value: 25_000_000, club_id: null, stats: { TAC: 80, MGT: 80, MOT: 80, ATT: 80, DEF: 80, PHY: 80 } }
    const saveId = await createDraftState({
      name: 'Coach transfer QA',
      teams,
      freeAgents: [],
      freeAgentsCoaches: [coach],
    })

    await expect(transferDraftCoach(saveId, coach.id, teams[0].club_id, 600_000_000))
      .rejects.toThrow('Insufficient budget')

    let state = await transferDraftCoach(saveId, coach.id, teams[0].club_id, 25_000_000)
    expect(state.teams[0].coaches.map(item => item.id)).toContain(coach.id)
    expect(state.teams[0].budget).toBe(475_000_000)
    expect(state.freeAgentsCoaches).toHaveLength(0)

    state = await transferDraftCoach(saveId, coach.id, 'free_agent', 0)
    expect(state.teams[0].coaches).toHaveLength(0)
    expect(state.freeAgentsCoaches.map(item => item.id)).toContain(coach.id)
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
