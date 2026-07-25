import { createSeededRandom } from '../utils/matchEngine'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const STORAGE_KEY = 'football_manager_career_saves'
export const MAX_CAREER_SAVES = 5

// A career is a self-contained snapshot of the master Players/Clubs data.
// Never retain object references supplied by the editor or another save.
function cloneCareerSnapshot(value) {
  if (value == null) return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

export const DEFAULT_LEAGUE_PRIZES = {
  placements: [50_000_000, 30_000_000, 20_000_000, 10_000_000, 5_000_000],
  awards: { topScorers: 5_000_000, topAssists: 5_000_000, mostMvps: 5_000_000 },
}

export const DEFAULT_CUP_PRIZES = [30_000_000, 20_000_000, 15_000_000, 10_000_000, 10_000_000, 5_000_000, 5_000_000, 5_000_000]

function normalizeLeaguePrizes(prizes) {
  return {
    placements: Array.from({ length: 5 }, (_, index) => Math.max(0, Number(prizes?.placements?.[index] ?? DEFAULT_LEAGUE_PRIZES.placements[index]))),
    awards: Object.fromEntries(Object.keys(DEFAULT_LEAGUE_PRIZES.awards).map(key => [
      key, Math.max(0, Number(prizes?.awards?.[key] ?? DEFAULT_LEAGUE_PRIZES.awards[key])),
    ])),
  }
}

function readLocalSaves() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        localStorage.setItem(`${STORAGE_KEY}_corrupt_${Date.now()}`, raw)
      } catch { /* Keep the original value when storage is already full. */ }
    }
    console.error('Career save data is corrupted; a recovery copy was preserved.', error)
    return []
  }
}

function writeLocalSaves(saves) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves))
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Delete an unused career save, then try again.')
    }
    throw error
  }
}

async function requireCloudUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data?.user) throw new Error('Please sign in to access your career saves.')
  return data.user
}

function toDatabaseRow(save, ownerId) {
  return {
    id: save.id,
    owner_id: ownerId,
    name: save.name || 'Career Save',
    settings: save.settings || {},
    teams: save.teams || [],
    free_agents: save.freeAgents ?? save.free_agents ?? [],
    current_week: save.currentWeek ?? save.current_week ?? 1,
    created_at: save.created_at || new Date().toISOString(),
    updated_at: save.updated_at || new Date().toISOString(),
    schema_version: 2,
  }
}

async function readSaves() {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') return readLocalSaves()
  await requireCloudUser()
  const { data, error } = await supabase
    .from('draft_saves')
    .select('id,name,settings,teams,free_agents,current_week,created_at,updated_at,schema_version')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function writeSave(save) {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') {
    const saves = readLocalSaves()
    const index = saves.findIndex(item => item.id === save.id)
    if (index >= 0) saves[index] = save
    else saves.push(save)
    writeLocalSaves(saves)
    return
  }
  const user = await requireCloudUser()
  const { error } = await supabase.from('draft_saves').upsert(toDatabaseRow(save, user.id))
  if (error) throw error
}

export async function migrateLocalDraftSavesToCloud() {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') return 0
  let localSaves = readLocalSaves()
  // The backup is deliberately retained so a user who accidentally signs in
  // with the wrong account can still import the original browser careers into
  // the correct account later.
  if (!localSaves.length) {
    try {
      const backup = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_cloud_backup`) || '[]')
      if (Array.isArray(backup)) localSaves = backup
    } catch { /* Ignore an unusable recovery copy. */ }
  }
  if (!localSaves.length) return 0
  const user = await requireCloudUser()
  const { count, error: countError } = await supabase
    .from('draft_saves')
    .select('id', { count: 'exact', head: true })
  if (countError) throw countError
  // Never duplicate a recovery backup into an account that already owns saves.
  if (count > 0 && !readLocalSaves().length) return 0
  const rows = []
  for (const save of localSaves) {
    let row = toDatabaseRow(save, user.id)
    let { error } = await supabase.from('draft_saves').insert(row)
    // A restored database can contain the same legacy UUID without an owner.
    // Preserve both saves instead of trying to overwrite a row blocked by RLS.
    if (error?.code === '23505') {
      row = { ...row, id: globalThis.crypto.randomUUID() }
      ;({ error } = await supabase.from('draft_saves').insert(row))
    }
    if (error) throw error
    rows.push(row)
  }
  localStorage.setItem(`${STORAGE_KEY}_cloud_backup`, JSON.stringify(localSaves))
  localStorage.removeItem(STORAGE_KEY)
  return rows.length
}

export async function getDraftSaves() {
  return (await readSaves()).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
}

export async function createDraftState(saveObj) {
  const saves = await readSaves()
  if (saves.length >= MAX_CAREER_SAVES) throw new Error(`You can keep up to ${MAX_CAREER_SAVES} career saves.`)
  const id = globalThis.crypto?.randomUUID?.() || `career-${Date.now()}`
  const snapshot = cloneCareerSnapshot(saveObj)
  const newSave = {
    id,
    name: snapshot.name || 'Career Save',
    settings: snapshot.settings || {},
    teams: snapshot.teams || [],
    free_agents: snapshot.freeAgents || [],
    current_week: snapshot.currentWeek || 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await writeSave(newSave)
  return id
}

export async function loadDraftState(saveId) {
  const data = (await readSaves()).find(save => save.id === saveId)
  if (!data) throw new Error('Career save not found')
  
  // Map back from snake_case to camelCase where needed
  let saveData = {
    ...data,
    freeAgents: data.free_agents,
    currentWeek: data.current_week
  }

  // MIGRATION: Multi-season support
  if (!saveData.settings?.seasons || !Array.isArray(saveData.settings.seasons)) {
    const legacyMatches = saveData.settings?.matches || []
    const isSeasonEnded = saveData.settings?.seasonEnded || false
    
    const newSettings = { ...saveData.settings }
    
    // Create initial season
    newSettings.seasons = [{
      id: 1,
      matches: legacyMatches,
      stats: { topScorers: {}, topAssists: {}, mostMvps: {} },
      status: legacyMatches.length > 0 ? (isSeasonEnded ? 'completed' : 'active') : 'pending'
    }]

    // Save standings to completed season
    if (isSeasonEnded && legacyMatches.length > 0) {
      const standings = (saveData.teams || []).map(t => ({
        club_id: t.club_id,
        stats: { ...t.stats }
      })).sort((a, b) => {
        if ((a.stats?.PTS||0) !== (b.stats?.PTS||0)) return (b.stats?.PTS||0) - (a.stats?.PTS||0)
        if ((a.stats?.GD||0) !== (b.stats?.GD||0)) return (b.stats?.GD||0) - (a.stats?.GD||0)
        return (b.stats?.GF||0) - (a.stats?.GF||0)
      })
      newSettings.seasons[0].standings = standings
      if (standings.length > 0) newSettings.seasons[0].champion = standings[0].club_id
    }
    
    saveData.settings = newSettings
    
    // Save migration back
    updateDraftState(saveId, saveData).catch(e => console.error("Auto-migrate failed", e))
  }

  return saveData
}

export async function updateDraftState(saveId, saveObj) {
  const saves = await readSaves()
  const index = saves.findIndex(save => save.id === saveId)
  if (index === -1) throw new Error('Career save not found')
  const snapshot = cloneCareerSnapshot(saveObj)
  saves[index] = {
    ...saves[index],
    ...snapshot,
    free_agents: snapshot.freeAgents ?? snapshot.free_agents ?? saves[index].free_agents,
    current_week: snapshot.currentWeek ?? snapshot.current_week ?? saves[index].current_week,
    updated_at: new Date().toISOString(),
  }
  await writeSave(saves[index])
}

export async function updateDraftSeasonPrizeSettings(saveId, seasonId, prizes) {
  const saveData = await loadDraftState(saveId)
  const seasons = [...(saveData.settings?.seasons || [])]
  const seasonIndex = seasons.findIndex(season => String(season.id) === String(seasonId))
  if (seasonIndex < 0) throw new Error('Season not found')
  if (seasons[seasonIndex].status === 'completed') throw new Error('Completed season prizes are locked')
  seasons[seasonIndex] = { ...seasons[seasonIndex], prizeSettings: normalizeLeaguePrizes(prizes) }
  const nextState = { ...saveData, settings: { ...saveData.settings, seasons } }
  await updateDraftState(saveId, nextState)
  return nextState
}

export async function updateDraftCupPrizeSettings(saveId, cupId, placements) {
  const saveData = await loadDraftState(saveId)
  const cups = [...(saveData.settings?.cups || [])]
  const cupIndex = cups.findIndex(cup => String(cup.id) === String(cupId))
  if (cupIndex < 0) throw new Error('Cup not found')
  if (cups[cupIndex].status === 'completed') throw new Error('Completed cup prizes are locked')
  cups[cupIndex] = {
    ...cups[cupIndex],
    prizeSettings: Array.from({ length: 8 }, (_, index) => Math.max(0, Number(placements?.[index] ?? DEFAULT_CUP_PRIZES[index]))),
  }
  const nextState = { ...saveData, settings: { ...saveData.settings, cups } }
  await updateDraftState(saveId, nextState)
  return nextState
}

export async function deleteDraftState(saveId) {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') {
    writeLocalSaves(readLocalSaves().filter(save => save.id !== saveId))
    return
  }
  await requireCloudUser()
  const { error } = await supabase.from('draft_saves').delete().eq('id', saveId)
  if (error) throw error
}

export async function completeDraftMatch(saveId, currentWeek, matchIndex, payload) {
  const saveData = await loadDraftState(saveId)
  if (!saveData || !saveData.settings?.seasons) throw new Error("Draft save or schedule not found")

  const { homeScore, awayScore, events, mvp } = payload
  
  // Find active season
  const activeSeasonIdx = saveData.settings.seasons.findIndex(s => s.status === 'active')
  if (activeSeasonIdx === -1) throw new Error("No active season found")
  
  const season = saveData.settings.seasons[activeSeasonIdx]
  const weekDataIndex = season.matches.findIndex(w => w.week === currentWeek)
  
  if (weekDataIndex === -1) throw new Error("Current week not found in schedule")

  const match = season.matches[weekDataIndex].matches[matchIndex]
  if (!match) throw new Error("Match not found")
  if (match.played) throw new Error('Match has already been completed')
  if (!Number.isFinite(payload.homeScore) || !Number.isFinite(payload.awayScore) || payload.homeScore < 0 || payload.awayScore < 0) {
    throw new Error('Invalid match score')
  }

  // Update match status
  match.played = true
  match.homeScore = homeScore
  match.awayScore = awayScore
  match.events = Array.isArray(events) ? events : []
  match.mvp = mvp || null

  const newTeams = [...saveData.teams]

  // Update stats
  const stats = season.stats || { topScorers: {}, topAssists: {}, mostMvps: {} }
  stats.playerSnapshots = stats.playerSnapshots || {}

  const snapshotPlayer = (player, eventTeam = null) => {
    if (!player?.id || stats.playerSnapshots[player.id]) return
    const eventClubId = eventTeam === 'home' ? match.home : eventTeam === 'away' ? match.away : null
    const club = newTeams.find(team => team.club_id === eventClubId)
      || newTeams.find(team => (team.roster || []).some(member => String(member.id) === String(player.id)))
    stats.playerSnapshots[player.id] = {
      id: player.id,
      name: player.name,
      photo_url: player.photo_url || null,
      nationality: player.nationality || null,
      position: player.position || null,
      club: club ? {
        id: club.club_id,
        name: club.club_name,
        short_name: club.short_name || club.club_name?.slice(0, 3).toUpperCase(),
        badge_url: club.badge_url || null,
        badge_color: club.badge_color || null,
      } : null,
    }
  }
  if (events && Array.isArray(events)) {
    events.forEach(ev => {
      if (ev.type === 'goal' && ev.player) {
        snapshotPlayer(ev.player, ev.team)
        stats.topScorers[ev.player.id] = (stats.topScorers[ev.player.id] || 0) + 1
      }
      if (ev.type === 'goal' && ev.assist) {
        snapshotPlayer(ev.assist, ev.team)
        stats.topAssists[ev.assist.id] = (stats.topAssists[ev.assist.id] || 0) + 1
      }
      if (ev.type === 'foul' && ev.player) {
        snapshotPlayer(ev.player, ev.team)
        stats.mostFouls = stats.mostFouls || {}
        stats.mostFouls[ev.player.id] = (stats.mostFouls[ev.player.id] || 0) + 1
      }
    })
  }
  if (mvp) {
    snapshotPlayer(mvp)
    stats.mostMvps[mvp.id] = (stats.mostMvps[mvp.id] || 0) + 1
  }
  season.stats = stats

  // Update standings
  const homeIdx = newTeams.findIndex(t => t.club_id === match.home)
  const awayIdx = newTeams.findIndex(t => t.club_id === match.away)
  
  if (homeIdx !== -1 && awayIdx !== -1) {
    const hStats = { ...(newTeams[homeIdx].stats || { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 }) }
    const aStats = { ...(newTeams[awayIdx].stats || { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 }) }

    hStats.GF += homeScore
    hStats.GA += awayScore
    hStats.GD = hStats.GF - hStats.GA

    aStats.GF += awayScore
    aStats.GA += homeScore
    aStats.GD = aStats.GF - aStats.GA

    if (homeScore > awayScore) {
      hStats.PTS += 3; hStats.W += 1
      aStats.L += 1
    } else if (homeScore < awayScore) {
      aStats.PTS += 3; aStats.W += 1
      hStats.L += 1
    } else {
      hStats.PTS += 1; hStats.D += 1
      aStats.PTS += 1; aStats.D += 1
    }

    newTeams[homeIdx].stats = hStats
    newTeams[awayIdx].stats = aStats
  }
  
  saveData.settings.seasons[activeSeasonIdx] = season

  // Save state
  await updateDraftState(saveId, {
    ...saveData,
    teams: newTeams
  })

  // Finishing the final fixture of a week immediately unlocks the next one.
  // The final week concludes the season through the same transition.
  if (season.matches[weekDataIndex].matches.every(item => item.played)) {
    return advanceDraftLeagueWeek(saveId)
  }

  return loadDraftState(saveId)
}

export async function completeDraftCupMatch(saveId, round, matchIndex, payload) {
  const saveData = await loadDraftState(saveId)
  const cups = saveData.settings?.cups || []
  const cupIndex = cups.findIndex(cup => cup.status === 'active')
  if (cupIndex < 0) throw new Error('No active cup found')

  const cup = cups[cupIndex]
  const matches = cup.rounds?.[round] || []
  const match = matches[matchIndex]
  if (!match) throw new Error('Cup match not found')
  if (match.played) throw new Error('Cup match has already been completed')
  if (!Number.isFinite(payload.homeScore) || !Number.isFinite(payload.awayScore) || payload.homeScore < 0 || payload.awayScore < 0) {
    throw new Error('Invalid match score')
  }

  match.played = true
  match.homeScore = payload.homeScore
  match.awayScore = payload.awayScore
  match.events = payload.events || []
  match.mvp = payload.mvp || null
  if (payload.homeScore === payload.awayScore) {
    const penaltyRandom = createSeededRandom(`${cup.id}-${round}-${matchIndex}-penalties`)
    const penaltyWinner = [match.home, match.away].includes(payload.penaltyWinner)
      ? payload.penaltyWinner
      : (penaltyRandom() < 0.5 ? match.home : match.away)
    match.winner = penaltyWinner
    match.decidedOnPenalties = true
    match.penalties = penaltyWinner === match.home
      ? { home: 5, away: 4 }
      : { home: 4, away: 5 }
  } else {
    match.winner = payload.homeScore > payload.awayScore ? match.home : match.away
  }

  if (matches.every(item => item.played)) {
    if (Number(round) < 3) {
      // Preserve the visible bracket: QF1/QF2 feed SF1 and QF3/QF4 feed SF2.
      const winners = matches.map(item => item.winner)
      const nextRound = Number(round) + 1
      cup.round = nextRound
      cup.rounds[nextRound] = Array.from({ length: winners.length / 2 }, (_, index) => ({
        home: winners[index * 2], away: winners[index * 2 + 1], played: false,
      }))
    } else {
      cup.status = 'completed'
      cup.champion = match.winner
      cup.completedAt = new Date().toISOString()
      if (!cup.prizesPaidAt) {
        const loser = item => item.winner === item.home ? item.away : item.home
        const finalMatch = cup.rounds[3][0]
        const orderedClubIds = [
          finalMatch.winner,
          loser(finalMatch),
          ...(cup.rounds[2] || []).map(loser),
          ...(cup.rounds[1] || []).map(loser),
        ]
        const prizes = Array.from({ length: 8 }, (_, index) => Math.max(0, Number(cup.prizeSettings?.[index] ?? DEFAULT_CUP_PRIZES[index])))
        const teams = (saveData.teams || []).map(team => ({ ...team }))
        cup.prizePayouts = orderedClubIds.map((clubId, index) => {
          const team = teams.find(item => String(item.club_id) === String(clubId))
          if (team) team.budget = (team.budget || 0) + prizes[index]
          return { position: index + 1, clubId, clubName: team?.club_name || null, amount: prizes[index] }
        })
        cup.prizeSettings = prizes
        cup.prizesPaidAt = new Date().toISOString()
        saveData.teams = teams
      }

      const seasonIndex = (saveData.settings?.seasons || []).findIndex(season => String(season.id) === String(cup.seasonId))
      const season = saveData.settings?.seasons?.[seasonIndex]
      const alreadyPaidAwards = season?.awardsPaidAt || season?.prizePayouts?.some(payout => payout.type === 'player_award')
      if (season && !alreadyPaidAwards) {
        const combined = {
          topScorers: { ...(season.stats?.topScorers || {}) },
          topAssists: { ...(season.stats?.topAssists || {}) },
          mostMvps: { ...(season.stats?.mostMvps || {}) },
          mostFouls: { ...(season.stats?.mostFouls || {}) },
          playerSnapshots: { ...(season.stats?.playerSnapshots || {}) },
        }
        const teams = (saveData.teams || []).map(team => ({ ...team }))
        const snapshotPlayer = (player, clubId) => {
          if (!player?.id || combined.playerSnapshots[player.id]) return
          const club = teams.find(team => String(team.club_id) === String(clubId))
            || teams.find(team => (team.roster || []).some(member => String(member.id) === String(player.id)))
          combined.playerSnapshots[player.id] = {
            id: player.id,
            name: player.name,
            photo_url: player.photo_url || null,
            nationality: player.nationality || null,
            position: player.position || null,
            club: club ? { id: club.club_id, name: club.club_name, short_name: club.short_name || club.club_name?.slice(0, 3).toUpperCase(), badge_url: club.badge_url || null, badge_color: club.badge_color || null } : null,
          }
        }
        Object.values(cup.rounds || {}).flat().filter(Boolean).forEach(cupMatch => {
          ;(cupMatch.events || []).forEach(event => {
            const clubId = event.team === 'home' ? cupMatch.home : event.team === 'away' ? cupMatch.away : null
            if (event.type === 'goal' && event.player) {
              snapshotPlayer(event.player, clubId)
              combined.topScorers[event.player.id] = (combined.topScorers[event.player.id] || 0) + 1
            }
            if (event.type === 'goal' && event.assist) {
              snapshotPlayer(event.assist, clubId)
              combined.topAssists[event.assist.id] = (combined.topAssists[event.assist.id] || 0) + 1
            }
            if (event.type === 'foul' && event.player) {
              snapshotPlayer(event.player, clubId)
              combined.mostFouls[event.player.id] = (combined.mostFouls[event.player.id] || 0) + 1
            }
          })
          if (cupMatch.mvp) {
            const mvpClubId = [cupMatch.home, cupMatch.away].find(clubId => teams.find(team => String(team.club_id) === String(clubId))?.roster?.some(player => String(player.id) === String(cupMatch.mvp.id)))
            snapshotPlayer(cupMatch.mvp, mvpClubId)
            combined.mostMvps[cupMatch.mvp.id] = (combined.mostMvps[cupMatch.mvp.id] || 0) + 1
          }
        })

        const prizeSettings = normalizeLeaguePrizes(season.prizeSettings)
        const awardLabels = { topScorers: 'Top Scorer', topAssists: 'Top Assists', mostMvps: 'Most MVP' }
        const awardPayouts = []
        Object.entries(awardLabels).forEach(([key, label]) => {
          const leader = Object.entries(combined[key]).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]
          if (!leader || leader[1] <= 0) return
          const winnerId = leader[0]
          const clubId = combined.playerSnapshots[winnerId]?.club?.id
          const team = teams.find(item => String(item.club_id) === String(clubId))
          const amount = Math.max(0, Number(prizeSettings.awards[key]) || 0)
          if (!team || amount <= 0) return
          team.budget = (team.budget || 0) + amount
          awardPayouts.push({ clubId: team.club_id, clubName: team.club_name, amount, type: 'player_award', label, playerId: winnerId, scope: 'all_competitions' })
        })
        season.stats = combined
        season.prizePayouts = [...(season.prizePayouts || []), ...awardPayouts]
        season.awardsPaidAt = new Date().toISOString()
        saveData.settings.seasons[seasonIndex] = season
        saveData.teams = teams
      }
    }
  }

  cups[cupIndex] = cup
  await updateDraftState(saveId, { ...saveData, settings: { ...saveData.settings, cups } })
}

export async function advanceDraftLeagueWeek(saveId) {
  const saveData = await loadDraftState(saveId)
  const seasons = saveData.settings?.seasons || []
  const seasonIndex = seasons.findIndex(season => season.status === 'active')
  if (seasonIndex < 0) throw new Error('No active season found')

  const season = seasons[seasonIndex]
  const currentWeek = saveData.currentWeek || 1
  const week = season.matches.find(item => item.week === currentWeek)
  if (!week || !week.matches.length) throw new Error('Current week has no matches')
  if (!week.matches.every(match => match.played)) throw new Error('Complete every match before advancing')

  const isFinalWeek = currentWeek >= season.matches.length
  if (!isFinalWeek) {
    const nextState = { ...saveData, currentWeek: currentWeek + 1 }
    await updateDraftState(saveId, nextState)
    return nextState
  }

  const participantIds = new Set(season.teamIds || season.matches.flatMap(item => item.matches.flatMap(match => [match.home, match.away])))
  const standings = (saveData.teams || [])
    .filter(team => participantIds.has(team.club_id))
    .map(team => ({
      club_id: team.club_id,
      club_name: team.club_name,
      badge_url: team.badge_url,
      badge_color: team.badge_color,
      stats: { ...team.stats },
    }))
    .sort((a, b) => (b.stats?.PTS || 0) - (a.stats?.PTS || 0) || (b.stats?.GD || 0) - (a.stats?.GD || 0) || (b.stats?.GF || 0) - (a.stats?.GF || 0))

  season.status = 'completed'
  season.standings = standings
  season.champion = standings[0]?.club_id || null
  season.completedAt = new Date().toISOString()

  if (!season.prizesPaidAt) {
    const prizeSettings = normalizeLeaguePrizes(season.prizeSettings)
    const teams = (saveData.teams || []).map(team => ({ ...team }))
    const payouts = []
    const payClub = (clubId, amount, type, label, playerId = null) => {
      const value = Math.max(0, Number(amount) || 0)
      const team = teams.find(item => String(item.club_id) === String(clubId))
      if (!team || value <= 0) return
      team.budget = (team.budget || 0) + value
      payouts.push({ clubId: team.club_id, clubName: team.club_name, amount: value, type, label, playerId })
    }

    standings.slice(0, 5).forEach((row, index) => {
      payClub(row.club_id, prizeSettings.placements[index], 'placement', `League position ${index + 1}`)
    })

    season.prizeSettings = prizeSettings
    season.prizePayouts = payouts
    season.prizesPaidAt = new Date().toISOString()
    saveData.teams = teams
  }
  seasons[seasonIndex] = season

  const nextState = { ...saveData, settings: { ...saveData.settings, seasons } }
  await updateDraftState(saveId, nextState)
  return nextState
}

export async function transferDraftPlayer(saveId, playerId, targetClubId, agreedFee = null) {
  const saveData = await loadDraftState(saveId)
  const teams = (saveData.teams || []).map(team => ({ ...team, roster: [...(team.roster || [])] }))
  const isFreeAgentTarget = !targetClubId || targetClubId === 'free' || targetClubId === 'free_agent'
  const targetIndex = isFreeAgentTarget ? -1 : teams.findIndex(team => team.club_id === targetClubId)
  
  if (!isFreeAgentTarget && targetIndex < 0) throw new Error('Target club not found')

  let player = (saveData.freeAgents || []).find(item => item.id === playerId)
  let sourceIndex = -1
  if (!player) {
    sourceIndex = teams.findIndex(team => team.roster.some(item => item.id === playerId))
    player = sourceIndex >= 0 ? teams[sourceIndex].roster.find(item => item.id === playerId) : null
  }
  if (!player) throw new Error('Player not found')
  if (sourceIndex === targetIndex) throw new Error('Player is already in this club')

  const fee = agreedFee == null ? (player.market_value || 0) : Number(agreedFee)
  if (!Number.isFinite(fee) || fee < 0) throw new Error('Invalid transfer fee')

  if (!isFreeAgentTarget) {
    if ((teams[targetIndex].budget || 0) < fee) throw new Error('Insufficient budget')
    teams[targetIndex].budget -= fee
  }

  if (sourceIndex >= 0) {
    teams[sourceIndex].budget = (teams[sourceIndex].budget || 0) + fee
    teams[sourceIndex].roster = teams[sourceIndex].roster.filter(item => item.id !== playerId)
  }

  let freeAgents = [...(saveData.freeAgents || []).filter(item => item.id !== playerId)]

  if (isFreeAgentTarget) {
    const releasedPlayer = { ...player, club_id: null, club: null }
    freeAgents.push(releasedPlayer)
  } else {
    const storedPlayer = { ...player, club_id: targetClubId, market_value: fee }
    delete storedPlayer.club
    teams[targetIndex].roster.push(storedPlayer)
  }

  const activeSeason = saveData.settings?.seasons?.find(season => season.status === 'active')
  const transfer = {
    id: globalThis.crypto?.randomUUID?.() || `transfer-${Date.now()}`,
    playerId, playerName: player.name,
    fromClubId: sourceIndex >= 0 ? teams[sourceIndex].club_id : null,
    fromName: sourceIndex >= 0 ? teams[sourceIndex].club_name : null,
    toClubId: isFreeAgentTarget ? null : teams[targetIndex].club_id,
    toName: isFreeAgentTarget ? 'Free Agent' : teams[targetIndex].club_name,
    fee, week: saveData.currentWeek || 1, seasonId: activeSeason?.id || null,
    createdAt: new Date().toISOString(),
  }
  const nextState = { ...saveData, teams, freeAgents, transferHistory: [...(saveData.transferHistory || []), transfer] }
  await updateDraftState(saveId, nextState)
  return nextState
}
