import { describe, expect, it } from 'vitest'
import { aggregateCareerLeaderStats } from '../utils/careerLeaders'

const goal = (scorer, assist) => ({ type: 'goal', player: { id: scorer }, assist: assist ? { id: assist } : null })
const foul = player => ({ type: 'foul', player: { id: player } })
const match = (events, mvp) => ({ played: true, events, mvp: mvp ? { id: mvp } : null })

describe('career leader aggregation', () => {
  it('counts league, club cup and national cup events exactly once', () => {
    const result = aggregateCareerLeaderStats({
      seasons: [{ id: 1, stats: { topScorers: { p1: 1 }, topAssists: { p2: 1 }, mostFouls: { p3: 1 }, mostMvps: { p4: 1 } } }],
      cups: [{ seasonId: 1, status: 'active', rounds: { 1: [match([goal('p1', 'p2'), foul('p3')], 'p4')] } }],
      nationalCups: [{ seasonId: 1, status: 'active', rounds: { 1: [match([goal('p1', 'p2'), foul('p3')], 'p4')] } }],
      seasonId: 1,
    })
    expect(result.topScorers.p1).toBe(3)
    expect(result.topAssists.p2).toBe(3)
    expect(result.mostFouls.p3).toBe(3)
    expect(result.mostMvps.p4).toBe(3)
  })

  it('ignores unplayed matches and filters by season', () => {
    const result = aggregateCareerLeaderStats({
      seasons: [
        { id: 1, stats: { topScorers: { old: 1 }, mostMvps: { old: 1 } } },
        { id: 2, stats: {} },
      ],
      cups: [{ seasonId: 2, status: 'active', rounds: { 1: [{ played: false, events: [goal('future')], mvp: { id: 'future' } }] } }],
      seasonId: 2,
    })
    expect(result.topScorers).toEqual({})
    expect(result.mostMvps).toEqual({})
  })

  it('does not add a completed cup again after it has been merged into season stats', () => {
    const result = aggregateCareerLeaderStats({
      seasons: [{ id: 1, stats: { topScorers: { p1: 9 } } }],
      cups: [{ seasonId: 1, status: 'completed', rounds: { 1: [match([goal('p1')], null)] } }],
      seasonId: 1,
    })
    expect(result.topScorers.p1).toBe(9)
  })
})
