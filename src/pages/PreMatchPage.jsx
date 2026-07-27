import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchPlayers } from '../services/players'
import { completeMatch as completeMatchFriendly } from '../services/friendlyMatches'
import { completeMatch as completeMatchWC } from '../services/worldCup'
import { completeLeagueMatch } from '../services/league'
import { completeDraftMatch, completeDraftCupMatch } from '../services/draftSave'
import { getOVRTier } from '../utils/stats'
import { simulateMatchSequences } from '../utils/matchEngine'
import { FIFA_NATIONS } from '../utils/fifaNations'
import PlayerCard from '../components/ui/PlayerCard'
import AllStarIcon from '../components/ui/AllStarIcon'
import { ChevronDown, ChevronUp, CircleDot, Footprints, RefreshCw, ShieldCheck, Star, Trophy } from 'lucide-react'
import useOverlayBehavior from '../hooks/useOverlayBehavior'

const TIER_STYLES = {
  special: 'bg-[#FD5461] text-white',
  gold:    'bg-[#0A1318] text-white',
  silver:  'bg-gray-600 text-white',
  bronze:  'bg-gray-400 text-white',
}

const POS_COLORS = { GK: '#f59e0b', DEF: '#3b82f6', MF: '#22c55e', FWD: '#FD5461' }
const POS_LABEL  = { GK: 'GK', DEF: 'DF', MF: 'MF', FWD: 'FW' }

// ─── Goal Celebration Confetti ───────────────────────────────────────────────
const CONFETTI_COLORS = ['#FD5461', '#0A1318', '#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#f97316']

function GoalConfetti({ active, onDone }) {
  const particles = useRef([])
  const rafRef = useRef(null)
  const canvasRef = useRef(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!active) { startedRef.current = false; return }
    if (startedRef.current) return
    startedRef.current = true

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // spawn 120 particles from center-top
    particles.current = Array.from({ length: 120 }, () => ({
      x: canvas.width * (0.3 + Math.random() * 0.4),
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 16 + 4),
      radius: Math.random() * 6 + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.25,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }))

    const gravity = 0.55
    let frame = 0

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of particles.current) {
        p.vy += gravity
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotV
        if (frame > 40) p.alpha = Math.max(0, p.alpha - 0.018)
        if (p.alpha > 0) alive = true
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.radius, -p.radius * 0.5, p.radius * 2, p.radius)
        }
        ctx.restore()
      }
      frame++
      if (alive) {
        rafRef.current = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        onDone?.()
      }
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />
  )
}

// ─── Live Event Ticker ────────────────────────────────────────────────────────
function MatchEventFeed({ goals, fouls, actions = [], mvp, mvpTeam, phase, homeClub, awayClub }) {
  // Filter ONLY key events: goals, fouls/cards, and match MVP
  const ALLOWED_ACTION_TYPES = new Set(['foul'])
  
  const events = [
    ...goals.map((goal, index) => ({ ...goal, id: `goal-${goal.minute}-${goal.scorer?.id ?? index}`, type: 'goal', player: goal.scorer })),
    ...fouls.map((foul, index) => ({ ...foul, id: `${foul.card || 'foul'}-${foul.minute}-${foul.player?.id ?? index}`, type: foul.card || 'foul', card: foul.card, player: foul.player })),
    ...actions.filter(event => event.type === 'foul').map((event, index) => ({ ...event, id: `action-foul-${event.minute}-${event.player?.id ?? index}`, type: event.card || 'foul', card: event.card, player: event.player })),
    ...(phase === 'full_time' && mvp ? [{ id: `mvp-${mvp.id}`, type: 'mvp', minute: Infinity, team: mvpTeam, player: mvp }] : []),
  ].sort((a, b) => a.minute - b.minute)

  const eventMeta = {
    goal: { label: 'Goal', icon: <CircleDot size={17} strokeWidth={2.5} />, tone: 'bg-[#FD5461] text-white' },
    yellow: { label: 'Yellow card', icon: <span className="h-4 w-3 rounded-[2px] bg-amber-400 shrink-0" />, tone: 'bg-amber-50 text-amber-700' },
    red: { label: 'Red card', icon: <span className="h-4 w-3 rounded-[2px] bg-red-500 shrink-0" />, tone: 'bg-red-50 text-red-600' },
    mvp: { label: 'Player of the Match', icon: <Trophy size={17} strokeWidth={2.5} />, tone: 'bg-[#0A1318] text-white' },
    foul: { label: 'Foul', icon: <span className="text-[10px] font-black text-amber-600">!</span>, tone: 'bg-amber-100 text-amber-800' },
  }

  const feedRef = useRef(null)

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [events.length])

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-heading text-base font-bold uppercase tracking-wide text-[#0A1318]">Match Events</h2>
        <span className="text-sm text-gray-500">{events.length} {events.length === 1 ? 'event' : 'events'}</span>
      </div>
      {events.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center px-4 py-6 text-sm text-gray-400">Events will appear here as the match unfolds.</div>
      ) : (
        <div ref={feedRef} className="max-h-[320px] overflow-y-auto divide-y divide-gray-100">
          {events.map((event, index) => {
            const club = event.team === 'home' ? homeClub : awayClub
            const meta = eventMeta[event.type] || { label: event.type, icon: <CircleDot size={15} />, tone: 'bg-slate-100 text-slate-600' }
            const flagCode = FIFA_NATIONS.find(n => n.name === event.player?.nationality)?.code
            return (
              <div key={event.id} className="flex items-center gap-3 px-4 py-3"
                style={{ animation: index === events.length - 1 ? 'tickerSlideIn 0.35s ease-out both' : undefined }}>
                {/* Player Photo */}
                <div className="relative h-10 w-10 flex-shrink-0 overflow-visible rounded-full bg-gray-100 ring-1 ring-black/5">
                  {event.player?.photo_url
                    ? <img src={event.player.photo_url} alt={event.player.name} className="h-full w-full rounded-full object-cover" />
                    : <span className="flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-gray-400">{event.player?.name?.charAt(0) || '?'}</span>}
                  <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${meta.tone}`}>{meta.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-[#0A1318]">
                    {event.player?.name ?? 'Own goal'}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                    {/* Club Badge Leading */}
                    {club?.id === '__allstars__' ? (
                      <AllStarIcon size={14} badgeUrl={club?.badge_url} className="shrink-0" />
                    ) : club?.badge_url ? (
                      <img src={club.badge_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                    ) : (
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm text-[5px] font-bold uppercase text-white" style={{ backgroundColor: club?.badge_color || '#0A1318' }}>
                        {(club?.short_name || club?.name || 'CLB').slice(0, 3)}
                      </span>
                    )}
                    {/* Position Badge */}
                    {event.player?.position && (
                      <span className="font-semibold uppercase text-[11px]" style={{ color: POS_COLORS[event.player.position] ?? '#6b7280' }}>
                        {POS_LABEL[event.player.position] ?? event.player.position}
                      </span>
                    )}
                    {/* Flag Trailing */}
                    {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-2.5 w-4 object-cover rounded-[2px] ring-1 ring-black/10 ml-0.5" alt="" />}
                    <span className="font-medium text-gray-600">{meta.label}</span>
                    {event.type === 'goal' && event.assist && <><span className="text-gray-300">·</span><span>Assist: {event.assist.name}</span></>}
                  </div>
                </div>
                <span className="flex-shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-gray-700">
                  {event.type === 'mvp' ? 'FT' : `${event.minute}'`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function IconBallSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="white" stroke="#0A1318" strokeWidth="2"/>
      <path d="M16 4 L19.5 10 L27 10.5 L22.5 16 L24.5 23.5 L16 20 L7.5 23.5 L9.5 16 L5 10.5 L12.5 10 Z" fill="#0A1318"/>
    </svg>
  )
}

function IconBootSmall() {
  return (
    <svg width="18" height="16" viewBox="0 0 36 32" fill="none">
      <path d="M8 3 C8 3 8 16 8 19 C8 22 10 24 14 24 L30 24 L30 21 C30 21 22 21 20 18 C18 15 18 3 18 3 Z" fill="#0A1318"/>
      <path d="M10 24 L30 24 L30 27 L10 27 Z" fill="#0A1318"/>
      <circle cx="13" cy="27.5" r="1.5" fill="#FD5461"/>
      <circle cx="19" cy="27.5" r="1.5" fill="#FD5461"/>
      <circle cx="25" cy="27.5" r="1.5" fill="#FD5461"/>
    </svg>
  )
}

function CaptainBadge() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#FD5461] flex-shrink-0">
      <span className="text-[11px] font-bold text-white leading-none">C</span>
    </span>
  )
}

function PlayerRow({ player, club, isDragging, isOver, canDrop, onPointerDown, onMoveUp, onMoveDown, isFirst, isLast, isCaptain, stats, isSuspended, animOffset = 0 }) {
  const tier = getOVRTier(player.ovr)
  const flagCode = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
  const { goals = 0, assists = 0, yellows = 0, reds = 0 } = stats ?? {}
  const hasStats = goals > 0 || assists > 0 || yellows > 0 || reds > 0

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        touchAction: 'none',
        transform: animOffset ? `translate3d(0, ${animOffset}px, 0)` : undefined,
        transition: animOffset ? 'none' : 'transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1), border-color 200ms, background-color 200ms',
      }}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-300 ease-in-out min-h-[52px]
        ${isDragging ? 'opacity-20 scale-[0.98]' : 'scale-100'}
        ${isSuspended ? 'opacity-50' : ''}
        ${isOver && canDrop ? 'border-[#FD5461] bg-red-50 shadow-md shadow-red-500/10' : 'border-gray-100 bg-white hover:border-gray-200'}
        ${isOver && !canDrop ? 'border-red-300 bg-red-50' : ''}`}
    >
      {/* Stacked Up/Down Reorder Buttons */}
      <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 -ml-1 pr-0.5">
        <button
          type="button"
          disabled={isFirst}
          onClick={(e) => { e.stopPropagation(); onMoveUp?.() }}
          aria-label={`Move ${player.name} up`}
          className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-[#FD5461] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer"
        >
          <ChevronUp size={14} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={(e) => { e.stopPropagation(); onMoveDown?.() }}
          aria-label={`Move ${player.name} down`}
          className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-[#FD5461] disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer"
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </button>
      </div>
      {/* OVR Badge — Leading */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0 ${TIER_STYLES[tier]}`}>
        {player.ovr}
      </div>

      {/* Photo */}
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        {player.photo_url
          ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center font-semibold text-gray-500 text-sm">{player.name.charAt(0)}</div>
        }
      </div>

      {/* Name + Subtitle (Club Badge -> Position -> Flag) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-semibold text-[#0A1318] truncate">{player.name}</span>
          {isCaptain && <CaptainBadge />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {/* Club Badge Leading: Show player's original club badge if present, fallback to match club */}
          {(() => {
            const playerClub = player.club || (club?.id !== '__allstars__' ? club : null)
            if (playerClub?.badge_url) {
              return <img src={playerClub.badge_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
            }
            if (playerClub) {
              return (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm text-[5px] font-bold uppercase text-white" style={{ backgroundColor: playerClub.badge_color || '#0A1318' }}>
                  {(playerClub.short_name || playerClub.name || playerClub.club_name || 'CLB').slice(0, 3)}
                </span>
              )
            }
            if (club?.id === '__allstars__') {
              return <AllStarIcon size={14} badgeUrl={club?.badge_url} className="shrink-0" />
            }
            if (club?.badge_url) {
              return <img src={club.badge_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
            }
            return (
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm text-[5px] font-bold uppercase text-[#white]" style={{ backgroundColor: club?.badge_color || '#0A1318' }}>
                {(club?.short_name || club?.name || 'CLB').slice(0, 3)}
              </span>
            )
          })()}
          {/* Position Text without dot */}
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: POS_COLORS[player.position] ?? '#6b7280' }}>
            {POS_LABEL[player.position] ?? player.position}
          </span>
          {/* Flag Trailing */}
          {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-2.5 w-4 object-cover rounded-[2px] ring-1 ring-black/10 ml-0.5" alt="" />}
        </div>
      </div>

      {/* Live Match Stats */}
      {hasStats && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {goals > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-600">
              <CircleDot size={13} className="text-[#0A1318] shrink-0" strokeWidth={2.5} />
              <span>{goals}</span>
            </span>
          )}
          {assists > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-600">
              <Footprints size={13} className="text-gray-500 shrink-0" strokeWidth={2.25} />
              <span>{assists}</span>
            </span>
          )}
          {yellows > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700">
              <span className="h-3 w-2 rounded-[2px] bg-amber-400 shrink-0" />
              <span>{yellows}</span>
            </span>
          )}
          {reds > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600">
              <span className="h-3 w-2 rounded-[2px] bg-red-500 shrink-0" />
              <span>{reds}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyRow({ isOver, canDrop }) {
  return (
    <div className={`flex items-center justify-center px-3 py-2.5 rounded-xl border-2 border-dashed transition-colors min-h-[52px]
      ${isOver && canDrop ? 'border-[#FD5461] bg-red-50' : 'border-gray-200'}
      ${isOver && !canDrop ? 'border-red-300' : ''}`}
    >
      <span className="text-sm font-medium text-gray-400">Empty player slot</span>
    </div>
  )
}

function useDrag(setSlots, suspendedIds = new Set(), onTap = null) {
  const dragRef = useRef({ active: false, fromIdx: null, startX: 0, startY: 0, cachedRects: null })
  const suppressClickRef = useRef(false)
  const slotRefs = useRef(Array(12).fill(null))
  const scrollRef = useRef({ rafId: null, dir: 0, x: 0, y: 0 })
  const [activeDragIdx, setActiveDragIdx] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  function getSlotUnderPointer(clientX, clientY) {
    const rects = dragRef.current.cachedRects
    if (!rects) return null
    const x = clientX + window.scrollX
    const y = clientY + window.scrollY
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i
    }
    return null
  }

  function startScrollLoop() {
    if (scrollRef.current.rafId) return
    const loop = () => {
      if (scrollRef.current.dir !== 0) {
        window.scrollBy(0, scrollRef.current.dir * 15)
        setDragOver(getSlotUnderPointer(scrollRef.current.x, scrollRef.current.y))
      }
      scrollRef.current.rafId = requestAnimationFrame(loop)
    }
    scrollRef.current.rafId = requestAnimationFrame(loop)
  }

  function stopScrollLoop() {
    if (scrollRef.current.rafId) {
      cancelAnimationFrame(scrollRef.current.rafId)
      scrollRef.current.rafId = null
    }
    scrollRef.current.dir = 0
  }

  useEffect(() => {
    return () => stopScrollLoop()
  }, [])

  function handlePointerDown(fromIdx, e) {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    dragRef.current = { active: false, fromIdx, startX: e.clientX, startY: e.clientY }

    function onMove(e) {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (!dragRef.current.active && Math.hypot(dx, dy) > 8) {
        dragRef.current.active = true
        dragRef.current.cachedRects = slotRefs.current.map(el => {
          if (!el) return null
          const r = el.getBoundingClientRect()
          return {
            left: r.left + window.scrollX,
            right: r.right + window.scrollX,
            top: r.top + window.scrollY,
            bottom: r.bottom + window.scrollY,
          }
        })
        setActiveDragIdx(fromIdx)
        startScrollLoop()
      }
      if (dragRef.current.active) {
        scrollRef.current.x = e.clientX
        scrollRef.current.y = e.clientY

        const threshold = 100
        if (e.clientY < threshold) {
          scrollRef.current.dir = -1
        } else if (e.clientY > window.innerHeight - threshold) {
          scrollRef.current.dir = 1
        } else {
          scrollRef.current.dir = 0
        }

        const newDragOver = getSlotUnderPointer(e.clientX, e.clientY)
        setDragOver(prev => prev === newDragOver ? prev : newDragOver)
      }
    }

    function onUp(e) {
      stopScrollLoop()
      if (dragRef.current.active) {
        suppressClickRef.current = true
        const toIdx = getSlotUnderPointer(e.clientX, e.clientY)
        const fIdx = dragRef.current.fromIdx
        if (toIdx !== null && toIdx !== fIdx) {
          setSlots(prev => {
            const starterCount = prev.slice(0, 5).filter(Boolean).length
            if (fIdx < 5 && toIdx >= 5 && starterCount < 5) return prev
            const playerToMove = prev[fIdx]
            if (toIdx < 5 && playerToMove && suspendedIds.has(playerToMove.id)) return prev
            const next = [...prev]
            const tmp = next[fIdx]; next[fIdx] = next[toIdx]; next[toIdx] = tmp
            return next
          })
        }
      } else {
        // tap — no movement
        if (onTap) onTap(dragRef.current.fromIdx)
      }
      dragRef.current = { active: false, fromIdx: null, startX: 0, startY: 0, cachedRects: null }
      setActiveDragIdx(null)
      setDragOver(null)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  function handleActivate(idx) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (onTap) onTap(idx)
  }

  return { slotRefs, activeDragIdx, dragOver, handlePointerDown, handleActivate }
}

function SlotCell({ player, club, idx, totalCount = 12, onMovePlayer, activeDragIdx, dragOver, slotRefs, handlePointerDown, handleActivate, goals, fouls, suspendedIds, animOffset = 0 }) {
  const isDragging = activeDragIdx === idx
  const isOver = dragOver === idx && activeDragIdx !== null
  const canDrop = dragOver === idx && activeDragIdx !== idx
  const isSuspended = player ? (suspendedIds ?? new Set()).has(player.id) : false
  const stats = player ? {
    goals: (goals ?? []).filter(g => g.scorer?.id === player.id).length,
    assists: (goals ?? []).filter(g => g.assist?.id === player.id).length,
    yellows: (fouls ?? []).filter(f => f.player.id === player.id && f.card === 'yellow').length,
    reds: (fouls ?? []).filter(f => f.player.id === player.id && f.card === 'red').length,
  } : null
  return (
    <div
      ref={el => { slotRefs.current[idx] = el }}
      role={player ? 'button' : undefined}
      tabIndex={player ? 0 : undefined}
      aria-label={player ? `Select ${player.name}` : undefined}
      onClick={player ? () => handleActivate(idx) : undefined}
      onKeyDown={player ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleActivate(idx)
        }
      } : undefined}
      className={player ? 'rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD5461] focus-visible:ring-offset-2' : undefined}
    >
      {player
        ? <PlayerRow player={player} club={club} isDragging={isDragging} isOver={isOver} canDrop={canDrop}
            onPointerDown={e => handlePointerDown(idx, e)}
            onMoveUp={() => onMovePlayer?.(idx, idx - 1)}
            onMoveDown={() => onMovePlayer?.(idx, idx + 1)}
            isFirst={idx === 0}
            isLast={idx >= totalCount - 1}
            isCaptain={idx === 0} stats={stats} isSuspended={isSuspended} animOffset={animOffset} />
        : <EmptyRow isOver={isOver} canDrop={canDrop} />
      }
    </div>
  )
}

// Desktop: shared rows so both columns align perfectly
function SharedLineupDesktop({ homeClub, awayClub, homeSlots, setHomeSlots, awaySlots, setAwaySlots, goals, fouls, suspendedIds, onPlayerClick }) {
  const home = useDrag(setHomeSlots, suspendedIds, (idx) => { const p = homeSlots[idx]; if (p) onPlayerClick(p) })
  const away = useDrag(setAwaySlots, suspendedIds, (idx) => { const p = awaySlots[idx]; if (p) onPlayerClick(p) })

  const [homeAnimOffsets, setHomeAnimOffsets] = useState({})
  const [awayAnimOffsets, setAwayAnimOffsets] = useState({})

  const moveHomePlayer = (from, to) => {
    if (to < 0 || to >= homeSlots.length || from === to) return
    const p1 = homeSlots[from], p2 = homeSlots[to]
    const distance = (to - from) * 58
    if (p1) setHomeAnimOffsets(prev => ({ ...prev, [p1.id]: -distance }))
    if (p2) setHomeAnimOffsets(prev => ({ ...prev, [p2.id]: distance }))

    setHomeSlots(prev => {
      const next = [...prev]
      const tmp = next[from]; next[from] = next[to]; next[to] = tmp
      return next
    })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setHomeAnimOffsets({})
      })
    })
  }

  const moveAwayPlayer = (from, to) => {
    if (to < 0 || to >= awaySlots.length || from === to) return
    const p1 = awaySlots[from], p2 = awaySlots[to]
    const distance = (to - from) * 58
    if (p1) setAwayAnimOffsets(prev => ({ ...prev, [p1.id]: -distance }))
    if (p2) setAwayAnimOffsets(prev => ({ ...prev, [p2.id]: distance }))

    setAwaySlots(prev => {
      const next = [...prev]
      const tmp = next[from]; next[from] = next[to]; next[to] = tmp
      return next
    })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAwayAnimOffsets({})
      })
    })
  }

  const homeStarters = homeSlots.slice(0, 5).filter(Boolean).length
  const awayStarters = awaySlots.slice(0, 5).filter(Boolean).length

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">Starting 5</span>
          <span className="text-sm text-gray-500">{homeStarters}/5</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">Starting 5</span>
          <span className="text-sm text-gray-500">{awayStarters}/5</span>
        </div>
      </div>

      {/* Starter rows */}
      <div className="space-y-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`starter-row-${homeSlots[i]?.id || 'h'+i}-${awaySlots[i]?.id || 'a'+i}`} className="grid grid-cols-2 gap-4">
            <SlotCell player={homeSlots[i]} club={homeClub} idx={i} onMovePlayer={moveHomePlayer} {...home} goals={goals} fouls={fouls} suspendedIds={suspendedIds} animOffset={homeSlots[i] ? homeAnimOffsets[homeSlots[i].id] || 0 : 0} />
            <SlotCell player={awaySlots[i]} club={awayClub} idx={i} onMovePlayer={moveAwayPlayer} {...away} goals={goals} fouls={fouls} suspendedIds={suspendedIds} animOffset={awaySlots[i] ? awayAnimOffsets[awaySlots[i].id] || 0 : 0} />
          </div>
        ))}
      </div>

      {/* Subs divider */}
      <div className="grid grid-cols-2 gap-4 my-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-sm font-medium text-gray-500">Subs · {homeSlots.slice(5).filter(Boolean).length}/7</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-sm font-medium text-gray-500">Subs · {awaySlots.slice(5).filter(Boolean).length}/7</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      </div>

      {/* Sub rows */}
      <div className="space-y-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const idx = i + 5
          return (
            <div key={`sub-row-${homeSlots[idx]?.id || 'h'+idx}-${awaySlots[idx]?.id || 'a'+idx}`} className="grid grid-cols-2 gap-4">
              <SlotCell player={homeSlots[idx]} club={homeClub} idx={idx} onMovePlayer={moveHomePlayer} {...home} goals={goals} fouls={fouls} suspendedIds={suspendedIds} animOffset={homeSlots[idx] ? homeAnimOffsets[homeSlots[idx].id] || 0 : 0} />
              <SlotCell player={awaySlots[idx]} club={awayClub} idx={idx} onMovePlayer={moveAwayPlayer} {...away} goals={goals} fouls={fouls} suspendedIds={suspendedIds} animOffset={awaySlots[idx] ? awayAnimOffsets[awaySlots[idx].id] || 0 : 0} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Mobile: tab + slide
function LineupPanel({ club, slots, setSlots, goals, fouls, suspendedIds, onPlayerClick }) {
  const { slotRefs, activeDragIdx, dragOver, handlePointerDown, handleActivate } = useDrag(setSlots, suspendedIds, (idx) => { const p = slots[idx]; if (p) onPlayerClick(p) })
  const starters = slots.slice(0, 5)
  const subs = slots.slice(5)
  const [animOffsets, setAnimOffsets] = useState({})

  const movePlayer = (from, to) => {
    if (to < 0 || to >= slots.length || from === to) return
    const p1 = slots[from], p2 = slots[to]
    const distance = (to - from) * 58
    if (p1) setAnimOffsets(prev => ({ ...prev, [p1.id]: -distance }))
    if (p2) setAnimOffsets(prev => ({ ...prev, [p2.id]: distance }))

    setSlots(prev => {
      const next = [...prev]
      const tmp = next[from]; next[from] = next[to]; next[to] = tmp
      return next
    })

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimOffsets({})
      })
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-600">Starting 5</span>
          <span className="text-sm text-gray-500">{starters.filter(Boolean).length}/5</span>
        </div>
        <div className="space-y-1.5">
          {starters.map((player, i) => (
            <div key={player?.id || `starter-${i}`}>
              <SlotCell player={player} club={club} idx={i} onMovePlayer={movePlayer} slotRefs={slotRefs} activeDragIdx={activeDragIdx} dragOver={dragOver} handlePointerDown={handlePointerDown} handleActivate={handleActivate} goals={goals} fouls={fouls} suspendedIds={suspendedIds} animOffset={player ? animOffsets[player.id] || 0 : 0} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-sm font-medium text-gray-500">Subs · {subs.filter(Boolean).length}/7</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <div className="space-y-1.5">
        {subs.map((player, i) => {
          const idx = i + 5
          return (
            <div key={player?.id || `sub-${idx}`}>
              <SlotCell player={player} club={club} idx={idx} onMovePlayer={movePlayer} slotRefs={slotRefs} activeDragIdx={activeDragIdx} dragOver={dragOver} handlePointerDown={handlePointerDown} handleActivate={handleActivate} goals={goals} fouls={fouls} suspendedIds={suspendedIds} animOffset={player ? animOffsets[player.id] || 0 : 0} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlayerDetailModal({ player, onClose }) {
  useOverlayBehavior(Boolean(player), onClose)
  if (!player) return null
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.2s ease forwards' }}>
      <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
        <PlayerCard player={player} />
        <button onClick={onClose} className="w-full mt-2 py-3.5 text-xs font-heading font-black uppercase tracking-widest text-gray-400 bg-white rounded-2xl hover:text-gray-600 transition-colors flex items-center justify-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Close
        </button>
      </div>
    </div>,
    document.body
  )
}

export default function PreMatchPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { matchId } = useParams()
  // Support both URL param and legacy location.state
  const { homeClub, awayClub, duration, returnPath, nationalMode, allStarsTeamIds, saveId, matchIndex, currentWeek, cupRound } = location.state ?? {}
  const isTournament = location.pathname.includes('/world-cup/') || location.pathname.includes('/club-cup/')
  const isLeague = location.pathname.includes('/league/')
  const isDraft = location.pathname.includes('/matches/draft/prematch')
  const isKnockoutMatch = isTournament || (isDraft && Boolean(cupRound))
  const matchTitle = isDraft
    ? (cupRound ? 'Cup Match' : 'League Match')
    : isTournament
      ? 'Tournament Match'
      : isLeague
        ? 'League Match'
        : 'Friendly Match'
  
  let completeMatch = isLeague ? completeLeagueMatch : (isTournament ? completeMatchWC : completeMatchFriendly)
  if (isDraft) {
    completeMatch = async (_, payload) => {
      if (cupRound) await completeDraftCupMatch(saveId, cupRound, matchIndex, payload)
      else await completeDraftMatch(saveId, currentWeek, matchIndex, payload)
    }
  }
  
  const matchesPath = returnPath ?? '/matches/friendly'

  const [activeTab, setActiveTab] = useState('home')
  const [homeSlots, setHomeSlots] = useState(Array(12).fill(null))
  const [awaySlots, setAwaySlots] = useState(Array(12).fill(null))
  const [loading, setLoading] = useState(true)
  // phase: 'idle' | 'first_half' | 'half_time' | 'second_half' | 'full_time'
  const [phase, setPhase] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [countdown, setCountdown] = useState(null) // null | 3 | 2 | 1 | 'KICK OFF!'
  const [notification, setNotification] = useState(null) // null | 'HALF TIME' | 'FULL TIME'
  const [postMatchReady, setPostMatchReady] = useState(false)
  // goal modal: step = null | 'team' | 'scorer' | 'assist'
  const [goalStep, setGoalStep] = useState(null)
  const [goalTeam, setGoalTeam] = useState(null) // 'home' | 'away'
  const [goalScorer, setGoalScorer] = useState(null)
  const [goals, setGoals] = useState([])
  const [matchActions, setMatchActions] = useState([])
  const [foulStep, setFoulStep] = useState(null) // null | 'player' | 'card'
  const [foulPlayer, setFoulPlayer] = useState(null)
  const [foulPlayerTeam, setFoulPlayerTeam] = useState(null)
  const [fouls, setFouls] = useState([])
  const [redCardWarning, setRedCardWarning] = useState(null) // { player, minute }
  const [redCardMinute, setRedCardMinute] = useState(null)
  const [playerDetail, setPlayerDetail] = useState(null)
  const [mvp, setMvp] = useState(null)
  const [penaltyShootout, setPenaltyShootout] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const anthemRef = useRef(null)
  const crowdRef = useRef(null)
  const audioContextRef = useRef(null)
  const [simModal, setSimModal] = useState(false)
  const [simPreview, setSimPreview] = useState(null)
  const [fastSimulating, setFastSimulating] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function simulateStatSegment(startSec, endSec, currentHomeScore, currentAwayScore, currentGoals, currentFouls) {
    const homePlayers = homeSlots.slice(0, 5).filter(player => player && !currentFouls.some(foul => foul.player?.id === player.id && foul.card === 'red'))
    const awayPlayers = awaySlots.slice(0, 5).filter(player => player && !currentFouls.some(foul => foul.player?.id === player.id && foul.card === 'red'))
    const segmentRatio = Math.max(0, endSec - startSec) / Math.max(1, totalSeconds)
    const startMinute = toMatchMinute(startSec)
    const endMinute = toMatchMinute(endSec)
    const sequence = simulateMatchSequences(homePlayers, awayPlayers, {
      seed: `${homeClub?.id}-${awayClub?.id}-${startSec}-${endSec}-${currentGoals.length}-${currentFouls.length}`,
      possessions: Math.max(1, Math.round(36 * segmentRatio)),
      startMinute,
      endMinute,
    })

    // ─── Tactical & Realistic Substitutions Generator (Minute 55' - 85') ───
    if (endMinute >= 55) {
      ;['home', 'away'].forEach(team => {
        const slots = team === 'home' ? homeSlots : awaySlots
        const setSlots = team === 'home' ? setHomeSlots : setAwaySlots
        const hScore = currentHomeScore + sequence.filter(e => e.type === 'goal' && e.team === 'home').length
        const aScore = currentAwayScore + sequence.filter(e => e.type === 'goal' && e.team === 'away').length
        const scoreDiff = team === 'home' ? (hScore - aScore) : (aScore - hScore)
        
        // Non-GK starters on pitch & subs on bench
        const startersOnPitch = slots.slice(0, 5).map((p, idx) => ({ player: p, idx })).filter(item => item.player && item.player.position !== 'GK')
        const subsBench = slots.slice(5).map((p, idx) => ({ player: p, idx: idx + 5 })).filter(item => item.player)

        if (startersOnPitch.length > 0 && subsBench.length > 0 && Math.random() < 0.65) {
          const subMinute = Math.floor(Math.random() * (Math.min(85, endMinute) - Math.max(55, startMinute) + 1)) + Math.max(55, startMinute)
          let candidateOut = null
          let candidateIn = null

          if (scoreDiff < 0) {
            // Losing: Tactical offensive sub (FWD/MF in, DEF/MF out)
            candidateIn = subsBench.find(s => s.player.position === 'FWD' || s.player.position === 'MF') || subsBench[0]
            candidateOut = startersOnPitch.find(s => s.player.position === candidateIn.player.position) || startersOnPitch.find(s => s.player.position === 'DEF' || s.player.position === 'MF') || startersOnPitch[0]
          } else if (scoreDiff > 0) {
            // Winning: Tactical defensive sub (DEF/MF in to hold lead)
            candidateIn = subsBench.find(s => s.player.position === 'DEF' || s.player.position === 'MF') || subsBench[0]
            candidateOut = startersOnPitch.find(s => s.player.position === candidateIn.player.position) || startersOnPitch.find(s => s.player.position === 'FWD' || s.player.position === 'MF') || startersOnPitch[0]
          } else {
            // Drawing: Position-matched swap (FWD->FWD, MF->MF, DEF->DEF)
            candidateOut = startersOnPitch[Math.floor(Math.random() * startersOnPitch.length)]
            candidateIn = subsBench.find(s => s.player.position === candidateOut.player.position) || subsBench[0]
          }

          if (candidateOut && candidateIn) {
            // Apply live slot swap
            setSlots(prev => {
              const next = [...prev]
              next[candidateOut.idx] = candidateIn.player
              next[candidateIn.idx] = candidateOut.player
              return next
            })
            // Add substitution event to match timeline
            sequence.push({
              type: 'substitution',
              team,
              minute: subMinute,
              player: candidateOut.player,
              subIn: candidateIn.player,
            })
          }
        }
      })
    }

    sequence.sort((a, b) => a.minute - b.minute)
    const generatedGoals = sequence.filter(event => event.type === 'goal').map(event => ({
      team: event.team,
      scorer: event.scorer,
      assist: event.assist,
      minute: event.minute,
      detail: event.error,
    }))
    return {
      hScore: currentHomeScore + generatedGoals.filter(goal => goal.team === 'home').length,
      aScore: currentAwayScore + generatedGoals.filter(goal => goal.team === 'away').length,
      newGoals: [...currentGoals, ...generatedGoals],
      newFouls: [...currentFouls],
      sequence,
    }
  }

  function simulateSegment(startSec, endSec, currentHomeScore, currentAwayScore, currentGoals, currentFouls) {
    return simulateStatSegment(startSec, endSec, currentHomeScore, currentAwayScore, currentGoals, currentFouls)
  }

  // Weighted player picker supporting statistical attributes
  function pickWeightedPlayer(lineup, posWeights, attributeKey) {
    const filtered = lineup.filter(Boolean)
    if (filtered.length === 0) return null
    
    // Total weight combines position weights and individual stat (normalized / 50)
    const totalWeight = filtered.reduce((sum, p) => {
      const pW = posWeights[p.position] || 1
      const statW = p.stats?.[attributeKey] ? (p.stats[attributeKey] / 50) : 1.0
      return sum + (pW * statW)
    }, 0)

    let rand = Math.random() * totalWeight
    for (const p of filtered) {
      const pW = posWeights[p.position] || 1
      const statW = p.stats?.[attributeKey] ? (p.stats[attributeKey] / 50) : 1.0
      const w = pW * statW
      if (rand < w) return p
      rand -= w
    }
    return filtered[0]
  }

  function handleSimAction(target) {
    let targetPhase = 'full_time'
    let targetElapsed = totalSeconds
    if (target === 'half') {
      targetPhase = 'half_time'
      targetElapsed = halfSeconds
    } else if (target === 'extra_half') {
      targetPhase = 'extra_time_half'
      targetElapsed = extraHalfSeconds
    } else if (target === 'extra_full') {
      targetPhase = 'full_time'
      targetElapsed = extraTimeSeconds
    }
    const result = simulateSegment(elapsed, targetElapsed, homeScore, awayScore, goals, fouls)
    const startElapsed = elapsed
    const startGoals = [...goals]
    const startFouls = [...fouls]
    const generatedGoals = result.newGoals.slice(startGoals.length)
    const generatedFouls = result.newFouls.slice(startFouls.length)
    const startActions = [...matchActions]
    const generatedActions = result.sequence || []
    const tickSize = Math.max(1, Math.ceil((targetElapsed - startElapsed) / 90))

    clearInterval(simTimerRef.current)
    setSimPreview(null)
    setSimModal(false)
    setFastSimulating(true)
    setPaused(false)
    setPhase(startElapsed >= totalSeconds
      ? (startElapsed >= extraHalfSeconds ? 'extra_time_second' : 'extra_time_first')
      : (startElapsed >= halfSeconds ? 'second_half' : 'first_half'))

    let simulatedElapsed = startElapsed
    let halfWhistlePlayed = targetElapsed === extraTimeSeconds ? startElapsed >= extraHalfSeconds : startElapsed >= halfSeconds
    simTimerRef.current = setInterval(() => {
      simulatedElapsed = Math.min(targetElapsed, simulatedElapsed + tickSize)
      const revealedGoals = generatedGoals.filter(goal => matchMinuteToRuntimeSeconds(goal.minute) <= simulatedElapsed)
      const revealedFouls = generatedFouls.filter(foul => matchMinuteToRuntimeSeconds(foul.minute) <= simulatedElapsed)
      const revealedActions = generatedActions.filter(action => matchMinuteToRuntimeSeconds(action.minute) <= simulatedElapsed)
      setElapsed(simulatedElapsed)
      setGoals([...startGoals, ...revealedGoals])
      setFouls([...startFouls, ...revealedFouls])
      setMatchActions([...startActions, ...revealedActions])
      setHomeScore(homeScore + revealedGoals.filter(goal => goal.team === 'home').length)
      setAwayScore(awayScore + revealedGoals.filter(goal => goal.team === 'away').length)
      if (simulatedElapsed >= halfSeconds && targetElapsed === totalSeconds) {
        setPhase('second_half')
        if (!halfWhistlePlayed) {
          halfWhistlePlayed = true
          playWhistlePattern(2)
        }
      }
      if (simulatedElapsed >= extraHalfSeconds && targetElapsed === extraTimeSeconds) {
        setPhase('extra_time_second')
        if (!halfWhistlePlayed) {
          halfWhistlePlayed = true
          playWhistlePattern(2)
        }
      }

      if (simulatedElapsed >= targetElapsed) {
        clearInterval(simTimerRef.current)
        setHomeScore(result.hScore)
        setAwayScore(result.aScore)
        setGoals(result.newGoals)
        setFouls(result.newFouls)
        setMatchActions([...startActions, ...generatedActions])
        const needsExtraTime = (targetElapsed === totalSeconds || targetElapsed === extraTimeSeconds) && isKnockoutMatch && result.hScore === result.aScore
        setPhase(needsExtraTime ? 'extra_time_ready' : targetPhase)
        setFastSimulating(false)
        if (targetPhase === 'full_time' && !needsExtraTime) {
          setPostMatchReady(false)
          setMvp(null)
        }
        playWhistlePattern(targetPhase === 'full_time' || needsExtraTime ? 3 : 2)
        showNotification(
          needsExtraTime ? 'CONTINUE EXTRA TIME' : targetPhase === 'full_time' ? 'FULL TIME' : targetPhase === 'extra_time_half' ? 'EXTRA TIME HALF' : 'HALF TIME',
          targetPhase === 'full_time' && !needsExtraTime ? () => setPostMatchReady(true) : undefined,
        )
      }
    }, 40)
  }
  const timerRef = useRef(null)
  const countdownRef = useRef(null)
  const simTimerRef = useRef(null)

  const totalSeconds = (duration ?? 10) * 60
  const halfSeconds = totalSeconds / 2
  const extraHalfSeconds = totalSeconds + totalSeconds / 6
  const extraTimeSeconds = totalSeconds + totalSeconds / 3

  // Runtime duration can be short (for example five real minutes), while the
  // football clock and every recorded event always use a standard 90-minute match.
  function toMatchMinute(runtimeSeconds) {
    return Math.max(1, Math.floor((runtimeSeconds / totalSeconds) * 90))
  }

  function matchMinuteToRuntimeSeconds(matchMinute) {
    return ((matchMinute || 1) / 90) * totalSeconds
  }

  function playWhistlePattern(count = 1) {
    if (isMuted) return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const context = audioContextRef.current || new AudioContext()
    audioContextRef.current = context
    context.resume?.()
    const start = context.currentTime + 0.02
    for (let index = 0; index < count; index += 1) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const at = start + index * 0.28
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(1850, at)
      oscillator.frequency.exponentialRampToValueAtTime(2250, at + 0.16)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.21)
    }
  }

  function showNotification(text, onDone) {
    setNotification(text)
    setTimeout(() => {
      setNotification(null)
      onDone?.()
    }, ['FULL TIME', 'GOLDEN GOAL!'].includes(text) ? 2600 : 2200)
  }

  function runTimer(stopAt, onEnd) {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 0.1 >= stopAt) {
          clearInterval(timerRef.current)
          onEnd?.()
          return stopAt
        }
        return prev + 0.1
      })
    }, 100)
  }

  function startWithCountdown(nextPhase, timerStopAt, onTimerEnd) {
    setCountdown(3)
    let count = 3
    countdownRef.current = setInterval(() => {
      count -= 1
      if (count === 0) {
        setCountdown('KICK OFF!')
        playWhistlePattern(1)
        setTimeout(() => {
          setCountdown(null)
          setPhase(nextPhase)
          runTimer(timerStopAt, onTimerEnd)
        }, 800)
        clearInterval(countdownRef.current)
      } else {
        setCountdown(count)
      }
    }, 900)
  }

  function endFirstHalf() {
    clearInterval(timerRef.current)
    setElapsed(halfSeconds)
    setPhase('half_time')
    playWhistlePattern(2)
    showNotification('HALF TIME')
  }

  function finishMatchAfterExtraTime() {
    clearInterval(timerRef.current)
    // ⚽ Continuous Golden Goal Extra Time: If still tied after 120 mins, start another Extra Time period instead of Penalty Shootout!
    if (isKnockoutMatch && homeScore === awayScore) {
      setPostMatchReady(false)
      setPhase('extra_time_ready')
      playWhistlePattern(2)
      showNotification('CONTINUE EXTRA TIME')
      return
    }
    setPostMatchReady(false)
    setPhase('full_time')
    setMvp(null)
    playWhistlePattern(3)
    showNotification('FULL TIME', () => setPostMatchReady(true))
  }

  function endExtraFirstHalf() {
    clearInterval(timerRef.current)
    setElapsed(extraHalfSeconds)
    setPhase('extra_time_half')
    playWhistlePattern(2)
    showNotification('EXTRA TIME HALF')
  }

  function endMatch() {
    clearInterval(timerRef.current)
    setElapsed(totalSeconds)
    if (isKnockoutMatch && homeScore === awayScore) {
      setPostMatchReady(false)
      setPhase('extra_time_ready')
      playWhistlePattern(3)
      showNotification('FULL TIME')
      return
    }
    setPostMatchReady(false)
    setPhase('full_time')
    setMvp(null)
    playWhistlePattern(3)
    showNotification('FULL TIME', () => setPostMatchReady(true))
  }

  function handleMainButton() {
    setPaused(false)
    if (phase === 'idle') {
      setElapsed(0); setHomeScore(0); setAwayScore(0)
      setMvp(null)
      setPenaltyShootout(null)
      anthemRef.current?.play().catch(() => {})
      crowdRef.current?.play().catch(() => {})
      startWithCountdown('first_half', halfSeconds, endFirstHalf)
    } else if (phase === 'first_half') {
      endFirstHalf()
    } else if (phase === 'half_time') {
      startWithCountdown('second_half', totalSeconds, endMatch)
    } else if (phase === 'second_half') {
      endMatch()
    } else if (phase === 'extra_time_ready') {
      const nextHalfTarget = elapsed + totalSeconds / 6
      startWithCountdown('extra_time_first', nextHalfTarget, endExtraFirstHalf)
    } else if (phase === 'extra_time_first') {
      endExtraFirstHalf()
    } else if (phase === 'extra_time_half') {
      const nextFullTarget = elapsed + totalSeconds / 6
      startWithCountdown('extra_time_second', nextFullTarget, finishMatchAfterExtraTime)
    } else if (phase === 'extra_time_second') {
      finishMatchAfterExtraTime()
    }
  }

  const [paused, setPaused] = useState(false)

  function handlePause() {
    clearInterval(timerRef.current)
    setPaused(true)
  }

  function handleResume() {
    if (redCardWarning) return
    setPaused(false)
    const extraPeriodIndex = Math.max(0, Math.floor((elapsed - totalSeconds) / (totalSeconds / 3)))
    const currentExtraHalfTarget = totalSeconds + (extraPeriodIndex * (totalSeconds / 3)) + (totalSeconds / 6)
    const currentExtraFullTarget = totalSeconds + ((extraPeriodIndex + 1) * (totalSeconds / 3))

    const stopAt = phase === 'first_half' ? halfSeconds
      : phase === 'second_half' ? totalSeconds
        : phase === 'extra_time_first' ? currentExtraHalfTarget
          : currentExtraFullTarget
    const onEnd = phase === 'first_half' ? endFirstHalf
      : phase === 'second_half' ? endMatch
        : phase === 'extra_time_first' ? endExtraFirstHalf
          : finishMatchAfterExtraTime
    runTimer(stopAt, onEnd)
  }

  const matchRunning = ['first_half', 'second_half', 'extra_time_first', 'extra_time_second'].includes(phase) && !paused

  const goalMinute = toMatchMinute(elapsed)

  function openGoalModal() {
    setGoalStep('team')
    setGoalTeam(null)
    setGoalScorer(null)
  }

  function confirmGoal(assist) {
    const minute = goalMinute
    const newGoal = { team: goalTeam, scorer: goalScorer, assist, minute }
    setGoals(prev => [...prev, newGoal])

    const updatedHomeScore = goalTeam === 'home' ? homeScore + 1 : homeScore
    const updatedAwayScore = goalTeam === 'away' ? awayScore + 1 : awayScore

    if (goalTeam === 'home') setHomeScore(updatedHomeScore)
    else setAwayScore(updatedAwayScore)

    setGoalStep(null)
    // 🎉 trigger confetti
    setShowConfetti(true)

    // ⚽ Golden Goal Rule for Knockout matches during Extra Time
    if (isKnockoutMatch && ['extra_time_first', 'extra_time_second'].includes(phase)) {
      if (updatedHomeScore !== updatedAwayScore) {
        clearInterval(timerRef.current)
        setPostMatchReady(false)
        setPhase('full_time')
        setMvp(null)
        playWhistlePattern(3)
        showNotification('GOLDEN GOAL!', () => setPostMatchReady(true))
      }
    }
  }

  const anyModalOpen = goalStep !== null || foulStep !== null || playerDetail !== null
  useEffect(() => {
    document.body.style.overflow = anyModalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [anyModalOpen])

  function openFoulModal() {
    setFoulStep('player')
    setFoulPlayer(null)
    setFoulPlayerTeam(null)
  }

  function undoLastFoul() {
    setFouls(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      if (last.card === 'red' && redCardWarning?.id === last.player.id) {
        setRedCardWarning(null)
        setRedCardMinute(null)
        setPaused(false)
      }
      return prev.slice(0, -1)
    })
  }

  function confirmFoul(card) {
    const minute = goalMinute
    setFouls(prev => [...prev, { player: foulPlayer, team: foulPlayerTeam, card, minute, phase }])
    if (card === 'red') {
      const slots = foulPlayerTeam === 'home' ? homeSlots : awaySlots
      const isStarter = slots.slice(0, 5).some(p => p?.id === foulPlayer.id)
      if (isStarter) {
        clearInterval(timerRef.current)
        setPaused(true)
        setRedCardWarning(foulPlayer)
        setRedCardMinute(minute)
      }
    }
    setFoulStep(null)
    setFoulPlayer(null)
    setFoulPlayerTeam(null)
  }

  // Compute suspended player IDs for current phase only
  const suspendedIds = (() => {
    const phaseFouls = fouls.filter(f => f.phase === phase)
    const ids = new Set()
    const yellowCounts = {}
    phaseFouls.forEach(f => {
      if (f.card === 'red') {
        ids.add(f.player.id)
      } else if (f.card === 'yellow') {
        yellowCounts[f.player.id] = (yellowCounts[f.player.id] || 0) + 1
        if (yellowCounts[f.player.id] >= 2) ids.add(f.player.id)
      }
    })
    return ids
  })()


  const goalPlayers = goalTeam === 'home'
    ? homeSlots.filter(Boolean)
    : awaySlots.filter(Boolean)

  useEffect(() => {
    const audios = [anthemRef.current, crowdRef.current]
    audios.forEach(a => {
      if (a) {
        if (a === crowdRef.current) a.volume = isMuted ? 0 : 0.2
        else a.volume = isMuted ? 0 : 0.5
      }
    })
  }, [isMuted])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(countdownRef.current)
      clearInterval(simTimerRef.current)
      // Stop all audio on unmount
      const audios = [anthemRef.current, crowdRef.current]
      audios.forEach(a => {
        if (a) {
          a.pause()
          a.currentTime = 0
        }
      })
      audioContextRef.current?.close?.()
    }
  }, [])

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const displayMatchSeconds = Math.round((elapsed / totalSeconds) * 90 * 60)

  useEffect(() => {
    if (!homeClub || !awayClub) { navigate(matchesPath); return }
    const awayFetch = isDraft
      ? Promise.resolve(awayClub.roster || [])
      : allStarsTeamIds
      ? Promise.all(allStarsTeamIds.map(id => fetchPlayers({ clubId: id }))).then(arrs => arrs.flat())
      : fetchPlayers(nationalMode ? { nationality: awayClub.name } : { clubId: awayClub.id })
    Promise.all([
      isDraft
        ? Promise.resolve(homeClub.roster || [])
        : fetchPlayers(nationalMode ? { nationality: homeClub.name } : { clubId: homeClub.id }),
      awayFetch,
    ]).then(([homePlayers, awayPlayers]) => {
      const makeSlots = (players, uncapped = false) => {
        let sorted = [...players]
        if (!isDraft) {
          const orderKey = nationalMode ? 'national_roster_order' : 'roster_order'
          sorted.sort((a, b) => {
            const aHasOrder = a[orderKey] != null
            const bHasOrder = b[orderKey] != null
            if (aHasOrder && bHasOrder) return a[orderKey] - b[orderKey]
            if (aHasOrder) return -1
            if (bHasOrder) return 1
            return b.ovr - a.ovr
          })
        }
        if (uncapped) {
          const len = Math.max(sorted.length, 12)
          const slots = Array(len).fill(null)
          sorted.forEach((p, i) => { slots[i] = p })
          return slots
        }
        if (nationalMode) {
          // Only first 12 (Starting 5 + Substitutes) go to the match
          const slots = Array(12).fill(null)
          sorted.forEach((p, i) => { if (i < 12) slots[i] = p })
          return slots
        }
        const slots = Array(12).fill(null)
        sorted.forEach((p, i) => { if (i < 12) slots[i] = p })
        return slots
      }
      setHomeSlots(makeSlots(homePlayers))
      setAwaySlots(makeSlots(awayPlayers, !!allStarsTeamIds))
      setLoading(false)
    }).catch(() => {
      navigate(matchesPath)
    })
  }, [homeClub, awayClub, navigate])

  if (!homeClub || !awayClub) return null

  async function handleSaveAndExit() {
    if (!mvp || isSaving) return
    setIsSaving(true)
    if (isDraft) {
      const draftEvents = [
        ...goals.filter(goal => goal.scorer).map(goal => ({
          type: 'goal', player: goal.scorer, assist: goal.assist || null, minute: goal.minute, team: goal.team,
        })),
        ...fouls.filter(foul => foul.player).map(foul => ({
          type: 'foul', player: foul.player, card: foul.card, minute: foul.minute, team: foul.team,
        })),
      ]
      try {
        await completeMatch(null, { homeScore, awayScore, events: draftEvents, mvp, penaltyWinner: penaltyShootout?.winner })
      } catch (err) {
        console.error('Error saving career match:', err)
        setIsSaving(false)
        return
      }
    } else if (matchId) {
      // Build events array from goals, fouls, mvp
      const events = []
      goals.forEach(g => {
        if (g.scorer) {
          const club = g.team === 'home' ? homeClub : awayClub
          events.push({ player_id: g.scorer.id, club_id: club.id, event_type: 'goal', minute: g.minute })
        }
        if (g.assist) {
          const club = g.team === 'home' ? homeClub : awayClub
          events.push({ player_id: g.assist.id, club_id: club.id, event_type: 'assist', minute: g.minute })
        }
      })
      fouls.forEach(f => {
        const club = f.team === 'home' ? homeClub : awayClub
        events.push({
          player_id: f.player.id,
          club_id: club.id,
          event_type: f.card === 'yellow' ? 'yellow_card' : 'red_card',
          minute: f.minute,
        })
      })
      if (mvp) {
        // Determine mvp club
        const homeIds = homeSlots.filter(Boolean).map(p => p.id)
        const mvpClub = homeIds.includes(mvp.id) ? homeClub : awayClub
        events.push({ player_id: mvp.id, club_id: mvpClub.id, event_type: 'mvp', minute: null })
      }
      try {
        await completeMatch(matchId, {
          homeScore,
          awayScore,
          events,
          penaltyWinner: penaltyShootout?.winner ?? null,
          penaltyHomeScore: penaltyShootout?.home ?? null,
          penaltyAwayScore: penaltyShootout?.away ?? null,
        })
      } catch (err) {
        console.error('Error saving match:', err)
        setIsSaving(false)
        return
      }
    } else {
      setIsSaving(false)
    }
    setMvp(null)
    navigate(matchesPath, { state: { refresh: true } })
  }

  return (
    <div>
      {/* 🎉 Goal Confetti */}
      <GoalConfetti active={showConfetti} onDone={() => setShowConfetti(false)} />
      {/* Header — desktop: single row justify-between / mobile: 2 rows */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(matchesPath, { state: { refresh: true } })} className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <h1 className="font-heading font-bold text-3xl uppercase tracking-wide leading-none whitespace-nowrap">{matchTitle}</h1>
            </div>
          </div>
          {/* Desktop buttons (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors mr-1"
          >
            {isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
            )}
          </button>
          {phase !== 'full_time' && (
            <button
              onClick={() => setSimModal(true)}
              disabled={fastSimulating}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer mr-2 disabled:cursor-not-allowed disabled:opacity-80
                ${fastSimulating ? 'bg-[#FD5461] text-white font-black animate-pulse' : 'bg-red-50 text-[#FD5461] hover:bg-red-100 font-bold'}`}
            >
              {fastSimulating ? 'Simulating' : 'Sim'}
            </button>
          )}
          {!fastSimulating && (
            <>
              {(matchRunning || paused) && phase !== 'idle' && phase !== 'full_time' && (
                <button onClick={openFoulModal} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors">
                  Foul
                </button>
              )}
              {(matchRunning || paused) && phase !== 'idle' && phase !== 'full_time' && (
                <button onClick={openGoalModal} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors">
                  Goal
                </button>
              )}
              {matchRunning && (
                <button onClick={handlePause} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-heading font-black text-sm hover:bg-gray-200 transition-colors">
                  ⏸
                </button>
              )}
              {paused && (
                <button onClick={handleResume} disabled={!!redCardWarning}
                  className={`px-4 py-2.5 rounded-xl font-heading font-black text-sm transition-colors
                    ${redCardWarning ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  ▶
                </button>
              )}
              <button
                onClick={phase === 'full_time' ? (mvp ? handleSaveAndExit : undefined) : handleMainButton}
                disabled={(phase === 'full_time' && !mvp) || isSaving}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors
                  ${(phase === 'full_time' && !mvp) || isSaving ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-[#FD5461] text-white hover:bg-red-500 cursor-pointer'}`}
              >
                {phase === 'idle' && 'Start Match'}
                {phase === 'first_half' && 'End 1st Half'}
                {phase === 'half_time' && 'Start 2nd Half'}
                {phase === 'second_half' && 'End Match'}
                {phase === 'extra_time_ready' && 'Play Extra Time'}
                {phase === 'extra_time_first' && 'End ET 1st Half'}
                {phase === 'extra_time_half' && 'Start ET 2nd Half'}
                {phase === 'extra_time_second' && 'End Extra Time'}
                {phase === 'full_time' && (isSaving ? 'Saving...' : 'Save & Exit')}
              </button>
            </>
          )}
          </div>
        </div>
        {/* Mobile buttons (hidden on sm+) */}
        <div className="flex sm:hidden items-center gap-2 mt-4">
          {phase !== 'full_time' && (
            <button
              onClick={() => setSimModal(true)}
              disabled={fastSimulating}
              className={`px-4 py-2.5 rounded-xl font-heading font-black text-sm uppercase tracking-widest transition-colors cursor-pointer mr-auto disabled:cursor-not-allowed disabled:opacity-80
                ${fastSimulating ? 'bg-[#FD5461] text-white animate-pulse' : 'bg-red-50 text-[#FD5461] hover:bg-red-100'}`}
            >
              {fastSimulating ? 'Simulating' : 'Sim'}
            </button>
          )}
          {!fastSimulating && (
            <>
              {(matchRunning || paused) && phase !== 'idle' && phase !== 'full_time' && (
                <button onClick={openFoulModal} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors">
                  Foul
                </button>
              )}
              {(matchRunning || paused) && phase !== 'idle' && phase !== 'full_time' && (
                <button onClick={openGoalModal} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors">
                  Goal
                </button>
              )}
              {matchRunning && (
                <button onClick={handlePause} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-heading font-black text-sm hover:bg-gray-200 transition-colors">
                  ⏸
                </button>
              )}
              {paused && (
                <button onClick={handleResume} disabled={!!redCardWarning}
                  className={`px-4 py-2.5 rounded-xl font-heading font-black text-sm transition-colors
                    ${redCardWarning ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  ▶
                </button>
              )}
              <button
                onClick={phase === 'full_time' ? (mvp ? handleSaveAndExit : undefined) : handleMainButton}
                disabled={(phase === 'full_time' && !mvp) || isSaving}
                className={`px-5 py-2.5 rounded-xl font-heading font-black text-sm uppercase tracking-widest transition-colors
                  ${(phase === 'full_time' && !mvp) || isSaving ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-[#FD5461] text-white hover:bg-red-500 cursor-pointer'}`}
              >
                {phase === 'idle' && 'Start Match'}
                {phase === 'first_half' && 'End 1st Half'}
                {phase === 'half_time' && 'Start 2nd Half'}
                {phase === 'second_half' && 'End Match'}
                {phase === 'extra_time_ready' && 'Play Extra Time'}
                {phase === 'extra_time_first' && 'End ET 1st Half'}
                {phase === 'extra_time_half' && 'Start ET 2nd Half'}
                {phase === 'extra_time_second' && 'End Extra Time'}
                {phase === 'full_time' && (isSaving ? 'Saving...' : 'Save & Exit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Score Bar */}
      <div className="flex items-center bg-gray-50 rounded-2xl px-5 py-4 mb-3 gap-3">
        {/* Home badge + name */}
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 flex-1 min-w-0">
          {nationalMode ? (
            <div className="w-10 h-7 rounded overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-black/5 shadow-sm">
              <img 
                src={`https://flagcdn.com/${FIFA_NATIONS.find(n => n.name === homeClub.name)?.code || homeClub.short_name?.toLowerCase()}.svg`} 
                alt={homeClub.name} 
                className="w-full h-full object-cover" 
              />
            </div>
          ) : homeClub.id === '__allstars__' ? (
            <AllStarIcon size={40} badgeUrl={homeClub.badge_url} className="flex-shrink-0" />
          ) : (
            homeClub.badge_url ? (
              <img src={homeClub.badge_url} alt={homeClub.name} className="w-10 h-10 object-contain flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-heading font-black text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: homeClub.badge_color ?? "#6b7280" }}>{(homeClub.short_name || homeClub.name).slice(0, 3).toUpperCase()}</div>
            )
          )}
          <div className="font-semibold text-[#0A1318] min-w-0 text-center sm:text-left text-xs sm:text-base">
            <span className="hidden sm:inline truncate block">{homeClub.name}</span>
            <span className="sm:hidden font-heading font-black text-xs uppercase tracking-wider text-[#0A1318]">
              {homeClub.short_name || (homeClub.name || '').slice(0, 3).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Center: score · timer · score */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-3">
            <span className="font-heading font-black text-3xl text-[#0A1318] tabular-nums w-6 text-right">{homeScore}</span>
            <div className="flex flex-col items-center">
              <span className="font-heading font-black text-lg text-[#0A1318] tabular-nums leading-none">
                {formatTime(displayMatchSeconds)}
              </span>
            </div>
            <span className="font-heading font-black text-3xl text-[#0A1318] tabular-nums w-6 text-left">{awayScore}</span>
          </div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {(phase === 'idle' || phase === 'first_half') && '1st Half'}
            {phase === 'half_time' && 'Half Time'}
            {phase === 'second_half' && '2nd Half'}
            {phase === 'extra_time_ready' && 'Extra Time'}
            {phase === 'extra_time_first' && 'ET 1st Half'}
            {phase === 'extra_time_half' && 'ET Half Time'}
            {phase === 'extra_time_second' && 'ET 2nd Half'}
            {phase === 'full_time' && 'Full Time'}
          </div>
          {penaltyShootout && (
            <div className="mt-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#FD5461]">
              PEN {penaltyShootout.home}–{penaltyShootout.away}
            </div>
          )}
        </div>

        {/* Away name + badge */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-1 sm:gap-3 flex-1 min-w-0 justify-end">
          <div className="font-semibold text-[#0A1318] min-w-0 text-center sm:text-right text-xs sm:text-base">
            <span className="hidden sm:inline truncate block">{awayClub.name}</span>
            <span className="sm:hidden font-heading font-black text-xs uppercase tracking-wider text-[#0A1318]">
              {awayClub.short_name || (awayClub.name || '').slice(0, 3).toUpperCase()}
            </span>
          </div>
          {nationalMode ? (
            <div className="w-10 h-7 rounded overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-black/5 shadow-sm">
              <img 
                src={`https://flagcdn.com/${FIFA_NATIONS.find(n => n.name === awayClub.name)?.code || awayClub.short_name?.toLowerCase()}.svg`} 
                alt={awayClub.name} 
                className="w-full h-full object-cover" 
              />
            </div>
          ) : awayClub.id === '__allstars__' ? (
            <AllStarIcon size={40} badgeUrl={awayClub.badge_url} className="flex-shrink-0" />
          ) : (
            awayClub.badge_url ? (
              <img src={awayClub.badge_url} alt={awayClub.name} className="w-10 h-10 object-contain flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-heading font-black text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: awayClub.badge_color ?? "#6b7280" }}>{(awayClub.short_name || awayClub.name).slice(0, 3).toUpperCase()}</div>
            )
          )}
        </div>
      </div>

      <MatchEventFeed
        goals={goals}
        fouls={fouls}
        actions={matchActions}
        mvp={postMatchReady ? mvp : null}
        mvpTeam={homeSlots.some(player => player?.id === mvp?.id) ? 'home' : 'away'}
        phase={phase}
        homeClub={homeClub}
        awayClub={awayClub}
      />

      {/* Legacy split timeline retained temporarily for data migration, but no longer rendered. */}
      {false && (() => {
        const ICON = { goal: '⚽', yellow: '🟨', red: '🟥' }
        const allEvents = [
          ...goals.map(g => ({ type: 'goal', minute: g.minute, team: g.team, player: g.scorer, assist: g.assist })),
          ...fouls.map(f => ({ type: f.card, minute: f.minute, team: f.team, player: f.player })),
        ].sort((a, b) => a.minute - b.minute)
        const homeEvents = allEvents.filter(e => e.team === 'home')
        const awayEvents = allEvents.filter(e => e.team === 'away')

        function EventItem({ ev }) {
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-xs leading-none">{ICON[ev.type]}</span>
              <div className="min-w-0">
                <span className="font-heading font-bold text-xs text-[#0A1318]">{ev.player?.name ?? 'OG'}</span>
                {ev.assist && <span className="text-[10px] text-gray-400 ml-1">({ev.assist.name})</span>}
                <span className="text-[10px] font-heading font-black text-gray-400 tabular-nums ml-1">{ev.minute}'</span>
              </div>
            </div>
          )
        }

        return (
          <div className="mb-6">
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-2">Match Events</div>
            <div className="bg-gray-50 rounded-2xl px-4 py-3">
              <div className="grid grid-cols-2 gap-4">
                {/* Home column */}
                <div className="space-y-2">
                  <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-300 mb-1">{homeClub.short_name}</div>
                  {homeEvents.length === 0
                    ? <div className="text-[10px] font-heading text-gray-300">—</div>
                    : homeEvents.map((ev, i) => <EventItem key={i} ev={ev} />)
                  }
                </div>
                {/* Away column */}
                <div className="space-y-2">
                  <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-300 mb-1">{awayClub.short_name}</div>
                  {awayEvents.length === 0
                    ? <div className="text-[10px] font-heading text-gray-300">—</div>
                    : awayEvents.map((ev, i) => <EventItem key={i} ev={ev} />)
                  }
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MVP Banner — shown when full_time */}
      {phase === 'full_time' && postMatchReady && (() => {
        const mvpGoals   = mvp ? goals.filter(g => g.scorer?.id === mvp.id).length : 0
        const mvpAssists = mvp ? goals.filter(g => g.assist?.id === mvp.id).length : 0
        const mvpYellows = mvp ? fouls.filter(f => f.player?.id === mvp.id && f.card === 'yellow').length : 0
        const mvpReds    = mvp ? fouls.filter(f => f.player?.id === mvp.id && f.card === 'red').length : 0
        const tier = mvp ? getOVRTier(mvp.ovr) : null
        const mvpClub = mvp ? (homeSlots.some(p => p?.id === mvp.id) ? homeClub : awayClub) : null
        const flagCode = mvp ? FIFA_NATIONS.find(n => n.name === mvp.nationality)?.code : null

        return (
          <div className="mb-5 bg-red-50/80 border border-red-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xs">
            {mvp ? (
              <>
                {/* Leading OVR Badge */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0 ${TIER_STYLES[tier]}`}>
                  {mvp.ovr}
                </div>

                {/* Photo */}
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                  {mvp.photo_url
                    ? <img src={mvp.photo_url} alt={mvp.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-sm">{mvp.name.charAt(0)}</div>
                  }
                </div>

                {/* Name + Subtitle (Match MVP tag / Stats) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-semibold text-[#0A1318] truncate">{mvp.name}</span>
                    {mvpGoals > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-600">
                        <CircleDot size={13} className="text-[#0A1318] shrink-0" strokeWidth={2.5} />
                        <span>{mvpGoals}</span>
                      </span>
                    )}
                    {mvpAssists > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-600">
                        <Footprints size={13} className="text-gray-500 shrink-0" strokeWidth={2.25} />
                        <span>{mvpAssists}</span>
                      </span>
                    )}
                    {mvpYellows > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700">
                        <span className="h-3 w-2 rounded-[2px] bg-amber-400 shrink-0" />
                        <span>{mvpYellows}</span>
                      </span>
                    )}
                    {mvpReds > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600">
                        <span className="h-3 w-2 rounded-[2px] bg-red-500 shrink-0" />
                        <span>{mvpReds}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {mvpClub?.badge_url ? (
                      <img src={mvpClub.badge_url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                    ) : (
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm text-[5px] font-bold uppercase text-white" style={{ backgroundColor: mvpClub?.badge_color || '#0A1318' }}>
                        {(mvpClub?.short_name || mvpClub?.name || 'CLB').slice(0, 3)}
                      </span>
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#FD5461]">
                      Match MVP
                    </span>
                    {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-2.5 w-4 object-cover rounded-[2px] ring-1 ring-black/10 ml-0.5" alt="" />}
                  </div>
                </div>

                {/* Trailing Star Icon */}
                <div className="flex-shrink-0 ml-auto">
                  <Star size={20} className="fill-[#FD5461] text-[#FD5461]" strokeWidth={1.5} />
                </div>
              </>
            ) : (
              <>
                <Star size={18} className="text-[#FD5461] shrink-0" strokeWidth={2} />
                <span className="text-sm text-gray-600 font-heading font-bold flex-1">Tap a player to select MVP</span>
                <span className="text-[10px] font-heading font-black uppercase tracking-widest text-[#FD5461] flex-shrink-0">Required</span>
              </>
            )}
          </div>
        )
      })()}

      {/* Lineup */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">Loading lineups...</div>
      ) : (
        <>
          {/* Desktop: shared rows */}
          <div className="hidden sm:block">
            <SharedLineupDesktop
              homeClub={homeClub} awayClub={awayClub}
              homeSlots={homeSlots} setHomeSlots={setHomeSlots}
              awaySlots={awaySlots} setAwaySlots={setAwaySlots}
              goals={goals} fouls={fouls} suspendedIds={suspendedIds}
              onPlayerClick={phase === 'full_time' ? setMvp : setPlayerDetail}
            />
          </div>

          {/* Mobile: tabs with slide animation */}
          <div className="sm:hidden">
            <div className="flex gap-1 mb-4 border-b border-gray-200">
              {[{ key: 'home', label: homeClub.name }, { key: 'away', label: awayClub.name }].map(({ key, label }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex-1 px-5 py-2 text-sm font-heading font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors text-center
                    ${activeTab === key ? 'border-[#FD5461] text-[#FD5461]' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ transform: activeTab === 'home' ? 'translateX(0%)' : 'translateX(-50%)', width: '200%' }}
              >
                <div className="w-1/2 pr-3">
                  <LineupPanel club={homeClub} slots={homeSlots} setSlots={setHomeSlots} goals={goals} fouls={fouls} suspendedIds={suspendedIds} onPlayerClick={phase === 'full_time' ? setMvp : setPlayerDetail} />
                </div>
                <div className="w-1/2 pl-3">
                  <LineupPanel club={awayClub} slots={awaySlots} setSlots={setAwaySlots} goals={goals} fouls={fouls} suspendedIds={suspendedIds} onPlayerClick={phase === 'full_time' ? setMvp : setPlayerDetail} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Goal Modal */}
      {goalStep !== null && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="font-heading font-black text-base uppercase tracking-wide">
                  {goalStep === 'team' && 'Goal — Select Team'}
                  {goalStep === 'scorer' && 'Select Scorer'}
                  {goalStep === 'assist' && 'Select Assist'}
                </div>
                <div className="text-xs text-gray-400 font-heading font-bold mt-0.5">Min. {goalMinute}'</div>
              </div>
              <button onClick={() => setGoalStep(null)} className="text-gray-300 hover:text-gray-500 text-xl font-bold">✕</button>
            </div>

            <div className="px-5 py-4 space-y-2 max-h-80 overflow-y-auto">
              {/* Step 1: Team */}
              {goalStep === 'team' && [
                { key: 'home', club: homeClub },
                { key: 'away', club: awayClub },
              ].map(({ key, club }) => (
                <button key={key} onClick={() => { setGoalTeam(key); setGoalStep('scorer') }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-red-50 transition-colors text-left">
                  {nationalMode ? (
                    <div className="w-10 h-7 rounded overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-black/5 shadow-sm">
                      <img 
                        src={`https://flagcdn.com/${FIFA_NATIONS.find(n => n.name === club.name)?.code || club.short_name?.toLowerCase()}.svg`} 
                        alt={club.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  ) : (
                    club.badge_url ? (
                      <img src={club.badge_url} alt={club.name} className="w-9 h-9 object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0" style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>{club.short_name}</div>
                    )
                  )}
                  <span className="font-heading font-black text-sm uppercase tracking-wide text-[#0A1318]">{club.name}</span>
                </button>
              ))}

              {/* Step 2: Scorer */}
              {goalStep === 'scorer' && goalPlayers.map(player => {
                const scored = goals.filter(g => g.scorer?.id === player.id).length
                const assisted = goals.filter(g => g.assist?.id === player.id).length
                return (
                  <button key={player.id} onClick={() => { setGoalScorer(player); setGoalStep('assist') }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-red-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                      {player.photo_url
                        ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-xs">{player.name.charAt(0)}</div>
                      }
                    </div>
                    <span className="font-heading font-bold text-sm text-[#0A1318] flex-1 truncate">{player.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {scored > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          <CircleDot size={12} className="text-[#0A1318] shrink-0" strokeWidth={2.5} />
                          <span>{scored}</span>
                        </span>
                      )}
                      {assisted > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          <Footprints size={12} className="text-gray-600 shrink-0" strokeWidth={2.25} />
                          <span>{assisted}</span>
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* Step 3: Assist */}
              {goalStep === 'assist' && (
                <>
                  {goalPlayers.filter(p => p.id !== goalScorer?.id).map(player => {
                    const scored = goals.filter(g => g.scorer?.id === player.id).length
                    const assisted = goals.filter(g => g.assist?.id === player.id).length
                    return (
                      <button key={player.id} onClick={() => confirmGoal(player)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-red-50 transition-colors text-left">
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                          {player.photo_url
                            ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-xs">{player.name.charAt(0)}</div>
                          }
                        </div>
                        <span className="font-heading font-bold text-sm text-[#0A1318] flex-1 truncate">{player.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {scored > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                              <CircleDot size={12} className="text-[#0A1318] shrink-0" strokeWidth={2.5} />
                              <span>{scored}</span>
                            </span>
                          )}
                          {assisted > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                              <Footprints size={12} className="text-gray-600 shrink-0" strokeWidth={2.25} />
                              <span>{assisted}</span>
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </div>

            {goalStep !== 'team' && (
              <div className="px-5 pb-4">
                <button onClick={() => setGoalStep(goalStep === 'assist' ? 'scorer' : 'team')}
                  className="text-xs font-heading font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider">
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <PlayerDetailModal player={playerDetail} onClose={() => setPlayerDetail(null)} />

      {/* Simulation Modal */}
      {simModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-black text-2xl uppercase tracking-wide">Match Simulator</h2>
                <button onClick={() => { setSimModal(false); setSimPreview(null) }} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </button>
              </div>

              {!simPreview ? (
                <div className="space-y-4">
                  <p className="text-gray-500 text-sm">Select how you want to simulate the remaining match time.</p>
                  <div className="grid grid-cols-1 gap-3">
                    {['extra_time_ready', 'extra_time_first'].includes(phase) && (
                      <button
                        onClick={() => handleSimAction('extra_half')}
                        className="w-full cursor-pointer rounded-2xl border-2 border-transparent bg-gray-50 py-4 font-heading text-sm font-black uppercase tracking-widest text-gray-900 transition-all hover:border-gray-200 hover:bg-gray-100"
                      >
                        Simulate until ET Half-time
                      </button>
                    )}
                    {['extra_time_ready', 'extra_time_first', 'extra_time_half', 'extra_time_second'].includes(phase) && (
                      <button
                        onClick={() => handleSimAction('extra_full')}
                        className="w-full cursor-pointer rounded-2xl bg-[#0A1318] py-4 font-heading text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-gray-800"
                      >
                        Simulate until 120 minutes
                      </button>
                    )}
                    {(phase === 'idle' || phase === 'first_half') && (
                      <button 
                        onClick={() => handleSimAction('half')}
                        className="w-full py-4 rounded-2xl bg-gray-50 text-gray-900 font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-100 transition-all border-2 border-transparent hover:border-gray-200 cursor-pointer"
                      >
                        Simulate until Half-time
                      </button>
                    )}
                    {!['extra_time_ready', 'extra_time_first', 'extra_time_half', 'extra_time_second'].includes(phase) && <button
                      onClick={() => handleSimAction('full')}
                      className="w-full py-4 rounded-2xl bg-[#0A1318] text-white font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-all cursor-pointer"
                    >
                      Simulate until Full-time
                    </button>}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Result Preview */}
                  <div className="bg-gray-50 rounded-2xl p-5 flex flex-col items-center">
                    <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-4">Simulated Result</span>
                    <div className="flex items-center gap-8 mb-6">
                      <div className="flex flex-col items-center gap-2">
                        <div className="font-heading font-black text-5xl text-[#0A1318]">{simPreview.hScore}</div>
                        <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-gray-400">{homeClub.short_name}</span>
                      </div>
                      <div className="text-2xl font-heading font-black text-gray-200">VS</div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="font-heading font-black text-5xl text-[#0A1318]">{simPreview.aScore}</div>
                        <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-gray-400">{awayClub.short_name}</span>
                      </div>
                    </div>

                    {/* Event Summary Preview */}
                    <div className="w-full grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      <div className="space-y-1.5">
                        {simPreview.newGoals.filter(g => g.team === 'home').map((g, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px]">
                            <CircleDot size={12} className="text-[#0A1318] shrink-0" strokeWidth={2.5} />
                            <div className="flex flex-col min-w-0">
                              <span className="font-heading font-bold text-[#0A1318] truncate">{g.scorer?.name}</span>
                              {g.assist && <span className="text-[8px] text-gray-400 truncate -mt-0.5">({g.assist.name})</span>}
                            </div>
                            <span className="text-gray-400 font-bold ml-auto">{g.minute}'</span>
                          </div>
                        ))}
                        {simPreview.newFouls.filter(f => f.team === 'home').map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px]">
                            <span className={`h-3 w-2 rounded-[2px] shrink-0 ${f.card === 'red' ? 'bg-red-500' : 'bg-amber-400'}`} />
                            <span className="font-heading font-bold text-[#0A1318] truncate">{f.player?.name}</span>
                            <span className="text-gray-400 font-bold ml-auto">{f.minute}'</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {simPreview.newGoals.filter(g => g.team === 'away').map((g, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] justify-end text-right">
                            <span className="text-gray-400 font-bold mr-auto">{g.minute}'</span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-heading font-bold text-[#0A1318] truncate">{g.scorer?.name}</span>
                              {g.assist && <span className="text-[8px] text-gray-400 truncate -mt-0.5">({g.assist.name})</span>}
                            </div>
                            <CircleDot size={12} className="text-[#0A1318] shrink-0" strokeWidth={2.5} />
                          </div>
                        ))}
                        {simPreview.newFouls.filter(f => f.team === 'away').map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] justify-end text-right">
                            <span className="text-gray-400 font-bold mr-auto">{f.minute}'</span>
                            <span className="font-heading font-bold text-[#0A1318] truncate">{f.player?.name}</span>
                            <span className={`h-3 w-2 rounded-[2px] shrink-0 ${f.card === 'red' ? 'bg-red-500' : 'bg-amber-400'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleSimAction(simPreview.targetPhase === 'half_time' ? 'half' : 'full')}
                      className="py-4 rounded-2xl bg-gray-100 text-gray-900 font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      Simulate Again
                    </button>
                    <button 
                      onClick={() => {
                        clearInterval(timerRef.current)
                        setHomeScore(simPreview.hScore)
                        setAwayScore(simPreview.aScore)
                        setGoals(simPreview.newGoals)
                        setFouls(simPreview.newFouls)
                        setPhase(simPreview.targetPhase)
                        setElapsed(simPreview.targetElapsed)
                        if (simPreview.targetPhase === 'full_time') {
                          setPostMatchReady(false)
                          setMvp(null)
                        }
                        showNotification(
                          simPreview.targetPhase === 'full_time' ? 'FULL TIME' : 'HALF TIME',
                          simPreview.targetPhase === 'full_time' ? () => setPostMatchReady(true) : undefined,
                        )
                      }}
                      className="py-4 rounded-2xl bg-[#FD5461] text-white font-heading font-black text-sm uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-200 cursor-pointer"
                    >
                      Apply Result
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Foul Modal */}
      {foulStep !== null && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="font-heading font-black text-base uppercase tracking-wide">
                  {foulStep === 'player' && 'Foul — Select Player'}
                  {foulStep === 'card' && 'Select Card'}
                </div>
                <div className="text-xs text-gray-400 font-heading font-bold mt-0.5">Min. {goalMinute}'</div>
              </div>
              <button onClick={() => setFoulStep(null)} className="text-gray-300 hover:text-gray-500 text-xl font-bold">✕</button>
            </div>

            {foulStep === 'player' && fouls.length > 0 && (
              <div className="px-5 pt-3 pb-0">
                <button onClick={undoLastFoul}
                  className="flex items-center gap-1.5 text-xs font-heading font-bold text-gray-400 hover:text-[#FD5461] transition-colors uppercase tracking-widest">
                  ↩ Undo Last Foul
                </button>
              </div>
            )}

            <div className="px-5 py-4 space-y-2 max-h-80 overflow-y-auto">
              {foulStep === 'player' && (() => {
                const homeGroup = homeSlots.filter(Boolean)
                const awayGroup = awaySlots.filter(Boolean)
                return (
                  <>
                    {/* Home team */}
                    <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-1">{homeClub.name}</div>
                    {homeGroup.map(player => {
                      const yellows = fouls.filter(f => f.player.id === player.id && f.card === 'yellow').length
                      const reds = fouls.filter(f => f.player.id === player.id && f.card === 'red').length
                      return (
                        <button key={player.id} onClick={() => { setFoulPlayer(player); setFoulPlayerTeam('home'); setFoulStep('card') }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-red-50 transition-colors text-left">
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                            {player.photo_url
                              ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-xs">{player.name.charAt(0)}</div>
                            }
                          </div>
                          <span className="font-heading font-bold text-sm text-[#0A1318] flex-1 truncate">{player.name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {yellows > 0 && <span className="text-xs font-heading font-bold">🟨 {yellows}</span>}
                            {reds > 0 && <span className="text-xs font-heading font-bold">🟥 {reds}</span>}
                          </div>
                        </button>
                      )
                    })}
                    {/* Away team */}
                    <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mt-3 mb-1">{awayClub.name}</div>
                    {awayGroup.map(player => {
                      const yellows = fouls.filter(f => f.player.id === player.id && f.card === 'yellow').length
                      const reds = fouls.filter(f => f.player.id === player.id && f.card === 'red').length
                      return (
                        <button key={player.id} onClick={() => { setFoulPlayer(player); setFoulPlayerTeam('away'); setFoulStep('card') }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-red-50 transition-colors text-left">
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                            {player.photo_url
                              ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-xs">{player.name.charAt(0)}</div>
                            }
                          </div>
                          <span className="font-heading font-bold text-sm text-[#0A1318] flex-1 truncate">{player.name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {yellows > 0 && <span className="text-xs font-heading font-bold">🟨 {yellows}</span>}
                            {reds > 0 && <span className="text-xs font-heading font-bold">🟥 {reds}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </>
                )
              })()}

              {foulStep === 'card' && foulPlayer && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                      {foulPlayer.photo_url
                        ? <img src={foulPlayer.photo_url} alt={foulPlayer.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-xs">{foulPlayer.name.charAt(0)}</div>
                      }
                    </div>
                    <span className="font-heading font-bold text-sm text-[#0A1318]">{foulPlayer.name}</span>
                  </div>
                  <button onClick={() => confirmFoul('yellow')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-yellow-50 hover:bg-yellow-100 transition-colors text-left">
                    <span className="text-2xl">🟨</span>
                    <span className="font-heading font-black text-sm uppercase tracking-wide text-yellow-700">Yellow Card</span>
                  </button>
                  <button onClick={() => confirmFoul('red')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 hover:bg-red-100 transition-colors text-left">
                    <span className="text-2xl">🟥</span>
                    <span className="font-heading font-black text-sm uppercase tracking-wide text-red-700">Red Card</span>
                  </button>
                </div>
              )}
            </div>

            {foulStep === 'card' && (
              <div className="px-5 pb-4">
                <button onClick={() => setFoulStep('player')} className="text-xs font-heading font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider">
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Red card warning banner */}
      {redCardWarning && (
        <div className="fixed bottom-6 inset-x-0 z-[90] flex justify-center px-4"
          style={{ animation: 'slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
          <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100">
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
                  {redCardWarning.photo_url
                    ? <img src={redCardWarning.photo_url} alt={redCardWarning.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-sm">{redCardWarning.name.charAt(0)}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-black text-base text-[#0A1318] truncate">{redCardWarning.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm">🟥</span>
                    <span className="text-xs font-heading font-black uppercase tracking-widest text-[#FD5461]">Red Card</span>
                    <span className="text-xs text-gray-400 font-heading font-bold">· Min. {redCardMinute}'</span>
                  </div>
                </div>
                <button onClick={() => { setRedCardWarning(null); setRedCardMinute(null) }} className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0">✕</button>
              </div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Substitute this player before resuming — drag a bench player to replace the starter.
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Half/Full time notification overlay */}
      {notification !== null && createPortal(
        <div className="fixed inset-0 bg-[#0A1318]/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div style={{ animation: 'countdownPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
            <span className="font-heading font-black text-white text-6xl uppercase tracking-widest drop-shadow-lg">
              {notification}
            </span>
          </div>
        </div>,
        document.body
      )}

      {/* Countdown overlay */}
      {countdown !== null && createPortal(
        <div className="fixed inset-0 bg-[#0A1318]/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div
            key={String(countdown)}
            style={{ animation: 'countdownPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}
          >
            <span className={`font-heading font-black text-white leading-none drop-shadow-lg
              ${countdown === 'KICK OFF!' ? 'text-5xl text-[#FD5461]' : 'text-[120px]'}`}>
              {countdown}
            </span>
          </div>
        </div>,
        document.body
      )}

      {/* Audio Elements */}
      <audio ref={anthemRef} src="/Inazuma11 OST 1 - Holy Ground (Anime ver.).mp3" preload="auto" loop />
      <audio ref={crowdRef} src="/audio/crowd.mp3" preload="auto" loop />

      <style>{`
        @keyframes countdownPop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes slideUp {
          0%   { transform: translateY(120%); opacity: 0; }
          100% { transform: translateY(0%);   opacity: 1; }
        }
        @keyframes fadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes tickerSlideIn {
          0%   { transform: translateX(20px) scale(0.85); opacity: 0; }
          60%  { transform: translateX(-3px) scale(1.05); opacity: 1; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
