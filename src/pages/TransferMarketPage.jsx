import { useState, useEffect, useCallback } from 'react'
import { fetchPlayers } from '../services/players'
import { fetchClubs } from '../services/clubs'
import { buyPlayer, InsufficientBudgetError } from '../services/transfers'
import { formatCurrency } from '../utils/currency'
import { getOVRTier } from '../utils/stats'
import PositionBadge from '../components/ui/PositionBadge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import PlayerCard from '../components/ui/PlayerCard'
import PlayerListRow from '../components/ui/PlayerListRow'
import ClubSelect from '../components/ui/ClubSelect'
import { useToast } from '../components/ui/Toast'
import PageWrapper from '../components/ui/PageWrapper'
import { SkeletonRow, SkeletonCard } from '../components/ui/SkeletonCard'
import ScrollToTop from '../components/ui/ScrollToTop'
import { FIFA_NATIONS } from '../utils/fifaNations'

const TIER_DOT   = { special: 'bg-[#FD5461]', gold: 'bg-[#0A1318]', silver: 'bg-gray-400', bronze: 'bg-gray-300' }
const TIER_LABEL = { special: 'Special', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' }
const POS_FILTERS = ['ALL', 'GK', 'DEF', 'MF', 'FWD']
const POS_COLORS  = { GK: '#f59e0b', DEF: '#3b82f6', MF: '#22c55e', FWD: '#FD5461' }

export default function TransferMarketPage() {
  const [players, setPlayers] = useState([])
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [ovrSort, setOvrSort] = useState('desc') // 'desc' | 'asc'
  const [buying, setBuying] = useState(null) // { player }
  const [selectedClub, setSelectedClub] = useState('')
  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [viewMode, setViewMode] = useState('card') // 'card' | 'list'
  const toast = useToast()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [playersData, clubsData] = await Promise.all([
        fetchPlayers({ freeAgentsOnly: true }),
        fetchClubs(),
      ])
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
      const matchPos = filter === 'ALL' || p.position === filter
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.nationality.toLowerCase().includes(search.toLowerCase())
      return matchPos && matchSearch
    })
    .sort((a, b) => ovrSort === 'desc' ? b.ovr - a.ovr : a.ovr - b.ovr)

  // Market stats
  const totalValue = players.reduce((sum, p) => sum + (p.market_value || 0), 0)
  const avgOvr = players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.ovr, 0) / players.length) : 0
  const topPlayer = players.length > 0 ? [...players].sort((a, b) => b.ovr - a.ovr)[0] : null

  const targetClub = clubs.find((c) => c.id === selectedClub)
  const canAfford = targetClub ? targetClub.budget >= (buying?.player.market_value ?? 0) : false

  async function handleBuy() {
    if (!buying || !selectedClub) return
    try {
      setProcessing(true)
      await buyPlayer({
        playerId: buying.player.id,
        toClubId: selectedClub,
        fee: buying.player.market_value,
      })
      setPlayers((prev) => prev.filter((p) => p.id !== buying.player.id))
      setClubs((prev) => prev.map((c) =>
        c.id === selectedClub
          ? { ...c, budget: c.budget - buying.player.market_value }
          : c
      ))
      const playerName = buying.player.name
      const clubName = targetClub?.name
      setBuying(null)
      setSelectedClub('')
      toast.success(`${playerName} signed to ${clubName}`)
    } catch (e) {
      if (e instanceof InsufficientBudgetError) {
        toast.error(`Not enough budget — short by $${formatCurrency(e.needed - e.available)}`)
      } else {
        toast.error(e.message)
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide">Transfer Market</h1>
          <p className="text-gray-500 text-sm mt-0.5">{players.length} free agents available</p>
        </div>
      </div>

      {/* Market Stats Summary */}
      {!loading && players.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-1">Free Agents</div>
            <div className="font-heading font-black text-2xl text-[#0A1318]">{players.length}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-1">Avg OVR</div>
            <div className="font-heading font-black text-2xl text-[#0A1318]">{avgOvr}</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-1">Total Value</div>
            <div className="font-heading font-black text-lg text-[#0A1318]">${formatCurrency(totalValue)}</div>
          </div>
        </div>
      )}

      {/* Top Available Player Spotlight */}
      {!loading && topPlayer && (
        <div className="bg-gradient-to-r from-[#0A1318] to-gray-700 rounded-2xl p-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-600">
            {topPlayer.photo_url
              ? <img src={topPlayer.photo_url} alt={topPlayer.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center font-heading font-black text-white text-lg">{topPlayer.name.charAt(0)}</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-[#FD5461] mb-0.5">⭐ Top Available</div>
            <div className="font-heading font-black text-white text-lg truncate">{topPlayer.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <PositionBadge position={topPlayer.position} />
              {(() => {
                const code = FIFA_NATIONS.find(n => n.name === topPlayer.nationality)?.code
                return code ? <img src={`https://flagcdn.com/${code}.svg`} className="h-3 w-5 object-cover rounded-sm" alt="" /> : null
              })()}
              <span className="text-gray-300 text-xs">{topPlayer.nationality}</span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="font-heading font-black text-3xl text-white">{topPlayer.ovr}</div>
            <div className="text-xs text-gray-400">${formatCurrency(topPlayer.market_value)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Search free agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        />
        <div className="flex gap-1.5 flex-wrap items-center">
          {POS_FILTERS.map((pos) => (
            <button
              key={pos}
              onClick={() => setFilter(pos)}
              className={`px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors
                ${filter === pos ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {pos}
            </button>
          ))}
          <button
            onClick={() => setOvrSort(s => s === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
          >
            OVR {ovrSort === 'desc' ? '↓' : '↑'}
          </button>
          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 ml-auto sm:ml-0">
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
          <p className="text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">No free agents found</p>
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
                  onClick={() => setPreview(player)}
                  onSign={() => { setBuying({ player }); setSelectedClub('') }}
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
                  onClick={() => setPreview(player)}
                  actions={
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setPreview(player)}>View</Button>
                      <Button size="sm" onClick={() => { setBuying({ player }); setSelectedClub('') }} disabled={clubs.filter(c => !c.is_national).length === 0}>
                        Sign
                      </Button>
                    </>
                  }
                />
              </div>
            ))}
          </div>
        )
      )}

      {/* Player preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? ''} width="max-w-sm">
        {preview && (
          <div className="space-y-4">
            <PlayerCard player={preview} />
            <Button
              className="w-full justify-center"
              onClick={() => { setPreview(null); setBuying({ player: preview }); setSelectedClub('') }}
              disabled={clubs.filter(c => !c.is_national).length === 0}
            >
              Sign This Player
            </Button>
          </div>
        )}
      </Modal>

      {/* Buy modal */}
      <Modal open={!!buying} onClose={() => { setBuying(null); setSelectedClub('') }} title="Sign Player" width="max-w-sm">
        {buying && (
          <div className="space-y-5">
            {/* Player info */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              {buying.player.photo_url ? (
                <img src={buying.player.photo_url} alt={buying.player.name} className="w-12 h-12 rounded-full object-cover bg-white" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-heading font-black text-gray-400">
                  {buying.player.name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <div className="font-heading font-black text-lg">{buying.player.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <PositionBadge position={buying.player.position} />
                  {(() => {
                    const code = FIFA_NATIONS.find(n => n.name === buying.player.nationality)?.code
                    return code ? <img src={`https://flagcdn.com/${code}.svg`} className="h-3.5 w-6 object-cover rounded-sm shadow-sm ring-1 ring-black/10" alt="" /> : null
                  })()}
                  <span className="text-sm text-gray-500">{buying.player.nationality}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-0.5">Market Value</div>
                <div className="font-heading font-black text-xl">${formatCurrency(buying.player.market_value)}</div>
              </div>
            </div>

            {/* Club select */}
            <ClubSelect
              label="Select Club"
              value={selectedClub}
              onChange={(val) => setSelectedClub(val)}
              clubs={clubs.filter(c => !c.is_national).map((c) => ({
                ...c,
                name: `${c.name}  ·  $${formatCurrency(c.budget)}${c.budget < buying.player.market_value ? '  (insufficient)' : ''}`,
              }))}
            />

            {selectedClub && (
              <p className={`text-sm font-heading ${canAfford ? 'text-green-600' : 'text-red-500'} -mt-1`}>
                {canAfford
                  ? `Budget after signing: $${formatCurrency(targetClub.budget - buying.player.market_value)}`
                  : `Insufficient budget. Short by $${formatCurrency(buying.player.market_value - targetClub.budget)}`
                }
              </p>
            )}

            <Button
              className="w-full justify-center"
              onClick={handleBuy}
              disabled={!selectedClub || !canAfford || processing}
            >
              {processing ? 'Processing...' : `Confirm · $${formatCurrency(buying.player.market_value)}`}
            </Button>
          </div>
        )}
      </Modal>
      <ScrollToTop />
    </PageWrapper>
  )
}
