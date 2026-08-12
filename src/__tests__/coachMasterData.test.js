import { describe, expect, it, vi } from 'vitest'
import { generateInitialDraft } from '../utils/draftLogic'
import { applySeasonalCoachAdjustments } from '../utils/playerGrowth'

describe('career coach master data', () => {
  it('does not inject mock coaches when no master coaches are supplied', () => {
    const clubs = [{ id: 'club-1', name: 'Club One', startingRoster: [], startingBudget: 100_000_000 }]
    const result = generateInitialDraft(clubs, [], undefined, [], 3)
    expect(result.newTeams[0].coaches).toEqual([])
    expect(result.remainingCoaches).toEqual([])
  })

  it('drafts only coaches supplied by master data', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const coach = { id: 'master-coach-1', name: 'Master Coach', stats: { TAC: 80, MGT: 80, MOT: 80, ATT: 80, DEF: 80, PHY: 80 }, ovr: 80 }
    const clubs = [{ id: 'club-1', name: 'Club One', startingRoster: [], startingBudget: 100_000_000 }]
    const result = generateInitialDraft(clubs, [], undefined, [coach], 3)
    expect(result.newTeams[0].coaches.map(item => item.id)).toEqual(['master-coach-1'])
    vi.restoreAllMocks()
  })

  it('updates coach ratings without changing coach identity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const coach = { id: 'coach-1', name: 'Coach One', stats: { TAC: 80, MGT: 80, MOT: 80, ATT: 80, DEF: 80, PHY: 80 }, ovr: 80 }
    const result = applySeasonalCoachAdjustments([{ club_id: 'club-1', club_name: 'Club One', coaches: [coach] }], [], 'all')
    expect(result.updatedTeams[0].coaches[0].id).toBe('coach-1')
    expect(result.seasonAdjustments).toHaveLength(1)
    expect(result.updatedTeams[0].coaches[0].ovr).toBeGreaterThanOrEqual(80)
    vi.restoreAllMocks()
  })
})
