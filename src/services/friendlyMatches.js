import { supabase } from '../lib/supabase'

// ─── Seasons ────────────────────────────────────────────────────────────────

export async function fetchSeasons() {
  const { data, error } = await supabase
    .from('friendly_seasons')
    .select('*')
    .order('number', { ascending: true })
  if (error) throw error
  return data
}

export async function getOrCreateActiveSeason() {
  // Try to find an existing active season
  const { data: active, error: e1 } = await supabase
    .from('friendly_seasons')
    .select('*')
    .eq('status', 'active')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (e1) throw e1
  if (active) return active

  // Check if any seasons exist to determine number
  const { data: all, error: e2 } = await supabase
    .from('friendly_seasons')
    .select('number')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (e2) throw e2

  const nextNumber = all ? all.number + 1 : 1
  const { data: created, error: e3 } = await supabase
    .from('friendly_seasons')
    .insert({ name: `Season ${nextNumber}`, number: nextNumber, status: 'active' })
    .select()
    .single()
  if (e3) throw e3
  return created
}

export async function createNextSeason(currentNumber) {
  const nextNumber = currentNumber + 1
  const { data, error } = await supabase
    .from('friendly_seasons')
    .insert({ name: `Season ${nextNumber}`, number: nextNumber, status: 'active' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function endSeason(seasonId) {
  // Mark season as completed
  const { error: e1 } = await supabase
    .from('friendly_seasons')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', seasonId)
  if (e1) throw e1

  // Insert player_awards for top performers
  await insertSeasonAwards(seasonId)
}

async function insertSeasonAwards(seasonId) {
  const { data: season } = await supabase
    .from('friendly_seasons')
    .select('name')
    .eq('id', seasonId)
    .single()

  const seasonName = season?.name ?? 'Season'

  // Get match IDs for this season first
  const { data: seasonMatches } = await supabase
    .from('friendly_matches')
    .select('id')
    .eq('season_id', seasonId)
  if (!seasonMatches || seasonMatches.length === 0) return
  const matchIds = seasonMatches.map(m => m.id)

  // Get all events for these matches
  const { data: events, error } = await supabase
    .from('friendly_match_events')
    .select('player_id, club_id, event_type')
    .in('match_id', matchIds)
  if (error || !events || events.length === 0) return

  // Tally by player + event_type
  const tally = {}
  events.forEach(ev => {
    const key = `${ev.player_id}__${ev.event_type}`
    if (!tally[key]) {
      tally[key] = { player_id: ev.player_id, event_type: ev.event_type, count: 0 }
    }
    tally[key].count++
  })

  // Find top per category
  const categories = ['goal', 'assist', 'mvp', 'yellow_card', 'red_card']
  const awardTypeMap = {
    goal: 'top_scorer', assist: 'top_assist', mvp: 'most_mvp',
    yellow_card: 'most_yellow', red_card: 'most_red',
  }
  const awards = []

  categories.forEach(cat => {
    const entries = Object.values(tally).filter(t => t.event_type === cat)
    if (entries.length === 0) return
    const maxCount = Math.max(...entries.map(e => e.count))
    entries.filter(e => e.count === maxCount).forEach(w => {
      awards.push({ player_id: w.player_id, season_id: seasonId, award_type: awardTypeMap[cat], season_name: seasonName })
    })
  })

  if (awards.length > 0) {
    await supabase.from('player_awards').insert(awards)
  }
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export async function fetchMatchesBySeason(seasonId) {
  const { data, error } = await supabase
    .from('friendly_matches')
    .select(`
      *,
      home_club:clubs!friendly_matches_home_club_id_fkey(id, name, short_name, badge_color, badge_url),
      away_club:clubs!friendly_matches_away_club_id_fkey(id, name, short_name, badge_color, badge_url)
    `)
    .eq('season_id', seasonId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createMatch({ seasonId, homeClubId, awayClubId, duration }) {
  const { data, error } = await supabase
    .from('friendly_matches')
    .insert({
      season_id: seasonId,
      home_club_id: homeClubId,
      away_club_id: awayClubId,
      duration,
      status: 'scheduled',
    })
    .select(`
      *,
      home_club:clubs!friendly_matches_home_club_id_fkey(id, name, short_name, badge_color, badge_url),
      away_club:clubs!friendly_matches_away_club_id_fkey(id, name, short_name, badge_color, badge_url)
    `)
    .single()
  if (error) throw error
  return data
}

export async function startMatch(matchId) {
  const { error } = await supabase
    .from('friendly_matches')
    .update({ status: 'live' })
    .eq('id', matchId)
  if (error) throw error
}

export async function cancelMatch(matchId) {
  // Delete events first (FK constraint)
  await supabase.from('friendly_match_events').delete().eq('match_id', matchId)
  // Delete the match
  const { error } = await supabase.from('friendly_matches').delete().eq('id', matchId)
  if (error) throw error
}

export async function completeMatch(matchId, { homeScore, awayScore, events = [] }) {
  // Update match result
  const { error: e1 } = await supabase
    .from('friendly_matches')
    .update({
      status: 'completed',
      home_score: homeScore,
      away_score: awayScore,
      played_at: new Date().toISOString(),
    })
    .eq('id', matchId)
  if (e1) throw e1

  // Bulk insert events
  if (events.length > 0) {
    const rows = events.map(ev => ({
      match_id: matchId,
      player_id: ev.player_id,
      club_id: ev.club_id,
      event_type: ev.event_type,
      minute: ev.minute ?? null,
    }))
    const { error: e2 } = await supabase.from('friendly_match_events').insert(rows)
    if (e2) throw e2
  }
}

export async function fetchMatchEvents(matchId) {
  const { data, error } = await supabase
    .from('friendly_match_events')
    .select(`
      *,
      player:players(id, name, photo_url, position),
      club:clubs(id, name, short_name, badge_color, badge_url)
    `)
    .eq('match_id', matchId)
    .order('minute', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

// ─── Season Stats ─────────────────────────────────────────────────────────────

export async function fetchSeasonStats(seasonId) {
  // Fetch all completed matches in the season
  const { data: matches, error: me } = await supabase
    .from('friendly_matches')
    .select(`
      *,
      home_club:clubs!friendly_matches_home_club_id_fkey(id, name, short_name, badge_color, badge_url),
      away_club:clubs!friendly_matches_away_club_id_fkey(id, name, short_name, badge_color, badge_url)
    `)
    .eq('season_id', seasonId)
    .eq('status', 'completed')
  if (me) throw me

  // Get all match IDs in this season (including non-completed)
  const { data: allMatches } = await supabase
    .from('friendly_matches')
    .select('id')
    .eq('season_id', seasonId)
  const matchIds = (allMatches ?? []).map(m => m.id)

  let events = []
  if (matchIds.length > 0) {
    const { data: evData, error: ee } = await supabase
      .from('friendly_match_events')
      .select(`
        *,
        player:players(id, name, photo_url, position),
        club:clubs(id, name, short_name, badge_color, badge_url)
      `)
      .in('match_id', matchIds)
    if (ee) throw ee
    events = evData ?? []
  }

  const standings = computeStandings(matches ?? [])
  const topPerformers = computeTopPerformers(events)

  return { standings, ...topPerformers }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStandings(matches) {
  const clubs = {}

  matches.forEach(m => {
    const hId = m.home_club_id
    const aId = m.away_club_id
    if (!clubs[hId]) clubs[hId] = { club: m.home_club, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }
    if (!clubs[aId]) clubs[aId] = { club: m.away_club, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }

    const hs = m.home_score ?? 0
    const as_ = m.away_score ?? 0

    clubs[hId].p++; clubs[aId].p++
    clubs[hId].gf += hs; clubs[hId].ga += as_
    clubs[aId].gf += as_; clubs[aId].ga += hs

    if (hs > as_) { clubs[hId].w++; clubs[aId].l++ }
    else if (hs < as_) { clubs[aId].w++; clubs[hId].l++ }
    else { clubs[hId].d++; clubs[aId].d++ }
  })

  return Object.values(clubs)
    .map(r => ({ ...r, gd: r.gf - r.ga, pts: r.w * 3 + r.d }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
}

function computeTopPerformers(events) {
  const byPlayer = {}

  events.forEach(ev => {
    const pid = ev.player_id
    if (!byPlayer[pid]) {
      byPlayer[pid] = {
        player: ev.player,
        club: ev.club,
        goals: 0, assists: 0, mvp: 0, yellows: 0, reds: 0,
      }
    }
    if (ev.event_type === 'goal')        byPlayer[pid].goals++
    if (ev.event_type === 'assist')      byPlayer[pid].assists++
    if (ev.event_type === 'mvp')         byPlayer[pid].mvp++
    if (ev.event_type === 'yellow_card') byPlayer[pid].yellows++
    if (ev.event_type === 'red_card')    byPlayer[pid].reds++
  })

  const all = Object.values(byPlayer)
  const top5By = (key) =>
    all
      .filter(p => p[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 5)
      .map(p => ({ ...p, value: p[key] }))

  return {
    topScorer:  top5By('goals'),
    topAssist:  top5By('assists'),
    mostMvp:    top5By('mvp'),
    mostYellow: top5By('yellows'),
    mostRed:    top5By('reds'),
  }
}
