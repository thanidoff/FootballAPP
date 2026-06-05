import { supabase } from '../lib/supabase'

export async function getDraftSaves() {
  const { data, error } = await supabase
    .from('draft_saves')
    .select('id, name, settings, teams, created_at')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export async function createDraftState(saveObj) {
  const { data, error } = await supabase
    .from('draft_saves')
    .insert({
      name: saveObj.name || 'Draft Save',
      settings: saveObj.settings || {},
      teams: saveObj.teams || [],
      free_agents: saveObj.freeAgents || [],
      current_week: saveObj.currentWeek || 1
    })
    .select('id')
    .single()
    
  if (error) throw error
  return data.id
}

export async function loadDraftState(saveId) {
  const { data, error } = await supabase
    .from('draft_saves')
    .select('*')
    .eq('id', saveId)
    .single()
    
  if (error) throw error
  
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
  const { error } = await supabase
    .from('draft_saves')
    .update({
      settings: saveObj.settings,
      teams: saveObj.teams,
      free_agents: saveObj.freeAgents,
      current_week: saveObj.currentWeek
    })
    .eq('id', saveId)
    
  if (error) throw error
}

export async function deleteDraftState(saveId) {
  const { error } = await supabase
    .from('draft_saves')
    .delete()
    .eq('id', saveId)
    
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

  // Update match status
  match.played = true
  match.homeScore = homeScore
  match.awayScore = awayScore

  // Update stats
  const stats = season.stats || { topScorers: {}, topAssists: {}, mostMvps: {} }
  if (events && Array.isArray(events)) {
    events.forEach(ev => {
      if (ev.type === 'goal' && ev.player) {
        stats.topScorers[ev.player.id] = (stats.topScorers[ev.player.id] || 0) + 1
      }
      if (ev.type === 'goal' && ev.assist) {
        stats.topAssists[ev.assist.id] = (stats.topAssists[ev.assist.id] || 0) + 1
      }
    })
  }
  if (mvp) {
    stats.mostMvps[mvp.id] = (stats.mostMvps[mvp.id] || 0) + 1
  }
  season.stats = stats

  // Update standings
  const newTeams = [...saveData.teams]
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
}
