import { useState, useEffect, useMemo } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { updateDraftState } from '../../../services/draftSave'
import { generateSchedule, simulateMatch } from '../../../utils/draftLogic'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'

// --- HELPER COMPONENTS ---

function TopList({ title, icon, itemsMap, allPlayers }) {
  // Convert map { playerId: count } to array and sort
  const items = Object.entries(itemsMap || {})
    .map(([playerId, count]) => {
      const p = allPlayers.find(player => player.id === playerId)
      return { player: p, count }
    })
    .filter(i => i.player && i.count > 0)
    .sort((a, b) => b.count - a.count)

  const displayItems = items.slice(0, 5)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="font-heading font-black text-xs uppercase tracking-widest text-[#0A1318]">{title}</span>
        </div>
      </div>
      {displayItems.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs text-gray-300 font-heading font-bold uppercase tracking-widest">No data yet</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {displayItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[10px] font-heading font-black text-gray-300 w-4">{i + 1}</span>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center ring-1 ring-black/5">
                {item.player?.photo_url
                  ? <img src={item.player.photo_url} alt={item.player.name} className="w-full h-full object-cover" />
                  : <span className="text-xs font-heading font-black text-gray-400">{item.player?.name?.charAt(0)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-xs text-[#0A1318] truncate">{item.player?.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-gray-400 font-heading truncate">{item.player?.club?.short_name || 'Free Agent'}</span>
                </div>
              </div>
              <span className="font-heading font-black text-xl text-[#0A1318] tabular-nums flex-shrink-0">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StandingsTable({ standings, championId }) {
  if (!standings || !standings.length) return (
    <div className="text-center py-8 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">No matches yet</div>
  )
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_repeat(6,auto)] gap-x-3 px-4 py-2 border-b border-gray-100 text-[9px] font-heading font-black uppercase tracking-widest text-gray-400">
        <div className="w-5 text-center">#</div>
        <div>Team</div>
        <div className="w-7 text-center">P</div>
        <div className="w-7 text-center">W</div>
        <div className="w-7 text-center">D</div>
        <div className="w-7 text-center">L</div>
        <div className="w-9 text-center">GD</div>
        <div className="w-9 text-center font-black text-[#0A1318]">PTS</div>
      </div>
      <div className="divide-y divide-gray-50">
        {standings.map((row, i) => {
          const isChamp = championId && row.club_id === championId
          const isTop4 = i < 4
          const isBottom2 = i >= standings.length - 2
          const s = row.stats || {}
          const gd = s.GD || 0
          return (
            <div key={row.club_id}
              className={`grid grid-cols-[auto_1fr_repeat(6,auto)] gap-x-3 px-4 py-2.5 items-center
                ${isChamp ? 'bg-amber-50' : ''}`}>
              <div className={`w-5 text-center text-[10px] font-heading font-black
                ${i === 0 ? 'text-amber-500' : isTop4 ? 'text-[#0A1318]' : isBottom2 ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {i + 1}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                {row.badge_url ? (
                  <img src={row.badge_url} alt="" className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-5 h-5 rounded bg-gray-200" />
                )}
                <span className="font-heading font-medium text-sm text-[#0A1318] truncate">{row.club_name}</span>
                {isChamp && <span className="text-xs">🏆</span>}
              </div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{(s.W||0) + (s.D||0) + (s.L||0)}</div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{s.W||0}</div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{s.D||0}</div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{s.L||0}</div>
              <div className={`w-9 text-center text-sm font-heading font-bold tabular-nums ${gd > 0 ? 'text-green-600' : gd < 0 ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {gd > 0 ? `+${gd}` : gd}
              </div>
              <div className="w-9 text-center text-sm font-heading font-black text-[#0A1318] tabular-nums">{s.PTS||0}</div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[9px] font-heading font-bold text-gray-400">1st — Champion</span>
        </div>
      </div>
    </div>
  )
}

// --- MAIN COMPONENT ---

export default function DraftMatchesTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('matches') // matches, standings, stats
  
  const seasons = saveData.settings?.seasons || []
  
  // By default select the active season or the last one
  const [currentSeasonIdx, setCurrentSeasonIdx] = useState(() => {
    const activeIdx = seasons.findIndex(s => s.status === 'active')
    return activeIdx >= 0 ? activeIdx : Math.max(0, seasons.length - 1)
  })

  useEffect(() => {
    if (seasons.length > 0 && !seasons[currentSeasonIdx]) {
      setCurrentSeasonIdx(Math.max(0, seasons.length - 1))
    }
  }, [seasons, currentSeasonIdx])

  const seasonData = seasons[currentSeasonIdx]
  const isActiveSeason = seasonData?.status === 'active'

  const matchesConfig = seasonData?.matches || []
  const currentWeek = saveData.currentWeek || 1
  
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)

  // Keep selectedWeek in sync
  useEffect(() => {
    if (isActiveSeason) {
      setSelectedWeek(currentWeek)
    } else if (matchesConfig.length > 0) {
      setSelectedWeek(matchesConfig[matchesConfig.length - 1].week) // default to last week for past seasons
    }
  }, [currentWeek, isActiveSeason, matchesConfig])

  // Get all players for stats mapping
  const allPlayers = useMemo(() => {
    const players = [...(saveData.freeAgents || [])]
    saveData.teams?.forEach(t => {
      t.roster?.forEach(p => {
        players.push({
          ...p,
          club: { id: t.club_id, short_name: t.club_name }
        })
      })
    })
    return players
  }, [saveData])

  const weekData = matchesConfig.find(w => w.week === selectedWeek)
  const currentWeekData = matchesConfig.find(w => w.week === currentWeek)

  async function handleGenerateSchedule() {
    setProcessing(true)
    try {
      const teamIds = saveData.teams.map(t => t.club_id)
      const schedule = generateSchedule(teamIds)
      
      const newTeams = saveData.teams.map(t => ({
        ...t,
        stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 }
      }))

      const newSettings = { ...saveData.settings }
      newSettings.seasons = [{
        id: 1,
        matches: schedule,
        stats: { topScorers: {}, topAssists: {}, mostMvps: {} },
        status: 'active'
      }]

      const newSaveData = {
        ...saveData,
        teams: newTeams,
        settings: newSettings,
        currentWeek: 1
      }
      
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setSelectedWeek(1)
      setCurrentSeasonIdx(0)
    } catch (err) {
      console.error(err)
      alert('Failed to generate schedule')
    } finally {
      setProcessing(false)
    }
  }

  async function handleStartNewSeason() {
    setProcessing(true)
    try {
      const teamIds = saveData.teams.map(t => t.club_id)
      const schedule = generateSchedule(teamIds)
      
      // Reset team stats
      const newTeams = saveData.teams.map(t => ({
        ...t,
        stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 }
      }))

      const newSettings = { ...saveData.settings }
      const newSeasonId = (newSettings.seasons.length > 0 ? Math.max(...newSettings.seasons.map(s => s.id)) : 0) + 1
      
      newSettings.seasons.push({
        id: newSeasonId,
        matches: schedule,
        stats: { topScorers: {}, topAssists: {}, mostMvps: {} },
        status: 'active'
      })

      const newSaveData = {
        ...saveData,
        teams: newTeams,
        settings: newSettings,
        currentWeek: 1
      }
      
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setCurrentSeasonIdx(newSettings.seasons.length - 1)
      setSelectedWeek(1)
    } catch (err) {
      console.error(err)
      alert('Failed to start new season')
    } finally {
      setProcessing(false)
    }
  }

  function handlePlayMatch(matchIndex) {
    if (!weekData || !isActiveSeason || selectedWeek !== currentWeek) return
    const match = weekData.matches[matchIndex]
    const homeTeam = saveData.teams.find(t => t.club_id === match.home)
    const awayTeam = saveData.teams.find(t => t.club_id === match.away)

    navigate('/matches/draft/prematch', {
      state: {
        homeClub: { id: homeTeam.club_id, name: homeTeam.club_name, short_name: homeTeam.club_name, badge_url: homeTeam.badge_url, roster: homeTeam.roster },
        awayClub: { id: awayTeam.club_id, name: awayTeam.club_name, short_name: awayTeam.club_name, badge_url: awayTeam.badge_url, roster: awayTeam.roster },
        duration: 5,
        returnPath: `/draft/${saveId}/matches`,
        saveId,
        currentWeek,
        matchIndex
      }
    })
  }

  async function handleAdvanceWeek() {
    setProcessing(true)
    try {
      const isEndOfSeason = currentWeek >= matchesConfig.length
      const newSaveData = { ...saveData }
      
      if (isEndOfSeason) {
        // Conclude Season
        const newSettings = { ...saveData.settings }
        const currentSeasonObj = newSettings.seasons[currentSeasonIdx]
        
        currentSeasonObj.status = 'completed'
        
        // Finalize Standings
        const standings = (saveData.teams || []).map(t => ({
          club_id: t.club_id,
          club_name: t.club_name,
          badge_url: t.badge_url,
          stats: { ...t.stats }
        })).sort((a, b) => {
          if ((a.stats?.PTS||0) !== (b.stats?.PTS||0)) return (b.stats?.PTS||0) - (a.stats?.PTS||0)
          if ((a.stats?.GD||0) !== (b.stats?.GD||0)) return (b.stats?.GD||0) - (a.stats?.GD||0)
          return (b.stats?.GF||0) - (a.stats?.GF||0)
        })
        
        currentSeasonObj.standings = standings
        if (standings.length > 0) currentSeasonObj.champion = standings[0].club_id
        
        newSaveData.settings = newSettings
        // Stay on current week visually
      } else {
        newSaveData.currentWeek = currentWeek + 1
      }

      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  if (!seasonData && seasons.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
        <div className="text-6xl mb-6">📅</div>
        <h2 className="text-2xl font-heading font-black text-[#0A1318] uppercase tracking-wide mb-2">No Schedule</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">Generate a double round-robin league schedule for all your drafted teams to start the season.</p>
        <Button onClick={handleGenerateSchedule} disabled={processing}>
          {processing ? 'Generating...' : 'Generate Schedule'}
        </Button>
      </div>
    )
  }

  const allPlayed = currentWeekData?.matches.every(m => m.played)
  const existingWeeks = matchesConfig.map(w => w.week)

  // Current Standings Calculation
  const activeStandings = isActiveSeason ? (saveData.teams || []).map(t => ({
    club_id: t.club_id,
    club_name: t.club_name,
    badge_url: t.badge_url,
    stats: { ...t.stats }
  })).sort((a, b) => {
    if ((a.stats?.PTS||0) !== (b.stats?.PTS||0)) return (b.stats?.PTS||0) - (a.stats?.PTS||0)
    if ((a.stats?.GD||0) !== (b.stats?.GD||0)) return (b.stats?.GD||0) - (a.stats?.GD||0)
    return (b.stats?.GF||0) - (a.stats?.GF||0)
  }) : seasonData.standings

  const championObj = seasonData.champion ? activeStandings.find(s => s.club_id === seasonData.champion) : null

  const canGoPrev = currentSeasonIdx > 0
  const canGoNext = currentSeasonIdx < seasons.length - 1

  return (
    <div className="space-y-6">
      {/* Season Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-5">
        <div className="flex-1 min-w-0">
          <div className="font-heading font-black text-sm sm:text-base uppercase tracking-wide text-[#0A1318] truncate">
            Season {seasonData.id}
          </div>
          <div className={`text-[9px] sm:text-[10px] font-heading font-black uppercase tracking-widest mt-0.5
            ${isActiveSeason ? 'text-[#FD5461]' : 'text-gray-400'}`}>
            {isActiveSeason ? `● Active · Week ${currentWeek}/${matchesConfig.length}` : '✓ Completed'}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {seasons.length > 1 && (
            <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
              <button onClick={() => canGoPrev && setCurrentSeasonIdx(i => i - 1)} disabled={!canGoPrev}
                className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
              <button onClick={() => canGoNext && setCurrentSeasonIdx(i => i + 1)} disabled={!canGoNext}
                className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}

          {!isActiveSeason && currentSeasonIdx === seasons.length - 1 && (
            <button onClick={handleStartNewSeason} disabled={processing}
              className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-[#0A1318] font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-[#0A1318] hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
              + New Season
            </button>
          )}
        </div>
      </div>

      {/* Champion Banner */}
      {!isActiveSeason && championObj && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-5 py-4 mb-4 flex items-center gap-4">
          <div className="text-3xl">🏆</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-amber-500 mb-0.5">League Champion</div>
            <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318] truncate">{championObj.club_name}</div>
          </div>
          {championObj.badge_url ? (
             <img src={championObj.badge_url} alt="" className="w-12 h-12 object-contain" />
          ) : (
             <div className="w-12 h-12 rounded-xl bg-[#0A1318] font-heading font-black text-white flex items-center justify-center text-xs">
               {championObj.club_name.substring(0,3).toUpperCase()}
             </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-8 border-b border-gray-100 mb-6 px-1">
        {[
          { key: 'matches', label: 'Matches' },
          { key: 'standings', label: 'Standings' },
          { key: 'stats', label: 'Stats' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`pb-3 font-heading font-black text-sm uppercase tracking-widest transition-all cursor-pointer border-b-2 -mb-[1px]
              ${activeTab === tab.key ? 'border-[#0A1318] text-[#0A1318]' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'standings' && (
        <StandingsTable standings={activeStandings} championId={seasonData.champion} />
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <TopList title="Top Scorer" icon="⚽" itemsMap={seasonData.stats?.topScorers} allPlayers={allPlayers} />
          <TopList title="Top Assist" icon="👟" itemsMap={seasonData.stats?.topAssists} allPlayers={allPlayers} />
          <TopList title="Most MVP" icon="⭐" itemsMap={seasonData.stats?.mostMvps} allPlayers={allPlayers} />
        </div>
      )}

      {activeTab === 'matches' && (
        <>
          {existingWeeks.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide flex-1">
                {existingWeeks.map(w => {
                  const weekMatches = matchesConfig.find(cw => cw.week === w)?.matches || []
                  const done = weekMatches.every(m => m.played)
                  const isCurrent = w === currentWeek && isActiveSeason
                  return (
                    <button key={w}
                      onClick={() => setSelectedWeek(w)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full font-heading font-black text-xs uppercase tracking-widest transition-all cursor-pointer border
                        ${selectedWeek === w
                          ? 'bg-[#0A1318] text-white border-[#0A1318]'
                          : done 
                            ? 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                            : isCurrent 
                              ? 'bg-[#FD5461]/10 text-[#FD5461] border-[#FD5461]/30 hover:bg-[#FD5461]/20'
                              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                        }`}>
                      Wk {w}
                      {done && <span className="ml-1 opacity-70">✓</span>}
                    </button>
                  )
                })}
              </div>
              {isActiveSeason && allPlayed && selectedWeek === currentWeek && (
                <Button onClick={handleAdvanceWeek} disabled={processing} className="bg-green-600 hover:bg-green-700 flex-shrink-0">
                  {currentWeek >= matchesConfig.length ? 'Conclude Season' : 'Advance to Next Week'}
                </Button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {weekData?.matches.map((match, idx) => {
              const homeTeam = saveData.teams.find(t => t.club_id === match.home)
              const awayTeam = saveData.teams.find(t => t.club_id === match.away)
              
              return (
                <div key={idx} className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-150 shadow-sm hover:shadow-md">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Home */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-black/5 shadow-sm flex items-center justify-center" style={{ backgroundColor: homeTeam.badge_url ? 'white' : (homeTeam.badge_color || '#0A1318') }}>
                        {homeTeam.badge_url ? (
                          <img src={homeTeam.badge_url} alt="" className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="font-heading font-black text-white text-xs">{homeTeam.club_name.substring(0, 3).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{homeTeam.club_name}</span>
                        <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{homeTeam.club_name.substring(0,3)}</span>
                      </div>
                    </div>

                    {/* Center */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 w-28 sm:w-36">
                      {match.played ? (
                        <div className="flex items-center gap-2">
                          <span className={`font-heading font-black text-2xl tabular-nums w-7 text-right ${match.homeScore > match.awayScore ? 'text-[#0A1318]' : 'text-gray-300'}`}>
                            {match.homeScore}
                          </span>
                          <span className="font-heading font-bold text-base text-gray-300">–</span>
                          <span className={`font-heading font-black text-2xl tabular-nums w-7 text-left ${match.awayScore > match.homeScore ? 'text-[#0A1318]' : 'text-gray-300'}`}>
                            {match.awayScore}
                          </span>
                        </div>
                      ) : (
                        <span className="font-heading font-black text-lg text-gray-200 tracking-widest">VS</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-heading font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 ${match.played ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {match.played ? 'Completed' : 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    {/* Away */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{awayTeam.club_name}</span>
                        <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{awayTeam.club_name.substring(0,3)}</span>
                      </div>
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-black/5 shadow-sm flex items-center justify-center" style={{ backgroundColor: awayTeam.badge_url ? 'white' : (awayTeam.badge_color || '#0A1318') }}>
                        {awayTeam.badge_url ? (
                          <img src={awayTeam.badge_url} alt="" className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="font-heading font-black text-white text-xs">{awayTeam.club_name.substring(0, 3).toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!match.played && isActiveSeason && selectedWeek === currentWeek && (
                    <div className="border-t border-gray-50 px-4 py-2.5">
                      <button 
                        onClick={() => handlePlayMatch(idx)}
                        disabled={processing}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#0A1318] text-white font-heading font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        ▶ Play Match
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
