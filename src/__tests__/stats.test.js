import { describe, it, expect } from 'vitest'
import {
  calculateOVR,
  getOVRTier,
  getStatColor,
  getDefaultStats,
  STATS_BY_POSITION,
} from '../utils/stats'

describe('calculateOVR', () => {
  it('returns 0 for unknown position', () => {
    expect(calculateOVR('MID', {})).toBe(0)
  })

  it('calculates GK OVR from GK stats', () => {
    const stats = { DIV: 90, HAN: 85, KIC: 70, REF: 88, SPD: 65, POS: 84 }
    const ovr = calculateOVR('GK', stats)
    expect(ovr).toBeGreaterThan(70)
    expect(ovr).toBeLessThanOrEqual(99)
  })

  it('calculates FWD OVR weighted toward SHO/PAC', () => {
    const highShot = { PAC: 95, SHO: 95, PAS: 70, DRI: 70, DEF: 40, PHY: 70 }
    const lowShot  = { PAC: 70, SHO: 40, PAS: 95, DRI: 95, DEF: 40, PHY: 70 }
    expect(calculateOVR('FWD', highShot)).toBeGreaterThan(calculateOVR('FWD', lowShot))
  })

  it('calculates DEF OVR weighted toward DEF', () => {
    const highDef = { PAC: 70, SHO: 50, PAS: 70, DRI: 60, DEF: 95, PHY: 80 }
    const lowDef  = { PAC: 70, SHO: 50, PAS: 70, DRI: 60, DEF: 40, PHY: 80 }
    expect(calculateOVR('DEF', highDef)).toBeGreaterThan(calculateOVR('DEF', lowDef))
  })

  it('handles missing stats gracefully using 0', () => {
    expect(() => calculateOVR('FWD', {})).not.toThrow()
    const ovr = calculateOVR('FWD', {})
    expect(ovr).toBe(0)
  })
})

describe('getOVRTier', () => {
  it('returns special for 100+', () => expect(getOVRTier(100)).toBe('special'))
  it('returns special for 140', () => expect(getOVRTier(140)).toBe('special'))
  it('returns gold for 85-99', () => {
    expect(getOVRTier(85)).toBe('gold')
    expect(getOVRTier(99)).toBe('gold')
  })
  it('returns silver for 75-84', () => {
    expect(getOVRTier(75)).toBe('silver')
    expect(getOVRTier(84)).toBe('silver')
  })
  it('returns bronze below 75', () => expect(getOVRTier(74)).toBe('bronze'))
})

describe('getStatColor', () => {
  it('returns purple for 100+', () => expect(getStatColor(100)).toBe('#a855f7'))
  it('returns green for 80-99', () => expect(getStatColor(80)).toBe('var(--color-stat-high)'))
  it('returns amber for 60-79', () => expect(getStatColor(60)).toBe('var(--color-stat-mid)'))
  it('returns red below 60', () => expect(getStatColor(59)).toBe('var(--color-stat-low)'))
})

describe('getDefaultStats', () => {
  it('returns correct keys for GK', () => {
    const stats = getDefaultStats('GK')
    expect(Object.keys(stats)).toEqual(STATS_BY_POSITION.GK)
  })

  it('returns correct keys for FWD', () => {
    const stats = getDefaultStats('FWD')
    expect(Object.keys(stats)).toEqual(STATS_BY_POSITION.FWD)
  })

  it('defaults all values to 50', () => {
    const stats = getDefaultStats('DEF')
    Object.values(stats).forEach((v) => expect(v).toBe(50))
  })
})
