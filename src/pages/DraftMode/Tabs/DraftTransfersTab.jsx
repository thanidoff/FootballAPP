import { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { transferDraftPlayer, updateDraftState } from '../../../services/draftSave'
import PlayerCard from '../../../components/ui/PlayerCard'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import ClubSelect from '../../../components/ui/ClubSelect'
import PlayerForm from '../../../components/players/PlayerForm'
import AnimatedTabs from '../../../components/ui/AnimatedTabs'
import { formatCurrency } from '../../../utils/currency'
import { calculateOVR } from '../../../utils/stats'
import { useToast } from '../../../components/ui/Toast'

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
    const sourceList = tab === 'all' ? allPlayers : cleanFreeAgents
    return sourceList
      .filter((p) => {
        const matchPos = posFilter === 'ALL' || p.position === posFilter
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.nationality.toLowerCase().includes(search.toLowerCase())
        return matchPos && matchSearch
      })
      .sort((a, b) => ovrSort === 'desc' ? b.ovr - a.ovr : a.ovr - b.ovr)
  }, [allPlayers, cleanFreeAgents, tab, posFilter, search, ovrSort])

  async function handleSign() {
    if (!signingPlayer || !selectedClubId) return
    const team = saveData.teams.find(t => t.club_id === selectedClubId)
    if (!team) return
    
    if (signingPlayer.club?.id === selectedClubId) {
      toast.error('Player is already in this team!')
      return
    }

    if (team.budget < agreedFee) {
      toast.error('Insufficient budget!')
      return
    }

    setProcessing(true)
    try {
      const newSaveData = await transferDraftPlayer(saveId, signingPlayer.id, selectedClubId, agreedFee)
      setSaveData(newSaveData)
      
      toast.success(`Signed ${signingPlayer.name} to ${team.club_name}`)
      setSigningPlayer(null)
      setSelectedClubId('')
    } catch (err) {
      console.error('Failed to sign player', err)
      toast.error(err.message || 'Failed to sign player')
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
      }
      delete updatedPlayer.club

      const isFreeAgent = !editPlayer.club?.id
      updatedPlayer.club_id = isFreeAgent ? null : editPlayer.club.id
      const newTeams = saveData.teams.map(team => ({
        ...team,
        roster: (team.roster || []).map(player => player.id === editPlayer.id ? updatedPlayer : player),
      }))
      const newFreeAgents = (saveData.freeAgents || []).map(player => player.id === editPlayer.id ? updatedPlayer : player)
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

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <AnimatedTabs items={[{ id: 'all', label: `All Players (${allPlayers.length})` }, { id: 'free', label: `Free Agents (${freeAgents.length})` }]} value={tab} onChange={setTab} ariaLabel="Transfer player groups" className="mb-6 gap-1" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Search name or nationality..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        />
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
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
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 border border-gray-100">
              {signingPlayer.photo_url ? (
                <img src={signingPlayer.photo_url} alt={signingPlayer.name} className="w-16 h-16 rounded-full object-cover bg-white ring-2 ring-white shadow-sm" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-heading font-black text-xl text-gray-400 ring-2 ring-white shadow-sm">
                  {signingPlayer.name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <div className="font-heading font-black text-xl text-[#0A1318]">{signingPlayer.name}</div>
                <div className="text-sm font-bold text-[#FD5461] mt-1">OVR {signingPlayer.ovr} · {signingPlayer.position}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Market Value</div>
                <div className="font-heading font-black text-2xl text-[#0A1318]">${formatCurrency(signingPlayer.market_value)}</div>
              </div>
            </div>

            <ClubSelect
              label="Select Club"
              value={selectedClubId}
              onChange={setSelectedClubId}
              clubs={saveData.teams.filter(team => team.club_id !== signingPlayer.club?.id).map(team => ({
                ...team,
                id: team.club_id,
                name: `${team.club_name}  ·  $${formatCurrency(team.budget)}  ·  ${team.roster?.length || 0} players${team.budget < agreedFee ? '  (insufficient)' : ''}`,
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

            {signingTeam && <p className={`text-sm font-medium ${canAfford ? 'text-[#FD5461]' : 'text-red-600'}`}>{canAfford ? `Budget after signing: $${formatCurrency(signingTeam.budget - agreedFee)}` : `Insufficient budget. Short by $${formatCurrency(agreedFee - signingTeam.budget)}`}</p>}

            <Button
              className="w-full justify-center py-4 text-base"
              onClick={handleSign}
              disabled={!selectedClubId || !canAfford || processing}
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
    </div>
  )
}
