import { useState, useEffect, useCallback } from 'react'
import { fetchPlayers, createPlayer, updatePlayer, deletePlayer } from '../services/players'
import { fetchClubs } from '../services/clubs'
import { buyPlayer, InsufficientBudgetError } from '../services/transfers'
import { formatCurrency } from '../utils/currency'
import PlayerCard from '../components/ui/PlayerCard'
import PlayerForm from '../components/players/PlayerForm'
import PositionBadge from '../components/ui/PositionBadge'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import ClubSelect from '../components/ui/ClubSelect'
import { FIFA_NATIONS } from '../utils/fifaNations'
import { useToast } from '../components/ui/Toast'
import FreeAgentIcon from '../components/ui/FreeAgentIcon'
import PlayerListRow from '../components/ui/PlayerListRow'
import ScrollToTop from '../components/ui/ScrollToTop'
import PageWrapper from '../components/ui/PageWrapper'
import { SkeletonCard, SkeletonRow } from '../components/ui/SkeletonCard'

const POS_FILTERS = ['ALL', 'GK', 'DEF', 'MF', 'FWD']
const POS_DOT = { GK: 'bg-amber-400', DEF: 'bg-[#3b82f6]', MF: 'bg-[#22c55e]', FWD: 'bg-[#FD5461]' }

export default function PlayersPage() {
  const [players, setPlayers] = useState([])
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [posFilter, setPosFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  // tab: 'all' | 'free'
  const [tab, setTab] = useState('all')
  const [viewMode, setViewMode] = useState('card') // 'card' | 'list'
  const [ovrSort, setOvrSort] = useState('desc') // 'desc' | 'asc'
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  // sign modal
  const [signing, setSigning] = useState(null)
  const [selectedClub, setSelectedClub] = useState('')
  const [agreedFee, setAgreedFee] = useState(0)
  const [feeDisplay, setFeeDisplay] = useState('')
  const [processing, setProcessing] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [playersData, clubsData] = await Promise.all([fetchPlayers(), fetchClubs()])
      setPlayers(playersData)
      setClubs(clubsData)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = players
    .filter((p) => {
      const matchTab = tab === 'all' || (tab === 'free' && !p.club_id)
      const matchPos = posFilter === 'ALL' || p.position === posFilter
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.nationality.toLowerCase().includes(search.toLowerCase())
      return matchTab && matchPos && matchSearch
    })
    .sort((a, b) => ovrSort === 'desc' ? b.ovr - a.ovr : a.ovr - b.ovr)

  const freeCount = players.filter((p) => !p.club_id).length

  async function handleCreate(form) {
    try {
      setSaving(true)
      const player = await createPlayer(form)
      if (player.club_id) player.club = clubs.find((c) => c.id === player.club_id) ?? null
      setPlayers((prev) => [player, ...prev].sort((a, b) => b.ovr - a.ovr))
      setModal(null)
      toast.success('Player created')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(form) {
    try {
      setSaving(true)
      const updated = await updatePlayer(modal.player.id, form)
      setPlayers((prev) => prev.map((p) => p.id === updated.id ? updated : p).sort((a, b) => b.ovr - a.ovr))
      setModal(null)
      toast.success('Player updated')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this player?')) return
    try {
      await deletePlayer(id)
      setPlayers((prev) => prev.filter((p) => p.id !== id))
      setModal(null)
      toast.success('Player deleted')
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function handleSign() {
    if (!signing || !selectedClub) return
    try {
      setProcessing(true)
      await buyPlayer({ playerId: signing.id, toClubId: selectedClub, fee: agreedFee })
      const club = clubs.find((c) => c.id === selectedClub)
      setPlayers((prev) => prev.map((p) =>
        p.id === signing.id ? { ...p, club_id: selectedClub, club, market_value: agreedFee } : p
      ))
      setClubs((prev) => prev.map((c) =>
        c.id === selectedClub ? { ...c, budget: c.budget - agreedFee } : c
      ))
      setSigning(null)
      setSelectedClub('')
      toast.success(`${signing.name} signed to ${club?.name}`)
    } catch (e) {
      if (e instanceof InsufficientBudgetError) {
        toast.error(`Insufficient budget — short by $${formatCurrency(e.needed - e.available)}`)
      } else {
        toast.error(e.message)
      }
    } finally {
      setProcessing(false)
    }
  }

  const editInitial = modal?.player
    ? {
        first_name: modal.player.name.split(' ').slice(0, -1).join(' ') || modal.player.name,
        last_name: modal.player.name.split(' ').slice(-1).join('') || '',
        nationality: modal.player.nationality,
        age: modal.player.age,
        position: modal.player.position,
        market_value: modal.player.market_value,
        stats: modal.player.stats,
        photo: modal.player.photo_url ? { preview: modal.player.photo_url } : null,
        club_id: modal.player.club_id ?? '',
      }
    : null

  const targetClub = clubs.find((c) => c.id === selectedClub)
  const canAfford = targetClub && signing ? targetClub.budget >= agreedFee : false

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide">Players</h1>
          <p className="text-gray-500 text-sm mt-0.5">{players.length} total · {freeCount} free agents</p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })}>+ New Player</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'all', label: `All Players (${players.length})` },
          { key: 'free', label: `Free Agents (${freeCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-heading font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors text-center
              ${tab === key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Search name or nationality..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        />
        <div className="flex gap-1.5">
          {POS_FILTERS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors
                ${posFilter === pos ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {pos}
            </button>
          ))}
          <button
            onClick={() => setOvrSort((s) => s === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
          >
            OVR {ovrSort === 'desc' ? '↓' : '↑'}
          </button>
          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'card' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2.5" width="14" height="2.5" rx="1.25" fill="currentColor"/>
                <rect x="1" y="6.75" width="14" height="2.5" rx="1.25" fill="currentColor"/>
                <rect x="1" y="11" width="14" height="2.5" rx="1.25" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loading && (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-24 gap-3">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-gray-200">
            <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2.5"/>
            <path d="M16 24h16M24 16v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.4"/>
          </svg>
          <p className="text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">No players found</p>
          <p className="text-gray-300 text-xs">Try adjusting your filters</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((player, i) => (
              <div key={player.id} className="animate-fadeSlideUp" style={{ animationDelay: `${Math.min(i * 40, 400)}ms`, animationFillMode: 'both' }}>
                <PlayerCard
                  player={player}
                  onClick={() => setModal({ mode: 'edit', player })}
                  onEdit={() => setModal({ mode: 'edit', player })}
                  onDelete={() => handleDelete(player.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((player, i) => (
              <div key={player.id} className="animate-fadeSlideUp" style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: 'both' }}>
              <PlayerListRow
                player={player}
                actions={
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setModal({ mode: 'edit', player })}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(player.id)}>Del</Button>
                    {tab === 'free' && (
                      <Button size="sm" onClick={() => { setSigning(player); setSelectedClub(''); setAgreedFee(player.market_value); setFeeDisplay((player.market_value / 1_000_000).toFixed(1)) }} disabled={clubs.length === 0}>Sign</Button>
                    )}
                  </>
                }
              />
              </div>
            ))}
          </div>
        )
      )}

      {/* Create modal */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="New Player" width="max-w-xl">
        <PlayerForm onSubmit={handleCreate} loading={saving} clubs={clubs} />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={modal?.mode === 'edit'}
        onClose={() => setModal(null)}
        title="Edit Player"
        width="max-w-xl"
      >
        {modal?.mode === 'edit' && modal?.player && (
          <PlayerForm initialValues={editInitial} onSubmit={handleEdit} loading={saving} clubs={clubs} />
        )}
      </Modal>

      {/* Sign to club modal */}
      <Modal open={!!signing} onClose={() => { setSigning(null); setSelectedClub('') }} title="Sign Player" width="max-w-sm">
        {signing && (
          <div className="space-y-5">
            {/* Player info */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              {signing.photo_url ? (
                <img src={signing.photo_url} alt={signing.name} className="w-12 h-12 rounded-full object-cover bg-white" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-heading font-black text-gray-400">
                  {signing.name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <div className="font-heading font-black text-lg">{signing.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <PositionBadge position={signing.position} />
                  {(() => {
                    const code = FIFA_NATIONS.find(n => n.name === signing.nationality)?.code
                    return code ? <img src={`https://flagcdn.com/w40/${code}.png`} className="h-3.5 w-5 object-cover rounded-[2px] ring-1 ring-black/10" alt="" /> : null
                  })()}
                  <span className="text-sm text-gray-500">{signing.nationality}</span>
                  {signing.club && (
                    signing.club.badge_url
                      ? <img src={signing.club.badge_url} className="w-5 h-5 object-contain" alt={signing.club.name} />
                      : <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[8px] font-black" style={{ backgroundColor: signing.club.badge_color ?? "#6b7280" }}>{signing.club.short_name?.slice(0,1)}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-0.5">Market Value</div>
                <div className="font-heading font-black text-xl">${formatCurrency(signing.market_value)}</div>
              </div>
            </div>

            {/* Club select */}
            <ClubSelect
              label="Select Club"
              value={selectedClub}
              onChange={(val) => setSelectedClub(val)}
              clubs={clubs.map((c) => ({
                ...c,
                name: `${c.name}  ·  $${formatCurrency(c.budget)}${c.budget < agreedFee ? '  (insufficient)' : ''}`,
              }))}
            />

            {/* Fee negotiation */}
            <div>
              <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500 block mb-1">
                Transfer Fee
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { const v = Math.max(0, agreedFee - 1_000_000); setAgreedFee(v); setFeeDisplay((v/1_000_000).toFixed(1)) }}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold text-lg flex-shrink-0"
                >−</button>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={feeDisplay}
                    onChange={(e) => { setFeeDisplay(e.target.value); setAgreedFee(Math.round(parseFloat(e.target.value || 0) * 1_000_000)) }}
                    onBlur={() => setFeeDisplay((agreedFee / 1_000_000).toFixed(1))}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 text-center font-heading font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">M</span>
                </div>
                <button
                  type="button"
                  onClick={() => { const v = agreedFee + 1_000_000; setAgreedFee(v); setFeeDisplay((v/1_000_000).toFixed(1)) }}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold text-lg flex-shrink-0"
                >+</button>
              </div>
            </div>

            {selectedClub && (
              <p className={`text-sm font-heading ${canAfford ? 'text-green-600' : 'text-red-500'} -mt-1`}>
                {canAfford
                  ? `Budget after signing: $${formatCurrency(targetClub.budget - agreedFee)}`
                  : `Insufficient budget. Short by $${formatCurrency(agreedFee - targetClub.budget)}`
                }
              </p>
            )}

            <Button
              className="w-full justify-center"
              onClick={handleSign}
              disabled={!selectedClub || !canAfford || processing}
            >
              {processing ? 'Processing...' : `Confirm · $${formatCurrency(agreedFee)}`}
            </Button>
          </div>
        )}
      </Modal>
      <ScrollToTop />
    </PageWrapper>
  )
}
