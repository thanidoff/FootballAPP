import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FIFA_NATIONS } from '../utils/fifaNations'

const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))
import {
  fetchSeasons, fetchSeasonData, startMatch,
  advanceToNextRound, completeSeason, fetchSeasonStats,
  getRoundName, getRoundNameTH, getShortRoundName, completeMatch, fetchMatchEvents,
  createSeason, seedNationalTeams,
} from '../services/worldCup'
import WorldCupSetupModal from '../components/matches/WorldCupSetupModal'
import MatchResultModal from '../components/matches/MatchResultModal'

// ─── Shared UI helpers ───────────────────────────────────────────────────────

function ClubBadge({ club, size = 'md' }) {
  const s = size === 'lg' ? 'w-12 h-12' : 'w-9 h-9'
  if (!club) return <div className={`${s} rounded-xl bg-gray-100 flex-shrink-0`} />
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
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>
      {club.short_name}
    </div>
  )
}

const STATUS_BADGE = {
  scheduled: { label: 'Scheduled', cls: 'bg-amber-100 text-amber-700' },
  live:      { label: 'Live',      cls: 'bg-[#FD5461]/10 text-[#FD5461]' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function RoundProgress({ currentRound, status, matchesByRound, totalRounds }) {
  const steps = Array.from({ length: totalRounds }, (_, i) => i + 1)
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((round, i) => {
        const roundMatches = matchesByRound[round] ?? []
        const allDone = roundMatches.length > 0 && roundMatches.every(m => m.status === 'completed')
        const isActive = round === currentRound
        const isPast = round < currentRound || (round === currentRound && allDone && status === 'completed')
        const isFuture = round > currentRound

        return (
          <div key={round} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-heading font-black text-[10px] transition-all
                ${isPast || allDone ? 'bg-[#0A1318] text-white' : isActive ? 'bg-[#FD5461] text-white ring-4 ring-[#FD5461]/20' : 'bg-gray-100 text-gray-400'}`}>
                {isPast || allDone ? '✓' : round}
              </div>
              <div className={`text-[8px] font-heading font-black uppercase tracking-widest text-center leading-tight hidden sm:block
                ${isActive ? 'text-[#FD5461]' : isPast || allDone ? 'text-[#0A1318]' : 'text-gray-300'}`}>
                {getRoundName(round, totalRounds)}
              </div>
              <div className={`text-[8px] font-heading font-black uppercase tracking-widest text-center leading-tight sm:hidden
                ${isActive ? 'text-[#FD5461]' : isPast || allDone ? 'text-[#0A1318]' : 'text-gray-300'}`}>
                {getShortRoundName(round, totalRounds)}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-[2px] w-4 sm:w-6 flex-shrink-0 mx-0.5 rounded-full mb-4
                ${round < currentRound || (allDone && round === currentRound) ? 'bg-[#0A1318]' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
      {/* Champion dot */}
      <div className="flex items-center">
        <div className={`h-[2px] w-4 sm:w-6 flex-shrink-0 mx-0.5 rounded-full mb-4 ${status === 'completed' ? 'bg-[#0A1318]' : 'bg-gray-200'}`} />
        <div className="flex flex-col items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all
            ${status === 'completed' ? 'bg-amber-400' : 'bg-gray-100'}`}>
            🏆
          </div>
          <div className={`text-[8px] font-heading font-black uppercase tracking-widest ${status === 'completed' ? 'text-amber-500' : 'text-gray-300'}`}>
            Champion
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Match card (reused pattern from FriendlyMatchesPage) ─────────────────────

function WCMatchCard({ match, isActiveSeason, onStart, onResume, onClick }) {
  const badge = STATUS_BADGE[match.status] ?? STATUS_BADGE.scheduled
  const isLive = match.status === 'live'
  const isCompleted = match.status === 'completed'

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
              <span className={`font-heading font-black text-2xl tabular-nums w-7 text-right
                ${match.winner_club_id === match.home_club_id ? 'text-[#0A1318]' : 'text-gray-300'}`}>
                {match.home_score ?? 0}
              </span>
              <span className="font-heading font-bold text-base text-gray-300">–</span>
              <span className={`font-heading font-black text-2xl tabular-nums w-7 text-left
                ${match.winner_club_id === match.away_club_id ? 'text-[#0A1318]' : 'text-gray-300'}`}>
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
            {isCompleted && match.played_at && (
              <span className="text-[9px] text-gray-400 font-heading font-medium">
                {new Date(match.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {/* Away */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{match.away_club?.name}</span>
            <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">{match.away_club?.short_name}</span>
          </div>
          <ClubBadge club={match.away_club} />
        </div>
      </div>

      {/* Action row */}
      {isActiveSeason && !isCompleted && (
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

// ─── Stats panel (same pattern as Friendly) ──────────────────────────────────

function SmallClubBadge({ club }) {
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
                  <SmallClubBadge club={item.club} />
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
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!seasonId) return
    setLoading(true)
    fetchSeasonStats(seasonId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [seasonId])

  if (loading) return (
    <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">Loading stats...</div>
  )
  if (!stats) return (
    <div className="text-center py-16 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">No data available</div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TopList title="Top Scorer"  icon="⚽" items={stats.topScorer}  />
      <TopList title="Top Assist"  icon="👟" items={stats.topAssist}  />
      <TopList title="Most MVP"    icon="⭐" items={stats.mostMvp}   />
      <TopList title="Yellow Card" icon="🟨" items={stats.mostYellow} />
      <TopList title="Red Card"    icon="🟥" items={stats.mostRed}   />
    </div>
  )
}

// ─── Champion banner ──────────────────────────────────────────────────────────

function ChampionBanner({ club }) {
  if (!club) return null
  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-5 py-4 mb-4 flex items-center gap-4">
      <div className="text-3xl">🏆</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-heading font-black uppercase tracking-widest text-amber-500 mb-0.5">World Cup Champion</div>
        <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318] truncate">{club.name}</div>
      </div>
      <ClubBadge club={club} size="lg" />
    </div>
  )
}

// ─── Confirm modals ───────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorldCupPage({ mode = 'national' }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const isClub    = mode === 'club'
  const seasonType = isClub ? 'club' : 'national'

  const [seasons, setSeasons]             = useState([])
  const [currentSeasonIdx, setIdx]        = useState(0)
  const [seasonData, setSeasonData]       = useState(null) // { season, matchesByRound }
  const [loading, setLoading]             = useState(true)
  const [dataLoading, setDataLoading]     = useState(false)
  const [setupOpen, setSetupOpen]         = useState(false)
  const [seeding, setSeeding]             = useState(false)
  const [activeTab, setActiveTab]         = useState('matches')
  const [startingId, setStartingId]       = useState(null)
  const [resultMatch, setResultMatch]     = useState(null)
  const [advanceConfirm, setAdvanceConfirm] = useState(false)
  const [advanceLoading, setAdvanceLoading] = useState(false)
  const [closeConfirm, setCloseConfirm]   = useState(false)
  const [closeLoading, setCloseLoading]   = useState(false)

  const currentSeason = seasons[currentSeasonIdx] ?? null

  const loadSeasons = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSeasons(seasonType)
      setSeasons(data)
      const activeIdx = data.findIndex(s => s.status === 'active')
      setIdx(activeIdx >= 0 ? activeIdx : data.length - 1)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSeasonData = useCallback((seasonId) => {
    setDataLoading(true)
    fetchSeasonData(seasonId)
      .then(setSeasonData)
      .catch(() => setSeasonData(null))
      .finally(() => setDataLoading(false))
  }, [])

  useEffect(() => { loadSeasons() }, [loadSeasons])

  useEffect(() => {
    if (!currentSeason) { setSeasonData(null); return }
    loadSeasonData(currentSeason.id)
  }, [currentSeason, loadSeasonData])

  useEffect(() => {
    if (!location.state?.refresh) return
    window.history.replaceState({}, '')
    // reload seasons first (status may have changed), then season data
    fetchSeasons(seasonType).then(data => {
      setSeasons(data)
      const activeIdx = data.findIndex(s => s.status === 'active')
      const idx = activeIdx >= 0 ? activeIdx : data.length - 1
      setIdx(idx)
      if (data[idx]) loadSeasonData(data[idx].id)
    })
  }, [location.state, loadSeasonData])

  async function handleCreate(clubIds) {
    setSeeding(true)
    try {
      await createSeason(clubIds, seasonType)
      setSetupOpen(false)
      await loadSeasons()
    } finally {
      setSeeding(false)
    }
  }

  async function handleStartMatch(match) {
    setStartingId(match.id)
    try {
      if (match.status !== 'live') {
        await startMatch(match.id)
      }
    } catch (err) {
      console.error('startMatch error:', err)
    }
    const basePath = isClub ? '/matches/club-cup' : '/matches/world-cup'
    navigate(`${basePath}/${match.id}/prematch`, {
      state: {
        homeClub: match.home_club,
        awayClub: match.away_club,
        duration: 10,
        returnPath: basePath,
        nationalMode: !isClub,
      },
    })
  }

  async function handleAdvance() {
    if (!seasonData) return
    setAdvanceLoading(true)
    try {
      await advanceToNextRound(seasonData.season.id, seasonData.season.current_round)
      setAdvanceConfirm(false)
      loadSeasonData(seasonData.season.id)
      // refresh season list for current_round update
      const data = await fetchSeasons(seasonType)
      setSeasons(data)
    } finally {
      setAdvanceLoading(false)
    }
  }

  async function handleCloseSeason() {
    if (!seasonData) return
    setCloseLoading(true)
    try {
      await completeSeason(seasonData.season.id)
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
  const matchesByRound = seasonData?.matchesByRound ?? {}
  const currentRound   = seasonData?.season?.current_round ?? 1
  const initialTeams = (matchesByRound[1]?.length || 4) * 2 // Default 8 if no matches
  const totalRounds = Math.max(1, Math.log2(initialTeams))

  const currentRoundMatches = matchesByRound[currentRound] ?? []
  const allCurrentDone = currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.status === 'completed')
  const canAdvance = isActiveSeason && allCurrentDone && currentRound < totalRounds
  const canClose   = isActiveSeason && allCurrentDone && currentRound === totalRounds
  const champion   = seasonData?.season?.champion_club ?? (canClose
    ? matchesByRound[totalRounds]?.[0]?.winner_club
    : null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">
        Loading...
      </div>
    )
  }

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
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide leading-none">{isClub ? 'Club Cup' : 'World Cup'}</h1>
          <p className="text-gray-400 text-sm mt-0.5">{initialTeams}-team knockout · {isClub ? 'สโมสร' : 'ทีมชาติ'}</p>
        </div>
        {seasons.length === 0 || !isActiveSeason ? null : null}
      </div>

      {/* No seasons: empty state */}
      {seasons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center text-4xl">🏆</div>
          <div className="text-center">
            <div className="font-heading font-black text-xl uppercase tracking-wide text-gray-300">ยังไม่มีการแข่งขัน</div>
            <p className="text-sm text-gray-400 mt-2">กดปุ่มด้านล่างเพื่อเริ่มต้นการแข่งขัน {isClub ? 'Club Cup' : 'World Cup'}</p>
          </div>
          <button
            onClick={() => setSetupOpen(true)}
            className="px-8 py-4 bg-[#FD5461] text-white rounded-2xl font-heading font-black text-sm uppercase tracking-widest hover:bg-red-500 transition-colors cursor-pointer">
            เริ่มต้นการแข่งขัน
          </button>
        </div>
      ) : (
        <>
          {/* Season header control */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-5">
            <div className="flex-1 min-w-0">
              <div className="font-heading font-black text-sm sm:text-base uppercase tracking-wide text-[#0A1318] truncate">
                {currentSeason?.name}
              </div>
              <div className={`text-[9px] sm:text-[10px] font-heading font-black uppercase tracking-widest mt-0.5
                ${isActiveSeason ? 'text-[#FD5461]' : 'text-gray-400'}`}>
                {isActiveSeason ? '● Active' : '✓ Completed'}
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
                        className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer hover:bg-gray-100 text-gray-600"
                        title="ไปซีซั่นล่าสุด">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 4v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </>
                  )}
                </div>
              )}

              {canClose && (
                <button onClick={() => setCloseConfirm(true)}
                  className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-amber-300 font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer whitespace-nowrap">
                  <span className="hidden sm:inline">🏆 ปิดซีซัน</span>
                  <span className="sm:hidden">🏆</span>
                </button>
              )}
              {!hasActiveSeason && !canClose && (
                <button onClick={() => setSetupOpen(true)}
                  className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-[#0A1318] font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-[#0A1318] hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
                  + New Tournament
                </button>
              )}
            </div>
          </div>

          {/* Round progress */}
          {seasonData && (
            <RoundProgress
              currentRound={currentRound}
              status={currentSeason?.status}
              matchesByRound={matchesByRound}
              totalRounds={totalRounds}
            />
          )}

          {/* Champion banner for completed season */}
          {currentSeason?.status === 'completed' && currentSeason?.champion_club && (
            <ChampionBanner club={currentSeason.champion_club} />
          )}

          {/* Tabs */}
          <div className="flex gap-8 border-b border-gray-100 mb-6 px-1">
            {[{ key: 'matches', label: 'Matches' }, { key: 'stats', label: 'Stats' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`pb-3 font-heading font-black text-sm uppercase tracking-widest transition-all cursor-pointer border-b-2 -mb-[1px]
                  ${activeTab === tab.key ? 'border-[#0A1318] text-[#0A1318]' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'stats' ? (
            <StatsPanel seasonId={currentSeason?.id} />
          ) : dataLoading ? (
            <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Show all rounds that have matches */}
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => {
                const roundMatches = matchesByRound[round] ?? []
                if (roundMatches.length === 0) return null
                const isCurrentRound = round === currentRound && isActiveSeason
                return (
                  <div key={round}>
                    {/* Round header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full
                        ${isCurrentRound ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <span className="font-heading font-black text-[10px] uppercase tracking-widest">
                          {getRoundName(round, totalRounds)}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-heading">{getRoundNameTH(round, totalRounds)}</span>
                    </div>

                    <div className="space-y-2">
                      {roundMatches.map(match => (
                        <WCMatchCard
                          key={match.id}
                          match={match}
                          isActiveSeason={isActiveSeason && round === currentRound}
                          onStart={handleStartMatch}
                          onResume={handleStartMatch}
                          onClick={() => setResultMatch(match)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Advance to next round button */}
              {canAdvance && (
                <div className="pt-2">
                  <button onClick={() => setAdvanceConfirm(true)}
                    className="w-full py-4 rounded-2xl bg-[#0A1318] text-white font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer flex items-center justify-center gap-2">
                    ไปรอบถัดไป → {getRoundName(currentRound + 1, totalRounds)}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <WorldCupSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onCreate={handleCreate}
        mode={mode}
      />

      <ConfirmModal
        open={advanceConfirm}
        title={`ไปรอบ ${getRoundName(currentRound + 1, totalRounds)}?`}
        desc={`สุ่มคู่แข่งจากผู้ชนะ ${currentRoundMatches.length} ทีม แล้วสร้างแมตช์รอบถัดไป`}
        confirmLabel="สุ่มคู่แข่ง"
        onClose={() => setAdvanceConfirm(false)}
        onConfirm={handleAdvance}
        loading={advanceLoading}
      />

      <ConfirmModal
        open={closeConfirm}
        title="ปิดซีซัน?"
        desc="บันทึกแชมป์และสถิติ แล้วปิดการแข่งขัน World Cup นี้"
        confirmLabel="🏆 ปิดซีซัน"
        onClose={() => setCloseConfirm(false)}
        onConfirm={handleCloseSeason}
        loading={closeLoading}
      />

      {resultMatch && (
        <MatchResultModal
          match={resultMatch}
          open={!!resultMatch}
          onClose={() => setResultMatch(null)}
          fetchEventsFn={fetchMatchEvents}
        />
      )}
    </div>
  )
}
