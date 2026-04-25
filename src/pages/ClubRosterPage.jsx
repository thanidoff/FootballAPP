import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchClub, fetchClubs } from '../services/clubs'
import { fetchPlayers, updatePlayer, saveRosterOrder, saveNationalRosterOrder } from '../services/players'
import { releasePlayer } from '../services/transfers'
import { formatCurrency } from '../utils/currency'
import { getOVRTier, STATS_BY_POSITION } from '../utils/stats'
import { FIFA_NATIONS } from '../utils/fifaNations'

const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))
import StatBar from '../components/ui/StatBar'
import FreeAgentIcon from '../components/ui/FreeAgentIcon'
import PlayerListRow from '../components/ui/PlayerListRow'
import ScrollToTop from '../components/ui/ScrollToTop'
import PageWrapper from '../components/ui/PageWrapper'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import PlayerForm from '../components/players/PlayerForm'
import { useToast } from '../components/ui/Toast'

const TIER_STYLES = {
  special: { ovrBg: 'bg-[#FD5461]', ovrText: 'text-white' },
  gold:    { ovrBg: 'bg-[#0A1318]', ovrText: 'text-white' },
  silver:  { ovrBg: 'bg-gray-600',  ovrText: 'text-white' },
  bronze:  { ovrBg: 'bg-gray-400',  ovrText: 'text-white' },
}
const POS_COLORS = { GK: '#f59e0b', DEF: '#3b82f6', MF: '#22c55e', FWD: '#FD5461' }
const POS_LABEL  = { GK: 'GK', DEF: 'DF', MF: 'MF', FWD: 'FW' }

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
    </svg>
  )
}

function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="3" rx="1.5" fill="currentColor"/>
      <rect x="1" y="6.5" width="14" height="3" rx="1.5" fill="currentColor"/>
      <rect x="1" y="11" width="14" height="3" rx="1.5" fill="currentColor"/>
    </svg>
  )
}

function EmptySlotCard({ isOver, canDrop }) {
  return (
    <div className={`h-full min-h-[400px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors
      ${isOver && canDrop ? 'border-gray-400 bg-gray-50' : 'border-gray-200'}
      ${isOver && !canDrop ? 'border-red-300 bg-red-50' : ''}
      text-gray-300`}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="text-xs font-heading font-bold uppercase tracking-wider">Empty</span>
    </div>
  )
}

function EmptySlotRow({ isOver, canDrop }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed transition-colors min-h-[64px]
      ${isOver && canDrop ? 'border-gray-300 bg-gray-50' : 'border-gray-100'}
      ${isOver && !canDrop ? 'border-red-200 bg-red-50' : ''}`}>
      <span className="text-xs font-heading font-bold uppercase tracking-widest text-gray-300">Empty</span>
    </div>
  )
}

function RosterCard({ player, isCaptain, onRelease, releasing, onEdit, onPointerDown, isDragging, isOver, canDrop, isNational }) {
  const tier = getOVRTier(player.ovr)
  const style = TIER_STYLES[tier]
  const posColor = POS_COLORS[player.position] ?? '#6b7280'
  const statKeys = STATS_BY_POSITION[player.position]
  const flagCode = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
  const playerClub = player.club

  return (
    <div
      onPointerDown={onPointerDown}
      className={`relative w-full text-left bg-white border rounded-2xl overflow-hidden shadow-sm
        transition-all duration-150 cursor-grab active:cursor-grabbing select-none touch-none
        ${isDragging ? 'opacity-25 scale-[0.97]' : ''}
        ${isOver && canDrop ? 'border-gray-400 ring-2 ring-gray-300' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}
        ${isOver && !canDrop ? 'border-red-300 ring-2 ring-red-200' : ''}`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
            {player.photo_url
              ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center font-medium text-gray-400 text-sm">{player.name.charAt(0)}</div>
            }
          </div>
          <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold text-gray-900 leading-tight truncate">{player.name}</span>
                {isCaptain && (
                  <span className="inline-flex items-center justify-center bg-[#FD5461] text-white font-heading font-black text-[10px] tracking-wider px-1.5 py-0.5 rounded">C</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                {isNational ? (
                  <>
                    {flagCode && <img src={`https://flagcdn.com/w40/${flagCode}.png`} className="h-4 w-6 object-cover rounded-[2px] shadow-sm flex-shrink-0 ring-1 ring-black/10" alt="" />}
                    {playerClub ? (
                      playerClub.badge_url
                        ? <img src={playerClub.badge_url} alt={playerClub.short_name} className="w-6 h-6 object-contain flex-shrink-0" />
                        : <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-[8px] font-black" style={{ backgroundColor: playerClub.badge_color ?? "#6b7280" }}>{playerClub.short_name?.slice(0, 1)}</div>
                    ) : <FreeAgentIcon size={18} />}
                  </>
                ) : (
                  <>
                    {playerClub ? (
                      playerClub.badge_url
                        ? <img src={playerClub.badge_url} alt={playerClub.short_name} className="w-6 h-6 object-contain flex-shrink-0" />
                        : <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-[8px] font-black" style={{ backgroundColor: playerClub.badge_color ?? "#6b7280" }}>{playerClub.short_name?.slice(0, 1)}</div>
                    ) : <FreeAgentIcon size={18} />}
                    {flagCode && <img src={`https://flagcdn.com/w40/${flagCode}.png`} className="h-4 w-6 object-cover rounded-[2px] shadow-sm flex-shrink-0 ring-1 ring-black/10" alt="" />}
                  </>
                )}
                <span className="text-xs text-gray-400">{player.age} yrs</span>
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
              <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${style.ovrBg} ${style.ovrText}`}>
                <span className="text-lg font-bold leading-none">{player.ovr}</span>
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: posColor }}>
                {POS_LABEL[player.position] ?? player.position}
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 my-4" />
        <div className="space-y-2">
          {statKeys.map(key => (
            <StatBar key={key} label={key} value={player.stats[key]} />
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
            {onRelease && (
              <Button variant="ghost" size="sm" onClick={onRelease} disabled={releasing}>
                {releasing ? '...' : 'Release'}
              </Button>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-700">${formatCurrency(player.market_value)}</span>
        </div>
      </div>
    </div>
  )
}

function RosterRow({ player, isCaptain, onRelease, releasing, onEdit, onPointerDown, isDragging, isOver, canDrop, isNational }) {
  return (
    <PlayerListRow
      player={player}
      isCaptain={isCaptain}
      isNational={isNational}
      onPointerDown={onPointerDown}
      isDragging={isDragging}
      isOver={isOver}
      canDrop={canDrop}
      actions={
        <>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-[11px] font-heading font-black uppercase tracking-widest text-gray-500 hover:text-[#0A1318] transition-colors cursor-pointer">
            Edit
          </button>
          {onRelease && (
            <button
              onClick={onRelease}
              disabled={releasing}
              className="px-3 py-1.5 rounded-xl bg-[#FD5461] text-white text-[11px] font-heading font-black uppercase tracking-widest hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50">
              {releasing ? '...' : 'Release'}
            </button>
          )}
        </>
      }
    />
  )
}

export default function ClubRosterPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [club, setClub] = useState(null)
  const [clubs, setClubs] = useState([])
  const [slots, setSlots] = useState(Array(12).fill(null))
  const [loading, setLoading] = useState(true)
  const [releasing, setReleasing] = useState(null)
  const [editPlayer, setEditPlayer] = useState(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('card')
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved'
  const saveTimerRef = useRef(null)
  const toast = useToast()

  const dragRef = useRef({ active: false, fromIdx: null, startX: 0, startY: 0 })
  const slotRefs = useRef(Array(12).fill(null))
  const [activeDragIdx, setActiveDragIdx] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [ghostPos, setGhostPos] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [clubData, allClubs] = await Promise.all([fetchClub(id), fetchClubs()])
      setClub(clubData)
      setClubs(allClubs)
      const playersData = clubData.is_national
        ? await fetchPlayers({ nationality: clubData.name })
        : await fetchPlayers({ clubId: id })
      // DB already returns in correct order (roster_order/national_roster_order → ovr)
      const size = Math.max(playersData.length, 12)
      const initial = Array(size).fill(null)
      playersData.forEach((p, i) => { initial[i] = p })
      setSlots(initial)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function triggerAutoSave(newSlots) {
    setSaveStatus('saving')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await (club.is_national ? saveNationalRosterOrder(newSlots) : saveRosterOrder(newSlots))
        setSaveStatus('saved')
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => setSaveStatus(null), 2000)
      } catch {
        setSaveStatus(null)
        toast.error('Failed to save order')
      }
    }, 600)
  }

  function canDropCheck(prev, fromIdx, toIdx) {
    if (fromIdx === toIdx) return false
    if (prev[toIdx]) return true
    if (toIdx < 5 && fromIdx >= 5) return true
    return false
  }

  function getSlotUnderPointer(x, y) {
    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return i
    }
    return null
  }

  function handlePointerDown(fromIdx, e) {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    dragRef.current = { active: false, fromIdx, startX: e.clientX, startY: e.clientY }

    function onMove(e) {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (!dragRef.current.active && Math.hypot(dx, dy) > 8) {
        dragRef.current.active = true
        setActiveDragIdx(fromIdx)
      }
      if (dragRef.current.active) {
        setGhostPos({ x: e.clientX, y: e.clientY })
        setDragOver(getSlotUnderPointer(e.clientX, e.clientY))
      }
    }

    function onUp(e) {
      if (dragRef.current.active) {
        const toIdx = getSlotUnderPointer(e.clientX, e.clientY)
        const fIdx = dragRef.current.fromIdx
        if (toIdx !== null && toIdx !== fIdx) {
          setSlots(prev => {
            if (!canDropCheck(prev, fIdx, toIdx)) return prev
            const next = [...prev]
            const tmp = next[fIdx]; next[fIdx] = next[toIdx]; next[toIdx] = tmp
            triggerAutoSave(next)
            return next
          })
        }
      }
      dragRef.current = { active: false, fromIdx: null, startX: 0, startY: 0 }
      setActiveDragIdx(null)
      setDragOver(null)
      setGhostPos(null)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  async function handleRelease(player, slotIdx) {
    if (!confirm(`Release ${player.name}?\nRelease cost: $${formatCurrency(Math.round(player.market_value * 0.5))}`)) return
    try {
      setReleasing(player.id)
      const { cost } = await releasePlayer({ playerId: player.id, fromClubId: id, marketValue: player.market_value })
      setSlots(prev => {
        const next = [...prev]
        next[slotIdx] = null
        const players = next.filter(Boolean)
        const compacted = Array(12).fill(null)
        players.forEach((p, i) => { compacted[i] = p })
        return compacted
      })
      setClub(prev => ({ ...prev, budget: prev.budget - cost }))
      toast.success(`${player.name} released`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReleasing(null)
    }
  }

  async function handleEdit(form) {
    try {
      setSaving(true)
      const updated = await updatePlayer(editPlayer.id, form)
      setSlots(prev => prev.map(p => p?.id === updated.id ? updated : p))
      setEditPlayer(null)
      toast.success('Player updated')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const editInitial = editPlayer ? {
    first_name: editPlayer.name.split(' ').slice(0, -1).join(' ') || editPlayer.name,
    last_name: editPlayer.name.split(' ').slice(-1).join('') || '',
    nationality: editPlayer.nationality,
    age: editPlayer.age,
    position: editPlayer.position,
    market_value: editPlayer.market_value,
    stats: editPlayer.stats,
    photo: editPlayer.photo_url ? { preview: editPlayer.photo_url } : null,
    club_id: editPlayer.club_id ?? '',
  } : null

  if (loading) {
    return <div className="text-center py-20 text-gray-400 font-heading font-bold uppercase tracking-wider">Loading...</div>
  }
  if (!club) return null

  const starters = slots.slice(0, 5)
  const subs = slots.slice(5, 12)
  const extra = slots.slice(12)
  const playerCount = slots.filter(Boolean).length
  const ghostPlayer = activeDragIdx !== null ? slots[activeDragIdx] : null
  const ghostTier = ghostPlayer ? getOVRTier(ghostPlayer.ovr) : null
  const ghostStyle = ghostTier ? TIER_STYLES[ghostTier] : null
  const isList = viewMode === 'list'

  function SlotWrapper({ slotIdx, children }) {
    const isOver = dragOver === slotIdx && activeDragIdx !== null
    const valid = activeDragIdx !== null && (() => {
      if (activeDragIdx === slotIdx) return false
      if (slots[slotIdx]) return true
      if (slotIdx < 5 && activeDragIdx >= 5) return true
      return false
    })()
    return (
      <div ref={el => { slotRefs.current[slotIdx] = el }}>
        {children(isOver, valid)}
      </div>
    )
  }

  function renderSlot(player, slotIdx) {
    const isCaptain = slotIdx === 0
    return (
      <SlotWrapper key={slotIdx} slotIdx={slotIdx}>
        {(isOver, valid) => {
          if (!player) return isList
            ? <EmptySlotRow isOver={isOver} canDrop={valid} />
            : <EmptySlotCard isOver={isOver} canDrop={valid} />
          const sharedProps = {
            player, isCaptain,
            onEdit: () => setEditPlayer(player),
            onRelease: club.is_national ? null : () => handleRelease(player, slotIdx),
            releasing: releasing === player.id,
            onPointerDown: e => handlePointerDown(slotIdx, e),
            isDragging: activeDragIdx === slotIdx,
          }
          return isList
            ? <RosterRow {...sharedProps} isOver={isOver} canDrop={valid} isNational={club.is_national} />
            : <RosterCard {...sharedProps} isOver={isOver} canDrop={valid} isNational={club.is_national} />
        }}
      </SlotWrapper>
    )
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {club.is_national ? (
          <div className="w-[84px] h-14 rounded-xl overflow-hidden shadow bg-gray-100 flex-shrink-0">
            <img src={`https://flagcdn.com/${NATION_CODE[club.name] ?? club.short_name.toLowerCase()}.svg`} alt={club.name} className="w-full h-full object-cover" />
          </div>
        ) : club.badge_url ? (
          <div className="w-14 h-14 rounded-xl overflow-hidden shadow bg-white ring-1 ring-gray-100">
            <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-1" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-xl flex items-center justify-center font-heading font-black text-white text-lg shadow" style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>
            {club.short_name}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide">{club.name}</h1>
          <p className="text-gray-500 text-sm">
            {!club.is_national && <>Budget: <span className="font-bold text-gray-900">${formatCurrency(club.budget)}</span><span className="mx-2 text-gray-300">·</span></>}
            {playerCount} players
          </p>
        </div>
        {/* Save indicator */}
        {saveStatus && (
          <div className={`flex items-center gap-1.5 text-[11px] font-heading font-black uppercase tracking-widest flex-shrink-0 transition-all
            ${saveStatus === 'saved' ? 'text-green-500' : 'text-gray-400'}`}>
            {saveStatus === 'saving' ? (
              <>
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 8" strokeLinecap="round"/>
                </svg>
                Saving
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Saved
              </>
            )}
          </div>
        )}

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5 flex-shrink-0">
          <button
            onClick={() => setViewMode('card')}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer
              ${!isList ? 'bg-white shadow-sm text-[#0A1318]' : 'text-gray-400 hover:text-gray-600'}`}>
            <IconGrid />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer
              ${isList ? 'bg-white shadow-sm text-[#0A1318]' : 'text-gray-400 hover:text-gray-600'}`}>
            <IconList />
          </button>
        </div>
      </div>

      {/* Starting 5 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-heading font-black uppercase tracking-widest text-gray-500">Starting 5</span>
        <span className="text-xs text-gray-400">{starters.filter(Boolean).length} / 5</span>
      </div>
      <div className={isList
        ? 'space-y-1.5 mb-6'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6'}>
        {starters.map((player, i) => renderSlot(player, i))}
      </div>

      {/* Substitutes */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-heading font-black uppercase tracking-widest text-gray-400">
          Substitutes · {subs.filter(Boolean).length}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className={isList
        ? 'space-y-1.5'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
        {subs.map((player, i) => renderSlot(player, i + 5))}
      </div>

      {/* Extra squad — national teams only */}
      {extra.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-6 mb-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-heading font-black uppercase tracking-widest text-gray-400">
              Squad · {extra.filter(Boolean).length}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className={isList
            ? 'space-y-1.5'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}>
            {extra.map((player, i) => renderSlot(player, i + 12))}
          </div>
        </>
      )}

      {/* Ghost card — follows pointer during drag */}
      {ghostPlayer && ghostPos && (
        <div style={{
          position: 'fixed',
          left: ghostPos.x - 140,
          top: ghostPos.y - 50,
          width: 280,
          pointerEvents: 'none',
          zIndex: 9999,
          transform: 'rotate(2deg) scale(1.05)',
          filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.28))',
        }}>
          <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 flex items-center gap-3 shadow-2xl">
            {ghostPlayer.photo_url
              ? <img src={ghostPlayer.photo_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
              : <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-400 text-lg flex-shrink-0">{ghostPlayer.name.charAt(0)}</div>
            }
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-gray-900 truncate">{ghostPlayer.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{ghostPlayer.position} · {ghostPlayer.nationality}</div>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${ghostStyle.ovrBg} ${ghostStyle.ovrText}`}>
              <span className="text-lg font-bold leading-none">{ghostPlayer.ovr}</span>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editPlayer} onClose={() => setEditPlayer(null)} title="Edit Player" width="max-w-xl">
        {editPlayer && (
          <PlayerForm initialValues={editInitial} onSubmit={handleEdit} loading={saving} clubs={clubs} />
        )}
      </Modal>
      <ScrollToTop />
    </PageWrapper>
  )
}
