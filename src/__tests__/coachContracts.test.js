import { describe, expect, it } from 'vitest'
import { getCoachEffects } from '../utils/coachEffects'
import { annualWageFor, processSeasonContracts, withDefaultContract } from '../utils/contracts'

describe('coach effects', () => {
  it('weights the head coach at 70% and assistant at 30%', () => {
    const result = getCoachEffects([
      { name: 'Head', stats: { TAC: 100, ATT: 100, DEF: 100, MOT: 100, MGT: 100, PHY: 100 } },
      { name: 'Assistant', stats: { TAC: 50, ATT: 50, DEF: 50, MOT: 50, MGT: 50, PHY: 50 } },
    ])
    expect(result.ratings.TAC).toBe(85)
    expect(result.TAC).toBe(5)
  })

  it('returns neutral effects when a team has no coach', () => {
    expect(getCoachEffects([])).toMatchObject({ hasCoach: false, TAC: 0, MGT: 0 })
  })
})

describe('contracts', () => {
  it('creates a three-season contract and an 8% annual wage', () => {
    const player = withDefaultContract({ id: 'p1', market_value: 20_000_000 })
    expect(player.contract).toEqual({ seasonsRemaining: 3, annualWage: 1_600_000 })
    expect(annualWageFor({ market_value: 1_000_000 })).toBe(500_000)
  })

  it('pays wages and releases expired people without mutating the source team', () => {
    const team = { club_id: 'a', budget: 10_000_000, roster: [{ id: 'p1', contract: { seasonsRemaining: 1, annualWage: 1_000_000 } }], coaches: [] }
    const result = processSeasonContracts([team], [], [])
    expect(result.teams[0].budget).toBe(9_000_000)
    expect(result.teams[0].roster).toHaveLength(0)
    expect(result.freeAgents[0]).toMatchObject({ id: 'p1', club_id: null, contract: null })
    expect(team.roster[0].contract.seasonsRemaining).toBe(1)
  })
})
