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
import { useToast } from '../components/ui/Toast'

const TIER_DOT = { gold: 'bg-[#0A1318]', silver: 'bg-gray-400', bronze: 'bg-gray-300' }

import { FIFA_NATIONS } from '../utils/fifaNations'

export default function TransferMarketPage() {
  const [players, setPlayers] = useState([])
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [buying, setBuying] = useState(null) // { player }
  const [selectedClub, setSelectedClub] = useState('')
  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState(null)
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

  const filtered = players.filter((p) => {
    const matchPos = filter === 'ALL' || p.position === filter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.nationality.toLowerCase().includes(search.toLowerCase())
    return matchPos && matchSearch
  })

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide">Transfer Market</h1>
          <p className="text-gray-500 text-sm mt-0.5">{players.length} free agents available</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Search free agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        />
        <div className="flex gap-1.5">
          {['ALL', 'GK', 'DEF', 'MF', 'FWD'].map((pos) => (
            <button
              key={pos}
              onClick={() => setFilter(pos)}
              className={`px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors
                ${filter === pos ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400 font-heading font-bold uppercase tracking-wider">
          Loading...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">
          No free agents found
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {filtered.map((player) => {
            const tier = getOVRTier(player.ovr)
            const flagCode = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
            return (
              <div
                key={player.id}
                className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-x-3 gap-y-1.5 hover:border-gray-200 hover:shadow-md transition-all"
              >
                {/* Fixed left group: always stays in row 1 */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${TIER_DOT[tier]}`} />
                  <span className="font-heading font-black text-2xl text-gray-800">{player.ovr}</span>
                  <PositionBadge position={player.position} />
                </div>

                {/* Name+nat: full-width row 2 on mobile, inline flex-1 on sm+ */}
                <div className="flex items-center gap-2 order-last w-full sm:order-none sm:w-auto sm:flex-1 min-w-0">
                  <span className="font-heading font-bold text-gray-900 truncate">{player.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto sm:ml-0">
                    {flagCode && (
                      <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-3 w-5 object-cover rounded-sm shadow-sm ring-1 ring-black/5" alt="" />
                    )}
                    <span className="text-xs text-gray-400">{player.nationality} · {player.age} yrs</span>
                  </div>
                </div>

                {/* Market value: desktop only */}
                <div className="hidden sm:block text-right flex-shrink-0">
                  <div className="font-heading font-black text-lg text-gray-800">${formatCurrency(player.market_value)}</div>
                  <div className="text-xs text-gray-400">Market Value</div>
                </div>

                {/* Buttons: always row 1 */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => setPreview(player)}>View</Button>
                  <Button size="sm" onClick={() => setBuying({ player })} disabled={clubs.length === 0}>Sign</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Player preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? ''} width="max-w-sm">
        {preview && (
          <div className="space-y-4">
            <PlayerCard player={preview} />
            <Button
              className="w-full justify-center"
              onClick={() => { setPreview(null); setBuying({ player: preview }) }}
              disabled={clubs.length === 0}
            >
              Sign This Player
            </Button>
          </div>
        )}
      </Modal>

      {/* Buy modal */}
      <Modal open={!!buying} onClose={() => { setBuying(null); setSelectedClub('') }} title="Sign Player">
        {buying && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl font-heading font-black text-gray-300">{buying.player.ovr}</div>
                <div>
                  <div className="font-heading font-black text-lg">{buying.player.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PositionBadge position={buying.player.position} />
                    <span className="text-sm text-gray-500">{buying.player.nationality}</span>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-heading font-black text-xl text-gray-900">
                    ${formatCurrency(buying.player.market_value)}
                  </div>
                  <div className="text-xs text-gray-400">Transfer Fee</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold tracking-wider uppercase text-gray-500 mb-2">
                Select Club
              </label>
              <select
                value={selectedClub}
                onChange={(e) => setSelectedClub(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              >
                <option value="">-- Choose a club --</option>
                {clubs.filter(c => !c.is_national).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · Budget: ${formatCurrency(c.budget)}
                    {c.budget < buying.player.market_value ? ' (insufficient)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedClub && (
              <div className={`rounded-xl p-3 text-sm font-heading font-bold ${canAfford ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {canAfford
                  ? `Budget after signing: $${formatCurrency(targetClub.budget - buying.player.market_value)}`
                  : `Insufficient budget. Short by $${formatCurrency(buying.player.market_value - targetClub.budget)}`
                }
              </div>
            )}

            <Button
              className="w-full justify-center"
              onClick={handleBuy}
              disabled={!selectedClub || !canAfford || processing}
            >
              {processing ? 'Processing...' : `Confirm Transfer · $${formatCurrency(buying.player.market_value)}`}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
