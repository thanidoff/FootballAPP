import { describe, expect, it } from 'vitest'
import { calculateAnnualAwards, generateOutsideLeagueStats, mergeSeasonStats } from '../utils/seasonAwards'

const teams = [
  { club_id: 'league', club_name: 'League FC', roster: [{ id: 'fwd', name: 'Forward', position: 'FW', overall: 90 }, { id: 'gk', name: 'Keeper', position: 'GK', overall: 91 }] },
  { club_id: 'outside', club_name: 'Outside FC', roster: [{ id: 'external', name: 'External', position: 'FW', overall: 95 }] },
]

describe('season awards', () => {
  it('generates stable outside-league statistics without including league clubs', () => {
    const season = { id: 2, teamIds: ['league'] }
    const first = generateOutsideLeagueStats(teams, season)
    const second = generateOutsideLeagueStats(teams, season)
    expect(first).toEqual(second)
    expect(first.playerSnapshots.external.club.id).toBe('outside')
    expect(first.playerSnapshots.fwd).toBeUndefined()
  })

  it('selects annual and positional winners from combined competitions', () => {
    const stats = mergeSeasonStats({
      topScorers: { fwd: 8 }, topAssists: { fwd: 4 }, mostMvps: { fwd: 3, gk: 5 },
      playerSnapshots: {},
    })
    const awards = calculateAnnualAwards(stats, teams, { id: 1, champion: 'league' })
    expect(awards.ballonDor.id).toBe('fwd')
    expect(awards.bestGK.id).toBe('gk')
    expect(awards.bestFWD.id).toBe('fwd')
  })
})
