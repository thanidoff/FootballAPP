import { useMemo, useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, CalendarDays, ChartNoAxesColumn, Play, Plus, Search, Sparkles, Trophy } from 'lucide-react'
import LeagueStandingsTable from '../../../components/draft/LeagueStandingsTable'
import Button from '../../../components/ui/Button'
import SegmentedControl from '../../../components/ui/SegmentedControl'
import CardHeaderAction from '../../../components/ui/CardHeaderAction'
import Select from '../../../components/ui/Select'
import ResultScore from '../../../components/draft/ResultScore'
import PlayerProfileModal from '../../../components/players/PlayerProfileModal'
import SeasonalGrowthModal from '../../../components/draft/SeasonalGrowthModal'
import { applySeasonalPlayerAdjustments } from '../../../utils/playerGrowth'
import OvrBadge from '../../../components/ui/OvrBadge'
import PositionBadge from '../../../components/ui/PositionBadge'
import { FIFA_NATIONS } from '../../../utils/fifaNations'
import FreeAgentIcon from '../../../components/ui/FreeAgentIcon'
import { updateDraftState } from '../../../services/draftSave'

const STAT_FILTERS = [
  { key: 'topScorers', label: 'Goals' },
  { key: 'topAssists', label: 'Assists' },
  { key: 'mostMvps', label: 'MVP' },
  { key: 'mostFouls', label: 'Fouls' },
]

const emptyStats = { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 }

function Badge({ team, size = 'h-8 w-8' }) {
  if (team?.badge_url) return <img src={team.badge_url} alt="" className={`${size} shrink-0 object-contain`} />
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-lg text-[9px] font-black text-white`} style={{ backgroundColor: team?.badge_color || '#0A1318' }}>
      {(team?.club_name || team?.name || '—').slice(0, 3).toUpperCase()}
    </span>
  )
}

function Empty({ children, className = '' }) {
  return <div className={`flex min-h-40 items-center justify-center px-6 text-center text-sm text-gray-400 ${className}`}>{children}</div>
}

function TransferClub({ team, name }) {
  const isFreeAgent = !team && (!name || name === 'Free Agent' || name === 'FREE')
  if (isFreeAgent) {
    return (
      <span className="flex min-w-0 items-center gap-2" title="Free Agent">
        <FreeAgentIcon size={20} className="shrink-0" />
        <span className="truncate text-xs font-semibold text-gray-500">FA</span>
      </span>
    )
  }
  const fallback = { club_name: name, short_name: name?.split(/\s+/).map(word => word[0]).join('').slice(0, 3) }
  const club = team || fallback
  return (
    <span className="flex min-w-0 items-center gap-2" title={club.club_name || name}>
      <Badge team={club} size="h-6 w-6" />
      <span className="truncate text-xs font-semibold text-gray-600">{club.short_name || club.club_name?.slice(0, 3).toUpperCase()}</span>
    </span>
  )
}

export default function DraftOverviewTab() {
  const { saveData, saveId } = useOutletContext()
  const navigate = useNavigate()
  const [statFilter, setStatFilter] = useState('topScorers')
  const [statScope, setStatScope] = useState('league')
  const [featureView, setFeatureView] = useState('transfers')
  const [leaderSearch, setLeaderSearch] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const seasons = saveData.settings?.seasons || []
  const activeSeason = seasons.find(season => season.status === 'active') || seasons[seasons.length - 1]
  const hasLeague = Boolean(activeSeason?.matches?.length)
  const seasonIds = new Set(activeSeason?.teamIds || saveData.teams?.map(team => team.club_id) || [])
  const leagueTeams = (saveData.teams || []).filter(team => seasonIds.has(team.club_id))

  const standings = (activeSeason?.status === 'completed' && activeSeason.standings
    ? activeSeason.standings
    : leagueTeams.map(team => ({
        club_id: team.club_id,
        club_name: team.club_name,
        badge_url: team.badge_url,
        badge_color: team.badge_color,
        stats: team.stats || emptyStats,
      })))
    .sort((a, b) => (b.stats?.PTS || 0) - (a.stats?.PTS || 0) || (b.stats?.GD || 0) - (a.stats?.GD || 0) || (b.stats?.GF || 0) - (a.stats?.GF || 0))

  const upcoming = (activeSeason?.matches || [])
    .flatMap(week => week.matches.map((match, matchIndex) => ({ ...match, week: week.week, matchIndex })))
    .filter(match => !match.played && match.week >= (saveData.currentWeek || 1))
    .slice(0, 4)

  const recentResults = (activeSeason?.matches || [])
    .flatMap(week => week.matches.map((match, matchIndex) => ({ ...match, week: week.week, matchIndex })))
    .filter(match => match.played)
    .sort((a, b) => b.week - a.week || b.matchIndex - a.matchIndex)
    .slice(0, 4)

  const leaderData = useMemo(() => {
    const metricKeys = STAT_FILTERS.map(filter => filter.key)
    const scopedSeasons = statScope === 'league' ? (activeSeason ? [activeSeason] : []) : seasons
    const scopedCups = statScope === 'league'
      ? (saveData.settings?.cups || []).filter(cup => String(cup.seasonId) === String(activeSeason?.id))
      : (saveData.settings?.cups || [])

    const metrics = Object.fromEntries(metricKeys.map(key => [key, {}]))
    scopedSeasons.forEach(season => metricKeys.forEach(key => Object.entries(season.stats?.[key] || {}).forEach(([id, value]) => {
      metrics[key][id] = (metrics[key][id] || 0) + value
    })))

    const discipline = new Map()
    const firstGoal = new Map()
    let eventOrder = 0

    const processEvents = (events) => {
      (events || []).forEach(event => {
        eventOrder += 1
        const pId = event.player?.id ?? event.scorer?.id ?? event.player_id
        const id = pId ? String(pId) : ''
        if (!id) return

        if (event.type === 'goal') {
          if (!firstGoal.has(id)) firstGoal.set(id, eventOrder)
          if (statScope === 'league') {
            // Include Cup goals for this season in metrics
          }
        }
        if (event.type === 'foul') {
          const current = discipline.get(id) || { red: 0, yellow: 0 }
          if (event.card === 'red') current.red += 1
          else current.yellow += 1
          discipline.set(id, current)
        }
      })
    }

    // Accumulate Cup stats for scopedCups into metrics
    scopedCups.forEach(cup => {
      Object.values(cup.rounds || {}).forEach(roundMatches => {
        (roundMatches || []).forEach(match => {
          if (!match.played) return
          (match.events || []).forEach(event => {
            if (event.type === 'goal' && event.scorer) {
              const scorerId = String(event.scorer.id)
              metrics.topScorers[scorerId] = (metrics.topScorers[scorerId] || 0) + 1
            }
            if (event.type === 'goal' && event.assist) {
              const assistId = String(event.assist.id)
              metrics.topAssists[assistId] = (metrics.topAssists[assistId] || 0) + 1
            }
            if (event.type === 'foul' && event.player) {
              const playerId = String(event.player.id)
              metrics.mostFouls = metrics.mostFouls || {}
              metrics.mostFouls[playerId] = (metrics.mostFouls[playerId] || 0) + 1
            }
          })
          if (match.mvp) {
            const mvpId = String(match.mvp.id)
            metrics.mostMvps[mvpId] = (metrics.mostMvps[mvpId] || 0) + 1
          }
        })
      })
    })

    scopedSeasons.forEach(season => (season.matches || []).forEach(week => (week.matches || []).forEach(match => {
      processEvents(match.events)
    })))

    const eligibleTeams = statScope === 'league' ? leagueTeams : (saveData.teams || [])
    const positionByClub = new Map(standings.map((team, index) => [String(team.club_id), index]))
    const seen = new Set()
    const eligiblePlayers = eligibleTeams.flatMap(team => (team.roster || []).map(player => ({ ...player, team }))).filter(player => {
      const id = String(player.id)
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    const query = leaderSearch.trim().toLocaleLowerCase()
    return eligiblePlayers
      .filter(player => !query || player.name?.toLocaleLowerCase().includes(query) || player.team?.club_name?.toLocaleLowerCase().includes(query))
      .map(player => ({ player, value: metrics[statFilter]?.[player.id] || metrics[statFilter]?.[String(player.id)] || 0 }))
      .sort((a, b) => {
        const aId = String(a.player.id), bId = String(b.player.id)
        const bySelectedMetric = b.value - a.value
        if (bySelectedMetric) return bySelectedMetric
        if (statFilter === 'topScorers' && a.value > 0) {
          const byFirstGoal = (firstGoal.get(aId) ?? Number.MAX_SAFE_INTEGER) - (firstGoal.get(bId) ?? Number.MAX_SAFE_INTEGER)
          if (byFirstGoal) return byFirstGoal
        }
        for (const key of ['topScorers', 'topAssists', 'mostMvps']) {
          if (key === statFilter) continue
          const difference = (metrics[key]?.[bId] || 0) - (metrics[key]?.[aId] || 0)
          if (difference) return difference
        }
        const byClubPosition = (positionByClub.get(String(a.player.team?.club_id)) ?? Number.MAX_SAFE_INTEGER) - (positionByClub.get(String(b.player.team?.club_id)) ?? Number.MAX_SAFE_INTEGER)
        if (byClubPosition) return byClubPosition
        const aCards = discipline.get(aId) || { red: 0, yellow: 0 }, bCards = discipline.get(bId) || { red: 0, yellow: 0 }
        if (aCards.red !== bCards.red) return aCards.red - bCards.red
        if (aCards.yellow !== bCards.yellow) return aCards.yellow - bCards.yellow
      })
  }, [activeSeason, leaderSearch, leagueTeams, saveData.teams, seasons, standings, statFilter, statScope])

  const leaders = leaderData.slice(0, 15)

  const transfers = [...(saveData.transferHistory || [])]
    .sort((a, b) => (b.fee || 0) - (a.fee || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  const teamById = id => (saveData.teams || []).find(team => team.club_id === id)
  const money = value => `$${((value || 0) / 1_000_000).toFixed(1)}M`

  function playMatch(match) {
    const home = teamById(match.home), away = teamById(match.away)
    if (!home || !away || activeSeason?.status !== 'active' || match.week !== (saveData.currentWeek || 1)) return
    navigate('/matches/draft/prematch', { state: {
      homeClub: { id: home.club_id, name: home.club_name, short_name: home.short_name || home.club_name, badge_url: home.badge_url, badge_color: home.badge_color, roster: home.roster },
      awayClub: { id: away.club_id, name: away.club_name, short_name: away.short_name || away.club_name, badge_url: away.badge_url, badge_color: away.badge_color, roster: away.roster },
      duration: 5, returnPath: `/draft/${saveId}/matches`, saveId, matchIndex: match.matchIndex, currentWeek: match.week,
    } })
  }

  const [growthModalOpen, setGrowthModalOpen] = useState(false)
  const seasonAdjustments = activeSeason?.seasonAdjustments || []
  const isGrowthLocked = activeSeason?.seasonAdjustmentsLocked || false

  const [previewGrowthData, setPreviewGrowthData] = useState(null)

  function handleReshufflePreview() {
    const result = applySeasonalPlayerAdjustments(saveData.teams || [], saveData.freeAgents || [])
    setPreviewGrowthData(result)
  }

  async function handleConfirmSaveRatings() {
    const target = previewGrowthData || (seasonAdjustments.length === 0 ? applySeasonalPlayerAdjustments(saveData.teams || [], saveData.freeAgents || []) : null)
    if (!target) return

    try {
      const nextSettings = { ...saveData.settings }
      if (nextSettings.seasons && nextSettings.seasons.length > 0) {
        const idx = nextSettings.seasons.findIndex(s => String(s.id) === String(activeSeason?.id))
        const targetIdx = idx >= 0 ? idx : nextSettings.seasons.length - 1
        nextSettings.seasons[targetIdx] = {
          ...nextSettings.seasons[targetIdx],
          seasonAdjustments: target.seasonAdjustments,
          seasonAdjustmentsLocked: true,
        }
      }
      const newSaveData = {
        ...saveData,
        teams: target.updatedTeams,
        freeAgents: target.updatedFreeAgents,
        settings: nextSettings,
      }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setPreviewGrowthData(null)
    } catch (err) {
      console.error('Failed to confirm seasonal player adjustments:', err)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(460px,0.85fr)_minmax(0,1.15fr)]">
        {/* LEFT COLUMN: Season Growth Banner + Standings + Recent Results + Upcoming Matches */}
        <div className="space-y-6">
          {/* Left Column Content */}

          <div>
            <LeagueStandingsTable standings={hasLeague ? standings : []} championId={activeSeason?.champion} onFullTable={() => navigate(`/draft/${saveId}/matches`)} onTeamClick={row => navigate(`/draft/${saveId}/squads?team=${row.club_id}`)} emptyContent={<div className="flex min-h-40 flex-col items-center justify-center px-6 text-center"><p className="text-sm text-gray-400">Create a league to see the standings.</p><Button variant="outline" size="sm" onClick={() => navigate(`/draft/${saveId}/matches`)} className="mt-4 flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"><Plus size={16} /> Start League</Button></div>} />
          </div>

          <section className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="font-heading text-base font-black uppercase tracking-wide text-[#0A1318]">Recent Results</h2>
              <CardHeaderAction onClick={() => navigate(`/draft/${saveId}/matches`)}>View all</CardHeaderAction>
            </header>
            {recentResults.length ? (
              <div className="divide-y divide-gray-50">
                {recentResults.map((match, index) => {
                  const home = teamById(match.home), away = teamById(match.away)
                  const homeShort = home?.short_name || (home?.club_name || '').slice(0, 3).toUpperCase()
                  const awayShort = away?.short_name || (away?.club_name || '').slice(0, 3).toUpperCase()
                  return (
                    <button key={`${match.week}-${match.matchIndex}-${index}`} onClick={() => navigate(`/draft/${saveId}/matches`)} className="w-full cursor-pointer px-5 py-3 text-left transition-colors hover:bg-slate-50">
                      <div className="mb-2 text-xs font-medium text-gray-500">Week {match.week}</div>
                      <div className="grid grid-cols-[1fr_88px_1fr] items-center gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge team={home} size="h-7 w-7" />
                          <span className="truncate text-xs font-bold">
                            <span className="sm:hidden">{homeShort}</span>
                            <span className="hidden sm:inline">{home?.club_name}</span>
                          </span>
                        </span>
                        <ResultScore homeScore={match.homeScore} awayScore={match.awayScore} compact />
                        <span className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-xs font-bold">
                            <span className="sm:hidden">{awayShort}</span>
                            <span className="hidden sm:inline">{away?.club_name}</span>
                          </span>
                          <Badge team={away} size="h-7 w-7" />
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : <Empty className="flex-1">No match results yet.</Empty>}
          </section>

          <section className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="font-heading text-base font-black uppercase tracking-wide text-[#0A1318]">Upcoming Matches</h2>
              <CardHeaderAction onClick={() => navigate(`/draft/${saveId}/matches`)}>View all</CardHeaderAction>
            </header>
            {upcoming.length ? (
              <div className="divide-y divide-gray-50">
                {upcoming.map((match, index) => {
                  const home = teamById(match.home), away = teamById(match.away)
                  const homeShort = home?.short_name || (home?.club_name || '').slice(0, 3).toUpperCase()
                  const awayShort = away?.short_name || (away?.club_name || '').slice(0, 3).toUpperCase()
                  return (
                    <div key={`${match.week}-${index}`} className={`w-full px-5 py-3 text-left transition-[opacity,background-color] ${match.week > (saveData.currentWeek || 1) ? 'bg-gray-50/70 opacity-55' : 'hover:bg-red-50/40'}`}>
                      <div className="mb-2 text-xs font-medium text-[#FD5461]">Week {match.week}</div>
                      <div className="grid grid-cols-[1fr_auto_1fr] sm:grid-cols-[1fr_112px_1fr] items-center gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge team={home} size="h-7 w-7" />
                          <span className="truncate text-xs font-bold">
                            <span className="sm:hidden">{homeShort}</span>
                            <span className="hidden sm:inline">{home?.club_name}</span>
                          </span>
                        </span>
                        {activeSeason?.status === 'active' && match.week === (saveData.currentWeek || 1)
                          ? <Button size="sm" variant="secondary" onClick={() => playMatch(match)} className="whitespace-nowrap px-2.5 sm:px-2 sm:w-full"><Play size={13} fill="currentColor" />Play<span className="hidden sm:inline"> match</span></Button>
                          : <span className="text-center font-heading text-sm font-semibold text-[#0A1318]">VS</span>}
                        <span className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-xs font-bold">
                            <span className="sm:hidden">{awayShort}</span>
                            <span className="hidden sm:inline">{away?.club_name}</span>
                          </span>
                          <Badge team={away} size="h-7 w-7" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex min-h-40 flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm text-gray-400">{hasLeague ? 'No upcoming fixtures yet.' : 'Create a league to generate your first fixtures.'}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/draft/${saveId}/matches`)}
                  className="mt-4 flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"
                >
                  {hasLeague ? <Trophy size={16} /> : <Plus size={16} />}
                  {hasLeague ? 'View League' : 'Start League'}
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Season Transfers / Leaders (Full Height Alone) */}
        <div>
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="border-b border-gray-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="min-w-[180px] font-heading text-lg font-black uppercase tracking-wide text-[#0A1318]">{featureView === 'transfers' ? 'Season Transfers' : 'Player Leaders'}</h2>
                <SegmentedControl items={[{ id: 'transfers', label: 'Transfers', icon: ArrowLeftRight }, { id: 'leaders', label: 'Leaders', icon: ChartNoAxesColumn }]} value={featureView} onChange={setFeatureView} ariaLabel="Dashboard feature" className="w-full sm:w-auto" />
              </div>
              {featureView === 'leaders' && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">{STAT_FILTERS.map(filter => <button key={filter.key} onClick={() => setStatFilter(filter.key)} className={`min-h-9 cursor-pointer whitespace-nowrap rounded-full px-4 text-xs font-medium transition-colors ${statFilter === filter.key ? 'bg-[#FD5461] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'}`}>{filter.label}</button>)}</div><div className="w-52"><Select value={statScope} onChange={event => setStatScope(event.target.value)} reserveErrorSpace={false} className="min-h-10 rounded-xl py-1.5 text-sm"><option value="league">This season (League & Cup)</option><option value="career">All seasons</option></Select></div></div>
                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-colors focus-within:border-[#FD5461]"><Search size={16} className="shrink-0 text-gray-400" /><input value={leaderSearch} onChange={event => setLeaderSearch(event.target.value)} placeholder="Search players or clubs..." className="ui-inner-input min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" /></label>
                </div>
              )}
            </header>
            {featureView === 'transfers' ? (transfers.length ? (
              <div className="w-full overflow-hidden">
                <div className="grid grid-cols-[minmax(180px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_76px] gap-2 bg-white border-b border-gray-100 px-5 py-3 text-[9px] font-heading font-black uppercase tracking-widest text-gray-400">
                  <span>Player</span><span>From</span><span>To</span><span className="text-right">Fee</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto hide-scrollbar">
                  {transfers.map((item, index) => {
                    // Find player data from save
                    let playerObj = (saveData.freeAgents || []).find(p => String(p.id) === String(item.playerId))
                    if (!playerObj) {
                      for (const t of (saveData.teams || [])) {
                        const found = (t.roster || []).find(p => String(p.id) === String(item.playerId))
                        if (found) {
                          playerObj = found
                          break
                        }
                      }
                    }

                    const flagCode = playerObj?.nationality ? FIFA_NATIONS.find(n => n.name === playerObj.nationality)?.code : null
                    const currentClub = playerObj?.club_id ? teamById(playerObj.club_id) : null

                    return (
                      <div
                        key={item.id || index}
                        onClick={() => playerObj && setSelectedPlayer(playerObj)}
                        className={`grid grid-cols-[minmax(180px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_76px] items-center gap-2 px-5 py-3 transition-colors ${playerObj ? 'cursor-pointer hover:bg-red-50/30' : 'hover:bg-gray-50'}`}
                      >
                        {/* Player column: OVR Badge + Avatar + Details (Name, Flag, Club, Position) */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {playerObj?.ovr ? (
                            <OvrBadge value={playerObj.ovr} size="sm" />
                          ) : (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-bold text-gray-400">—</span>
                          )}

                          <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 bg-gray-100 ring-1 ring-gray-200">
                            {playerObj?.photo_url ? (
                              <img src={playerObj.photo_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-gray-400 text-xs">
                                {item.playerName?.charAt(0)}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-[#0A1318]" title={item.playerName}>
                              {item.playerName}
                            </span>
                            <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-gray-500">
                              {flagCode && (
                                <img
                                  src={`https://flagcdn.com/${flagCode}.svg`}
                                  alt=""
                                  className="h-3 w-4 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
                                  title={playerObj?.nationality}
                                />
                              )}
                              {currentClub ? (
                                <Badge team={currentClub} size="h-3.5 w-3.5" />
                              ) : (
                                <FreeAgentIcon size={12} className="shrink-0" />
                              )}
                              {playerObj?.position && (
                                <PositionBadge position={playerObj.position} />
                              )}
                            </div>
                          </div>
                        </div>

                        <TransferClub team={teamById(item.fromClubId)} name={item.fromName} />
                        <TransferClub team={teamById(item.toClubId)} name={item.toName} />
                        <span className="text-right text-xs font-semibold tabular-nums text-[#FD5461]">{money(item.fee)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center"><p className="text-sm text-gray-400">No transfers have been completed this season.</p><Button variant="outline" size="sm" onClick={() => navigate(`/draft/${saveId}/transfers`)} className="mt-4 flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"><ArrowLeftRight size={16} /> Open Market</Button></div>) : (leaders.length ? (
              <div className="divide-y divide-gray-50">{leaders.map(({ player, value }, index) => <button key={player.id} onClick={() => setSelectedPlayer(player)} className="w-full cursor-pointer grid grid-cols-[28px_40px_1fr_auto] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-red-50/30"><span className={`text-center font-heading text-sm font-black ${index < 3 ? 'text-[#FD5461]' : 'text-gray-300'}`}>{index + 1}</span><span className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">{player.photo_url && <img src={player.photo_url} alt="" className="h-full w-full object-cover" />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[#0A1318]">{player.name}</span><span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-400">{player.team ? <><Badge team={player.team} size="h-4 w-4" /><span className="truncate">{player.team.club_name}</span></> : <span>Free Agent</span>}</span></span><span className="font-heading text-2xl font-black text-[#FD5461]">{value}</span></button>)}</div>
            ) : <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center"><p className="text-sm text-gray-400">No {STAT_FILTERS.find(filter => filter.key === statFilter)?.label.toLowerCase()} recorded yet.</p><Button variant="outline" size="sm" onClick={() => navigate(`/draft/${saveId}/matches`)} className="mt-4 flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"><Trophy size={16} /> Open League</Button></div>)}
          </section>
        </div>
      </div>

      <PlayerProfileModal open={Boolean(selectedPlayer)} player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      <SeasonalGrowthModal
        open={growthModalOpen}
        onClose={() => {
          setGrowthModalOpen(false)
          setPreviewGrowthData(null)
        }}
        adjustments={previewGrowthData ? previewGrowthData.seasonAdjustments : seasonAdjustments}
        seasonName={`Season ${activeSeason?.id || 1}`}
        isLocked={isGrowthLocked}
        onReshufflePreview={handleReshufflePreview}
        onConfirmSave={handleConfirmSaveRatings}
      />
    </>
  )
}
