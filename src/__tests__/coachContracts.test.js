import { describe, expect, it } from 'vitest'
import { getCoachEffects } from '../utils/coachEffects'
import { annualWageFor, applyExternalCompetitionIncome, marketValueForOvr, processSeasonContracts, withDefaultContract } from '../utils/contracts'

describe('coach effects', () => {
  it('uses the head coach fully and applies only a small assistant bonus', () => {
    const result = getCoachEffects([
      { name: 'Head', stats: { TAC: 100, ATT: 100, DEF: 100, MOT: 100, MGT: 100, PHY: 100 } },
      { name: 'Assistant', stats: { TAC: 100, ATT: 100, DEF: 100, MOT: 100, MGT: 100, PHY: 100 } },
    ])
    expect(result.ratings.TAC).toBe(106)
    expect(result.TAC).toBe(9)
  })

  it('returns neutral effects when a team has no coach', () => {
    expect(getCoachEffects([])).toMatchObject({ hasCoach: false, TAC: 0, MGT: 0 })
  })
})

describe('contracts', () => {
  it('provides balanced fallback market values from OVR', () => {
    expect(marketValueForOvr(79)).toBe(33_000_000)
    expect(marketValueForOvr(86)).toBe(62_000_000)
    expect(marketValueForOvr(90, true)).toBe(12_000_000)
  })

  it('calculates player wages mainly from OVR and only partly from transfer value', () => {
    const normalFee = annualWageFor({ position: 'FWD', ovr: 90, market_value: 100_000_000 })
    const negotiatedFee = annualWageFor({ position: 'FWD', ovr: 90, market_value: 150_000_000 })
    expect(normalFee).toBe(8_400_000)
    expect(negotiatedFee).toBe(9_600_000)
  })

  it('uses a lower wage scale for coaches', () => {
    expect(annualWageFor({ ovr: 90, market_value: 15_000_000, stats: { TAC: 90, MGT: 90, MOT: 90, ATT: 90, DEF: 90, PHY: 90 } })).toBe(3_500_000)
  })

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

describe('external competition income', () => {
  it('keeps clubs outside managed competitions financially active', () => {
    const teams = [{ club_id: 'league', budget: 0 }, { club_id: 'cup', budget: 0 }, { club_id: 'outside', budget: 0 }]
    const previousSeason = { id: 1, teamIds: ['league'] }
    const cups = [{ seasonId: 1, invitedIds: ['cup'], rounds: {} }]
    const result = applyExternalCompetitionIncome(teams, previousSeason, cups)
    expect(result.teams.find(team => team.club_id === 'league').budget).toBe(25_000_000)
    expect(result.teams.find(team => team.club_id === 'cup').budget).toBe(70_000_000)
    expect(result.teams.find(team => team.club_id === 'outside').budget).toBe(95_000_000)
  })
})
