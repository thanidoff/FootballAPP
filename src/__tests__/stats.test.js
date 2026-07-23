import { describe, it, expect } from 'vitest'
import {
  calculateOVR,
  getOVRTier,
  getStatColor,
  getDefaultStats,
  normalizeStats,
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
  it('returns custom red for 100+', () => expect(getStatColor(100)).toBe('#FD5461'))
  it('returns high opacity for 80-99', () => expect(getStatColor(80)).toBe('rgba(10,19,24,0.75)'))
  it('returns mid opacity for 60-79', () => expect(getStatColor(60)).toBe('rgba(10,19,24,0.30)'))
  it('returns low opacity below 60', () => expect(getStatColor(59)).toBe('rgba(10,19,24,0.15)'))
})

describe('getDefaultStats', () => {
  it('returns correct keys for GK', () => {
    const stats = getDefaultStats('GK')
    expect(Object.keys(stats)).toEqual(['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'SAV', 'GKA'])
  })

  it('returns correct keys for FWD', () => {
    const stats = getDefaultStats('FWD')
    expect(Object.keys(stats)).toEqual(['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'SAV', 'GKA'])
  })

  it('defaults all values to 50', () => {
    const stats = getDefaultStats('DEF')
    Object.values(stats).forEach((v) => expect(v).toBe(50))
  })
})

describe('normalizeStats', () => {
  it('migrates legacy goalkeeper attributes to integer SAV and GKA values', () => {
    const stats = normalizeStats({ DIV: 81, HAN: 82, REF: 82, POS: 79, KIC: 76, SPD: 70 })
    expect(stats.SAV).toBe(82)
    expect(stats.GKA).toBe(79)
    expect(Object.values(stats).every(Number.isInteger)).toBe(true)
  })
})
