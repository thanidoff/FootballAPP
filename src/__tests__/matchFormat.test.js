import { describe, expect, it } from 'vitest'
import { getSeasonMatchSize, getSimulationPace, normalizeMatchSize, orderStartingLineup } from '../utils/matchFormat'
import { generateInitialDraft } from '../utils/draftLogic'

const player = (id, position = 'MF') => ({ id, name: id, position })

describe('match formats', () => {
  it('supports 3, 5 and 7 players while keeping old saves at five', () => {
    expect(normalizeMatchSize(3)).toBe(3)
    expect(normalizeMatchSize(7)).toBe(7)
    expect(normalizeMatchSize(4)).toBe(5)
    expect(getSeasonMatchSize({})).toBe(5)
  })

  it('uses the active season format ahead of the career default', () => {
    expect(getSeasonMatchSize({ matchSize: 3, seasons: [{ id: 1, status: 'completed', matchSize: 3 }, { id: 2, status: 'active', matchSize: 7 }] })).toBe(7)
  })

  it('puts the goalkeeper in the final starter slot for every format', () => {
    const roster = [player('gk', 'GK'), player('a'), player('b'), player('c'), player('d'), player('e'), player('f')]
    expect(orderStartingLineup(roster, 3).slice(0, 3).map(item => item.id)).toEqual(['a', 'b', 'gk'])
    expect(orderStartingLineup(roster, 5).slice(0, 5).at(-1).id).toBe('gk')
    expect(orderStartingLineup(roster, 7).slice(0, 7).at(-1).id).toBe('gk')
  })

  it('uses a faster simulation pace for smaller pitches', () => {
    expect(getSimulationPace(3)).toBeGreaterThan(getSimulationPace(5))
    expect(getSimulationPace(5)).toBeGreaterThan(getSimulationPace(7))
  })

  it('drafts enough starters for the selected format and keeps the keeper last', () => {
    const club = { id: 'club', name: 'Club', startingRoster: [] }
    const pool = [player('gk', 'GK'), player('d', 'DEF'), player('m', 'MF'), player('f', 'FWD'), player('a'), player('b'), player('c')]
    const { newTeams } = generateInitialDraft([club], pool, 0, [], 7)

    expect(newTeams[0].roster).toHaveLength(7)
    expect(newTeams[0].roster[6].position).toBe('GK')
  })
})
