import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchPlayers } from '../services/players'
import { completeMatch as completeMatchFriendly } from '../services/friendlyMatches'
import { completeMatch as completeMatchWC } from '../services/worldCup'
import { completeLeagueMatch } from '../services/league'
import { getOVRTier } from '../utils/stats'
import { FIFA_NATIONS } from '../utils/fifaNations'
import PlayerCard from '../components/ui/PlayerCard'
import ScrollToTop from '../components/ui/ScrollToTop'

const TIER_STYLES = {
  special: 'bg-[#FD5461] text-white',
  gold:    'bg-[#0A1318] text-white',
  silver:  'bg-gray-600 text-white',
  bronze:  'bg-gray-400 text-white',
}

const POS_COLORS = { GK: '#f59e0b', DEF: '#3b82f6', MF: '#22c55e', FWD: '#FD5461' }
const POS_LABEL  = { GK: 'GK', DEF: 'DF', MF: 'MF', FWD: 'FW' }

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
      <span className="text-[8px] font-heading font-black text-white leading-none">C</span>
    </span>
  )
}

function PlayerRow({ player, isDragging, isOver, canDrop, onPointerDown, isCaptain, stats, isSuspended }) {
  const tier = getOVRTier(player.ovr)
  const flagCode = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
  const { goals = 0, assists = 0, yellows = 0, reds = 0 } = stats ?? {}
  const hasStats = goals > 0 || assists > 0 || yellows > 0 || reds > 0

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-100 min-h-[52px]
        ${isDragging ? 'opacity-20' : ''}
        ${isSuspended ? 'opacity-50' : ''}
        ${isOver && canDrop ? 'border-[#FD5461] bg-red-50' : 'border-gray-100 bg-white hover:border-gray-200'}
        ${isOver && !canDrop ? 'border-red-300 bg-red-50' : ''}`}
    >
      {/* Drag Handle */}
      <div 
        onPointerDown={onPointerDown}
        className="flex-shrink-0 text-gray-300 cursor-grab active:cursor-grabbing p-1 -ml-1 hover:text-gray-400 transition-colors touch-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
        </svg>
      </div>
      {/* Photo */}
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        {player.photo_url
          ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-sm">{player.name.charAt(0)}</div>
        }
      </div>

      {/* Name + flag */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-heading font-bold text-sm text-[#0A1318] truncate">{player.name}</span>
          {isCaptain && <CaptainBadge />}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-2.5 w-4 object-cover rounded-[2px] ring-1 ring-black/10" alt="" />}
          <span className="text-[10px] font-heading font-bold uppercase tracking-wider" style={{ color: POS_COLORS[player.position] ?? '#6b7280' }}>
            {POS_LABEL[player.position] ?? player.position}
          </span>
        </div>
      </div>

      {/* Stats + OVR */}
      {hasStats && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {goals > 0 && <span className="text-[10px] font-heading font-bold text-gray-500">⚽{goals}</span>}
          {assists > 0 && <span className="text-[10px] font-heading font-bold text-gray-500">👟{assists}</span>}
          {yellows > 0 && <span className="text-[10px]">🟨{yellows}</span>}
          {reds > 0 && <span className="text-[10px]">🟥{reds}</span>}
        </div>
      )}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-heading font-black text-sm flex-shrink-0 ${TIER_STYLES[tier]}`}>
        {player.ovr}
      </div>
    </div>
  )
}

function EmptyRow({ isOver, canDrop }) {
  return (
    <div className={`flex items-center justify-center px-3 py-2.5 rounded-xl border-2 border-dashed transition-colors min-h-[52px]
      ${isOver && canDrop ? 'border-[#FD5461] bg-red-50' : 'border-gray-200'}
      ${isOver && !canDrop ? 'border-red-300' : ''}`}
    >
      <span className="text-xs font-heading font-bold uppercase tracking-widest text-gray-300">Empty</span>
    </div>
  )
}

function useDrag(setSlots, suspendedIds = new Set(), onTap = null) {
  const dragRef = useRef({ active: false, fromIdx: null, startX: 0, startY: 0, cachedRects: null })
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

  return { slotRefs, activeDragIdx, dragOver, handlePointerDown }
}

function SlotCell({ player, idx, activeDragIdx, dragOver, slotRefs, handlePointerDown, goals, fouls, suspendedIds }) {
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
    <div ref={el => { slotRefs.current[idx] = el }}>
      {player
        ? <PlayerRow player={player} isDragging={isDragging} isOver={isOver} canDrop={canDrop}
            onPointerDown={e => handlePointerDown(idx, e)} isCaptain={idx === 0} stats={stats} isSuspended={isSuspended} />
        : <EmptyRow isOver={isOver} canDrop={canDrop} />
      }
    </div>
  )
}

// Desktop: shared rows so both columns align perfectly
function SharedLineupDesktop({ homeClub, awayClub, homeSlots, setHomeSlots, awaySlots, setAwaySlots, goals, fouls, suspendedIds, onPlayerClick }) {
  const home = useDrag(setHomeSlots, suspendedIds, (idx) => { const p = homeSlots[idx]; if (p) onPlayerClick(p) })
  const away = useDrag(setAwaySlots, suspendedIds, (idx) => { const p = awaySlots[idx]; if (p) onPlayerClick(p) })

  const homeStarters = homeSlots.slice(0, 5).filter(Boolean).length
  const awayStarters = awaySlots.slice(0, 5).filter(Boolean).length

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400">Starting 5</span>
          <span className="text-[10px] text-gray-300">{homeStarters}/5</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400">Starting 5</span>
          <span className="text-[10px] text-gray-300">{awayStarters}/5</span>
        </div>
      </div>

      {/* Starter rows */}
      <div className="space-y-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="grid grid-cols-2 gap-4">
            <SlotCell player={homeSlots[i]} idx={i} {...home} goals={goals} fouls={fouls} suspendedIds={suspendedIds} />
            <SlotCell player={awaySlots[i]} idx={i} {...away} goals={goals} fouls={fouls} suspendedIds={suspendedIds} />
          </div>
        ))}
      </div>

      {/* Subs divider */}
      <div className="grid grid-cols-2 gap-4 my-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-300">Subs · {homeSlots.slice(5).filter(Boolean).length}/7</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-300">Subs · {awaySlots.slice(5).filter(Boolean).length}/7</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      </div>

      {/* Sub rows */}
      <div className="space-y-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const idx = i + 5
          return (
            <div key={idx} className="grid grid-cols-2 gap-4">
              <SlotCell player={homeSlots[idx]} idx={idx} {...home} goals={goals} fouls={fouls} suspendedIds={suspendedIds} />
              <SlotCell player={awaySlots[idx]} idx={idx} {...away} goals={goals} fouls={fouls} suspendedIds={suspendedIds} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Mobile: tab + slide
function LineupPanel({ club, slots, setSlots, goals, fouls, suspendedIds, onPlayerClick }) {
  const { slotRefs, activeDragIdx, dragOver, handlePointerDown } = useDrag(setSlots, suspendedIds, (idx) => { const p = slots[idx]; if (p) onPlayerClick(p) })
  const starters = slots.slice(0, 5)
  const subs = slots.slice(5)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400">Starting 5</span>
          <span className="text-[10px] text-gray-300">{starters.filter(Boolean).length}/5</span>
        </div>
        <div className="space-y-1.5">
          {starters.map((player, i) => (
            <SlotCell key={i} player={player} idx={i} slotRefs={slotRefs} activeDragIdx={activeDragIdx} dragOver={dragOver} handlePointerDown={handlePointerDown} goals={goals} fouls={fouls} suspendedIds={suspendedIds} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-300">Subs · {subs.filter(Boolean).length}/7</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <div className="space-y-1.5">
        {subs.map((player, i) => (
          <SlotCell key={i + 5} player={player} idx={i + 5} slotRefs={slotRefs} activeDragIdx={activeDragIdx} dragOver={dragOver} handlePointerDown={handlePointerDown} goals={goals} fouls={fouls} suspendedIds={suspendedIds} />
        ))}
      </div>
    </div>
  )
}

function PlayerDetailModal({ player, onClose }) {
  if (!player) return null
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
    </div>
  )
}

export default function PreMatchPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { matchId } = useParams()
  // Support both URL param and legacy location.state
  const { homeClub, awayClub, duration, returnPath, nationalMode, allStarsTeamIds } = location.state ?? {}
  const isTournament = location.pathname.includes('/world-cup/') || location.pathname.includes('/club-cup/')
  const isLeague = location.pathname.includes('/league/')
  const completeMatch = isLeague ? completeLeagueMatch : (isTournament ? completeMatchWC : completeMatchFriendly)
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
  // goal modal: step = null | 'team' | 'scorer' | 'assist'
  const [goalStep, setGoalStep] = useState(null)
  const [goalTeam, setGoalTeam] = useState(null) // 'home' | 'away'
  const [goalScorer, setGoalScorer] = useState(null)
  const [goals, setGoals] = useState([])
  const [foulStep, setFoulStep] = useState(null) // null | 'player' | 'card'
  const [foulPlayer, setFoulPlayer] = useState(null)
  const [foulPlayerTeam, setFoulPlayerTeam] = useState(null)
  const [fouls, setFouls] = useState([])
  const [redCardWarning, setRedCardWarning] = useState(null) // { player, minute }
  const [redCardMinute, setRedCardMinute] = useState(null)
  const [playerDetail, setPlayerDetail] = useState(null)
  const [mvp, setMvp] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const anthemRef = useRef(null)
  const crowdRef = useRef(null)
  const whistleRef = useRef(null)
  const [simModal, setSimModal] = useState(false)
  const [simPreview, setSimPreview] = useState(null)

  function simulateSegment(startSec, endSec, currentHomeScore, currentAwayScore, currentGoals, currentFouls) {
    const homeOvr = homeSlots.slice(0, 5).reduce((sum, p) => sum + (p?.ovr || 0), 0) / 5
    const awayOvr = awaySlots.slice(0, 5).reduce((sum, p) => sum + (p?.ovr || 0), 0) / 5
    
    let hScore = currentHomeScore
    let aScore = currentAwayScore
    const newGoals = [...currentGoals]
    const newFouls = [...currentFouls]

    const POS_WEIGHTS = { FWD: 10, MF: 5, DEF: 2, GK: 0.05 }
    const ASSIST_WEIGHTS = { MF: 10, FWD: 6, DEF: 5, GK: 1 }

    function pickWeightedPlayer(lineup, weights) {
      const filtered = lineup.filter(Boolean)
      if (filtered.length === 0) return null
      const totalWeight = filtered.reduce((sum, p) => sum + (weights[p.position] || 1), 0)
      let rand = Math.random() * totalWeight
      for (const p of filtered) {
        const w = weights[p.position] || 1
        if (rand < w) return p
        rand -= w
      }
      return filtered[0]
    }
    
    for (let s = startSec; s < endSec; s += 30) {
      const matchMin = Math.floor(s / 60) || 1
      const pHome = (homeOvr / 100) * 0.12 * (homeOvr / awayOvr)
      const pAway = (awayOvr / 100) * 0.12 * (awayOvr / homeOvr)
      
      if (Math.random() < pHome) {
        hScore++
        const starters = homeSlots.slice(0, 5)
        const scorer = pickWeightedPlayer(starters, POS_WEIGHTS)
        const assist = Math.random() > 0.4 ? pickWeightedPlayer(starters.filter(p => p?.id !== scorer?.id), ASSIST_WEIGHTS) : null
        newGoals.push({ team: 'home', scorer, assist, minute: matchMin })
      }
      if (Math.random() < pAway) {
        aScore++
        const starters = awaySlots.slice(0, 5)
        const scorer = pickWeightedPlayer(starters, POS_WEIGHTS)
        const assist = Math.random() > 0.4 ? pickWeightedPlayer(starters.filter(p => p?.id !== scorer?.id), ASSIST_WEIGHTS) : null
        newGoals.push({ team: 'away', scorer, assist, minute: matchMin })
      }
      if (Math.random() < 0.04) {
        const team = Math.random() > 0.5 ? 'home' : 'away'
        const lineup = (team === 'home' ? homeSlots : awaySlots).slice(0, 5).filter(Boolean)
        const player = lineup[Math.floor(Math.random() * lineup.length)]
        if (player) {
          const card = Math.random() > 0.85 ? 'red' : 'yellow'
          const fPhase = s < halfSeconds ? 'first_half' : 'second_half'
          newFouls.push({ player, team, card, minute: matchMin, phase: fPhase })
        }
      }
    }
    return { hScore, aScore, newGoals, newFouls }
  }

  function handleSimAction(target) {
    let targetPhase = 'full_time'
    let targetElapsed = totalSeconds
    if (target === 'half') {
      targetPhase = 'half_time'
      targetElapsed = halfSeconds
    }
    const result = simulateSegment(elapsed, targetElapsed, homeScore, awayScore, goals, fouls)
    setSimPreview({ ...result, targetPhase, targetElapsed })
  }
  const timerRef = useRef(null)
  const countdownRef = useRef(null)

  const totalSeconds = (duration ?? 10) * 60
  const halfSeconds = totalSeconds / 2

  function showNotification(text) {
    setNotification(text)
    setTimeout(() => setNotification(null), 2200)
  }

  function runTimer(stopAt, onEnd) {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= stopAt) {
          clearInterval(timerRef.current)
          onEnd?.()
          return stopAt
        }
        return prev + 1
      })
    }, 1000)
  }

  function startWithCountdown(nextPhase, timerStopAt, onTimerEnd) {
    setCountdown(3)
    let count = 3
    countdownRef.current = setInterval(() => {
      count -= 1
      if (count === 0) {
        setCountdown('KICK OFF!')
        whistleRef.current?.play().catch(() => {})
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
    showNotification('HALF TIME')
  }

  function endMatch() {
    clearInterval(timerRef.current)
    setElapsed(totalSeconds)
    setPhase('full_time')
    showNotification('FULL TIME')
  }

  function handleMainButton() {
    setPaused(false)
    if (phase === 'idle') {
      setElapsed(0); setHomeScore(0); setAwayScore(0)
      anthemRef.current?.play().catch(() => {})
      crowdRef.current?.play().catch(() => {})
      startWithCountdown('first_half', halfSeconds, endFirstHalf)
    } else if (phase === 'first_half') {
      endFirstHalf()
    } else if (phase === 'half_time') {
      startWithCountdown('second_half', totalSeconds, endMatch)
    } else if (phase === 'second_half') {
      endMatch()
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
    const stopAt = phase === 'first_half' ? halfSeconds : totalSeconds
    const onEnd = phase === 'first_half' ? endFirstHalf : endMatch
    runTimer(stopAt, onEnd)
  }

  const matchRunning = (phase === 'first_half' || phase === 'second_half') && !paused

  const goalMinute = Math.max(1, Math.floor(elapsed / 60))

  function openGoalModal() {
    setGoalStep('team')
    setGoalTeam(null)
    setGoalScorer(null)
  }

  function confirmGoal(assist) {
    const minute = goalMinute
    setGoals(prev => [...prev, { team: goalTeam, scorer: goalScorer, assist, minute }])
    if (goalTeam === 'home') setHomeScore(s => s + 1)
    else setAwayScore(s => s + 1)
    setGoalStep(null)
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
    const audios = [anthemRef.current, crowdRef.current, whistleRef.current]
    audios.forEach(a => {
      if (a) {
        if (a === crowdRef.current) a.volume = isMuted ? 0 : 0.2
        else if (a === whistleRef.current) a.volume = isMuted ? 0 : 0.6
        else a.volume = isMuted ? 0 : 0.5
      }
    })
  }, [isMuted])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(countdownRef.current)
      // Stop all audio on unmount
      const audios = [anthemRef.current, crowdRef.current, whistleRef.current]
      audios.forEach(a => {
        if (a) {
          a.pause()
          a.currentTime = 0
        }
      })
    }
  }, [])

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  useEffect(() => {
    if (!homeClub || !awayClub) { navigate(matchesPath); return }
    const awayFetch = allStarsTeamIds
      ? Promise.all(allStarsTeamIds.map(id => fetchPlayers({ clubId: id }))).then(arrs => arrs.flat())
      : fetchPlayers(nationalMode ? { nationality: awayClub.name } : { clubId: awayClub.id })
    Promise.all([
      fetchPlayers(nationalMode ? { nationality: homeClub.name } : { clubId: homeClub.id }),
      awayFetch,
    ]).then(([homePlayers, awayPlayers]) => {
      const makeSlots = (players, uncapped = false) => {
        const orderKey = nationalMode ? 'national_roster_order' : 'roster_order'
        const sorted = [...players].sort((a, b) => {
          const aHasOrder = a[orderKey] != null
          const bHasOrder = b[orderKey] != null
          if (aHasOrder && bHasOrder) return a[orderKey] - b[orderKey]
          if (aHasOrder) return -1
          if (bHasOrder) return 1
          return b.ovr - a.ovr
        })
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
    if (!mvp) return
    if (matchId) {
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
        await completeMatch(matchId, { homeScore, awayScore, events })
      } catch (err) {
        console.error('Error saving match:', err)
      }
    }
    setMvp(null)
    navigate(matchesPath, { state: { refresh: true } })
  }

  return (
    <div>
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
              <h1 className="font-heading font-black text-2xl uppercase tracking-wide leading-none whitespace-nowrap">Friendly Match</h1>
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
              className="px-4 py-2.5 rounded-xl bg-amber-50 text-amber-600 font-heading font-black text-sm uppercase tracking-widest hover:bg-amber-100 transition-colors cursor-pointer mr-2"
            >
              Sim
            </button>
          )}
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
            disabled={phase === 'full_time' && !mvp}
            className={`px-5 py-2.5 rounded-xl font-heading font-black text-sm uppercase tracking-widest transition-colors
              ${phase === 'full_time' && !mvp ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : 'bg-[#FD5461] text-white hover:bg-red-500 cursor-pointer'}`}
          >
            {phase === 'idle' && 'Start Match'}
            {phase === 'first_half' && 'End 1st Half'}
            {phase === 'half_time' && 'Start 2nd Half'}
            {phase === 'second_half' && 'End Match'}
            {phase === 'full_time' && 'Save & Exit'}
          </button>
          </div>
        </div>
        {/* Mobile buttons (hidden on sm+) */}
        <div className="flex sm:hidden items-center gap-2 mt-4">
          {phase !== 'full_time' && (
            <button
              onClick={() => setSimModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-50 text-amber-600 font-heading font-black text-sm uppercase tracking-widest hover:bg-amber-100 transition-colors cursor-pointer mr-auto"
            >
              Sim
            </button>
          )}
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
            disabled={phase === 'full_time' && !mvp}
            className={`px-5 py-2.5 rounded-xl font-heading font-black text-sm uppercase tracking-widest transition-colors
              ${phase === 'full_time' && !mvp ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : 'bg-[#FD5461] text-white hover:bg-red-500 cursor-pointer'}`}
          >
            {phase === 'idle' && 'Start Match'}
            {phase === 'first_half' && 'End 1st Half'}
            {phase === 'half_time' && 'Start 2nd Half'}
            {phase === 'second_half' && 'End Match'}
            {phase === 'full_time' && 'Save & Exit'}
          </button>
        </div>
      </div>

      {/* Score Bar */}
      <div className="flex items-center bg-gray-50 rounded-2xl px-5 py-4 mb-6 gap-3">
        {/* Home badge + name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {nationalMode ? (
            <div className="w-10 h-7 rounded overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-black/5 shadow-sm">
              <img 
                src={`https://flagcdn.com/${FIFA_NATIONS.find(n => n.name === homeClub.name)?.code || homeClub.short_name?.toLowerCase()}.svg`} 
                alt={homeClub.name} 
                className="w-full h-full object-cover" 
              />
            </div>
          ) : (
            homeClub.badge_url ? (
              <img src={homeClub.badge_url} alt={homeClub.name} className="w-10 h-10 object-contain flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-heading font-black text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: homeClub.badge_color ?? "#6b7280" }}>{homeClub.short_name}</div>
            )
          )}
          <div className="font-heading font-black text-[#0A1318] uppercase tracking-wide truncate text-sm">
            <span className="hidden sm:inline">{homeClub.name}</span>
            <span className="sm:hidden">{homeClub.short_name}</span>
          </div>
        </div>

        {/* Center: score · timer · score */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-3">
            <span className="font-heading font-black text-3xl text-[#0A1318] tabular-nums w-6 text-right">{homeScore}</span>
            <div className="flex flex-col items-center">
              <span className="font-heading font-black text-lg text-[#0A1318] tabular-nums leading-none">
                {phase === 'idle' && formatTime(halfSeconds)}
                {phase === 'first_half' && formatTime(halfSeconds - elapsed)}
                {phase === 'half_time' && formatTime(0)}
                {phase === 'second_half' && formatTime(totalSeconds - elapsed)}
                {phase === 'full_time' && formatTime(0)}
              </span>
            </div>
            <span className="font-heading font-black text-3xl text-[#0A1318] tabular-nums w-6 text-left">{awayScore}</span>
          </div>
          <div className="text-[10px] font-heading font-bold uppercase tracking-widest text-gray-400">
            {(phase === 'idle' || phase === 'first_half') && '1st Half'}
            {phase === 'half_time' && 'Half Time'}
            {phase === 'second_half' && '2nd Half'}
            {phase === 'full_time' && 'Full Time'}
          </div>
        </div>

        {/* Away name + badge */}
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
          <div className="font-heading font-black text-[#0A1318] uppercase tracking-wide truncate text-sm text-right">
            <span className="hidden sm:inline">{awayClub.name}</span>
            <span className="sm:hidden">{awayClub.short_name}</span>
          </div>
          {nationalMode ? (
            <div className="w-10 h-7 rounded overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-black/5 shadow-sm">
              <img 
                src={`https://flagcdn.com/${FIFA_NATIONS.find(n => n.name === awayClub.name)?.code || awayClub.short_name?.toLowerCase()}.svg`} 
                alt={awayClub.name} 
                className="w-full h-full object-cover" 
              />
            </div>
          ) : (
            awayClub.badge_url ? (
              <img src={awayClub.badge_url} alt={awayClub.name} className="w-10 h-10 object-contain flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-heading font-black text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: awayClub.badge_color ?? "#6b7280" }}>{awayClub.short_name}</div>
            )
          )}
        </div>
      </div>

      {/* Match Events Timeline */}
      {(goals.length > 0 || fouls.length > 0) && (() => {
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
      {phase === 'full_time' && (() => {
        const mvpGoals   = mvp ? goals.filter(g => g.scorer?.id === mvp.id).length : 0
        const mvpAssists = mvp ? goals.filter(g => g.assist?.id === mvp.id).length : 0
        const mvpYellows = mvp ? fouls.filter(f => f.player?.id === mvp.id && f.card === 'yellow').length : 0
        const mvpReds    = mvp ? fouls.filter(f => f.player?.id === mvp.id && f.card === 'red').length : 0
        const tier = mvp ? getOVRTier(mvp.ovr) : null
        return (
          <div className="mb-5 bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3">
            {mvp ? (
              <>
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                  {mvp.photo_url
                    ? <img src={mvp.photo_url} alt={mvp.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-sm">{mvp.name.charAt(0)}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-black text-sm text-[#0A1318] truncate">{mvp.name}</span>
                    <span className="text-sm leading-none">⭐</span>
                    {mvpGoals > 0   && <span className="text-[10px] font-heading font-bold text-gray-500">⚽{mvpGoals}</span>}
                    {mvpAssists > 0 && <span className="text-[10px] font-heading font-bold text-gray-500">👟{mvpAssists}</span>}
                    {mvpYellows > 0 && <span className="text-[10px]">🟨{mvpYellows}</span>}
                    {mvpReds > 0    && <span className="text-[10px]">🟥{mvpReds}</span>}
                  </div>
                </div>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-heading font-black text-sm flex-shrink-0 ${TIER_STYLES[tier]}`}>
                  {mvp.ovr}
                </div>
                <button onClick={() => setMvp(null)}
                  className="text-xs font-heading font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-1">
                  Change
                </button>
              </>
            ) : (
              <>
                <span className="text-base flex-shrink-0">⭐</span>
                <span className="text-sm text-gray-400 font-heading font-bold flex-1">Tap a player to select MVP</span>
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
      {goalStep !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {scored > 0 && <span className="text-xs font-heading font-bold text-gray-500">⚽ {scored}</span>}
                      {assisted > 0 && <span className="text-xs font-heading font-bold text-gray-500">👟 {assisted}</span>}
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
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {scored > 0 && <span className="text-xs font-heading font-bold text-gray-500">⚽ {scored}</span>}
                          {assisted > 0 && <span className="text-xs font-heading font-bold text-gray-500">👟 {assisted}</span>}
                        </div>
                      </button>
                    )
                  })}
                  <button onClick={() => confirmGoal(null)}
                    className="w-full p-3 rounded-xl border-2 border-dashed border-gray-200 text-xs font-heading font-bold uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-colors">
                    No Assist
                  </button>
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
        </div>
      )}

      <PlayerDetailModal player={playerDetail} onClose={() => setPlayerDetail(null)} />

      {/* Simulation Modal */}
      {simModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
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
                    {(phase === 'idle' || phase === 'first_half') && (
                      <button 
                        onClick={() => handleSimAction('half')}
                        className="w-full py-4 rounded-2xl bg-gray-50 text-gray-900 font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-100 transition-all border-2 border-transparent hover:border-gray-200 cursor-pointer"
                      >
                        Simulate until Half-time
                      </button>
                    )}
                    <button 
                      onClick={() => handleSimAction('full')}
                      className="w-full py-4 rounded-2xl bg-[#0A1318] text-white font-heading font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-all cursor-pointer"
                    >
                      Simulate until Full-time
                    </button>
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
                            <span className="flex-shrink-0">⚽</span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-heading font-bold text-[#0A1318] truncate">{g.scorer?.name}</span>
                              {g.assist && <span className="text-[8px] text-gray-400 truncate -mt-0.5">({g.assist.name})</span>}
                            </div>
                            <span className="text-gray-400 font-bold ml-auto">{g.minute}'</span>
                          </div>
                        ))}
                        {simPreview.newFouls.filter(f => f.team === 'home').map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px]">
                            <span className="flex-shrink-0">{f.card === 'red' ? '🟥' : '🟨'}</span>
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
                            <span className="flex-shrink-0">⚽</span>
                          </div>
                        ))}
                        {simPreview.newFouls.filter(f => f.team === 'away').map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] justify-end text-right">
                            <span className="text-gray-400 font-bold mr-auto">{f.minute}'</span>
                            <span className="font-heading font-bold text-[#0A1318] truncate">{f.player?.name}</span>
                            <span className="flex-shrink-0">{f.card === 'red' ? '🟥' : '🟨'}</span>
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
                        setSimPreview(null)
                        setSimModal(false)
                        showNotification(simPreview.targetPhase === 'full_time' ? 'FULL TIME' : 'HALF TIME')
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
        </div>
      )}

      {/* Foul Modal */}
      {foulStep !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
        </div>
      )}

      {/* Red card warning banner */}
      {redCardWarning && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4"
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
      {notification !== null && (
        <div className="fixed inset-0 bg-[#0A1318]/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div style={{ animation: 'countdownPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
            <span className="font-heading font-black text-white text-6xl uppercase tracking-widest drop-shadow-lg">
              {notification}
            </span>
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-[#0A1318]/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div
            key={String(countdown)}
            style={{ animation: 'countdownPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}
          >
            <span className={`font-heading font-black text-white leading-none drop-shadow-lg
              ${countdown === 'KICK OFF!' ? 'text-5xl text-[#FD5461]' : 'text-[120px]'}`}>
              {countdown}
            </span>
          </div>
        </div>
      )}

      <ScrollToTop />

      {/* Audio Elements */}
      <audio ref={anthemRef} src="/Inazuma11 OST 1 - Holy Ground (Anime ver.).mp3" preload="auto" loop />
      <audio ref={crowdRef} src="/audio/crowd.mp3" preload="auto" loop />
      <audio ref={whistleRef} src="/audio/whistle.mp3" preload="auto" />

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
      `}</style>
    </div>
  )
}
