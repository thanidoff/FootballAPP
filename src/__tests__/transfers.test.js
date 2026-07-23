import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InsufficientBudgetError } from '../services/transfers'

// Mock supabase to avoid real network calls in unit tests
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

import { supabase } from '../lib/supabase'

function makeSelectChain(resolvedValue) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    // resolveValue สำหรับ query ที่ไม่ใช้ .single()
    then: undefined,
  }
}

describe('InsufficientBudgetError', () => {
  it('stores needed and available', () => {
    const err = new InsufficientBudgetError(5_000_000, 2_000_000)
    expect(err.needed).toBe(5_000_000)
    expect(err.available).toBe(2_000_000)
    expect(err.name).toBe('InsufficientBudgetError')
    expect(err.message).toContain('Insufficient budget')
  })

  it('is instanceof Error', () => {
    expect(new InsufficientBudgetError(1, 0)).toBeInstanceOf(Error)
  })
})

describe('buyPlayer — budget guard', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws InsufficientBudgetError when club budget < fee', async () => {
    const { buyPlayer } = await import('../services/transfers')

    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'INSUFFICIENT_BUDGET:1000000:500000' },
    })

    await expect(
      buyPlayer({ playerId: 'p1', toClubId: 'c1', fee: 1_000_000 })
    ).rejects.toBeInstanceOf(InsufficientBudgetError)
  })
})

describe('releasePlayer — to_club = null (BUG FIX)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls the atomic release transaction with the source club', async () => {
    const { releasePlayer } = await import('../services/transfers')
    supabase.rpc.mockResolvedValue({ data: null, error: null })

    await releasePlayer({ playerId: 'p1', fromClubId: 'c1', marketValue: 2_000_000 })

    // ตรวจว่า insert เรียก to_club: null (ไม่ใช่ NOT NULL อีกต่อไป)
    expect(supabase.rpc).toHaveBeenCalledWith('release_player_atomic', {
      p_player_id: 'p1', p_from_club_id: 'c1', p_cost: 1_000_000,
    })
  })

  it('calculates release cost = 50% of market value', async () => {
    const { releasePlayer } = await import('../services/transfers')
    supabase.rpc.mockResolvedValue({ data: null, error: null })

    const { cost } = await releasePlayer({ playerId: 'p1', fromClubId: 'c1', marketValue: 4_000_000 })
    expect(cost).toBe(2_000_000) // 50% ของ 4M
  })
})

describe('fetchTransferHistory', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns data sorted by transferred_at desc', async () => {
    const { fetchTransferHistory } = await import('../services/transfers')
    const mockData = [
      { id: 't2', transferred_at: '2025-02-01' },
      { id: 't1', transferred_at: '2025-01-01' },
    ]

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    })

    const result = await fetchTransferHistory('p1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('t2')
  })
})
