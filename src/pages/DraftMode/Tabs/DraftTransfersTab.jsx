import { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { transferDraftPlayer, updateDraftState } from '../../../services/draftSave'
import PlayerCard from '../../../components/ui/PlayerCard'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import ClubSelect from '../../../components/ui/ClubSelect'
import PlayerForm from '../../../components/players/PlayerForm'
import SegmentedControl from '../../../components/ui/SegmentedControl'
import Select from '../../../components/ui/Select'
import { formatCurrency } from '../../../utils/currency'
import { calculateOVR } from '../../../utils/stats'
import { useToast } from '../../../components/ui/Toast'

import PositionBadge from '../../../components/ui/PositionBadge'
import OvrBadge from '../../../components/ui/OvrBadge'
import ScrollToTop from '../../../components/ui/ScrollToTop'
import FreeAgentIcon from '../../../components/ui/FreeAgentIcon'
import { FIFA_NATIONS } from '../../../utils/fifaNations'

import { fetchPlayers } from '../../../services/players'
import { Check, Plus, Search, Sparkles, Users, UserCheck } from 'lucide-react'
import SeasonalGrowthModal from '../../../components/draft/SeasonalGrowthModal'

const POS_FILTERS = ['ALL', 'GK', 'DEF', 'MF', 'FWD']

export default function DraftTransfersTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const toast = useToast()
  
  const [processing, setProcessing] = useState(false)
  const [posFilter, setPosFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [ovrSort, setOvrSort] = useState('desc')
  const [tab, setTab] = useState('all') // 'all' or 'free'
  const [signingPlayer, setSigningPlayer] = useState(null)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [agreedFee, setAgreedFee] = useState(0)
  const [feeDisplay, setFeeDisplay] = useState('0.0')
  const [editPlayer, setEditPlayer] = useState(null)

  const [playerManagerOpen, setPlayerManagerOpen] = useState(false)
  const [masterPlayers, setMasterPlayers] = useState([])
  const [managedPlayerIds, setManagedPlayerIds] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [playerManagerSearch, setPlayerManagerSearch] = useState('')
  const [playerManagerPosFilter, setPlayerManagerPosFilter] = useState('ALL')
  const [playerManagerStatusFilter, setPlayerManagerStatusFilter] = useState('all') // 'all' | 'added' | 'not_added'

  const freeAgents = saveData?.freeAgents || []
  
  const cleanFreeAgents = useMemo(() => {
    return freeAgents.map(p => ({ ...p, club: null, club_id: null }))
  }, [freeAgents])

  const allPlayers = useMemo(() => {
    if (!saveData) return []
    const list = [...cleanFreeAgents]
    saveData.teams.forEach(team => {
      team.roster.forEach(p => {
        list.push({
          ...p,
          club: {
            id: team.club_id,
            name: team.club_name,
            short_name: team.club_name,
            badge_url: team.badge_url,
            badge_color: team.badge_color
          }
        })
      })
    })
    return list
  }, [cleanFreeAgents, saveData])

  const filteredPlayers = useMemo(() => {
    const list = tab === 'free' ? cleanFreeAgents : allPlayers
    return list
      .filter((p) => {
        const matchPos = posFilter === 'ALL' || p.position === posFilter
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.nationality.toLowerCase().includes(search.toLowerCase())
        return matchPos && matchSearch
      })
      .sort((a, b) => (ovrSort === 'desc' ? b.ovr - a.ovr : a.ovr - b.ovr))
  }, [allPlayers, cleanFreeAgents, ovrSort, posFilter, search, tab])

  const openSigning = (player) => {
    setSigningPlayer(player)
    setSelectedClubId('')
    setAgreedFee(player.market_value)
    setFeeDisplay(((player.market_value || 0) / 1_000_000).toFixed(1))
  }

  const handleSign = async () => {
    if (!signingPlayer || !selectedClubId) return
    try {
      setProcessing(true)
      const nextSaveData = transferDraftPlayer(saveData, {
        playerId: signingPlayer.id,
        toClubId: selectedClubId,
        fee: agreedFee,
      })

      await updateDraftState(saveId, nextSaveData)
      setSaveData(nextSaveData)
      setSigningPlayer(null)
      setSelectedClubId('')
      toast.success(`${signingPlayer.name} transferred successfully`)
    } catch (e) {
      toast.error(e.message || 'Failed to transfer player')
    } finally {
      setProcessing(false)
    }
  }

  async function handlePlayerUpdate(form) {
    if (!editPlayer) return
    setProcessing(true)
    try {
      const updatedPlayer = {
        ...editPlayer,
        name: form.name,
        nationality: form.nationality,
        age: form.age,
        position: form.position,
        market_value: form.market_value,
        stats: form.stats,
        ovr: calculateOVR(form.position, form.stats),
        photo_url: form.photo?.preview || editPlayer.photo_url || null,
        club_id: editPlayer.club?.id || null,
      }

      let newTeams = saveData.teams
      let newFreeAgents = saveData.freeAgents || []

      if (editPlayer.club?.id) {
        newTeams = saveData.teams.map(item => item.club_id === editPlayer.club.id
          ? { ...item, roster: (item.roster || []).map(player => player.id === editPlayer.id ? updatedPlayer : player) }
          : item)
      } else {
        newFreeAgents = newFreeAgents.map(player => player.id === editPlayer.id ? updatedPlayer : player)
      }

      const newSaveData = { ...saveData, teams: newTeams, freeAgents: newFreeAgents }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      setEditPlayer(null)
      toast.success(`${updatedPlayer.name} updated`)
    } catch (error) {
      console.error('Failed to update player', error)
      toast.error(error.message || 'Failed to update player')
    } finally {
      setProcessing(false)
    }
  }

  async function openPlayerManager() {
    setPlayerManagerOpen(true)
    setPlayerManagerSearch('')
    setPlayerManagerPosFilter('ALL')
    setPlayerManagerStatusFilter('all')
    setManagedPlayerIds(allPlayers.map(p => String(p.id)))
    setLoadingPlayers(true)
    try {
      const players = await fetchPlayers()
      setMasterPlayers(players)
    } catch (error) {
      console.error('Failed to load master players', error)
      toast.error('Failed to load master players')
    } finally {
      setLoadingPlayers(false)
    }
  }

  function toggleManagedPlayer(playerId) {
    const id = String(playerId)
    setManagedPlayerIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function saveManagedPlayers() {
    setProcessing(true)
    try {
      const selectedIds = new Set(managedPlayerIds.map(String))
      
      // Kept & added free agents
      const existingInSave = new Map()
      allPlayers.forEach(p => existingInSave.set(String(p.id), p))
      
      // Update roster for each team (keep only selected)
      const updatedTeams = saveData.teams.map(team => ({
        ...team,
        roster: (team.roster || []).filter(p => selectedIds.has(String(p.id)))
      }))

      // Free agents: keep current free agents that are selected + add new master players that are selected and not in any team/free agent
      const newMasterToAdd = masterPlayers.filter(p => selectedIds.has(String(p.id)) && !existingInSave.has(String(p.id)))
        .map(p => ({
          ...p,
          club_id: null,
          club: null
        }))

      const updatedFreeAgents = [
        ...cleanFreeAgents.filter(p => selectedIds.has(String(p.id))),
        ...newMasterToAdd
      ]

      const nextState = { ...saveData, teams: updatedTeams, freeAgents: updatedFreeAgents }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setPlayerManagerOpen(false)
      toast.success('Save players updated')
    } catch (error) {
      console.error('Failed to manage save players', error)
      toast.error('Failed to update players in this save')
    } finally {
      setProcessing(false)
    }
  }

  const editPlayerInitial = editPlayer ? {
    first_name: editPlayer.name.split(' ').slice(0, -1).join(' ') || editPlayer.name,
    last_name: editPlayer.name.split(' ').slice(-1).join('') || '',
    nationality: editPlayer.nationality,
    age: editPlayer.age,
    position: editPlayer.position,
    market_value: editPlayer.market_value,
    stats: editPlayer.stats,
    photo: editPlayer.photo_url ? { preview: editPlayer.photo_url } : null,
    club_id: editPlayer.club?.id || '',
  } : null

  const signingTeam = saveData.teams.find(t => t.club_id === selectedClubId)
  const canAfford = signingTeam && signingPlayer ? signingTeam.budget >= agreedFee : false

  const [growthModalOpen, setGrowthModalOpen] = useState(false)
  const seasons = saveData.settings?.seasons || []
  const activeSeason = seasons.find(season => season.status === 'active') || seasons[seasons.length - 1]
  const seasonAdjustments = activeSeason?.seasonAdjustments || []

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <SegmentedControl
          ariaLabel="Transfer player groups"
          value={tab}
          onChange={setTab}
          className="w-full sm:w-auto"
          items={[
            { id: 'all', label: `All Players (${allPlayers.length})` },
            { id: 'free', label: `Free Agents (${freeAgents.length})` },
          ]}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGrowthModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"
          >
            <Sparkles size={15} className="shrink-0" /> Season Ratings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openPlayerManager}
            className="flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"
          >
            <Plus size={16} /> Manage Players
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-gray-900/20 transition-all">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="search"
            placeholder="Search name or nationality..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {POS_FILTERS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors
                ${posFilter === pos ? 'bg-[#0A1318] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {pos}
            </button>
          ))}
          <button
            onClick={() => setOvrSort((s) => s === 'desc' ? 'asc' : 'desc')}
            aria-label={`Sort by overall rating ${ovrSort === 'desc' ? 'ascending' : 'descending'}`}
            aria-pressed="true"
            title={ovrSort === 'desc' ? 'Highest OVR first' : 'Lowest OVR first'}
            className="flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[#0A1318] px-3 py-2 font-heading text-xs font-bold uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            OVR {ovrSort === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
          <div className="text-4xl mb-4">🛒</div>
          <h2 className="font-heading font-black text-lg text-gray-400 uppercase tracking-wide">No Players Found</h2>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div key={`${tab}-${posFilter}-${ovrSort}`} className="player-card-grid ui-content-refresh">
          {filteredPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onEdit={() => setEditPlayer(player)}
              onSign={() => {
                setSigningPlayer(player)
                setSelectedClubId('')
                setAgreedFee(player.market_value || 0)
                setFeeDisplay(((player.market_value || 0) / 1_000_000).toFixed(1))
              }}
              deleteLabel={player.club ? 'Transfer' : 'Sign'}
            />
          ))}
        </div>
      )}

      {/* Sign Modal */}
      <Modal open={!!signingPlayer} onClose={() => { setSigningPlayer(null); setSelectedClubId('') }} title="Sign Player" width="max-w-md">
        {signingPlayer && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 flex items-center justify-between gap-3 border border-gray-100">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Photo avatar */}
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
                  {signingPlayer.photo_url ? (
                    <img src={signingPlayer.photo_url} alt={signingPlayer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-base">
                      {signingPlayer.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name + flag + club + position */}
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#0A1318] truncate">{signingPlayer.name}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {(() => {
                      const code = FIFA_NATIONS.find(n => n.name === signingPlayer.nationality)?.code
                      return code ? <img src={`https://flagcdn.com/${code}.svg`} alt={signingPlayer.nationality} className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/10" /> : null
                    })()}
                    {signingPlayer.club ? (
                      <span className="flex items-center gap-1.5 text-xs text-gray-600">
                        {signingPlayer.club.badge_url ? (
                          <img src={signingPlayer.club.badge_url} alt="" className="h-4 w-4 object-contain shrink-0" />
                        ) : null}
                        <span>{signingPlayer.club.name}</span>
                      </span>
                    ) : <FreeAgentIcon size={20} />}
                    {signingPlayer.age && <span className="text-xs text-gray-400">{signingPlayer.age} yrs</span>}
                  </div>
                </div>
              </div>

              {/* OVR & Position Badge */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <OvrBadge value={signingPlayer.ovr} size="md" />
                <PositionBadge position={signingPlayer.position} />
              </div>
            </div>

            <ClubSelect
              label="Select Club"
              value={selectedClubId}
              onChange={setSelectedClubId}
              clubs={saveData.teams.filter(team => (team.budget > 0 || team.club_id === selectedClubId) && team.club_id !== signingPlayer.club?.id).map(team => ({
                ...team,
                id: team.club_id,
                name: `${team.club_name}  ·  $${formatCurrency(team.budget)}  ·  ${team.roster?.length || 0} players`,
                short_name: team.short_name || team.club_name.slice(0, 3).toUpperCase(),
              }))}
            />

            <div>
              <label className="mb-1 block text-xs font-heading font-bold uppercase tracking-wider text-gray-500">Transfer Fee</label>
              <div className="flex items-center gap-1.5">
                {[-10, -5].map(amount => <button key={amount} type="button" onClick={() => { const value = Math.max(0, agreedFee + amount * 1_000_000); setAgreedFee(value); setFeeDisplay((value / 1_000_000).toFixed(1)) }} className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">{amount}</button>)}
                <div className="relative min-w-[90px] flex-1"><input type="number" min="0" step="0.1" value={feeDisplay} onChange={event => { setFeeDisplay(event.target.value); setAgreedFee(Math.max(0, Math.round(Number(event.target.value || 0) * 1_000_000))) }} onBlur={() => setFeeDisplay((agreedFee / 1_000_000).toFixed(1))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-center font-heading font-bold focus:border-[#FD5461] focus:outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">M</span></div>
                {[5, 10].map(amount => <button key={amount} type="button" onClick={() => { const value = agreedFee + amount * 1_000_000; setAgreedFee(value); setFeeDisplay((value / 1_000_000).toFixed(1)) }} className="h-9 rounded-lg border border-gray-200 px-2 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+{amount}</button>)}
              </div>
            </div>

            {(() => {
              const selectedTeam = saveData.teams.find(t => t.club_id === selectedClubId)
              if (!selectedTeam) return null
              const budgetAfter = selectedTeam.budget - agreedFee
              return (
                <p className={`text-sm font-medium ${budgetAfter < 0 ? 'text-red-500 font-bold' : 'text-[#FD5461]'}`}>
                  Budget after signing: {budgetAfter < 0 ? `-$${formatCurrency(Math.abs(budgetAfter))}` : `$${formatCurrency(budgetAfter)}`}
                </p>
              )
            })()}

            <Button
              className="w-full justify-center py-4 text-base"
              onClick={handleSign}
              disabled={!selectedClubId || processing}
            >
              {processing ? 'Processing...' : `Confirm Signing`}
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={!!editPlayer} onClose={() => setEditPlayer(null)} title="Edit Player" width="max-w-xl">
        {editPlayer && (
          <PlayerForm
            key={editPlayer.id}
            initialValues={editPlayerInitial}
            onSubmit={handlePlayerUpdate}
            loading={processing}
            clubs={editPlayer.club ? [{
              id: editPlayer.club.id,
              name: editPlayer.club.name,
              short_name: editPlayer.club.short_name,
              badge_url: editPlayer.club.badge_url,
              badge_color: editPlayer.club.badge_color,
            }] : []}
          />
        )}
      </Modal>

      {/* Manage Players Modal */}
      <Modal open={playerManagerOpen} onClose={() => !processing && setPlayerManagerOpen(false)} title="Manage Players">
        <div className="flex h-[min(65dvh,560px)] min-h-0 flex-col space-y-3">
          {/* Filters: Search + Status Dropdown + Position Dropdown */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-gray-900/20 transition-all">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="search"
                placeholder="Search master players..."
                value={playerManagerSearch}
                onChange={(e) => setPlayerManagerSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <div className="w-36 shrink-0">
              <Select
                value={playerManagerStatusFilter}
                onChange={(e) => setPlayerManagerStatusFilter(e.target.value)}
                reserveErrorSpace={false}
                className="min-h-9 rounded-xl py-1 text-xs"
              >
                <option value="all">All Players</option>
                <option value="added">Added (In Save)</option>
                <option value="not_added">Not Added</option>
              </Select>
            </div>
            <div className="w-36 shrink-0">
              <Select
                value={playerManagerPosFilter}
                onChange={(e) => setPlayerManagerPosFilter(e.target.value)}
                reserveErrorSpace={false}
                className="min-h-9 rounded-xl py-1 text-xs"
              >
                <option value="ALL">All Positions</option>
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MF">MF</option>
                <option value="FWD">FWD</option>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 hide-scrollbar">
            {loadingPlayers ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading players...</div>
            ) : masterPlayers.filter(p => {
              const selected = managedPlayerIds.includes(String(p.id))
              const matchSearch = p.name.toLowerCase().includes(playerManagerSearch.toLowerCase()) || p.nationality.toLowerCase().includes(playerManagerSearch.toLowerCase())
              const matchPos = playerManagerPosFilter === 'ALL' || p.position === playerManagerPosFilter
              const matchStatus = playerManagerStatusFilter === 'all' || (playerManagerStatusFilter === 'added' && selected) || (playerManagerStatusFilter === 'not_added' && !selected)
              return matchSearch && matchPos && matchStatus
            }).map(player => {
              const selected = managedPlayerIds.includes(String(player.id))
              const inSavePlayer = allPlayers.find(p => String(p.id) === String(player.id))
              return (
                <button
                  type="button"
                  key={player.id}
                  onClick={() => toggleManagedPlayer(player.id)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.99] ${selected ? 'border-[#FD5461] bg-[#FD5461]/5' : 'border-gray-200 hover:bg-slate-50'}`}
                >
                  <div className="shrink-0">
                    <OvrBadge value={player.ovr} size="sm" />
                  </div>

                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200">
                    {player.photo_url ? (
                      <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-sm">
                        {player.name?.charAt(0)}
                      </div>
                    )}
                  </div>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#0A1318]">{player.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                      <PositionBadge position={player.position} />
                      {(() => {
                        const code = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
                        return code ? <img src={`https://flagcdn.com/${code}.svg`} alt={player.nationality} className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" title={player.nationality} /> : null
                      })()}
                      {player.age && <span className="text-xs text-gray-400">{player.age} yrs</span>}
                    </span>
                  </span>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${selected ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {selected ? <Check size={17} strokeWidth={2.5} /> : <Plus size={17} />}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="shrink-0 border-t border-gray-100 bg-white pt-4">
            <Button className="w-full" onClick={saveManagedPlayers} disabled={processing || loadingPlayers}>
              {processing ? 'Saving...' : `Save ${managedPlayerIds.length} players`}
            </Button>
          </div>
        </div>
      </Modal>

      <SeasonalGrowthModal
        open={growthModalOpen}
        onClose={() => setGrowthModalOpen(false)}
        adjustments={seasonAdjustments}
        seasonName={`Season ${activeSeason?.id || 1}`}
      />
      <ScrollToTop />
    </div>
  )
}
