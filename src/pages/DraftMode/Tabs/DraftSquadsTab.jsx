import { useCallback, useState, useEffect } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { updateDraftState } from '../../../services/draftSave'
import { fetchClubs } from '../../../services/clubs'
import PlayerCard from '../../../components/ui/PlayerCard'
import Modal from '../../../components/ui/Modal'
import ClubForm from '../../../components/clubs/ClubForm'
import PlayerForm from '../../../components/players/PlayerForm'
import PlayerProfileModal from '../../../components/players/PlayerProfileModal'
import Button from '../../../components/ui/Button'
import SegmentedControl from '../../../components/ui/SegmentedControl'
import OvrBadge from '../../../components/ui/OvrBadge'
import { calculateOVR } from '../../../utils/stats'
import { ArrowDown, ArrowUp, Check, ChevronsLeft, ChevronsRight, GripVertical, History, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'

function MatchRecordClub({ club, align = 'left' }) {
  return <span className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>{club?.badge_url ? <img src={club.badge_url} alt="" className="h-8 w-8 shrink-0 object-contain" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[8px] font-semibold text-white" style={{ backgroundColor: club?.badge_color || '#34414A' }}>{(club?.short_name || club?.club_name || 'CLB').slice(0, 3).toUpperCase()}</span>}<span className="truncate text-xs font-medium">{club?.club_name || 'Unknown club'}</span></span>
}

function MatchRecordSummary({ record, emptyLabel }) {
  if (!record) return <div className="mt-4 text-sm text-gray-300">{emptyLabel}</div>
  return <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"><MatchRecordClub club={record.homeClub} /><span className="whitespace-nowrap text-base font-semibold tabular-nums text-[#0A1318]">{record.homeScore} - {record.awayScore}</span><MatchRecordClub club={record.awayClub} align="right" /></div>
}

export default function DraftSquadsTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [processing, setProcessing] = useState(false)
  const [editTeam, setEditTeam] = useState(null)
  const [editPlayer, setEditPlayer] = useState(null)
  const [profilePlayer, setProfilePlayer] = useState(null)
  const [activeSection, setActiveSection] = useState('roster')
  const [teamSelectorCollapsed, setTeamSelectorCollapsed] = useState(false)
  const [clubManagerOpen, setClubManagerOpen] = useState(false)
  const [masterClubs, setMasterClubs] = useState([])
  const [managedClubIds, setManagedClubIds] = useState([])
  const [loadingClubs, setLoadingClubs] = useState(false)
  const [clubRecordMetric, setClubRecordMetric] = useState('goals')
  const [editDirty, setEditDirty] = useState(false)
  const [discardAction, setDiscardAction] = useState(null)
  const [draggedPlayerIndex, setDraggedPlayerIndex] = useState(null)

  // Default to first team if none selected
  const selectedClubId = searchParams.get('team') || saveData.teams[0]?.club_id

  useEffect(() => {
    if (!searchParams.get('team') && saveData.teams.length > 0) {
      setSearchParams({ team: saveData.teams[0].club_id }, { replace: true })
    }
  }, [saveData, searchParams, setSearchParams])

  const teamIndex = saveData.teams.findIndex(t => t.club_id === selectedClubId)
  const team = saveData.teams[teamIndex]

  if (!team) return null
  const averageOvr = team.roster.length ? Math.round(team.roster.reduce((sum, player) => sum + player.ovr, 0) / team.roster.length) : 0

  async function handleRelease(player) {
    if (!window.confirm(`Release ${player.name} to Free Agents? You will get back $${(player.market_value / 1000000).toFixed(1)}M.`)) return
    
    setProcessing(true)
    try {
      const newTeams = [...saveData.teams]
      const currentTeam = { ...newTeams[teamIndex] }
      const newFreeAgents = [...(saveData.freeAgents || [])]

      // Remove from roster
      currentTeam.roster = currentTeam.roster.filter(p => p.id !== player.id)
      // Refund budget
      currentTeam.budget += (player.market_value || 0)
      
      newTeams[teamIndex] = currentTeam
      
      const releasedPlayer = { ...player, club_id: null, club: null }
      newFreeAgents.push(releasedPlayer)

      const newSaveData = { ...saveData, teams: newTeams, freeAgents: newFreeAgents }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
    } catch (err) {
      console.error('Failed to release player', err)
      alert('Failed to release player')
    } finally {
      setProcessing(false)
    }
  }

  async function openClubManager() {
    setClubManagerOpen(true)
    setManagedClubIds(saveData.teams.map(item => String(item.club_id)))
    setLoadingClubs(true)
    try {
      const clubs = await fetchClubs()
      setMasterClubs(clubs.filter(club => !club.is_national))
    } catch (error) {
      console.error('Failed to load master clubs', error)
    } finally {
      setLoadingClubs(false)
    }
  }

  function toggleManagedClub(clubId) {
    const id = String(clubId)
    setManagedClubIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function saveManagedClubs() {
    if (!managedClubIds.length) return
    setProcessing(true)
    try {
      const selected = new Set(managedClubIds.map(String))
      const removedTeams = saveData.teams.filter(item => !selected.has(String(item.club_id)))
      const keptTeams = saveData.teams.filter(item => selected.has(String(item.club_id)))
      const existingIds = new Set(keptTeams.map(item => String(item.club_id)))
      const addedTeams = masterClubs
        .filter(club => selected.has(String(club.id)) && !existingIds.has(String(club.id)))
        .map(club => ({
          club_id: club.id,
          club_name: club.name,
          short_name: club.short_name || club.name?.slice(0, 3).toUpperCase(),
          badge_url: club.badge_url || null,
          badge_color: club.badge_color || '#0A1318',
          budget: 100_000_000,
          stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 },
          roster: [],
        }))
      const releasedPlayers = removedTeams.flatMap(item => (item.roster || []).map(player => ({ ...player, club_id: null, club: null })))
      const releasedIds = new Set(releasedPlayers.map(player => String(player.id)))
      const freeAgents = [...(saveData.freeAgents || []).filter(player => !releasedIds.has(String(player.id))), ...releasedPlayers]
      const teams = [...keptTeams, ...addedTeams]
      const nextState = { ...saveData, teams, freeAgents }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      if (!teams.some(item => String(item.club_id) === String(selectedClubId))) {
        setSearchParams({ team: teams[0].club_id }, { replace: true })
      }
      setClubManagerOpen(false)
    } catch (error) {
      console.error('Failed to manage save clubs', error)
      alert('Failed to update clubs in this save')
    } finally {
      setProcessing(false)
    }
  }

  async function handleBudgetUpdate(form) {
    setProcessing(true)
    try {
      const newTeams = saveData.teams.map(item => item.club_id === editTeam.club_id ? { ...item, budget: Math.max(0, Number(form.budget) || 0) } : item)
      const newSaveData = { ...saveData, teams: newTeams }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setEditTeam(null)
    } catch (error) {
      console.error('Failed to update team budget', error)
    } finally {
      setProcessing(false)
    }
  }

  async function handlePlayerUpdate(form) {
    if (!editPlayer) return
    setProcessing(true)
    try {
      const updatedPlayer = {
        ...editPlayer,
        name: form.name,
        nationality: form.nationality,
        age: form.age,
        position: form.position,
        market_value: form.market_value,
        stats: form.stats,
        ovr: calculateOVR(form.position, form.stats),
        photo_url: form.photo?.preview || editPlayer.photo_url || null,
        club_id: team.club_id,
      }
      delete updatedPlayer.club

      const newTeams = saveData.teams.map(item => item.club_id === team.club_id
        ? { ...item, roster: (item.roster || []).map(player => player.id === editPlayer.id ? updatedPlayer : player) }
        : item)
      const newSaveData = { ...saveData, teams: newTeams }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setProfilePlayer({ ...updatedPlayer, club: { id: team.club_id, name: team.club_name, short_name: team.short_name, badge_url: team.badge_url, badge_color: team.badge_color } })
      setEditDirty(false)
      setEditPlayer(null)
    } catch (error) {
      console.error('Failed to update player', error)
      alert('Failed to update player')
    } finally {
      setProcessing(false)
    }
  }

  function openPlayerEditor(player) {
    setEditDirty(false)
    setEditPlayer(player)
  }

  function requestLeavePlayerEditor(action = 'back') {
    if (editDirty) {
      setDiscardAction(action)
      return
    }
    setEditPlayer(null)
    if (action === 'close') setProfilePlayer(null)
  }

  function confirmDiscardPlayerChanges() {
    const action = discardAction
    setDiscardAction(null)
    setEditDirty(false)
    setEditPlayer(null)
    if (action === 'close') setProfilePlayer(null)
  }

  async function saveRosterOrder(roster) {
    setProcessing(true)
    try {
      const newTeams = saveData.teams.map(item => item.club_id === team.club_id ? { ...item, roster } : item)
      const newSaveData = { ...saveData, teams: newTeams }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
    } catch (error) {
      console.error('Failed to save lineup', error)
      alert('Failed to save lineup')
    } finally {
      setProcessing(false)
    }
  }

  function movePlayer(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= team.roster.length || fromIndex === toIndex) return
    const roster = [...team.roster]
    const [player] = roster.splice(fromIndex, 1)
    roster.splice(toIndex, 0, player)
    saveRosterOrder(roster)
  }

  function openRosterPlayer(player) {
    setProfilePlayer({
      ...player,
      club: {
        id: team.club_id,
        name: team.club_name,
        short_name: team.short_name,
        badge_url: team.badge_url,
        badge_color: team.badge_color,
      },
    })
  }

  function dropPlayerAt(toIndex) {
    if (draggedPlayerIndex == null) return
    movePlayer(draggedPlayerIndex, toIndex)
    setDraggedPlayerIndex(null)
  }

  const editPlayerInitial = editPlayer ? {
    first_name: editPlayer.name.split(' ').slice(0, -1).join(' ') || editPlayer.name,
    last_name: editPlayer.name.split(' ').slice(-1).join('') || '',
    nationality: editPlayer.nationality,
    age: editPlayer.age,
    position: editPlayer.position,
    market_value: editPlayer.market_value,
    stats: editPlayer.stats,
    photo: editPlayer.photo_url ? { preview: editPlayer.photo_url } : null,
    club_id: team.club_id,
  } : null

  const seasons = saveData.settings?.seasons || []
  const cups = saveData.settings?.cups || []
  const competitionHistory = Array.from({ length: Math.max(seasons.length, cups.length) }, (_, index) => {
    const season = seasons[index]
    const cup = cups.find(item => season?.id != null && String(item.seasonId) === String(season.id)) || cups.find(item => Number(item.number) === index + 1)
    const standingIndex = (season?.standings || []).findIndex(row => String(row.club_id) === String(team.club_id)) ?? -1
    const leagueMatch = (season?.matches || []).some(week => (week.matches || []).some(match => String(match.home) === String(team.club_id) || String(match.away) === String(team.club_id)))
    const leagueParticipated = standingIndex >= 0 || leagueMatch
    const cupTeams = new Set((cup?.rounds?.[1] || []).flatMap(match => [String(match.home), String(match.away)]))
    const cupParticipated = cupTeams.has(String(team.club_id))
    let cupResult = null
    if (cupParticipated) {
      const position = (cup.prizePayouts || []).find(item => String(item.clubId) === String(team.club_id))?.position
      if (position === 1 || String(cup.champion) === String(team.club_id)) cupResult = 'Champion'
      else if (position === 2) cupResult = 'Runner-up'
      else if (position && position <= 4) cupResult = 'Semi-finals'
      else if (position) cupResult = 'Quarter-finals'
      else if ((cup.rounds?.[3] || []).some(match => [match.home, match.away].some(id => String(id) === String(team.club_id)))) cupResult = cup.status === 'completed' ? 'Runner-up' : 'Final'
      else if ((cup.rounds?.[2] || []).some(match => [match.home, match.away].some(id => String(id) === String(team.club_id)))) cupResult = 'Semi-finals'
      else cupResult = 'Quarter-finals'
    }
    return {
      number: index + 1,
      league: leagueParticipated ? { name: `League ${index + 1}`, result: standingIndex >= 0 ? `#${standingIndex + 1}` : 'Participated' } : null,
      cup: cupParticipated ? { name: `Club Cup ${cup.number || index + 1}`, result: cupResult } : null,
    }
  }).filter(entry => entry.league || entry.cup)
  const allClubMatches = [
    ...seasons.flatMap((season, seasonIndex) => (season.matches || []).flatMap(week => (week.matches || []).filter(match => match.played).map(match => ({ ...match, competition: `League ${seasonIndex + 1}` })))),
    ...cups.flatMap(cup => Object.values(cup.rounds || {}).flat().filter(match => match?.played).map(match => ({ ...match, competition: `Club Cup ${cup.number}` }))),
  ].filter(match => [match.home, match.away].some(id => String(id) === String(team.club_id))).map(match => {
    const homeClub = saveData.teams.find(item => String(item.club_id) === String(match.home))
    const awayClub = saveData.teams.find(item => String(item.club_id) === String(match.away))
    const isHome = String(match.home) === String(team.club_id)
    return { ...match, homeClub, awayClub, clubGoals: isHome ? match.homeScore : match.awayScore, opponentGoals: isHome ? match.awayScore : match.homeScore }
  })
  const highestScoringMatch = [...allClubMatches].sort((a, b) => b.clubGoals - a.clubGoals || (b.clubGoals - b.opponentGoals) - (a.clubGoals - a.opponentGoals) || String(a.competition).localeCompare(String(b.competition)))[0]
  const biggestDefeat = allClubMatches.filter(match => match.opponentGoals > match.clubGoals).sort((a, b) => (b.opponentGoals - b.clubGoals) - (a.opponentGoals - a.clubGoals) || b.opponentGoals - a.opponentGoals)[0]
  const clubPlayerRecords = (() => {
    const records = new Map()
    const ensure = player => {
      if (!player?.id) return null
      const id = String(player.id)
      if (!records.has(id)) records.set(id, { player: { ...player }, goals: 0, assists: 0, mvps: 0, games: 0 })
      return records.get(id)
    }
    ;(team.roster || []).forEach(ensure)
    seasons.forEach(season => {
      const snapshots = season.stats?.playerSnapshots || {}
      const clubMatches = (season.matches || []).flatMap(week => week.matches || []).filter(match => match.played && [match.home, match.away].some(id => String(id) === String(team.club_id))).length
      Object.entries(snapshots).forEach(([playerId, snapshot]) => {
        if (String(snapshot?.club?.id) !== String(team.club_id)) return
        const record = ensure({ id: snapshot.id || playerId, name: snapshot.name, photo_url: snapshot.photo_url, nationality: snapshot.nationality, position: snapshot.position })
        record.goals += season.stats?.topScorers?.[playerId] || 0
        record.assists += season.stats?.topAssists?.[playerId] || 0
        record.mvps += season.stats?.mostMvps?.[playerId] || 0
        record.games += clubMatches
      })
    })
    cups.filter(cup => !cup.seasonId || !seasons.some(season => String(season.id) === String(cup.seasonId))).forEach(cup => {
      Object.values(cup.rounds || {}).flat().filter(match => match?.played && [match.home, match.away].some(id => String(id) === String(team.club_id))).forEach(match => {
        const participants = new Set()
        ;(match.events || []).forEach(event => {
          const eventClubId = event.team === 'home' ? match.home : event.team === 'away' ? match.away : null
          if (String(eventClubId) !== String(team.club_id)) return
          if (event.player) {
            const record = ensure(event.player)
            participants.add(String(event.player.id))
            if (event.type === 'goal') record.goals += 1
          }
          if (event.type === 'goal' && event.assist) {
            const record = ensure(event.assist)
            participants.add(String(event.assist.id))
            record.assists += 1
          }
        })
        if (match.mvp) {
          const currentClub = saveData.teams.find(item => (item.roster || []).some(player => String(player.id) === String(match.mvp.id)))
          if (String(currentClub?.club_id) === String(team.club_id)) {
            ensure(match.mvp).mvps += 1
            participants.add(String(match.mvp.id))
          }
        }
        participants.forEach(id => { records.get(id).games += 1 })
      })
    })
    const metricValue = record => clubRecordMetric === 'goals' ? record.goals : clubRecordMetric === 'assists' ? record.assists : record.mvps
    return [...records.values()].map(record => {
      const currentClub = saveData.teams.find(item => (item.roster || []).some(player => String(player.id) === String(record.player.id)))
      return { ...record, currentClub, value: metricValue(record) }
    }).sort((a, b) => b.value - a.value || b.goals - a.goals || b.assists - a.assists || b.mvps - a.mvps || String(a.player.name).localeCompare(String(b.player.name))).slice(0, 5)
  })()

  const loadSavePlayerHistory = useCallback(async (playerId) => {
    const id = String(playerId)
    const historyByClub = new Map()
    const awards = []
    const currentClub = saveData.teams.find(item => (item.roster || []).some(player => String(player.id) === id))
    const fallbackClub = currentClub ? { id: currentClub.club_id, name: currentClub.club_name, short_name: currentClub.short_name || currentClub.club_name?.slice(0, 3).toUpperCase(), badge_url: currentClub.badge_url, badge_color: currentClub.badge_color } : null
    const ensureHistory = club => {
      if (!club) return null
      const key = String(club.id)
      if (!historyByClub.has(key)) historyByClub.set(key, { club, stats: { goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0 } })
      return historyByClub.get(key)
    }
    seasons.forEach((season, seasonIndex) => {
      const snapshot = season.stats?.playerSnapshots?.[playerId] || season.stats?.playerSnapshots?.[id]
      const club = snapshot?.club || fallbackClub
      const history = ensureHistory(club)
      if (history) {
        history.stats.goal += season.stats?.topScorers?.[playerId] || season.stats?.topScorers?.[id] || 0
        history.stats.assist += season.stats?.topAssists?.[playerId] || season.stats?.topAssists?.[id] || 0
        history.stats.mvp += season.stats?.mostMvps?.[playerId] || season.stats?.mostMvps?.[id] || 0
        ;(season.matches || []).forEach(week => (week.matches || []).forEach(match => (match.events || []).forEach(event => {
          if (event.type !== 'foul' || String(event.player?.id) !== id) return
          history.stats[event.card === 'red' ? 'red_card' : 'yellow_card'] += 1
        })))
      }
      ;[['topScorers', 'top_scorer'], ['topAssists', 'top_assist'], ['mostMvps', 'most_mvp']].forEach(([key, awardType]) => {
        const entries = Object.entries(season.stats?.[key] || {}).sort((a, b) => b[1] - a[1])
        if (entries[0] && String(entries[0][0]) === id && entries[0][1] > 0 && club) awards.push({ season_name: `Season ${seasonIndex + 1}`, award_type: awardType, club })
      })
    })
    return { history: [...historyByClub.values()], awards }
  }, [saveData.teams, seasons])

  return (
    <div className="flex flex-col items-start gap-6 md:flex-row">
      {/* Team Selector Sidebar */}
      <div className={`w-full flex-shrink-0 transition-[width] duration-300 ease-out ${teamSelectorCollapsed ? 'md:w-14' : 'md:w-64'}`}>
        <div className={`mb-3 hidden h-9 items-center md:flex ${teamSelectorCollapsed ? 'justify-center' : 'justify-between'}`}>
          <h3 className={`overflow-hidden whitespace-nowrap text-sm font-medium text-gray-500 transition-[width,opacity] duration-200 ${teamSelectorCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>Select team</h3>
          <button type="button" onClick={() => setTeamSelectorCollapsed(value => !value)} aria-label={teamSelectorCollapsed ? 'Expand team selector' : 'Collapse team selector'} title={teamSelectorCollapsed ? 'Expand teams' : 'Collapse teams'} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-slate-500 transition-[background-color,color,transform] duration-200 hover:bg-slate-100 hover:text-slate-800 active:scale-95">
            {teamSelectorCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        <div className="relative flex gap-2 overflow-x-auto pb-2 hide-scrollbar md:flex-col md:overflow-visible md:pb-0">
          <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-0 hidden h-14 w-full rounded-xl border-2 border-[#FD5461] bg-[#FD5461]/5 shadow-sm shadow-[#FD5461]/10 transition-transform duration-300 ease-out md:block" style={{ transform: `translateY(${Math.max(0, teamIndex) * 64}px)` }} />
          {saveData.teams.map(t => (
            <div key={t.club_id} className={`group relative z-10 flex h-14 flex-shrink-0 items-center rounded-xl border-2 transition-[background-color,border-color,color] duration-200 hover:z-50 md:w-full md:flex-shrink ${
                selectedClubId === t.club_id 
                  ? 'border-[#FD5461] bg-[#FD5461]/5 md:border-transparent md:bg-transparent'
                  : 'border-transparent hover:border-slate-200 hover:bg-slate-100/80'
              }`}>
            <button onClick={() => setSearchParams({ team: t.club_id })} title={teamSelectorCollapsed ? t.club_name : undefined} className={`flex h-full min-w-0 flex-1 cursor-pointer items-center text-left transition-[padding,gap] duration-300 ${teamSelectorCollapsed ? 'justify-center gap-0 px-2' : 'gap-3 px-3'}`}>
              {t.badge_url ? (
                <img src={t.badge_url} alt={t.club_name} className="h-8 w-8 shrink-0 object-contain" />
              ) : (
                <div className={`h-8 w-8 shrink-0 rounded-full transition-colors ${selectedClubId === t.club_id ? 'bg-[#FD5461]/20 ring-2 ring-[#FD5461]/20' : 'bg-slate-200 group-hover:bg-slate-300'}`} />
              )}
              <div className={`hidden min-w-0 overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 md:block ${teamSelectorCollapsed ? 'w-0 flex-none opacity-0' : 'w-auto flex-1 opacity-100'}`}>
                <div className="font-bold text-sm text-[#0A1318] truncate">{t.club_name}</div>
                <div className="text-xs font-normal text-gray-500">{t.roster.length} players</div>
              </div>
            </button>
            <button onClick={() => setEditTeam(t)} aria-label={`Edit ${t.club_name} career budget`} tabIndex={teamSelectorCollapsed ? -1 : 0} className={`flex h-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg text-gray-400 transition-[width,opacity,background-color,color,margin] duration-200 hover:bg-slate-100 hover:text-slate-800 ${teamSelectorCollapsed ? 'pointer-events-none m-0 w-0 opacity-0' : 'mr-2 w-9 opacity-100'}`}><Pencil size={16} strokeWidth={2.25} /></button>
            {teamSelectorCollapsed && <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 hidden w-max min-w-40 -translate-x-2 -translate-y-1/2 overflow-hidden whitespace-nowrap rounded-xl bg-[#34414A] px-4 py-2.5 text-sm font-medium text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 md:block">{t.club_name}</span>}
            </div>
          ))}
          <button type="button" onClick={openClubManager} title="Manage clubs in this save" className={`relative z-10 flex h-12 cursor-pointer items-center rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 transition-[background-color,border-color,color,transform] duration-200 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98] ${teamSelectorCollapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100"><Plus size={17} /></span>
            <span className={`overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ${teamSelectorCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>Manage clubs</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {team.badge_url ? (
              <img src={team.badge_url} alt={team.club_name} className="w-12 h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-200" />
            )}
            <div>
              <h1 className="text-2xl font-heading font-black text-[#0A1318] uppercase tracking-wider leading-none mb-1">
                {team.club_name}
              </h1>
              <div className="text-sm font-semibold text-[#FD5461]">
                Budget: ${(team.budget / 1000000).toFixed(1)}M
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <OvrBadge value={averageOvr} size="lg" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg OVR</span>
          </div>
        </div>

        <SegmentedControl className="mb-6 w-full sm:w-fit" ariaLabel="Team details" value={activeSection} onChange={setActiveSection} items={[
            { id: 'roster', label: 'Roster', icon: Users },
            { id: 'lineup', label: 'Lineup', icon: ShieldCheck },
            { id: 'history', label: 'History', icon: History },
          ]} />

        {activeSection === 'roster' && <div className={`player-card-grid transition-opacity ${processing ? 'opacity-50' : 'opacity-100'}`}>
          {[...team.roster].sort((a,b) => b.ovr - a.ovr).map(p => {
            const player = {
              ...p,
              club: {
                id: team.club_id,
                name: team.club_name,
                short_name: team.club_name,
                badge_url: team.badge_url,
                badge_color: team.badge_color
              }
            }
            return (
              <PlayerCard 
                key={player.id} 
                player={player} 
                onClick={() => setProfilePlayer(player)}
                onEdit={() => openPlayerEditor(player)}
                onDelete={() => handleRelease(player)} 
                deleteLabel="Release"
              />
            )
          })}
        </div>}
        
        {activeSection === 'roster' && team.roster.length === 0 && (
          <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">
            No players in roster.
          </div>
        )}

        {activeSection === 'lineup' && (
          <div className={`transition-opacity ${processing ? 'pointer-events-none opacity-50' : ''}`}>
            {[{ title: 'Starting 5', start: 0, count: 5 }, { title: `Substitutes · ${Math.max(0, team.roster.length - 5)}`, start: 5, count: Math.max(7, team.roster.length - 5) }].map((section, sectionIndex) => (
              <div key={section.title} className={sectionIndex ? 'mt-6' : ''}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">{section.title}</span>
                  {!sectionIndex && <span className="text-sm text-gray-400">{Math.min(team.roster.length, 5)} / 5</span>}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: section.count }, (_, localIndex) => {
                    const playerIndex = section.start + localIndex
                    const player = team.roster[playerIndex]
                    if (!player) return <div key={`empty-${section.start}-${localIndex}`} onDragOver={event => event.preventDefault()} onDrop={() => playerIndex < team.roster.length && dropPlayerAt(playerIndex)} className="flex min-h-16 items-center rounded-2xl border border-dashed border-gray-200 px-4 text-sm text-gray-300">Empty</div>
                    return <div key={player.id} onDragOver={event => event.preventDefault()} onDrop={() => dropPlayerAt(playerIndex)} className={`flex min-h-16 items-center rounded-2xl border bg-white pr-3 transition-[border-color,background-color,opacity,transform] duration-200 hover:border-slate-300 hover:bg-slate-50 ${draggedPlayerIndex === playerIndex ? 'scale-[0.99] border-[#FD5461] opacity-50' : 'border-gray-200'}`}>
                      <span draggable onDragStart={() => setDraggedPlayerIndex(playerIndex)} onDragEnd={() => setDraggedPlayerIndex(null)} title="Drag to reorder" className="flex h-16 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-slate-400 transition-colors hover:text-slate-700 active:cursor-grabbing"><GripVertical size={19} /></span>
                      <button type="button" onClick={() => openRosterPlayer(player)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 text-left">
                        {player.photo_url ? <img src={player.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-400">{player.name?.charAt(0)}</span>}
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#0A1318]">{player.name}</span><span className="mt-0.5 block text-xs text-gray-500">{player.position} · OVR {player.ovr}</span></span>
                      </button>
                      <div className="ml-3 flex shrink-0 items-center gap-1.5">
                        {sectionIndex === 0
                          ? <Button variant="outline" size="sm" disabled={team.roster.length <= 5} onClick={() => movePlayer(playerIndex, 5)}>To bench</Button>
                          : <Button variant="outline" size="sm" onClick={() => movePlayer(playerIndex, 4)}>Make starter</Button>}
                        <Button variant="ghost" size="sm" aria-label={`Edit ${player.name}`} title="Edit player" onClick={() => openPlayerEditor(player)}><Pencil size={16} /></Button>
                        <Button variant="ghost" size="sm" aria-label={`Release ${player.name}`} title="Release player" onClick={() => handleRelease(player)}><Trash2 size={16} /></Button>
                      </div>
                    </div>
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {false && (
          <div className={`transition-opacity ${processing ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-gray-500">Starting 5</span><span className="text-xs text-gray-400">{Math.min(team.roster.length, 5)} / 5</span></div>
            <div className="mb-6 space-y-2">{Array.from({ length: 5 }, (_, playerIndex) => {
              const player = team.roster[playerIndex]
              if (!player) return <div key={`starter-empty-${playerIndex}`} className="flex min-h-16 items-center rounded-2xl border border-dashed border-gray-200 px-4 text-sm text-gray-300">Empty</div>
              return <div key={player.id} className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
                {player.photo_url ? <img src={player.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-400">{player.name?.charAt(0)}</span>}
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0A1318]">{player.name}</div><div className="mt-0.5 text-xs text-gray-500">{player.position} · OVR {player.ovr}</div></div>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} up`} disabled={playerIndex === 0} onClick={() => movePlayer(playerIndex, playerIndex - 1)}><ArrowUp size={16} /></Button>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} down`} disabled={playerIndex >= team.roster.length - 1} onClick={() => movePlayer(playerIndex, playerIndex + 1)}><ArrowDown size={16} /></Button>
                <Button variant="outline" size="sm" disabled={team.roster.length <= 5} onClick={() => movePlayer(playerIndex, 5)}>To bench</Button>
              </div>
            })}</div>
            <div className="mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-gray-200" /><span className="text-xs font-medium text-gray-400">Substitutes · {Math.max(0, team.roster.length - 5)}</span><div className="h-px flex-1 bg-gray-200" /></div>
            <div className="space-y-2">{Array.from({ length: Math.max(7, team.roster.length - 5) }, (_, localIndex) => {
              const playerIndex = localIndex + 5
              const player = team.roster[playerIndex]
              if (!player) return <div key={`sub-empty-${localIndex}`} className="flex min-h-16 items-center rounded-2xl border border-dashed border-gray-200 px-4 text-sm text-gray-300">Empty</div>
              return <div key={player.id} className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50">
                {player.photo_url ? <img src={player.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-400">{player.name?.charAt(0)}</span>}
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#0A1318]">{player.name}</div><div className="mt-0.5 text-xs text-gray-500">{player.position} · OVR {player.ovr}</div></div>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} up`} onClick={() => movePlayer(playerIndex, playerIndex - 1)}><ArrowUp size={16} /></Button>
                <Button variant="ghost" size="sm" aria-label={`Move ${player.name} down`} disabled={playerIndex >= team.roster.length - 1} onClick={() => movePlayer(playerIndex, playerIndex + 1)}><ArrowDown size={16} /></Button>
                <Button variant="outline" size="sm" onClick={() => movePlayer(playerIndex, 4)}>Make starter</Button>
              </div>
            })}</div>
          </div>
        )}

        {activeSection === 'history' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-base font-semibold">Competition history</h2></div>
              <div className="grid grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)] border-b border-gray-100 bg-slate-50 px-5 py-3 text-xs font-medium text-gray-500"><span>Season</span><span>League</span><span>Cup</span></div>
              <div className="divide-y divide-gray-100">
                {competitionHistory.map(entry => <div key={entry.number} className="grid min-h-20 grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-5 py-4"><span className="text-sm font-semibold">Season {entry.number}</span>{entry.league ? <span className="min-w-0"><span className="block truncate text-xs text-gray-500">{entry.league.name}</span><span className="mt-1 block text-sm font-semibold text-[#0A1318]">{entry.league.result}</span></span> : <span className="text-sm text-gray-300">—</span>}{entry.cup ? <span className="min-w-0"><span className="block truncate text-xs text-gray-500">{entry.cup.name}</span><span className={`mt-1 block text-sm font-semibold ${entry.cup.result === 'Champion' ? 'text-[#FD5461]' : 'text-[#0A1318]'}`}>{entry.cup.result}</span></span> : <span className="text-sm text-gray-300">—</span>}</div>)}
                {!competitionHistory.length && <div className="px-5 py-10 text-center text-sm text-gray-400">No competition history yet.</div>}
              </div>
            </section>
            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-base font-semibold">Club match records</h2></div>
                <div className="grid divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="p-5"><div className="text-xs font-medium text-gray-500">Most goals scored in a match</div><MatchRecordSummary record={highestScoringMatch} emptyLabel="No completed match yet" /></div>
                  <div className="p-5"><div className="text-xs font-medium text-gray-500">Biggest defeat</div><MatchRecordSummary record={biggestDefeat} emptyLabel="No defeat recorded" /></div>
                </div>
              </section>
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-base font-semibold">Club player records</h2><div className="mt-3 flex gap-1.5">{[{ id: 'goals', label: 'Goals' }, { id: 'assists', label: 'Assists' }, { id: 'mvps', label: 'MVP Awards' }].map(option => <button key={option.id} onClick={() => setClubRecordMetric(option.id)} className={`min-h-9 cursor-pointer rounded-full px-4 text-xs font-medium transition-colors ${clubRecordMetric === option.id ? 'bg-[#FD5461] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'}`}>{option.label}</button>)}</div></div>
                <div className="divide-y divide-gray-100">{clubPlayerRecords.map((record, index) => <div key={record.player.id} className="flex min-h-16 items-center gap-3 px-5 py-3"><span className="w-5 text-center text-xs font-medium text-gray-400">{index + 1}</span>{record.player.photo_url ? <img src={record.player.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">{record.player.name?.charAt(0)}</span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{record.player.name}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">{record.currentClub ? <><span className="flex h-4 w-4 items-center justify-center rounded text-[6px] font-semibold text-white" style={{ backgroundColor: record.currentClub.badge_color || '#34414A' }}>{(record.currentClub.short_name || record.currentClub.club_name).slice(0, 2).toUpperCase()}</span><span className="truncate">{record.currentClub.club_name}</span></> : <span>Free Agent</span>}</span></span><span className="text-base font-semibold tabular-nums text-[#FD5461]">{record.value}</span></div>)}</div>
              </section>
            </div>
          </div>
        )}
      </div>
      <Modal open={Boolean(editTeam)} onClose={() => setEditTeam(null)} title="Edit Club">
        {editTeam && <ClubForm identityLocked initialValues={{ name: editTeam.club_name, short_name: editTeam.short_name || editTeam.club_name.slice(0, 3).toUpperCase(), badge: editTeam.badge_url ? { preview: editTeam.badge_url } : null, budget: editTeam.budget || 0 }} onSubmit={handleBudgetUpdate} loading={processing} />}
      </Modal>
      <Modal open={clubManagerOpen} onClose={() => !processing && setClubManagerOpen(false)} title="Manage Clubs">
        <div className="flex h-[min(65dvh,560px)] min-h-0 flex-col">
          <p className="mb-4 shrink-0 text-sm text-gray-500">Choose clubs from the master Clubs page. Removing a club releases every player in its roster to this save's Free Agents.</p>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 hide-scrollbar">
            {loadingClubs ? <div className="py-12 text-center text-sm text-gray-400">Loading clubs...</div> : masterClubs.map(club => {
              const selected = managedClubIds.includes(String(club.id))
              const currentTeam = saveData.teams.find(item => String(item.club_id) === String(club.id))
              return <button type="button" key={club.id} onClick={() => toggleManagedClub(club.id)} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.99] ${selected ? 'border-[#FD5461] bg-[#FD5461]/5' : 'border-gray-200 hover:bg-slate-50'}`}>
                {club.badge_url ? <img src={club.badge_url} alt="" className="h-10 w-10 shrink-0 object-contain" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-semibold text-white" style={{ backgroundColor: club.badge_color || '#0A1318' }}>{(club.short_name || club.name).slice(0, 3).toUpperCase()}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#0A1318]">{club.name}</span><span className="mt-0.5 block text-xs text-gray-500">{currentTeam ? `${currentTeam.roster?.length || 0} players in this save` : 'Available from master data'}</span></span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${selected ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>{selected ? <Check size={17} strokeWidth={2.5} /> : <Plus size={17} />}</span>
              </button>
            })}
          </div>
          <div className="mt-5 shrink-0 border-t border-gray-100 bg-white pt-4"><Button className="w-full" onClick={saveManagedClubs} disabled={processing || loadingClubs || !managedClubIds.length}>{processing ? 'Saving...' : `Save ${managedClubIds.length} clubs`}</Button></div>
        </div>
      </Modal>
      <PlayerProfileModal player={profilePlayer} open={Boolean(profilePlayer)} onClose={() => requestLeavePlayerEditor('close')} onEdit={openPlayerEditor} onRelease={handleRelease} historyLoader={loadSavePlayerHistory} editing={Boolean(editPlayer)} onBackEdit={() => requestLeavePlayerEditor('back')} editContent={editPlayer ? <PlayerForm key={editPlayer.id} initialValues={editPlayerInitial} onSubmit={handlePlayerUpdate} onDirtyChange={setEditDirty} loading={processing} clubs={[{ id: team.club_id, name: team.club_name, short_name: team.short_name, badge_url: team.badge_url, badge_color: team.badge_color }]} /> : null} />
      <Modal open={Boolean(discardAction)} onClose={() => setDiscardAction(null)} title="Discard unsaved changes?">
        <p className="text-sm text-gray-500">Your edits have not been saved. If you go back now, these changes will be lost.</p>
        <div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={() => setDiscardAction(null)}>Keep editing</Button><Button onClick={confirmDiscardPlayerChanges}>Discard changes</Button></div>
      </Modal>
    </div>
  )
}
