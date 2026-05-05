import { supabase } from '../lib/supabase'
import { uploadDataUrl } from './storage'

function mapStatsToRow(position, stats) {
  if (position === 'GK') {
    return {
      stat_div: stats.DIV ?? 50, stat_han: stats.HAN ?? 50,
      stat_kic: stats.KIC ?? 50, stat_ref: stats.REF ?? 50,
      stat_spd: stats.SPD ?? 50, stat_pos: stats.POS ?? 50,
      stat_pac: 50, stat_sho: 50, stat_pas: 50,
      stat_dri: 50, stat_def: 50, stat_phy: 50,
    }
  }
  return {
    stat_pac: stats.PAC ?? 50, stat_sho: stats.SHO ?? 50,
    stat_pas: stats.PAS ?? 50, stat_dri: stats.DRI ?? 50,
    stat_def: stats.DEF ?? 50, stat_phy: stats.PHY ?? 50,
    stat_div: 50, stat_han: 50, stat_kic: 50,
    stat_ref: 50, stat_spd: 50, stat_pos: 50,
  }
}

function mapRowToStats(row) {
  return {
    DIV: row.stat_div, HAN: row.stat_han, KIC: row.stat_kic,
    REF: row.stat_ref, SPD: row.stat_spd, POS: row.stat_pos,
    PAC: row.stat_pac, SHO: row.stat_sho, PAS: row.stat_pas,
    DRI: row.stat_dri, DEF: row.stat_def, PHY: row.stat_phy,
  }
}

export function mapRowToPlayer(row) {
  return {
    id: row.id,
    name: row.name,
    nationality: row.nationality,
    age: row.age,
    position: row.position,
    club_id: row.club_id,
    club: row.clubs ?? null,
    market_value: row.market_value,
    ovr: row.ovr,
    roster_order: row.roster_order ?? null,
    national_roster_order: row.national_roster_order ?? null,
    photo_url: row.photo_url ?? null,
    stats: mapRowToStats(row),
    created_at: row.created_at,
  }
}

async function resolvePhotoUrl(photo, playerId) {
  if (!photo) return undefined
  if (!photo.preview || photo.preview.startsWith('http')) return undefined
  return uploadDataUrl('player-photos', `player-${playerId}`, photo.preview)
}

export async function fetchPlayers({ clubId, freeAgentsOnly, nationality } = {}) {
  let query = supabase
    .from('players')
    .select('*, clubs(id, name, short_name, badge_color, badge_url)')

  if (clubId) {
    query = query.eq('club_id', clubId).order('roster_order', { ascending: true, nullsFirst: false }).order('ovr', { ascending: false })
  } else if (nationality) {
    query = query.eq('nationality', nationality).order('national_roster_order', { ascending: true, nullsFirst: false }).order('ovr', { ascending: false })
  } else {
    query = query.order('ovr', { ascending: false })
  }

  if (freeAgentsOnly) query = query.is('club_id', null)

  const { data, error } = await query
  if (error) throw error
  return data.map(mapRowToPlayer)
}

export async function saveRosterOrder(slots) {
  const updates = slots
    .map((player, idx) => player ? { id: player.id, roster_order: idx } : null)
    .filter(Boolean)
  if (!updates.length) return
  await Promise.all(
    updates.map(({ id, roster_order }) =>
      supabase.from('players').update({ roster_order }).eq('id', id)
    )
  )
}

export async function saveNationalRosterOrder(slots) {
  const updates = slots
    .map((player, idx) => player ? { id: player.id, national_roster_order: idx } : null)
    .filter(Boolean)
  if (!updates.length) return
  await Promise.all(
    updates.map(({ id, national_roster_order }) =>
      supabase.from('players').update({ national_roster_order }).eq('id', id)
    )
  )
}

export async function fetchPlayer(id) {
  const { data, error } = await supabase
    .from('players')
    .select('*, clubs(id, name, short_name, badge_color, badge_url)')
    .eq('id', id)
    .single()
  if (error) throw error
  return mapRowToPlayer(data)
}

export async function createPlayer({ name, nationality, age, position, market_value, stats, photo, club_id }) {
  const { data, error } = await supabase
    .from('players')
    .insert({ name, nationality, age, position, market_value, club_id: club_id || null, ...mapStatsToRow(position, stats) })
    .select('*, clubs(id, name, short_name, badge_color, badge_url)')
    .single()
  if (error) throw error

  const photo_url = await resolvePhotoUrl(photo, data.id)
  if (photo_url) {
    await supabase.from('players').update({ photo_url }).eq('id', data.id)
    data.photo_url = photo_url
  }

  return mapRowToPlayer(data)
}

export async function updatePlayer(id, { name, nationality, age, position, market_value, stats, photo, club_id }) {
  const photo_url = await resolvePhotoUrl(photo, id)

  const updates = {
    name, nationality, age, position, market_value,
    club_id: club_id || null,
    ...mapStatsToRow(position, stats),
    ...(photo_url !== undefined ? { photo_url } : {}),
    ...(photo === null ? { photo_url: null } : {}),
  }

  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .select('*, clubs(id, name, short_name, badge_color, badge_url)')
    .single()
  if (error) throw error
  return mapRowToPlayer(data)
}

export async function deletePlayer(id) {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

export async function fetchPlayerHistory(playerId) {
  // Query all 3 event tables in parallel
  const [friendly, worldCup, league] = await Promise.all([
    supabase
      .from('friendly_match_events')
      .select('*, club:clubs(id, name, short_name, badge_color, badge_url, is_national)')
      .eq('player_id', playerId),
    supabase
      .from('world_cup_match_events')
      .select('*, club:clubs(id, name, short_name, badge_color, badge_url, is_national)')
      .eq('player_id', playerId),
    supabase
      .from('league_match_events')
      .select('*, club:clubs(id, name, short_name, badge_color, badge_url, is_national)')
      .eq('player_id', playerId),
  ])

  const allEvents = [
    ...(friendly.data ?? []),
    ...(worldCup.data ?? []),
    ...(league.data ?? []),
  ]

  // Group by club_id
  const historyMap = {}
  for (const e of allEvents) {
    const clubId = e.club_id
    if (!clubId) continue
    
    if (!historyMap[clubId]) {
      historyMap[clubId] = {
        club: e.club,
        stats: { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0 }
      }
    }
    historyMap[clubId].stats[e.event_type] = (historyMap[clubId].stats[e.event_type] || 0) + 1
  }

  // Also fetch awards
  const { data: awards } = await supabase
    .from('player_awards')
    .select('*, club:clubs(id, name, short_name, badge_color, badge_url, is_national)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  return {
    history: Object.values(historyMap),
    awards: awards ?? []
  }
}
