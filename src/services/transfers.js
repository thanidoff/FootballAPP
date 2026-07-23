import { supabase } from '../lib/supabase'

export class InsufficientBudgetError extends Error {
  constructor(needed, available) {
    super(`Insufficient budget. Need ${needed}, have ${available}.`)
    this.name = 'InsufficientBudgetError'
    this.needed = needed
    this.available = available
  }
}

/**
 * Buy a player into a club.
 * Handles both free agents and club-to-club transfers.
 */
export async function buyPlayer({ playerId, toClubId, fromClubId = null, fee }) {
  const { data, error } = await supabase.rpc('buy_player_atomic', {
    p_player_id: playerId,
    p_to_club_id: toClubId,
    p_from_club_id: fromClubId,
    p_fee: fee,
  })
  if (error?.message?.includes('INSUFFICIENT_BUDGET')) {
    const [, needed, available] = error.message.match(/INSUFFICIENT_BUDGET:(\d+):(\d+)/) ?? []
    throw new InsufficientBudgetError(Number(needed ?? fee), Number(available ?? 0))
  }
  if (error) throw error
  return data
}

/**
 * Release a player from their club back to free-agent pool.
 * Costs the club 50% of the player's market value (release compensation).
 */
export async function releasePlayer({ playerId, fromClubId, marketValue }) {
  const cost = Math.round(marketValue * 0.5)
  const { error } = await supabase.rpc('release_player_atomic', {
    p_player_id: playerId,
    p_from_club_id: fromClubId,
    p_cost: cost,
  })
  if (error) throw error
  return { cost }
}

export async function fetchTransferHistory(playerId) {
  const { data, error } = await supabase
    .from('transfers')
    .select('*, from_club_data:from_club(name), to_club_data:to_club(name)')
    .eq('player_id', playerId)
    .order('transferred_at', { ascending: false })
  if (error) throw error
  return data
}
