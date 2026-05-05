import { supabase } from '../lib/supabase'
import { uploadDataUrl } from './storage'

async function resolveBadgeUrl(badge, clubId) {
  if (!badge) return undefined
  if (!badge.preview || badge.preview.startsWith('http')) return undefined
  return uploadDataUrl('club-badges', `club-${clubId}`, badge.preview)
}

export async function fetchClubs() {
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function fetchClub(id) {
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createClub({ name, short_name, badge_color, budget, badge, is_national = false }) {
  const { data, error } = await supabase
    .from('clubs')
    .insert({ name, short_name, badge_color, budget, is_national })
    .select()
    .single()
  if (error) throw error

  const badge_url = await resolveBadgeUrl(badge, data.id)
  if (badge_url) {
    await supabase.from('clubs').update({ badge_url }).eq('id', data.id)
    data.badge_url = badge_url
  }

  return data
}

export async function updateClub(id, { name, short_name, badge_color, budget, badge, is_national }) {
  const badge_url = await resolveBadgeUrl(badge, id)

  const updates = {
    name, short_name, badge_color, budget, is_national,
    ...(badge_url !== undefined ? { badge_url } : {}),
    ...(badge === null ? { badge_url: null } : {}),
  }

  const { data, error } = await supabase
    .from('clubs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteClub(id) {
  const { error } = await supabase.from('clubs').delete().eq('id', id)
  if (error) throw error
}

export async function fetchClubRecords(clubId) {
  const [friendly, worldCup, league] = await Promise.all([
    supabase.from('friendly_match_events').select('player_id, event_type').eq('club_id', clubId),
    supabase.from('world_cup_match_events').select('player_id, event_type').eq('club_id', clubId),
    supabase.from('league_match_events').select('player_id, event_type').eq('club_id', clubId),
  ])

  const allEvents = [
    ...(friendly.data ?? []),
    ...(worldCup.data ?? []),
    ...(league.data ?? []),
  ]

  const tally = {}
  for (const e of allEvents) {
    if (!tally[e.player_id]) {
      tally[e.player_id] = { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0 }
    }
    tally[e.player_id][e.event_type] = (tally[e.player_id][e.event_type] || 0) + 1
  }

  const playerIds = Object.keys(tally)
  if (!playerIds.length) return { topScorers: [], topAssists: [], mostMvps: [], mostYellows: [], mostReds: [] }

  const { data: players } = await supabase
    .from('players')
    .select('*, clubs(id, name, short_name, badge_color, badge_url, is_national)')
    .in('id', playerIds)

  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, {
    ...p,
    club: p.clubs
  }]))

  const format = (type) => Object.entries(tally)
    .filter(([pid, v]) => v[type] > 0 && playerMap[pid])
    .sort((a, b) => b[1][type] - a[1][type])
    .slice(0, 10)
    .map(([pid, v]) => ({
      player: playerMap[pid],
      value: v[type]
    }))

  return {
    topScorers: format('goal'),
    topAssists: format('assist'),
    mostMvps: format('mvp'),
    mostYellows: format('yellow_card'),
    mostReds: format('red_card'),
  }
}
