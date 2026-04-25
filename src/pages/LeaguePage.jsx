import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FIFA_NATIONS } from '../utils/fifaNations'
import {
  fetchLeagueSeasons, fetchLeagueSeasonData, startLeagueMatch, completeLeagueSeason,
  advanceLeagueWeek, createFinalMatch, fetchLeagueMatchEvents, fetchLeagueStats,
  createLeagueSeason,
} from '../services/league'
import LeagueSetupModal from '../components/matches/LeagueSetupModal'
import MatchResultModal from '../components/matches/MatchResultModal'

const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))
const ALL_STARS_CLUB = { id: '__allstars__', name: 'All Stars', short_name: 'ALL', badge_color: '#FD5461', is_national: false }

function ClubBadge({ club, size = 'md' }) {
  const s = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  if (!club) return <div className={`${s} rounded-xl bg-gray-100 flex-shrink-0`} />
  if (club.id === '__allstars__') {
    return (
      <div className={`${s} rounded-xl flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0 bg-[#FD5461]`}>
        ★
      </div>
    )
  }
  const flagCode = club.is_national ? NATION_CODE[club.name] : null
  const imgUrl = club.badge_url || (flagCode ? `https://flagcdn.com/w80/${flagCode}.png` : null)
  if (imgUrl) {
    return (
      <div className={`${s} rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-200`}>
        <img src={imgUrl} alt={club.name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${s} rounded-xl flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0`}
      style={{ backgroundColor: club.badge_color ?? '#0A1318' }}>
      {club.short_name}
    </div>
  )
}

const STATUS_BADGE = {
  scheduled: { label: 'Scheduled', cls: 'bg-amber-100 text-amber-700' },
  live:      { label: 'Live',      cls: 'bg-[#FD5461]/10 text-[#FD5461]' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
}

function MatchCard({ match, isCurrentWeek, isActiveSeason, onStart, onResume, onClick }) {
  const badge = STATUS_BADGE[match.status] ?? STATUS_BADGE.scheduled
  const isLive = match.status === 'live'
  const isCompleted = match.status === 'completed'
  const homeWon = isCompleted && match.home_score > match.away_score
  const awayWon = isCompleted && match.away_score > match.home_score
  const awayClub = match.away_club ?? ALL_STARS_CLUB

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-150
        ${isCompleted ? 'cursor-pointer hover:border-gray-200 hover:shadow-md' : ''}`}
      onClick={isCompleted ? onClick : undefined}>

      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Home */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <ClubBadge club={match.home_club} />
          <div className="min-w-0">
            <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{match.home_club?.name}</span>
            <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{match.home_club?.short_name}</span>
          </div>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-28 sm:w-36">
          {isCompleted ? (
            <div className="flex items-center gap-2">
              <span className={`font-heading font-black text-2xl tabular-nums w-7 text-right ${homeWon ? 'text-[#0A1318]' : 'text-gray-300'}`}>
                {match.home_score ?? 0}
              </span>
              <span className="font-heading font-bold text-base text-gray-300">–</span>
              <span className={`font-heading font-black text-2xl tabular-nums w-7 text-left ${awayWon ? 'text-[#0A1318]' : 'text-gray-300'}`}>
                {match.away_score ?? 0}
              </span>
            </div>
          ) : (
            <span className="font-heading font-black text-lg text-gray-200 tracking-widest">VS</span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-heading font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 ${badge.cls}`}>
              {isLive && <span className="w-1 h-1 rounded-full bg-[#FD5461] animate-pulse inline-block" />}
              {badge.label}
            </span>
          </div>
          {match.is_final && (
            <span className="text-[8px] font-heading font-black uppercase tracking-widest text-amber-500">⭐ Final</span>
          )}
        </div>

        {/* Away */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{awayClub.name}</span>
            <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{awayClub.short_name}</span>
          </div>
          <ClubBadge club={awayClub} />
        </div>
      </div>

      {isActiveSeason && isCurrentWeek && !isCompleted && (
        <div className="border-t border-gray-50 px-4 py-2.5">
          <button
            onClick={e => { e.stopPropagation(); isLive ? onResume(match) : onStart(match) }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#0A1318] text-white font-heading font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer">
            {isLive ? '↩ Resume Match' : '▶ Start Match'}
          </button>
        </div>
      )}
    </div>
  )
}

function StandingsTable({ standings, champion }) {
  if (!standings.length) return (
    <div className="text-center py-8 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">No matches yet</div>
  )
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
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
          const isChamp = champion && row.club?.id === champion.id
          const isTop4 = i < 4
          const isBottom2 = i >= standings.length - 2
          const gd = row.gf - row.ga
          return (
            <div key={row.club?.id ?? i}
              className={`grid grid-cols-[auto_1fr_repeat(6,auto)] gap-x-3 px-4 py-2.5 items-center
                ${isChamp ? 'bg-amber-50' : ''}`}>
              <div className={`w-5 text-center text-[10px] font-heading font-black
                ${i === 0 ? 'text-amber-500' : isTop4 ? 'text-[#0A1318]' : isBottom2 ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {i + 1}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <ClubBadge club={row.club} size="sm" />
                <span className="font-heading font-medium text-sm text-[#0A1318] truncate">{row.club?.name}</span>
                {isChamp && <span className="text-xs">🏆</span>}
              </div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{row.played}</div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{row.won}</div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{row.drawn}</div>
              <div className="w-7 text-center text-sm font-heading font-bold text-gray-500 tabular-nums">{row.lost}</div>
              <div className={`w-9 text-center text-sm font-heading font-bold tabular-nums ${gd > 0 ? 'text-green-600' : gd < 0 ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {gd > 0 ? `+${gd}` : gd}
              </div>
              <div className="w-9 text-center text-sm font-heading font-black text-[#0A1318] tabular-nums">{row.points}</div>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[9px] font-heading font-bold text-gray-400">1st — Champion</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#FD5461]" />
          <span className="text-[9px] font-heading font-bold text-gray-400">5–6 — Relegated</span>
        </div>
      </div>
    </div>
  )
}

function ClubBadgeSm({ club }) {
  if (!club) return <div className="w-5 h-5 rounded-md bg-gray-100 flex-shrink-0" />
  if (club.badge_url) {
    return (
      <div className="w-5 h-5 rounded-md overflow-hidden bg-white flex-shrink-0">
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain" />
      </div>
    )
  }
  return (
    <div className="w-5 h-5 rounded-md flex items-center justify-center font-heading font-black text-white flex-shrink-0"
      style={{ backgroundColor: club.badge_color ?? '#6b7280', fontSize: '6px' }}>
      {club.short_name?.slice(0, 2)}
    </div>
  )
}

function TopList({ title, icon, items, unit }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="text-base">{icon}</span>
        <span className="font-heading font-black text-xs uppercase tracking-widest text-[#0A1318]">{title}</span>
      </div>
      {!items?.length ? (
        <div className="px-4 py-5 text-center text-xs text-gray-300 font-heading font-bold uppercase tracking-widest">No data yet</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[10px] font-heading font-black text-gray-300 w-4">{i + 1}</span>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                {item.player?.photo_url
                  ? <img src={item.player.photo_url} alt={item.player.name} className="w-full h-full object-cover" />
                  : <span className="text-xs font-heading font-black text-gray-400">{item.player?.name?.charAt(0)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-xs text-[#0A1318] truncate">{item.player?.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <ClubBadgeSm club={item.club} />
                  <span className="text-[10px] text-gray-400 font-heading truncate">{item.club?.short_name}</span>
                </div>
              </div>
              <span className="font-heading font-black text-xl text-[#0A1318] tabular-nums flex-shrink-0">
                {item.value}
                {unit && <span className="text-xs text-gray-400 font-bold ml-0.5">{unit}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatsPanel({ seasonId }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!seasonId) return
    setLoading(true)
    fetchLeagueStats(seasonId).then(setStats).catch(() => setStats(null)).finally(() => setLoading(false))
  }, [seasonId])
  if (loading) return <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">Loading stats...</div>
  if (!stats) return <div className="text-center py-16 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">No data available</div>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TopList title="Top Scorer"  icon="⚽" items={stats.topScorer} />
      <TopList title="Top Assist"  icon="👟" items={stats.topAssist} />
      <TopList title="Most MVP"    icon="⭐" items={stats.mostMvp} />
      <TopList title="Yellow Card" icon="🟨" items={stats.mostYellow} />
      <TopList title="Red Card"    icon="🟥" items={stats.mostRed} />
    </div>
  )
}

function ConfirmModal({ open, title, desc, confirmLabel, onClose, onConfirm, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318] mb-2">{title}</div>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">{desc}</p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-60">
            {loading ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LeaguePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [seasons, setSeasons] = useState([])
  const [currentSeasonIdx, setIdx] = useState(0)
  const [seasonData, setSeasonData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [newSeasonOpen, setNewSeasonOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('matches')
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [resultMatch, setResultMatch] = useState(null)
  const [advanceConfirm, setAdvanceConfirm] = useState(false)
  const [advanceLoading, setAdvanceLoading] = useState(false)
  const [finalConfirm, setFinalConfirm] = useState(false)
  const [finalLoading, setFinalLoading] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)

  const currentSeason = seasons[currentSeasonIdx] ?? null

  const loadSeasons = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchLeagueSeasons()
      setSeasons(data)
      const activeIdx = data.findIndex(s => s.status === 'active')
      setIdx(activeIdx >= 0 ? activeIdx : data.length - 1)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSeasonData = useCallback((seasonId) => {
    setDataLoading(true)
    fetchLeagueSeasonData(seasonId)
      .then(d => {
        setSeasonData(d)
      })
      .catch(() => setSeasonData(null))
      .finally(() => setDataLoading(false))
  }, [])

  useEffect(() => { loadSeasons() }, [loadSeasons])

  useEffect(() => {
    if (!currentSeason) { setSeasonData(null); return }
    loadSeasonData(currentSeason.id)
    setSelectedWeek(currentSeason.current_week ?? 1)
  }, [currentSeason, loadSeasonData])

  useEffect(() => {
    if (!location.state?.refresh) return
    window.history.replaceState({}, '')
    fetchLeagueSeasons().then(data => {
      setSeasons(data)
      const activeIdx = data.findIndex(s => s.status === 'active')
      const idx = activeIdx >= 0 ? activeIdx : data.length - 1
      setIdx(idx)
      if (data[idx]) loadSeasonData(data[idx].id)
    })
  }, [location.state, loadSeasonData])

  async function handleCreate(clubIds) {
    await createLeagueSeason(clubIds)
    setSetupOpen(false)
    setNewSeasonOpen(false)
    await loadSeasons()
  }

  async function handleStartMatch(match) {
    if (match.status !== 'live') {
      await startLeagueMatch(match.id)
    }
    const isFinal = match.is_final
    const awayClub = isFinal ? ALL_STARS_CLUB : match.away_club
    // For final: collect all other team club IDs
    const allStarsTeamIds = isFinal
      ? (seasonData?.teams ?? []).filter(t => t.club_id !== match.home_club_id).map(t => t.club_id).filter(Boolean)
      : undefined
    if (isFinal && (!allStarsTeamIds || allStarsTeamIds.length === 0)) return
    navigate(`/matches/league/${match.id}/prematch`, {
      state: {
        homeClub: match.home_club,
        awayClub,
        duration: 10,
        returnPath: '/matches/league',
        nationalMode: false,
        allStarsTeamIds,
      },
    })
  }

  async function handleAdvanceWeek() {
    if (!seasonData) return
    setAdvanceLoading(true)
    try {
      await advanceLeagueWeek(seasonData.season.id, seasonData.season.current_week)
      setAdvanceConfirm(false)
      const newWeek = seasonData.season.current_week + 1
      await loadSeasons()
      setSelectedWeek(newWeek)
    } finally {
      setAdvanceLoading(false)
    }
  }

  async function handleCreateFinal() {
    if (!seasonData) return
    setFinalLoading(true)
    const champion = seasonData.standings[0]?.club
    if (!champion?.id) { setFinalLoading(false); return }
    try {
      await createFinalMatch(seasonData.season.id, champion.id)
      setFinalConfirm(false)
      await loadSeasons()
      setSelectedWeek(11)
    } finally {
      setFinalLoading(false)
    }
  }

  async function handleCloseSeason() {
    if (!seasonData) return
    setCloseLoading(true)
    try {
      await completeLeagueSeason(seasonData.season.id)
      setCloseConfirm(false)
      await loadSeasons()
    } finally {
      setCloseLoading(false)
    }
  }

  const canGoPrev = currentSeasonIdx > 0
  const canGoNext = currentSeasonIdx < seasons.length - 1
  const isActiveSeason = currentSeason?.status === 'active'
  const hasActiveSeason = seasons.some(s => s.status === 'active')
  const matchesByWeek = seasonData?.matchesByWeek ?? {}
  const currentWeek = seasonData?.season?.current_week ?? 1
  const standings = seasonData?.standings ?? []

  // Weeks that have matches
  const existingWeeks = Object.keys(matchesByWeek).map(Number).sort((a, b) => a - b)

  const currentWeekMatches = matchesByWeek[currentWeek] ?? []
  const allCurrentDone = currentWeekMatches.length > 0 && currentWeekMatches.every(m => m.status === 'completed')

  const isWeek10Done = currentWeek === 10 && allCurrentDone && isActiveSeason
  const hasFinalWeek = !!matchesByWeek[11]
  const finalMatch = matchesByWeek[11]?.[0]
  const finalDone = finalMatch?.status === 'completed'

  const canAdvanceWeek = isActiveSeason && allCurrentDone && currentWeek < 10
  const canCreateFinal = isActiveSeason && isWeek10Done && !hasFinalWeek
  const canCloseSeason = isActiveSeason && hasFinalWeek && finalDone

  // Champion for display
  const champion = currentSeason?.champion_club ?? (standings[0]?.club)

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">Loading...</div>
  }

  // Locked teams for new season = top 4 from standings
  const lockedTeamsForNewSeason = seasons.length > 0 && !hasActiveSeason
    ? (seasonData?.standings?.slice(0, 4) ?? [])
    : []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/matches')} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide leading-none">League</h1>
          <p className="text-gray-400 text-sm mt-0.5">6-team round-robin · 10 weeks + final</p>
        </div>
      </div>

      {/* Empty state */}
      {seasons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center text-4xl">⚽</div>
          <div className="text-center">
            <div className="font-heading font-black text-xl uppercase tracking-wide text-gray-300">ยังไม่มีลีก</div>
            <p className="text-sm text-gray-400 mt-2">กดปุ่มด้านล่างเพื่อเริ่มต้นลีกแรก</p>
          </div>
          <button
            onClick={() => setSetupOpen(true)}
            className="px-8 py-4 bg-[#FD5461] text-white rounded-2xl font-heading font-black text-sm uppercase tracking-widest hover:bg-red-500 transition-colors cursor-pointer">
            เริ่มต้นลีก
          </button>
        </div>
      ) : (
        <>
          {/* Season header */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-5">
            <div className="flex-1 min-w-0">
              <div className="font-heading font-black text-sm sm:text-base uppercase tracking-wide text-[#0A1318] truncate">
                {currentSeason?.name}
              </div>
              <div className={`text-[9px] sm:text-[10px] font-heading font-black uppercase tracking-widest mt-0.5
                ${isActiveSeason ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {isActiveSeason ? `● Active · Week ${currentWeek}/11` : '✓ Completed'}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {seasons.length > 1 && (
                <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
                  <button onClick={() => canGoPrev && setIdx(i => i - 1)} disabled={!canGoPrev}
                    className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
                  <button onClick={() => canGoNext && setIdx(i => i + 1)} disabled={!canGoNext}
                    className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {currentSeasonIdx !== seasons.length - 1 && (
                    <>
                      <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
                      <button onClick={() => setIdx(seasons.length - 1)}
                        className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer hover:bg-gray-100 text-gray-600">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 4v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </>
                  )}
                </div>
              )}

              {canCreateFinal && (
                <button onClick={() => setFinalConfirm(true)}
                  className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-amber-300 font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer whitespace-nowrap">
                  <span className="hidden sm:inline">⭐ Create Final</span>
                  <span className="sm:hidden">⭐</span>
                </button>
              )}
              {canCloseSeason && (
                <button onClick={() => setCloseConfirm(true)}
                  className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-amber-300 font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer whitespace-nowrap">
                  <span className="hidden sm:inline">🏆 ปิดซีซัน</span>
                  <span className="sm:hidden">🏆</span>
                </button>
              )}
              {!hasActiveSeason && !canCreateFinal && !canCloseSeason && (
                <button onClick={() => setNewSeasonOpen(true)}
                  className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-[#0A1318] font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-[#0A1318] hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
                  + New Season
                </button>
              )}
            </div>
          </div>

          {/* Champion banner */}
          {currentSeason?.status === 'completed' && currentSeason?.champion_club && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-5 py-4 mb-4 flex items-center gap-4">
              <div className="text-3xl">🏆</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-heading font-black uppercase tracking-widest text-amber-500 mb-0.5">League Champion</div>
                <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318] truncate">{currentSeason.champion_club.name}</div>
              </div>
              <ClubBadge club={currentSeason.champion_club} size="lg" />
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

          {activeTab === 'standings' && (
            <StandingsTable standings={standings} champion={currentSeason?.champion_club} />
          )}

          {activeTab === 'stats' && (
            <StatsPanel seasonId={currentSeason?.id} />
          )}

          {activeTab === 'matches' && (
            dataLoading ? (
              <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">Loading...</div>
            ) : (
              <div>
                {/* Week pills */}
                {existingWeeks.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-hide">
                    {existingWeeks.map(w => {
                      const weekMatches = matchesByWeek[w] ?? []
                      const done = weekMatches.every(m => m.status === 'completed')
                      const isCurrent = w === currentWeek && isActiveSeason
                      const isFinalWeek = w === 11
                      return (
                        <button key={w}
                          onClick={() => setSelectedWeek(w)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full font-heading font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer
                            ${selectedWeek === w
                              ? 'bg-[#0A1318] text-white'
                              : done ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              : isCurrent ? 'bg-[#FD5461]/10 text-[#FD5461] ring-1 ring-[#FD5461]/30'
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                            }`}>
                          {isFinalWeek ? '⭐ Final' : `Wk ${w}`}
                          {done && !isFinalWeek && <span className="ml-1">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Selected week matches */}
                {matchesByWeek[selectedWeek] ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full
                        ${selectedWeek === currentWeek && isActiveSeason ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <span className="font-heading font-black text-[10px] uppercase tracking-widest">
                          {selectedWeek === 11 ? '⭐ Grand Final' : `Week ${selectedWeek}`}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {matchesByWeek[selectedWeek].map(match => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isCurrentWeek={selectedWeek === currentWeek}
                          isActiveSeason={isActiveSeason}
                          onStart={handleStartMatch}
                          onResume={handleStartMatch}
                          onClick={() => setResultMatch(match)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">
                    ยังไม่มีแมตช์สัปดาห์นี้
                  </div>
                )}

                {/* Advance week button */}
                {canAdvanceWeek && (
                  <div className="pt-4">
                    <button onClick={() => setAdvanceConfirm(true)}
                      className="w-full py-4 rounded-2xl bg-[#0A1318] text-white font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer">
                      ไปสัปดาห์ถัดไป → Week {currentWeek + 1}
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </>
      )}

      {/* Modals */}
      <LeagueSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onCreate={handleCreate}
      />

      <LeagueSetupModal
        open={newSeasonOpen}
        onClose={() => setNewSeasonOpen(false)}
        onCreate={handleCreate}
        lockedTeams={lockedTeamsForNewSeason}
      />

      <ConfirmModal
        open={advanceConfirm}
        title={`ไปสัปดาห์ ${currentWeek + 1}?`}
        desc="ยืนยันว่าแมตช์สัปดาห์นี้เล่นครบแล้ว"
        confirmLabel="ยืนยัน"
        onClose={() => setAdvanceConfirm(false)}
        onConfirm={handleAdvanceWeek}
        loading={advanceLoading}
      />

      <ConfirmModal
        open={finalConfirm}
        title="สร้าง Grand Final?"
        desc={`${standings[0]?.club?.name ?? 'อันดับ 1'} จะลงเล่นกับ All Stars (ผู้เล่นจากทีมที่เหลือ 5 ทีม)`}
        confirmLabel="⭐ Create Final"
        onClose={() => setFinalConfirm(false)}
        onConfirm={handleCreateFinal}
        loading={finalLoading}
      />

      <ConfirmModal
        open={closeConfirm}
        title="ปิดซีซัน?"
        desc="บันทึกแชมป์และสถิติ แล้วปิดลีกซีซันนี้"
        confirmLabel="🏆 ปิดซีซัน"
        onClose={() => setCloseConfirm(false)}
        onConfirm={handleCloseSeason}
        loading={closeLoading}
      />

      {resultMatch && (
        <MatchResultModal
          match={{ ...resultMatch, away_club: resultMatch.away_club ?? ALL_STARS_CLUB }}
          open={!!resultMatch}
          onClose={() => setResultMatch(null)}
          fetchEventsFn={fetchLeagueMatchEvents}
        />
      )}
    </div>
  )
}
