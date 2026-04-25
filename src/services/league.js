import { supabase } from '../lib/supabase'

// Circle-method round-robin for 6 teams → 5 rounds × 3 matches
function generateRoundRobin(teamIds) {
  const n = teamIds.length
  let circle = [...teamIds]
  const rounds = []
  for (let r = 0; r < n - 1; r++) {
    const matches = []
    for (let i = 0; i < n / 2; i++) {
      matches.push([circle[i], circle[n - 1 - i]])
    }
    rounds.push(matches)
    // Rotate: fix [0], move last to [1], shift rest right
    const last = circle[n - 1]
    circle = [circle[0], last, ...circle.slice(1, n - 1)]
  }
  return rounds
}

export function computeStandings(teams, matches) {
  const table = {}
  for (const t of teams) {
    table[t.club_id] = { club: t.club, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }
  }
  for (const m of matches) {
    if (m.status !== 'completed' || m.is_final) continue
    if (m.home_score == null || m.away_score == null) continue
    const h = table[m.home_club_id]
    const a = m.away_club_id ? table[m.away_club_id] : null
    if (!h) continue
    h.played++; h.gf += m.home_score; h.ga += m.away_score
    if (a) { a.played++; a.gf += m.away_score; a.ga += m.home_score }
    if (m.home_score > m.away_score) {
      h.won++; h.points += 3
      if (a) a.lost++
    } else if (m.home_score === m.away_score) {
      h.drawn++; h.points += 1
      if (a) { a.drawn++; a.points += 1 }
    } else {
      h.lost++
      if (a) { a.won++; a.points += 3 }
    }
  }
  return Object.values(table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gd = (b.gf - b.ga) - (a.gf - a.ga)
    if (gd !== 0) return gd
    return b.gf - a.gf
  })
}

export async function fetchLeagueSeasons() {
  const { data, error } = await supabase
    .from('league_seasons')
    .select('*, champion_club:clubs!league_seasons_champion_club_id_fkey(*)')
    .order('number')
  if (error) throw error
  return data
}

export async function createLeagueSeason(clubIds) {
  const { data: existing } = await supabase
    .from('league_seasons')
    .select('number')
    .order('number', { ascending: false })
    .limit(1)
  const nextNumber = (existing?.[0]?.number ?? 0) + 1

  const { data: season, error: sErr } = await supabase
    .from('league_seasons')
    .insert({ name: `League Season ${nextNumber}`, number: nextNumber })
    .select()
    .single()
  if (sErr) throw sErr

  await supabase.from('league_teams').insert(clubIds.map(club_id => ({ season_id: season.id, club_id })))

  const firstLeg = generateRoundRobin(clubIds)
  const matchRows = []
  // Weeks 1-5: first leg
  firstLeg.forEach((round, ri) => {
    round.forEach(([home, away], mi) => {
      matchRows.push({ season_id: season.id, week: ri + 1, match_order: mi + 1, home_club_id: home, away_club_id: away })
    })
  })
  // Weeks 6-10: second leg (swap home/away)
  firstLeg.forEach((round, ri) => {
    round.forEach(([home, away], mi) => {
      matchRows.push({ season_id: season.id, week: ri + 6, match_order: mi + 1, home_club_id: away, away_club_id: home })
    })
  })
  await supabase.from('league_matches').insert(matchRows)
  return season
}

export async function fetchLeagueSeasonData(seasonId) {
  const { data: season, error: sErr } = await supabase
    .from('league_seasons')
    .select('*, champion_club:clubs!league_seasons_champion_club_id_fkey(*)')
    .eq('id', seasonId)
    .single()
  if (sErr) throw sErr

  const { data: teams, error: tErr } = await supabase
    .from('league_teams')
    .select('club_id, club:clubs(*)')
    .eq('season_id', seasonId)
  if (tErr) throw tErr

  const { data: matches, error: mErr } = await supabase
    .from('league_matches')
    .select(`
      *,
      home_club:clubs!league_matches_home_club_id_fkey(*),
      away_club:clubs!league_matches_away_club_id_fkey(*)
    `)
    .eq('season_id', seasonId)
    .order('week')
    .order('match_order')
  if (mErr) throw mErr

  const matchesByWeek = {}
  for (const m of matches ?? []) {
    if (!matchesByWeek[m.week]) matchesByWeek[m.week] = []
    matchesByWeek[m.week].push(m)
  }

  const standings = computeStandings(teams ?? [], matches ?? [])
  return { season, matchesByWeek, standings, teams: teams ?? [] }
}

export async function startLeagueMatch(matchId) {
  const { error } = await supabase
    .from('league_matches')
    .update({ status: 'live' })
    .eq('id', matchId)
  if (error) throw error
}

export async function completeLeagueMatch(matchId, { homeScore, awayScore, events }) {
  const { error } = await supabase
    .from('league_matches')
    .update({ status: 'completed', home_score: homeScore, away_score: awayScore, played_at: new Date().toISOString() })
    .eq('id', matchId)
  if (error) throw error

  if (events.length > 0) {
    const { error: evErr } = await supabase.from('league_match_events').insert(events.map(e => ({ ...e, match_id: matchId })))
    if (evErr) throw evErr
  }
}

export async function advanceLeagueWeek(seasonId, currentWeek) {
  const { error } = await supabase
    .from('league_seasons')
    .update({ current_week: currentWeek + 1 })
    .eq('id', seasonId)
  if (error) throw error
}

export async function createFinalMatch(seasonId, homeClubId) {
  await supabase.from('league_matches').insert({
    season_id: seasonId,
    week: 11,
    match_order: 1,
    home_club_id: homeClubId,
    away_club_id: null,
    status: 'scheduled',
    is_final: true,
  })
  await supabase
    .from('league_seasons')
    .update({ current_week: 11, champion_club_id: homeClubId })
    .eq('id', seasonId)
}

export async function completeLeagueSeason(seasonId) {
  await supabase
    .from('league_seasons')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', seasonId)
  await _saveLeagueAwards(seasonId)
}

async function _saveLeagueAwards(seasonId) {
  const { data: matches } = await supabase.from('league_matches').select('id').eq('season_id', seasonId).eq('status', 'completed')
  if (!matches?.length) return
  const matchIds = matches.map(m => m.id)
  const { data: events } = await supabase.from('league_match_events').select('player_id, club_id, event_type').in('match_id', matchIds)
  if (!events?.length) return

  const { data: season } = await supabase.from('league_seasons').select('name').eq('id', seasonId).single()

  const tally = {}
  for (const e of events) {
    if (!tally[e.player_id]) tally[e.player_id] = { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0, club_id: e.club_id }
    tally[e.player_id][e.event_type] = (tally[e.player_id][e.event_type] || 0) + 1
  }
  const topOf = (type) => Object.entries(tally).filter(([, v]) => v[type] > 0).sort((a, b) => b[1][type] - a[1][type])[0]
  const awards = [
    { type: 'top_scorer', entry: topOf('goal') },
    { type: 'top_assist', entry: topOf('assist') },
    { type: 'most_mvp', entry: topOf('mvp') },
    { type: 'most_yellow', entry: topOf('yellow_card') },
    { type: 'most_red', entry: topOf('red_card') },
  ].filter(a => a.entry)
  if (!awards.length) return
  const rows = awards.map(a => ({
    player_id: a.entry[0], club_id: tally[a.entry[0]].club_id,
    season_id: seasonId, award_type: a.type, season_name: season?.name ?? '',
  }))
  await supabase.from('player_awards').upsert(rows, { onConflict: 'player_id,season_id,award_type' })
}

export async function fetchLeagueMatchEvents(matchId) {
  const { data, error } = await supabase
    .from('league_match_events')
    .select('*, player:players(id, name, photo_url), club:clubs(id, name, short_name, badge_color, badge_url)')
    .eq('match_id', matchId)
    .order('minute', { nullsLast: true })
  if (error) throw error
  return data ?? []
}

export async function fetchLeagueStats(seasonId) {
  const { data: matches } = await supabase.from('league_matches').select('id').eq('season_id', seasonId).eq('status', 'completed')
  if (!matches?.length) return { topScorer: [], topAssist: [], mostMvp: [], mostYellow: [], mostRed: [] }

  const matchIds = matches.map(m => m.id)
  const { data: events } = await supabase.from('league_match_events').select('player_id, club_id, event_type').in('match_id', matchIds)
  if (!events?.length) return { topScorer: [], topAssist: [], mostMvp: [], mostYellow: [], mostRed: [] }

  const playerIds = [...new Set(events.map(e => e.player_id))]
  const clubIds = [...new Set(events.map(e => e.club_id).filter(Boolean))]
  const [{ data: players }, { data: clubs }] = await Promise.all([
    supabase.from('players').select('id, name, photo_url').in('id', playerIds),
    supabase.from('clubs').select('id, name, short_name, badge_color, badge_url').in('id', clubIds),
  ])
  const playerMap = Object.fromEntries((players ?? []).map(p => [p.id, p]))
  const clubMap = Object.fromEntries((clubs ?? []).map(c => [c.id, c]))
  const tally = {}
  for (const e of events) {
    if (!tally[e.player_id]) tally[e.player_id] = { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0, club_id: e.club_id }
    tally[e.player_id][e.event_type] = (tally[e.player_id][e.event_type] || 0) + 1
  }
  const topOf = (type) => Object.entries(tally)
    .filter(([, v]) => v[type] > 0)
    .sort((a, b) => b[1][type] - a[1][type])
    .slice(0, 5)
    .map(([pid, v]) => ({ player: playerMap[pid], club: clubMap[v.club_id], value: v[type] }))
  return { topScorer: topOf('goal'), topAssist: topOf('assist'), mostMvp: topOf('mvp'), mostYellow: topOf('yellow_card'), mostRed: topOf('red_card') }
}
