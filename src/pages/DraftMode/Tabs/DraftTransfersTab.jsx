import { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { updateDraftState } from '../../../services/draftSave'
import PlayerCard from '../../../components/ui/PlayerCard'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import { formatCurrency } from '../../../utils/currency'
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
    
    const teamIndex = saveData.teams.findIndex(t => t.club_id === selectedClubId)
    if (teamIndex === -1) return
    const team = saveData.teams[teamIndex]
    
    if (signingPlayer.club?.id === selectedClubId) {
      toast.error('Player is already in this team!')
      return
    }

    if (team.budget < signingPlayer.market_value) {
      toast.error('Insufficient budget!')
      return
    }

    setProcessing(true)
    try {
      const newTeams = [...saveData.teams]
      const newTeam = { ...team }
      let newFreeAgents = [...freeAgents]

      newTeam.budget -= signingPlayer.market_value
      
      const playerToStore = { ...signingPlayer }
      delete playerToStore.club
      playerToStore.club_id = team.club_id

      newTeam.roster.push(playerToStore)
      newTeams[teamIndex] = newTeam

      if (signingPlayer.club?.id) {
        const fromTeamIndex = newTeams.findIndex(t => t.club_id === signingPlayer.club.id)
        if (fromTeamIndex !== -1) {
          const oldTeam = { ...newTeams[fromTeamIndex] }
          oldTeam.budget += signingPlayer.market_value 
          oldTeam.roster = oldTeam.roster.filter(p => p.id !== signingPlayer.id)
          newTeams[fromTeamIndex] = oldTeam
        }
      } else {
        newFreeAgents = newFreeAgents.filter(p => p.id !== signingPlayer.id)
      }

      const newSaveData = { ...saveData, teams: newTeams, freeAgents: newFreeAgents }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
      
      toast.success(`Signed ${signingPlayer.name} to ${team.club_name}`)
      setSigningPlayer(null)
      setSelectedClubId('')
    } catch (err) {
      console.error('Failed to sign player', err)
      toast.error('Failed to sign player')
    } finally {
      setProcessing(false)
    }
  }

  const signingTeam = saveData.teams.find(t => t.club_id === selectedClubId)
  const canAfford = signingTeam && signingPlayer ? signingTeam.budget >= signingPlayer.market_value : false

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'all', label: `All Players (${allPlayers.length})` },
          { key: 'free', label: `Free Agents (${freeAgents.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-heading font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors text-center
              ${tab === key
                ? 'border-[#0A1318] text-[#0A1318]'
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
            className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onSign={() => {
                setSigningPlayer(player)
                setSelectedClubId('')
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
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fee</div>
                <div className="font-heading font-black text-2xl text-[#0A1318]">${formatCurrency(signingPlayer.market_value)}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500 block mb-2">
                Select Team to Sign For
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {saveData.teams.filter(t => t.club_id !== signingPlayer.club?.id).map(t => {
                  const afford = t.budget >= signingPlayer.market_value
                  return (
                    <button
                      key={t.club_id}
                      onClick={() => afford && setSelectedClubId(t.club_id)}
                      disabled={!afford}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                        selectedClubId === t.club_id 
                          ? 'border-[#0A1318] bg-gray-50 ring-1 ring-[#0A1318]' 
                          : afford 
                            ? 'border-gray-200 hover:border-gray-300 bg-white' 
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {t.badge_url ? (
                          <img src={t.badge_url} alt={t.club_name} className="w-6 h-6 object-contain" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-gray-200" />
                        )}
                        <span className="font-bold text-sm text-[#0A1318]">{t.club_name}</span>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${afford ? 'text-green-600' : 'text-red-500'}`}>
                          ${formatCurrency(t.budget)}
                        </div>
                        {!afford && <div className="text-[10px] text-red-400 uppercase font-bold tracking-widest">Insufficient</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

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
    </div>
  )
}
