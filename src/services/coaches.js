import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { uploadDataUrl } from './storage'
import { MOCK_COACHES, MOCK_CLUBS } from '../data/mockGameData'

const COACHES_STORAGE_KEY = 'football_app_mock_coaches_v1'

function loadSavedMockCoaches() {
  try {
    const raw = localStorage.getItem(COACHES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.warn('Failed to load mock coaches from localStorage', err)
  }
  return [...MOCK_COACHES]
}

let mockCoachesState = loadSavedMockCoaches()

function saveMockCoachesState() {
  try {
    localStorage.setItem(COACHES_STORAGE_KEY, JSON.stringify(mockCoachesState))
  } catch (err) {
    console.warn('Failed to save mock coaches to localStorage', err)
  }
}

export function calculateCoachOVR(stats) {
  const tac = Number(stats?.stat_tac ?? stats?.TAC ?? 70)
  const mgt = Number(stats?.stat_mgt ?? stats?.MGT ?? 70)
  const mot = Number(stats?.stat_mot ?? stats?.MOT ?? 70)
  const att = Number(stats?.stat_att ?? stats?.ATT ?? 70)
  const def = Number(stats?.stat_def ?? stats?.DEF ?? 70)
  const phy = Number(stats?.stat_phy ?? stats?.PHY ?? 70)
  return Math.round((tac + mgt + mot + att + def + phy) / 6.0)
}

export function mapRowToCoach(row, clubsList = MOCK_CLUBS) {
  const stats = {
    TAC: row.stat_tac ?? 70,
    MGT: row.stat_mgt ?? 70,
    MOT: row.stat_mot ?? 70,
    ATT: row.stat_att ?? 70,
    DEF: row.stat_def ?? 70,
    PHY: row.stat_phy ?? 70,
  }
  const ovr = row.ovr ?? calculateCoachOVR(stats)

  let club = row.clubs ?? null
  if (!club && row.club_id) {
    const found = (clubsList || MOCK_CLUBS).find(c => String(c.id || c.club_id) === String(row.club_id))
    if (found) {
      club = {
        id: found.id || found.club_id,
        name: found.name || found.club_name,
        short_name: found.short_name || found.name,
        badge_color: found.badge_color,
        badge_url: found.badge_url
      }
    }
  }

  return {
    id: row.id,
    name: row.name,
    nationality: row.nationality,
    age: row.age,
    club_id: row.club_id ?? null,
    club,
    market_value: row.market_value ?? 2000000,
    photo_url: row.photo_url ?? null,
    ovr,
    stats,
    created_at: row.created_at,
  }
}

async function resolvePhotoUrl(photo, coachId) {
  if (!photo) return undefined
  if (!photo.preview || photo.preview.startsWith('http')) return undefined
  return uploadDataUrl('coach-photos', `coach-${coachId}`, photo.preview)
}

function getMockCoachesFiltered({ clubId, freeAgentsOnly, nationality } = {}) {
  let coaches = [...mockCoachesState]
  if (clubId) coaches = coaches.filter(c => String(c.club_id) === String(clubId))
  if (freeAgentsOnly) coaches = coaches.filter(c => !c.club_id)
  if (nationality) coaches = coaches.filter(c => c.nationality === nationality)
  return coaches.map(c => mapRowToCoach(c)).sort((a, b) => b.ovr - a.ovr)
}

export async function fetchCoaches(params = {}) {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('coaches')
        .select('*, clubs(id, name, short_name, badge_color, badge_url)')

      if (params.clubId) query = query.eq('club_id', params.clubId)
      if (params.nationality) query = query.eq('nationality', params.nationality)
      if (params.freeAgentsOnly) query = query.is('club_id', null)

      query = query.order('ovr', { ascending: false })

      const { data, error } = await query
      if (!error && data) {
        return data.map(c => mapRowToCoach(c))
      }
      console.warn('Supabase coaches table not found or error, falling back to mock coaches:', error?.message)
    } catch (err) {
      console.warn('Supabase query exception, falling back to mock coaches:', err.message)
    }
  }

  return getMockCoachesFiltered(params)
}

export async function fetchCoach(id) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*, clubs(id, name, short_name, badge_color, badge_url)')
        .eq('id', id)
        .single()
      if (!error && data) return mapRowToCoach(data)
    } catch (err) {
      console.warn('Supabase query exception for single coach:', err.message)
    }
  }

  const coach = mockCoachesState.find(c => String(c.id) === String(id))
  if (!coach) throw new Error('Coach not found')
  return mapRowToCoach(coach)
}

export async function createCoach({ name, nationality, age, market_value, stats, photo, club_id }) {
  const stat_tac = Number(stats?.TAC ?? 70)
  const stat_mgt = Number(stats?.MGT ?? 70)
  const stat_mot = Number(stats?.MOT ?? 70)
  const stat_att = Number(stats?.ATT ?? 70)
  const stat_def = Number(stats?.DEF ?? 70)
  const stat_phy = Number(stats?.PHY ?? 70)

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .insert({
          name,
          nationality,
          age: Number(age),
          market_value: Number(market_value),
          club_id: club_id || null,
          stat_tac, stat_mgt, stat_mot, stat_att, stat_def, stat_phy,
        })
        .select('*, clubs(id, name, short_name, badge_color, badge_url)')
        .single()

      if (!error && data) {
        const photo_url = await resolvePhotoUrl(photo, data.id)
        if (photo_url) {
          await supabase.from('coaches').update({ photo_url }).eq('id', data.id)
          data.photo_url = photo_url
        }
        return mapRowToCoach(data)
      }
    } catch (err) {
      console.warn('Supabase create coach failed, using local mock:', err.message)
    }
  }

  // Fallback to local mock state
  const newCoach = {
    id: `mock-coach-${Date.now()}`,
    name,
    nationality: nationality || 'Thailand',
    age: Number(age) || 45,
    market_value: Number(market_value) || 2000000,
    club_id: club_id || null,
    photo_url: photo?.preview || null,
    stat_tac, stat_mgt, stat_mot, stat_att, stat_def, stat_phy,
    created_at: new Date().toISOString(),
  }
  mockCoachesState.push(newCoach)
  saveMockCoachesState()
  return mapRowToCoach(newCoach)
}

export async function updateCoach(id, { name, nationality, age, market_value, stats, photo, club_id }) {
  if (isSupabaseConfigured) {
    try {
      const photo_url = await resolvePhotoUrl(photo, id)
      const updates = {
        ...(name !== undefined ? { name } : {}),
        ...(nationality !== undefined ? { nationality } : {}),
        ...(age !== undefined ? { age: Number(age) } : {}),
        ...(market_value !== undefined ? { market_value: Number(market_value) } : {}),
        ...(club_id !== undefined ? { club_id: club_id || null } : {}),
        ...(stats ? {
          stat_tac: Number(stats.TAC ?? 70),
          stat_mgt: Number(stats.MGT ?? 70),
          stat_mot: Number(stats.MOT ?? 70),
          stat_att: Number(stats.ATT ?? 70),
          stat_def: Number(stats.DEF ?? 70),
          stat_phy: Number(stats.PHY ?? 70),
        } : {}),
        ...(photo_url !== undefined ? { photo_url } : {}),
      }

      const { data, error } = await supabase
        .from('coaches')
        .update(updates)
        .eq('id', id)
        .select('*, clubs(id, name, short_name, badge_color, badge_url)')
        .single()

      if (!error && data) return mapRowToCoach(data)
    } catch (err) {
      console.warn('Supabase update coach failed, using local mock:', err.message)
    }
  }

  // Fallback to local mock state
  const idx = mockCoachesState.findIndex(c => String(c.id) === String(id))
  if (idx !== -1) {
    mockCoachesState[idx] = {
      ...mockCoachesState[idx],
      ...(name !== undefined ? { name } : {}),
      ...(nationality !== undefined ? { nationality } : {}),
      ...(age !== undefined ? { age: Number(age) } : {}),
      ...(market_value !== undefined ? { market_value: Number(market_value) } : {}),
      ...(club_id !== undefined ? { club_id: club_id || null } : {}),
      ...(photo?.preview ? { photo_url: photo.preview } : {}),
      ...(stats ? {
        stat_tac: Number(stats.TAC ?? 70),
        stat_mgt: Number(stats.MGT ?? 70),
        stat_mot: Number(stats.MOT ?? 70),
        stat_att: Number(stats.ATT ?? 70),
        stat_def: Number(stats.DEF ?? 70),
        stat_phy: Number(stats.PHY ?? 70),
      } : {}),
    }
    saveMockCoachesState()
    return mapRowToCoach(mockCoachesState[idx])
  }
}

export async function deleteCoach(id) {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('coaches').delete().eq('id', id)
      if (!error) return
    } catch (err) {
      console.warn('Supabase delete coach failed, deleting from local mock:', err.message)
    }
  }
  mockCoachesState = mockCoachesState.filter(c => String(c.id) !== String(id))
  saveMockCoachesState()
}

export async function signCoach(coachId, targetClubId) {
  // Check maximum 2 coaches rule
  const existingCoaches = await fetchCoaches({ clubId: targetClubId })
  if (existingCoaches.length >= 2) {
    throw new Error('สโมสรนี้มีโค้ชครบ 2 คนแล้ว (จำกัดสูงสุด 2 คน)')
  }

  return updateCoach(coachId, { club_id: targetClubId })
}

export async function releaseCoach(coachId) {
  return updateCoach(coachId, { club_id: null })
}
