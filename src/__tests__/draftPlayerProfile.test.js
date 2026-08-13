import { describe, expect, it } from 'vitest'
import { buildDraftPlayerProfileData, resolveDraftPlayer } from '../utils/draftPlayerProfile'

const goal = (playerId, assistId, team = 'home') => ({
  type: 'goal', team, player: { id: playerId }, assist: assistId ? { id: assistId } : null,
})

describe('draft player profile', () => {
  it('resolves the current club from the career save roster', () => {
    const saveData = { teams: [{ club_id: 'psg', club_name: 'Paris Saint Germain', roster: [{ id: 'p1', name: 'Player', ovr: 91 }] }], freeAgents: [] }
    expect(resolveDraftPlayer(saveData, { id: 'p1', club: null }).club.name).toBe('Paris Saint Germain')
  })

  it('includes live league, club cup and national cup events in career history', () => {
    const leagueMatch = { home: 'psg', away: 'rma', played: true, events: [goal('p1', 'p2')], mvp: { id: 'p1' } }
    const cupMatch = { home: 'psg', away: 'rma', played: true, events: [goal('p1', 'p2'), goal('p1')], mvp: { id: 'p2' } }
    const nationalMatch = { home: 'nation:France', away: 'nation:Spain', played: true, events: [goal('p1', null)], mvp: { id: 'p1' } }
    const saveData = {
      teams: [
        { club_id: 'psg', club_name: 'Paris Saint Germain', roster: [{ id: 'p1', name: 'Player' }] },
        { club_id: 'rma', club_name: 'Real Madrid', roster: [{ id: 'p2', name: 'Assist' }] },
      ],
      freeAgents: [],
      settings: {
        seasons: [{ id: 1, status: 'active', matches: [{ week: 1, matches: [leagueMatch] }], stats: { topScorers: { p1: 1 }, topAssists: { p2: 1 }, mostMvps: { p1: 1 } } }],
        cups: [{ seasonId: 1, status: 'active', rounds: { 1: [cupMatch] } }],
        nationalCups: [{ seasonId: 1, status: 'active', participants: [
          { id: 'nation:France', name: 'France', roster: [{ id: 'p1' }] },
          { id: 'nation:Spain', name: 'Spain', roster: [{ id: 'p2' }] },
        ], rounds: { 1: [nationalMatch] } }],
      },
    }

    const result = buildDraftPlayerProfileData(saveData, 'p1')
    const club = result.history.find(item => item.club.id === 'psg')
    const national = result.history.find(item => item.club.id === 'nation:France')
    expect(club.stats).toMatchObject({ goal: 3, mvp: 1 })
    expect(national.stats).toMatchObject({ goal: 1, mvp: 1 })
  })

  it('reads every tied and annual award from the completed save season', () => {
    const saveData = {
      teams: [{ club_id: 'psg', club_name: 'Paris Saint Germain', roster: [{ id: 'p1' }] }],
      settings: { seasons: [{
        id: 1, status: 'completed', stats: {},
        prizePayouts: [{ type: 'player_award', playerId: 'p1', clubId: 'psg', clubName: 'Paris Saint Germain', label: 'Top Scorer' }],
        annualAwards: { ballonDor: { id: 'p1', club: { id: 'psg', name: 'Paris Saint Germain' } }, finalizedAt: 'now' },
      }], cups: [], nationalCups: [] },
    }
    expect(buildDraftPlayerProfileData(saveData, 'p1').awards.map(item => item.award_type)).toEqual(["Ballon d'Or", 'Top Scorer'])
  })
})
