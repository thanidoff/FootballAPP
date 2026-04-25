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
