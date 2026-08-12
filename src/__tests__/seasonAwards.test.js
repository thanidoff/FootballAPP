import { describe, expect, it } from 'vitest'
import { calculateAnnualAwards, generateOutsideLeagueStats, mergeSeasonStats } from '../utils/seasonAwards'
import { applySeasonalPlayerAdjustments } from '../utils/playerGrowth'

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

  it('simulates position-aware seasons for players in the external market', () => {
    const season = { id: 3, teamIds: ['league'] }
    const market = [
      { id: 'market-gk', name: 'Market Keeper', position: 'GK', ovr: 88 },
      { id: 'market-mf', name: 'Market Midfielder', position: 'MF', ovr: 88 },
    ]
    const result = generateOutsideLeagueStats(teams, season, market)
    expect(result.playerSnapshots['market-gk'].club).toBeNull()
    expect(result.topScorers).toBeDefined()
    expect(result.topAssists).toBeDefined()
    expect(result.mostMvps).toBeDefined()
  })

  it('rewards individual positional performance even when the team finishes last', () => {
    const keeper = { id: 'great-gk', name: 'Great Keeper', position: 'GK', age: 24, ovr: 80, stats: { PAC: 70, PAS: 75, DRI: 65, PHY: 80, SAV: 82, GKA: 82 } }
    const season = {
      id: 4,
      standings: [{ club_id: 'winner' }, { club_id: 'bottom' }],
      matches: [],
      stats: { performance: { 'great-gk': { appearances: 20, saves: 110, cleanSheets: 5, mvps: 5 } } },
    }
    const result = applySeasonalPlayerAdjustments([{ club_id: 'bottom', roster: [keeper], coaches: [] }], [], 'all', { season })
    expect(result.seasonAdjustments[0].performance.formRating).toBeGreaterThanOrEqual(5.7)
  })

  it('gives low-scoring positions a seeded seasonal form without detailed metrics', () => {
    const defender = { id: 'quiet-def', name: 'Quiet Defender', position: 'DEF', age: 25, ovr: 84, stats: { PAC: 82, SHO: 45, PAS: 80, DRI: 72, DEF: 89, PHY: 88 } }
    const midfielder = { id: 'quiet-mf', name: 'Quiet Midfielder', position: 'MF', age: 25, ovr: 84, stats: { PAC: 80, SHO: 75, PAS: 91, DRI: 88, DEF: 82, PHY: 80 } }
    const season = { id: 5, standings: [{ club_id: 'club' }], matches: [], stats: { performance: { 'quiet-def': { appearances: 20 }, 'quiet-mf': { appearances: 20 } } } }
    const first = applySeasonalPlayerAdjustments([{ club_id: 'club', roster: [defender, midfielder], coaches: [] }], [], 'all', { season })
    const second = applySeasonalPlayerAdjustments([{ club_id: 'club', roster: [defender, midfielder], coaches: [] }], [], 'all', { season })
    expect(first.seasonAdjustments).toEqual(second.seasonAdjustments)
    first.seasonAdjustments.forEach(adjustment => {
      expect(['Very Poor', 'Poor', 'Normal', 'Good', 'Excellent']).toContain(adjustment.performance.form)
      expect(adjustment.performance.formRating).toBeGreaterThanOrEqual(5.7)
      expect(Object.keys(adjustment.performance).sort()).toEqual(['form', 'formRating'])
    })
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
