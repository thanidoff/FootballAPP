import { useState, useEffect } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { updateDraftState } from '../../../services/draftSave'
import PlayerCard from '../../../components/ui/PlayerCard'

export default function DraftSquadsTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [processing, setProcessing] = useState(false)

  // Default to first team if none selected
  const selectedClubId = searchParams.get('team') || saveData.teams[0]?.club_id

  useEffect(() => {
    if (!searchParams.get('team') && saveData.teams.length > 0) {
      setSearchParams({ team: saveData.teams[0].club_id }, { replace: true })
    }
  }, [saveData, searchParams, setSearchParams])

  const teamIndex = saveData.teams.findIndex(t => t.club_id === selectedClubId)
  const team = saveData.teams[teamIndex]

  if (!team) return null

  async function handleRelease(player) {
    if (!window.confirm(`Release ${player.name} to Free Agents? You will get back $${(player.market_value / 1000000).toFixed(1)}M.`)) return
    
    setProcessing(true)
    try {
      const newTeams = [...saveData.teams]
      const currentTeam = { ...newTeams[teamIndex] }
      const newFreeAgents = [...(saveData.freeAgents || [])]

      // Remove from roster
      currentTeam.roster = currentTeam.roster.filter(p => p.id !== player.id)
      // Refund budget
      currentTeam.budget += (player.market_value || 0)
      
      newTeams[teamIndex] = currentTeam
      
      const releasedPlayer = { ...player, club_id: null, club: null }
      newFreeAgents.push(releasedPlayer)

      const newSaveData = { ...saveData, teams: newTeams, freeAgents: newFreeAgents }
      await updateDraftState(saveId, newSaveData)
      setSaveData(newSaveData)
    } catch (err) {
      console.error('Failed to release player', err)
      alert('Failed to release player')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      {/* Team Selector Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0">
        <h3 className="font-heading font-black text-xs text-gray-400 uppercase tracking-widest mb-4">Select Team</h3>
        <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {saveData.teams.map(t => (
            <button
              key={t.club_id}
              onClick={() => setSearchParams({ team: t.club_id })}
              className={`flex-shrink-0 md:flex-shrink flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                selectedClubId === t.club_id 
                  ? 'border-[#0A1318] bg-gray-50 ring-1 ring-[#0A1318]' 
                  : 'border-transparent hover:bg-gray-50'
              }`}
            >
              {t.badge_url ? (
                <img src={t.badge_url} alt={t.club_name} className="w-8 h-8 object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200" />
              )}
              <div className="hidden md:block flex-1 min-w-0">
                <div className="font-bold text-sm text-[#0A1318] truncate">{t.club_name}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t.roster.length} Players</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {team.badge_url ? (
              <img src={team.badge_url} alt={team.club_name} className="w-12 h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-200" />
            )}
            <div>
              <h1 className="text-2xl font-heading font-black text-[#0A1318] uppercase tracking-wider leading-none mb-1">
                {team.club_name}
              </h1>
              <div className="text-sm font-bold text-green-600">
                Budget: ${(team.budget / 1000000).toFixed(1)}M
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-2 rounded-xl">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg OVR</div>
            <div className="text-xl font-heading font-black text-[#0A1318]">
              {team.roster.length ? Math.round(team.roster.reduce((sum, p) => sum + p.ovr, 0) / team.roster.length) : '-'}
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${processing ? 'opacity-50' : 'opacity-100'}`}>
          {team.roster.sort((a,b) => b.ovr - a.ovr).map(p => {
            const player = {
              ...p,
              club: {
                id: team.club_id,
                name: team.club_name,
                short_name: team.club_name,
                badge_url: team.badge_url,
                badge_color: team.badge_color
              }
            }
            return (
              <PlayerCard 
                key={player.id} 
                player={player} 
                onDelete={() => handleRelease(player)} 
                deleteLabel="Release"
              />
            )
          })}
        </div>
        
        {team.roster.length === 0 && (
          <div className="text-center py-16 text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">
            No players in roster.
          </div>
        )}
      </div>
    </div>
  )
}
