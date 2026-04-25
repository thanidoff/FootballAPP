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
 * Buy a free-agent player into a club.
 * Uses a Supabase RPC transaction to atomically:
 *   1. Deduct fee from club budget
 *   2. Assign player to club
 *   3. Record transfer history
 */
export async function buyPlayer({ playerId, toClubId, fee }) {
  // Fetch club budget first to give a helpful client-side error
  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .select('budget')
    .eq('id', toClubId)
    .single()
  if (clubErr) throw clubErr
  if (club.budget < fee) throw new InsufficientBudgetError(fee, club.budget)

  // Deduct budget
  const { error: budgetErr } = await supabase
    .from('clubs')
    .update({ budget: club.budget - fee })
    .eq('id', toClubId)
  if (budgetErr) throw budgetErr

  // Assign player and update market_value to agreed fee
  const { error: playerErr } = await supabase
    .from('players')
    .update({ club_id: toClubId, market_value: fee })
    .eq('id', playerId)
  if (playerErr) {
    // Rollback budget deduction
    await supabase.from('clubs').update({ budget: club.budget }).eq('id', toClubId)
    throw playerErr
  }

  // Record transfer
  const { error: transferErr } = await supabase
    .from('transfers')
    .insert({ player_id: playerId, from_club: null, to_club: toClubId, fee })
  if (transferErr) throw transferErr
}

/**
 * Release a player from their club back to free-agent pool.
 * Costs the club 50% of the player's market value (release compensation).
 */
export async function releasePlayer({ playerId, fromClubId, marketValue }) {
  const cost = Math.round(marketValue * 0.5)

  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .select('budget')
    .eq('id', fromClubId)
    .single()
  if (clubErr) throw clubErr

  const { error: budgetErr } = await supabase
    .from('clubs')
    .update({ budget: club.budget - cost })
    .eq('id', fromClubId)
  if (budgetErr) throw budgetErr

  const { error: playerErr } = await supabase
    .from('players')
    .update({ club_id: null })
    .eq('id', playerId)
  if (playerErr) {
    // Rollback budget deduction
    await supabase.from('clubs').update({ budget: club.budget }).eq('id', fromClubId)
    throw playerErr
  }

  const { error: transferErr } = await supabase
    .from('transfers')
    .insert({ player_id: playerId, from_club: fromClubId, to_club: null, fee: cost })
  if (transferErr) throw transferErr

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
