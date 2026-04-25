import { supabase } from '../lib/supabase'
import { FIFA_NATIONS } from '../utils/fifaNations'

export const ROUND_NAMES = {
  1: 'Round of 16',
  2: 'Quarter Finals',
  3: 'Semi Finals',
  4: 'Final',
}

export const ROUND_NAMES_TH = {
  1: 'รอบ 16 ทีม',
  2: 'รอบก่อนรองชนะเลิศ',
  3: 'รอบรองชนะเลิศ',
  4: 'รอบชิงชนะเลิศ',
}

export async function seedNationalTeams() {
  const { data: existing } = await supabase
    .from('clubs')
    .select('name')
    .eq('is_national', true)

  const existingNames = new Set((existing ?? []).map(c => c.name))

  const toInsert = FIFA_NATIONS
    .filter(n => !existingNames.has(n.name))
    .map(n => ({
      name: n.name,
      short_name: n.code.replace('gb-', '').toUpperCase().slice(0, 3),
      badge_color: '#0A1318',
      budget: 0,
      is_national: true,
    }))

  if (!toInsert.length) return 0

  const { error } = await supabase.from('clubs').insert(toInsert)
  if (error) throw error
  return toInsert.length
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function fetchSeasons(type = 'national') {
  const { data, error } = await supabase
    .from('world_cup_seasons')
    .select('*, champion_club:clubs!world_cup_seasons_champion_club_id_fkey(*)')
    .eq('type', type)
    .order('number')
  if (error) throw error
  return data
}

export async function fetchNationalTeams() {
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('is_national', true)
    .order('name')
  if (error) throw error
  return data
}

export async function fetchClubTeams() {
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('is_national', false)
    .order('name')
  if (error) throw error
  return data
}

export async function createSeason(clubIds, type = 'national') {
  const { data: existing } = await supabase
    .from('world_cup_seasons')
    .select('number')
    .eq('type', type)
    .order('number', { ascending: false })
    .limit(1)
  const nextNumber = (existing?.[0]?.number ?? 0) + 1

  const { data: season, error: seasonErr } = await supabase
    .from('world_cup_seasons')
    .insert({ name: type === 'club' ? `Club Cup ${nextNumber}` : `World Cup ${nextNumber}`, number: nextNumber, current_round: 1, type })
    .select()
    .single()
  if (seasonErr) throw seasonErr

  const teamRows = clubIds.map(club_id => ({ season_id: season.id, club_id }))
  await supabase.from('world_cup_teams').insert(teamRows)

  const shuffled = shuffle(clubIds)
  const matchRows = []
  for (let i = 0; i < shuffled.length; i += 2) {
    matchRows.push({
      season_id: season.id,
      round: 1,
      match_order: Math.floor(i / 2) + 1,
      home_club_id: shuffled[i],
      away_club_id: shuffled[i + 1],
      status: 'scheduled',
    })
  }
  await supabase.from('world_cup_matches').insert(matchRows)

  return season
}

export async function fetchSeasonData(seasonId) {
  const { data: season, error: sErr } = await supabase
    .from('world_cup_seasons')
    .select('*, champion_club:clubs!world_cup_seasons_champion_club_id_fkey(*)')
    .eq('id', seasonId)
    .single()
  if (sErr) throw sErr

  const { data: matches, error: mErr } = await supabase
    .from('world_cup_matches')
    .select(`
      *,
      home_club:clubs!world_cup_matches_home_club_id_fkey(*),
      away_club:clubs!world_cup_matches_away_club_id_fkey(*),
      winner_club:clubs!world_cup_matches_winner_club_id_fkey(*)
    `)
    .eq('season_id', seasonId)
    .order('round')
    .order('match_order')
  if (mErr) throw mErr

  const matchesByRound = {}
  for (const m of matches ?? []) {
    if (!matchesByRound[m.round]) matchesByRound[m.round] = []
    matchesByRound[m.round].push(m)
  }

  return { season, matchesByRound }
}

export async function startMatch(matchId) {
  const { error } = await supabase
    .from('world_cup_matches')
    .update({ status: 'live' })
    .eq('id', matchId)
  if (error) throw error
}

export async function completeMatch(matchId, { homeScore, awayScore, events }) {
  const { data: match, error: fetchErr } = await supabase
    .from('world_cup_matches')
    .select('home_club_id, away_club_id')
    .eq('id', matchId)
    .single()
  if (fetchErr) throw fetchErr

  // In knockout, home wins on draw
  const winner_club_id = homeScore >= awayScore ? match.home_club_id : match.away_club_id

  const { error } = await supabase
    .from('world_cup_matches')
    .update({
      status: 'completed',
      home_score: homeScore,
      away_score: awayScore,
      winner_club_id,
      played_at: new Date().toISOString(),
    })
    .eq('id', matchId)
  if (error) throw error

  if (events.length > 0) {
    const eventRows = events.map(e => ({ ...e, match_id: matchId }))
    const { error: evErr } = await supabase
      .from('world_cup_match_events')
      .insert(eventRows)
    if (evErr) throw evErr
  }
}

export async function advanceToNextRound(seasonId, currentRound) {
  const { data: matches, error } = await supabase
    .from('world_cup_matches')
    .select('winner_club_id')
    .eq('season_id', seasonId)
    .eq('round', currentRound)
    .eq('status', 'completed')
  if (error) throw error

  const winners = shuffle((matches ?? []).map(m => m.winner_club_id))
  const nextRound = currentRound + 1

  const matchRows = []
  for (let i = 0; i < winners.length; i += 2) {
    matchRows.push({
      season_id: seasonId,
      round: nextRound,
      match_order: Math.floor(i / 2) + 1,
      home_club_id: winners[i],
      away_club_id: winners[i + 1],
      status: 'scheduled',
    })
  }
  await supabase.from('world_cup_matches').insert(matchRows)
  await supabase
    .from('world_cup_seasons')
    .update({ current_round: nextRound })
    .eq('id', seasonId)
}

export async function completeSeason(seasonId) {
  // Find champion = winner of round 4
  const { data: final } = await supabase
    .from('world_cup_matches')
    .select('winner_club_id')
    .eq('season_id', seasonId)
    .eq('round', 4)
    .single()

  await supabase
    .from('world_cup_seasons')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      champion_club_id: final?.winner_club_id ?? null,
    })
    .eq('id', seasonId)

  await _saveSeasonAwards(seasonId)
}

async function _saveSeasonAwards(seasonId) {
  const { data: matches } = await supabase
    .from('world_cup_matches')
    .select('id')
    .eq('season_id', seasonId)
    .eq('status', 'completed')

  if (!matches?.length) return
  const matchIds = matches.map(m => m.id)

  const { data: events } = await supabase
    .from('world_cup_match_events')
    .select('player_id, club_id, event_type')
    .in('match_id', matchIds)

  if (!events?.length) return

  const { data: season } = await supabase
    .from('world_cup_seasons')
    .select('name')
    .eq('id', seasonId)
    .single()

  const tally = {}
  for (const e of events) {
    if (!tally[e.player_id]) {
      tally[e.player_id] = { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0, club_id: e.club_id }
    }
    tally[e.player_id][e.event_type] = (tally[e.player_id][e.event_type] || 0) + 1
  }

  const topOf = (type) => Object.entries(tally)
    .filter(([, v]) => v[type] > 0)
    .sort((a, b) => b[1][type] - a[1][type])[0]

  const awards = [
    { type: 'top_scorer',  entry: topOf('goal') },
    { type: 'top_assist',  entry: topOf('assist') },
    { type: 'most_mvp',    entry: topOf('mvp') },
    { type: 'most_yellow', entry: topOf('yellow_card') },
    { type: 'most_red',    entry: topOf('red_card') },
  ].filter(a => a.entry)

  if (!awards.length) return

  const rows = awards.map(a => ({
    player_id:   a.entry[0],
    club_id:     tally[a.entry[0]].club_id,
    season_id:   seasonId,
    award_type:  a.type,
    season_name: season?.name ?? '',
  }))

  await supabase.from('player_awards').upsert(rows, { onConflict: 'player_id,season_id,award_type' })
}

export async function fetchMatchEvents(matchId) {
  const { data, error } = await supabase
    .from('world_cup_match_events')
    .select('*, player:players(id, name, photo_url), club:clubs(id, name, short_name, badge_color, badge_url)')
    .eq('match_id', matchId)
    .order('minute', { nullsLast: true })
  if (error) throw error
  return data ?? []
}

export async function fetchSeasonStats(seasonId) {
  const { data: matches } = await supabase
    .from('world_cup_matches')
    .select('id')
    .eq('season_id', seasonId)
    .eq('status', 'completed')

  if (!matches?.length) {
    return { topScorer: [], topAssist: [], mostMvp: [], mostYellow: [], mostRed: [] }
  }

  const matchIds = matches.map(m => m.id)
  const { data: events } = await supabase
    .from('world_cup_match_events')
    .select('player_id, club_id, event_type')
    .in('match_id', matchIds)

  if (!events?.length) {
    return { topScorer: [], topAssist: [], mostMvp: [], mostYellow: [], mostRed: [] }
  }

  const playerIds = [...new Set(events.map(e => e.player_id))]
  const clubIds   = [...new Set(events.map(e => e.club_id).filter(Boolean))]

  const [{ data: players }, { data: clubs }] = await Promise.all([
    supabase.from('players').select('id, name, photo_url').in('id', playerIds),
    supabase.from('clubs').select('id, name, short_name, badge_color, badge_url').in('id', clubIds),
  ])

  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, p]))
  const clubMap   = Object.fromEntries((clubs ?? []).map(c => [c.id, c]))

  const tally = {}
  for (const e of events) {
    if (!tally[e.player_id]) {
      tally[e.player_id] = { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0, club_id: e.club_id }
    }
    tally[e.player_id][e.event_type] = (tally[e.player_id][e.event_type] || 0) + 1
  }

  const topOf = (type) => Object.entries(tally)
    .filter(([, v]) => v[type] > 0)
    .sort((a, b) => b[1][type] - a[1][type])
    .slice(0, 5)
    .map(([pid, v]) => ({
      player: playerMap[pid],
      club:   clubMap[v.club_id],
      value:  v[type],
    }))

  return {
    topScorer:  topOf('goal'),
    topAssist:  topOf('assist'),
    mostMvp:    topOf('mvp'),
    mostYellow: topOf('yellow_card'),
    mostRed:    topOf('red_card'),
  }
}
