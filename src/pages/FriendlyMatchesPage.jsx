import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  fetchSeasons,
  getOrCreateActiveSeason,
  fetchMatchesBySeason,
  fetchSeasonStats,
  endSeason,
  createNextSeason,
  startMatch,
  cancelMatch,
} from '../services/friendlyMatches'
import NewMatchModal from '../components/matches/NewMatchModal'
import MatchResultModal from '../components/matches/MatchResultModal'
import SeasonSummaryModal from '../components/matches/SeasonSummaryModal'

function ClubBadge({ club, size = 'md' }) {
  const s = size === 'lg' ? 'w-12 h-12' : 'w-9 h-9'
  if (!club) return <div className={`${s} rounded-xl bg-gray-100 flex-shrink-0`} />
  if (club.badge_url) {
    return (
      <div className={`${s} rounded-xl overflow-hidden bg-white flex-shrink-0`}>
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-1" />
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

function MatchCard({ match, isActiveSeason, onStart, onResume, onCancel, onClick }) {
  const badge = STATUS_BADGE[match.status] ?? STATUS_BADGE.scheduled
  const homeClub = match.home_club
  const awayClub = match.away_club
  const isLive = match.status === 'live'
  const isCompleted = match.status === 'completed'
  const canCancel = isActiveSeason && !isCompleted

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 transition-all duration-150 overflow-hidden
      ${isCompleted ? 'cursor-pointer hover:border-gray-200 hover:shadow-md' : ''}`}
      onClick={isCompleted ? onClick : undefined}>

      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">

        {/* Home Club */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <ClubBadge club={homeClub} />
          <div className="min-w-0">
            <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">
              {homeClub?.name}
            </span>
            <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">
              {homeClub?.short_name}
            </span>
          </div>
        </div>

        {/* Center: Score / VS + status */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-28 sm:w-36">
          {isCompleted ? (
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-2xl text-[#0A1318] tabular-nums w-7 text-right">{match.home_score ?? 0}</span>
              <span className="font-heading font-bold text-base text-gray-300">–</span>
              <span className="font-heading font-black text-2xl text-[#0A1318] tabular-nums w-7 text-left">{match.away_score ?? 0}</span>
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

        {/* Away Club */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <span className="hidden sm:block font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">
              {awayClub?.name}
            </span>
            <span className="sm:hidden font-heading font-black text-sm uppercase tracking-wide text-[#0A1318] truncate">
              {awayClub?.short_name}
            </span>
          </div>
          <ClubBadge club={awayClub} />
        </div>

        {/* Duration + Cancel */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className="text-[10px] text-gray-400 font-heading font-medium">{match.duration}'</span>
          {canCancel && (
            <button
              onClick={e => { e.stopPropagation(); onCancel() }}
              title="Cancel match"
              className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer text-xs leading-none p-0.5">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Action row */}
      {match.status === 'scheduled' && isActiveSeason && (
        <div className="px-4 pb-3.5">
          <button
            onClick={e => { e.stopPropagation(); onStart() }}
            className="w-full py-2.5 rounded-xl bg-[#FD5461] text-white font-heading font-black text-xs uppercase tracking-widest hover:bg-red-500 transition-colors cursor-pointer">
            ▶ Start Match
          </button>
        </div>
      )}

      {isLive && isActiveSeason && (
        <div className="px-4 pb-3.5">
          <button
            onClick={e => { e.stopPropagation(); onResume() }}
            className="w-full py-2.5 rounded-xl bg-[#0A1318] text-white font-heading font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer flex items-center justify-center gap-2">
            <span>↩</span> Resume Match
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="px-4 pb-3 flex items-center justify-center">
          <span className="text-[9px] text-gray-300 font-heading font-bold uppercase tracking-widest">Tap to view details</span>
        </div>
      )}
    </div>
  )
}

// ─── Stats Panel ─────────────────────────────────────────────────────────────

function PlayerAvatar({ player }) {
  if (!player) return <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
      {player.photo_url
        ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-xs">{player.name?.charAt(0)}</div>
      }
    </div>
  )
}

function SmallClubBadge({ club }) {
  if (!club) return null
  if (club.badge_url) return (
    <div className="w-5 h-5 rounded overflow-hidden bg-white flex-shrink-0">
      <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain" />
    </div>
  )
  return (
    <div className="w-5 h-5 rounded flex items-center justify-center font-heading font-black text-white text-[8px] flex-shrink-0"
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>
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
      {!items || items.length === 0 ? (
        <div className="px-4 py-4 text-xs text-gray-300 font-heading font-bold text-center">No data yet</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs font-heading font-black text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
              <PlayerAvatar player={item.player} />
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-sm text-[#0A1318] truncate">{item.player?.name ?? '—'}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <SmallClubBadge club={item.club} />
                  <span className="text-[10px] text-gray-400 font-heading">{item.club?.short_name}</span>
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

function StandingsTable({ standings }) {
  if (!standings || standings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center text-xs text-gray-300 font-heading font-bold uppercase tracking-widest">
        No matches played yet
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="text-base">🏆</span>
        <span className="font-heading font-black text-xs uppercase tracking-widest text-[#0A1318]">Standings</span>
      </div>
      {/* Header */}
      <div className="grid px-4 py-2 border-b border-gray-50 text-[9px] font-heading font-black uppercase tracking-widest text-gray-400"
        style={{ gridTemplateColumns: '1fr 28px 28px 28px 28px 28px 28px 36px' }}>
        <span>Club</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">GF</span>
        <span className="text-center">GA</span>
        <span className="text-center text-[#0A1318]">GD</span>
      </div>
      {standings.map((row, i) => (
        <div key={i} className="grid items-center px-4 py-2.5 border-b border-gray-50 last:border-0"
          style={{ gridTemplateColumns: '1fr 28px 28px 28px 28px 28px 28px 36px' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-heading font-black text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
            <SmallClubBadge club={row.club} />
            <div className="min-w-0">
              <span className="hidden sm:block font-heading font-bold text-xs text-[#0A1318] truncate">{row.club?.name}</span>
              <span className="sm:hidden font-heading font-bold text-xs text-[#0A1318] truncate">{row.club?.short_name}</span>
            </div>
          </div>
          {[row.p, row.w, row.d, row.l, row.gf, row.ga].map((v, j) => (
            <span key={j} className="text-xs font-heading font-bold text-gray-500 text-center tabular-nums">{v}</span>
          ))}
          <span className={`text-xs font-heading font-black text-center tabular-nums
            ${row.gd > 0 ? 'text-green-600' : row.gd < 0 ? 'text-[#FD5461]' : 'text-gray-400'}`}>
            {row.gd > 0 ? `+${row.gd}` : row.gd}
          </span>
        </div>
      ))}
    </div>
  )
}

function StatsPanel({ seasonId }) {
  const [stats, setStats] = useState(null)
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
    <div className="space-y-4">
      <StandingsTable standings={stats.standings} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TopList title="Top Scorer"  icon="⚽" items={stats.topScorer}  />
        <TopList title="Top Assist"  icon="👟" items={stats.topAssist}  />
        <TopList title="Most MVP"    icon="⭐" items={stats.mostMvp}   />
        <TopList title="Yellow Card" icon="🟨" items={stats.mostYellow} />
        <TopList title="Red Card"    icon="🟥" items={stats.mostRed}   />
      </div>
    </div>
  )
}

// ─── End Season Modal ───────────────────────────────────────────────────────

function EndSeasonConfirmModal({ open, onClose, onConfirm, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318] mb-2">End Season?</div>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          This will close the current season and start a new one. You'll be able to view the summary after.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-60">
            {loading ? 'Ending...' : 'End Season'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CancelMatchModal({ match, open, onClose, onConfirm, loading }) {
  if (!open || !match) return null
  const isLive = match.status === 'live'
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318] mb-2">
          {isLive ? 'Abandon Match?' : 'Cancel Match?'}
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-1">
          {match.home_club?.name} vs {match.away_club?.name}
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          {isLive
            ? 'This match is in progress. Abandoning will permanently delete it and all recorded events.'
            : 'This scheduled match will be permanently deleted.'}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
            Keep
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-60">
            {loading ? 'Deleting...' : isLive ? 'Abandon' : 'Cancel Match'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FriendlyMatchesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('matches') // 'matches' | 'stats'
  const [seasons, setSeasons] = useState([])
  const [currentSeasonIdx, setCurrentSeasonIdx] = useState(0)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [newMatchOpen, setNewMatchOpen] = useState(false)
  const [resultMatch, setResultMatch] = useState(null)
  const [summarySeasonId, setSummarySeasonId] = useState(null)
  const [endSeasonConfirm, setEndSeasonConfirm] = useState(false)
  const [endingLoading, setEndingLoading] = useState(false)
  const [startingMatchId, setStartingMatchId] = useState(null)
  const [cancelingMatch, setCancelingMatch] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const currentSeason = seasons[currentSeasonIdx] ?? null
  const activeSeason = seasons.find(s => s.status === 'active') ?? null

  const loadSeasons = useCallback(async () => {
    setLoading(true)
    try {
      await getOrCreateActiveSeason()
      const data = await fetchSeasons()
      setSeasons(data)
      const activeIdx = data.findIndex(s => s.status === 'active')
      setCurrentSeasonIdx(activeIdx >= 0 ? activeIdx : data.length - 1)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMatchesForSeason = useCallback((seasonId) => {
    setMatchesLoading(true)
    fetchMatchesBySeason(seasonId)
      .then(setMatches)
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false))
  }, [])

  useEffect(() => { loadSeasons() }, [loadSeasons])

  useEffect(() => {
    if (!currentSeason) return
    loadMatchesForSeason(currentSeason.id)
  }, [currentSeason, loadMatchesForSeason])

  // Refresh matches when returning from prematch with refresh flag
  useEffect(() => {
    if (location.state?.refresh && currentSeason) {
      loadMatchesForSeason(currentSeason.id)
      window.history.replaceState({}, '')
      const saved = sessionStorage.getItem('friendly-scroll')
      if (saved) {
        sessionStorage.removeItem('friendly-scroll')
        setTimeout(() => window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' }), 50)
      }
    }
  }, [location.state, currentSeason, loadMatchesForSeason])

  async function handleStartMatch(match) {
    setStartingMatchId(match.id)
    try {
      // Only call startMatch if not already live
      if (match.status !== 'live') {
        await startMatch(match.id)
        // Update local state immediately
        setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'live' } : m))
      }
      sessionStorage.setItem('friendly-scroll', window.scrollY)
      navigate(`/matches/friendly/${match.id}/prematch`, {
        state: {
          homeClub: match.home_club,
          awayClub: match.away_club,
          duration: match.duration,
          matchId: match.id,
        }
      })
    } catch {
      setStartingMatchId(null)
    }
  }

  async function handleEndSeason() {
    if (!activeSeason) return
    setEndingLoading(true)
    try {
      await endSeason(activeSeason.id)
      await createNextSeason(activeSeason.number)
      await loadSeasons()
      setEndSeasonConfirm(false)
    } finally {
      setEndingLoading(false)
    }
  }

  function handleMatchCreated(match) {
    setMatches(prev => [match, ...prev])
  }

  async function handleCancelMatch() {
    if (!cancelingMatch) return
    setCancelLoading(true)
    try {
      await cancelMatch(cancelingMatch.id)
      setMatches(prev => prev.filter(m => m.id !== cancelingMatch.id))
      setCancelingMatch(null)
    } catch (err) {
      console.error('Cancel match failed:', err)
    } finally {
      setCancelLoading(false)
    }
  }

  const canGoPrev = currentSeasonIdx > 0
  const canGoNext = currentSeasonIdx < seasons.length - 1
  const isActiveSeason = currentSeason?.status === 'active'
  const summarySeasonObj = seasons.find(s => s.id === summarySeasonId) ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">
        Loading...
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/matches')} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide leading-none">Friendly</h1>
          <p className="text-gray-400 text-sm mt-0.5">Friendly matches by season</p>
        </div>
        {isActiveSeason && (
          <button onClick={() => setNewMatchOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0A1318] text-white rounded-xl font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer flex-shrink-0">
            <span className="text-lg leading-none">+</span>
            <span className="hidden sm:inline">New Match</span>
          </button>
        )}
      </div>

      {/* Season Header Control */}
      {seasons.length > 0 && currentSeason && (
        <div className="flex items-center justify-between gap-2 sm:gap-4 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-6">
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-heading font-black text-sm sm:text-base uppercase tracking-wide text-[#0A1318] truncate">
              {currentSeason.name}
            </div>
            <div className={`text-[9px] sm:text-[10px] font-heading font-black uppercase tracking-widest mt-0.5
              ${isActiveSeason ? 'text-[#FD5461]' : 'text-gray-400'}`}>
              {isActiveSeason ? '● Active' : '✓ Completed'}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Nav (Only show if there are multiple seasons) */}
            {seasons.length > 1 ? (
              <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 flex-shrink-0">
                <button
                  onClick={() => canGoPrev && setCurrentSeasonIdx(i => i - 1)}
                  disabled={!canGoPrev}
                  className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer
                    disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="w-[1px] h-3 sm:h-4 bg-gray-200 mx-0.5 sm:mx-1"></div>
                <button
                  onClick={() => canGoNext && setCurrentSeasonIdx(i => i + 1)}
                  disabled={!canGoNext}
                  className="w-8 h-7 sm:w-10 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer
                    disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-600">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ) : null}

            {/* Action */}
            {isActiveSeason ? (
              <button onClick={() => setEndSeasonConfirm(true)}
                className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-gray-200 font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0">
                <span className="sm:hidden">🏁 End</span>
                <span className="hidden sm:inline">🏁 End Season</span>
              </button>
            ) : (
              <button onClick={() => setSummarySeasonId(currentSeason.id)}
                className="flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-xl border-2 border-[#0A1318] font-heading font-black text-[10px] sm:text-xs uppercase tracking-widest text-[#0A1318] hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0">
                <span className="sm:hidden">📊 View</span>
                <span className="hidden sm:inline">📊 View Summary</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-8 border-b border-gray-100 mb-6 px-1">
        {[{key:'matches',label:'Matches'},{key:'stats',label:'Stats'}].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`pb-3 font-heading font-black text-sm uppercase tracking-widest transition-all cursor-pointer border-b-2 -mb-[1px]
              ${activeTab === tab.key ? 'border-[#0A1318] text-[#0A1318]' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'stats' ? (
        <StatsPanel seasonId={currentSeason?.id} />
      ) : matchesLoading ? (
        <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">
          Loading matches...
        </div>
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">⚽</div>
          <div className="text-center">
            <div className="font-heading font-black text-lg uppercase tracking-wide text-gray-300">No Matches Yet</div>
            {isActiveSeason && (
              <p className="text-sm text-gray-400 mt-1">Tap <strong>+ New Match</strong> to schedule a game</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              isActiveSeason={isActiveSeason}
              onStart={() => handleStartMatch(match)}
              onResume={() => handleStartMatch(match)}
              onCancel={() => setCancelingMatch(match)}
              onClick={() => setResultMatch(match)}
            />
          ))}
        </div>
      )}


      {/* Modals */}
      <NewMatchModal
        open={newMatchOpen}
        onClose={() => setNewMatchOpen(false)}
        seasonId={currentSeason?.id}
        onCreated={handleMatchCreated}
      />

      <MatchResultModal
        match={resultMatch}
        open={!!resultMatch}
        onClose={() => setResultMatch(null)}
      />

      <SeasonSummaryModal
        season={summarySeasonObj}
        open={!!summarySeasonId}
        onClose={() => setSummarySeasonId(null)}
      />

      <EndSeasonConfirmModal
        open={endSeasonConfirm}
        onClose={() => setEndSeasonConfirm(false)}
        onConfirm={handleEndSeason}
        loading={endingLoading}
      />

      <CancelMatchModal
        match={cancelingMatch}
        open={!!cancelingMatch}
        onClose={() => setCancelingMatch(null)}
        onConfirm={handleCancelMatch}
        loading={cancelLoading}
      />


    </div>
  )
}
