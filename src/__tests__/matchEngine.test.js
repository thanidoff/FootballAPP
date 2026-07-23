import { describe, expect, it } from 'vitest'
import { simulateMatchSequences } from '../utils/matchEngine'

const player = (id, position, value) => ({ id, name: id, position, stats: { PAC: value, SHO: value, PAS: value, DRI: value, DEF: value, PHY: value, SAV: value, GKA: value } })
const home = [player('h-gk', 'GK', 75), player('h-df', 'DEF', 75), player('h-mf1', 'MF', 75), player('h-mf2', 'MF', 75), player('h-fw', 'FWD', 75)]
const away = [player('a-gk', 'GK', 72), player('a-df', 'DEF', 72), player('a-mf1', 'MF', 72), player('a-mf2', 'MF', 72), player('a-fw', 'FWD', 72)]

describe('possession match engine', () => {
  it('repeats exactly with the same seed', () => {
    expect(simulateMatchSequences(home, away, { seed: 'same', possessions: 36 })).toEqual(simulateMatchSequences(home, away, { seed: 'same', possessions: 36 }))
  })

  it('creates one resolved event for every possession', () => {
    const events = simulateMatchSequences(home, away, { seed: 'count', possessions: 40 })
    expect(events).toHaveLength(40)
    expect(events.every(event => event.minute >= 1 && event.minute <= 90)).toBe(true)
  })

  it('resolves shots through explicit outcomes', () => {
    const events = simulateMatchSequences(home, away, { seed: 'outcomes', possessions: 80 })
    const outcomes = new Set(['bad_pass', 'dispossessed', 'blocked_shot', 'shot_wide', 'shot_over', 'hit_post', 'save', 'goal'])
    expect(events.every(event => outcomes.has(event.type))).toBe(true)
  })

  it('keeps scoring in a tunable football-like range across 500 matches', () => {
    const goalCounts = Array.from({ length: 500 }, (_, index) => simulateMatchSequences(home, away, { seed: `balance-${index}`, possessions: 36 }).filter(event => event.type === 'goal').length)
    const averageGoals = goalCounts.reduce((sum, value) => sum + value, 0) / goalCounts.length
    expect(averageGoals).toBeGreaterThan(0.5)
    expect(averageGoals).toBeLessThan(6)
  })
})
