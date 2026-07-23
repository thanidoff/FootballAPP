import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { uploadDataUrl } from './storage'
import { MOCK_PLAYERS } from '../data/mockGameData'
import { calculateOVR, normalizeStats } from '../utils/stats'

function mapStatsToRow(position, stats) {
  const current = normalizeStats(stats)
  const safe = stats || {}
  return {
    stat_pac: current.PAC, stat_sho: current.SHO,
    stat_pas: current.PAS, stat_dri: current.DRI,
    stat_def: current.DEF, stat_phy: current.PHY,
    stat_sav: current.SAV, stat_gka: current.GKA,
    // Mirror the current model into the legacy GK fields so restored clients and
    // exports remain useful without discarding their historical column layout.
    stat_div: safe.DIV ?? current.SAV,
    stat_han: safe.HAN ?? current.SAV,
    stat_kic: safe.KIC ?? current.PAS,
    stat_ref: safe.REF ?? current.SAV,
    stat_spd: safe.SPD ?? current.PAC,
    stat_pos: safe.POS ?? current.GKA,
  }
}

function mapRowToStats(row) {
  return {
    DIV: row.stat_div, HAN: row.stat_han, KIC: row.stat_kic,
    REF: row.stat_ref, SPD: row.stat_spd, POS: row.stat_pos,
    PAC: row.stat_pac, SHO: row.stat_sho, PAS: row.stat_pas,
    DRI: row.stat_dri, DEF: row.stat_def, PHY: row.stat_phy,
    SAV: row.stat_sav, GKA: row.stat_gka,
  }
}

export function mapRowToPlayer(row) {
  const stats = mapRowToStats(row)
  return {
    id: row.id,
    name: row.name,
    nationality: row.nationality,
    age: row.age,
    position: row.position,
    club_id: row.club_id,
    club: row.clubs ?? null,
    market_value: row.market_value,
    ovr: row.ovr_v2 ?? calculateOVR(row.position, stats) ?? row.ovr,
    roster_order: row.roster_order ?? null,
    national_roster_order: row.national_roster_order ?? null,
    photo_url: row.photo_url ?? null,
    stats,
    created_at: row.created_at,
  }
}

async function resolvePhotoUrl(photo, playerId) {
  if (!photo) return undefined
  if (!photo.preview || photo.preview.startsWith('http')) return undefined
  return uploadDataUrl('player-photos', `player-${playerId}`, photo.preview)
}

export async function fetchPlayers({ clubId, freeAgentsOnly, nationality } = {}) {
  if (!isSupabaseConfigured) {
    let players = MOCK_PLAYERS
    if (clubId) players = players.filter(player => player.club_id === clubId)
    if (freeAgentsOnly) players = players.filter(player => !player.club_id)
    if (nationality) players = players.filter(player => player.nationality === nationality)
    return players
      .map(player => mapRowToPlayer({ ...player }))
      .sort((a, b) => b.ovr - a.ovr)
  }

  let query = supabase
    .from('players')
    .select('*, clubs(id, name, short_name, badge_color, badge_url)')

  if (clubId) {
    query = query.eq('club_id', clubId).order('roster_order', { ascending: true, nullsFirst: false }).order('ovr_v2', { ascending: false })
  } else if (nationality) {
    query = query.eq('nationality', nationality).order('national_roster_order', { ascending: true, nullsFirst: false }).order('ovr_v2', { ascending: false })
  } else {
    query = query.order('ovr_v2', { ascending: false })
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
  const results = await Promise.all(
    updates.map(({ id, roster_order }) =>
      supabase.from('players').update({ roster_order }).eq('id', id)
    )
  )
  const failed = results.find(result => result.error)
  if (failed) throw failed.error
}

export async function saveNationalRosterOrder(slots) {
  const updates = slots
    .map((player, idx) => player ? { id: player.id, national_roster_order: idx } : null)
    .filter(Boolean)
  if (!updates.length) return
  const results = await Promise.all(
    updates.map(({ id, national_roster_order }) =>
      supabase.from('players').update({ national_roster_order }).eq('id', id)
    )
  )
  const failed = results.find(result => result.error)
  if (failed) throw failed.error
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
    const { error: photoError } = await supabase.from('players').update({ photo_url }).eq('id', data.id)
    if (photoError) throw photoError
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
  const eventError = [friendly.error, worldCup.error, league.error].find(Boolean)
  if (eventError) throw eventError

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
  const { data: awards, error: awardsError } = await supabase
    .from('player_awards')
    .select('*, club:clubs(id, name, short_name, badge_color, badge_url, is_national)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
  if (awardsError) throw awardsError

  return {
    history: Object.values(historyMap),
    awards: awards ?? []
  }
}
