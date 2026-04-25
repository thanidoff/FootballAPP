import { supabase } from '../lib/supabase'

async function deleteTables(tables) {
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
  }
}

export async function resetFriendlyData() {
  await deleteTables(['friendly_match_events', 'friendly_matches', 'player_awards', 'friendly_seasons'])
}

export async function resetWorldCupData() {
  await deleteTables(['world_cup_match_events', 'world_cup_matches', 'world_cup_teams', 'world_cup_seasons'])
}

export async function resetLeagueData() {
  await deleteTables(['league_match_events', 'league_matches', 'league_teams', 'league_seasons'])
}

export async function resetAllMatchData() {
  await resetFriendlyData()
  await resetWorldCupData()
  await resetLeagueData()
}

export async function releaseAllPlayers() {
  const { error } = await supabase
    .from('players')
    .update({ club_id: null })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}
