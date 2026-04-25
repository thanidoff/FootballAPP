import { describe, it, expect } from 'vitest'
import { formatCurrency, parseCurrency } from '../utils/currency'

describe('formatCurrency', () => {
  it('formats millions', () => expect(formatCurrency(10_000_000)).toBe('10.0M'))
  it('formats thousands', () => expect(formatCurrency(500_000)).toBe('500K'))
  it('formats small values', () => expect(formatCurrency(999)).toBe('999'))
  it('formats 1.5M correctly', () => expect(formatCurrency(1_500_000)).toBe('1.5M'))
})

describe('parseCurrency', () => {
  it('parses plain numbers', () => expect(parseCurrency('1000')).toBe(1000))
  it('strips non-numeric chars', () => expect(parseCurrency('$1,500.00')).toBe(1500.0))
  it('returns 0 for empty', () => expect(parseCurrency('')).toBe(0))
})
