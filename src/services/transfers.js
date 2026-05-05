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
  // 1. Fetch buyer club budget
  const { data: toClub, error: toClubErr } = await supabase
    .from('clubs')
    .select('budget')
    .eq('id', toClubId)
    .single()
  if (toClubErr) throw toClubErr
  if (toClub.budget < fee) throw new InsufficientBudgetError(fee, toClub.budget)

  // 2. Deduct budget from buyer
  const { error: budgetErr } = await supabase
    .from('clubs')
    .update({ budget: toClub.budget - fee })
    .eq('id', toClubId)
  if (budgetErr) throw budgetErr

  // 3. Add budget to seller if they exist
  if (fromClubId) {
    const { data: fromClub, error: fromClubErr } = await supabase
      .from('clubs')
      .select('budget')
      .eq('id', fromClubId)
      .single()
    if (!fromClubErr) {
      await supabase
        .from('clubs')
        .update({ budget: fromClub.budget + fee })
        .eq('id', fromClubId)
    }
  }

  // 4. Assign player and update market_value to agreed fee
  const { error: playerErr } = await supabase
    .from('players')
    .update({ club_id: toClubId, market_value: fee })
    .eq('id', playerId)
  if (playerErr) {
    // Basic rollback for buyer budget
    await supabase.from('clubs').update({ budget: toClub.budget }).eq('id', toClubId)
    throw playerErr
  }

  // 5. Record transfer
  const { error: transferErr } = await supabase
    .from('transfers')
    .insert({ player_id: playerId, from_club: fromClubId, to_club: toClubId, fee })
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
