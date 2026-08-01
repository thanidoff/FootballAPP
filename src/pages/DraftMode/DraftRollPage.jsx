import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { fetchPlayers } from '../../services/players'
import { generateInitialDraft, rollDraft } from '../../utils/draftLogic'
import { createDraftState } from '../../services/draftSave'
import PlayerCard from '../../components/ui/PlayerCard'

export default function DraftRollPage() {
  const [searchParams] = useSearchParams()
  const saveName = searchParams.get('name') || 'Draft Save'
  const navigate = useNavigate()
  const location = useLocation()
  
  const [teams, setTeams] = useState([])
  const [availablePool, setAvailablePool] = useState([])
  const [availableCoachesPool, setAvailableCoachesPool] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRolling, setIsRolling] = useState(false)

  // From setup page
  const { clubs } = location.state || {}

  useEffect(() => {
    if (!saveName || !clubs?.length) {
      navigate('/draft')
      return
    }

    async function load() {
      try {
        const allPlayers = await fetchPlayers() // Get all global players
        const { newTeams, remainingPlayers, remainingCoaches } = generateInitialDraft(clubs, allPlayers)
        setTeams(newTeams)
        setAvailablePool(remainingPlayers)
        setAvailableCoachesPool(remainingCoaches || [])
      } catch (err) {
        console.error('Failed to load draft data', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [saveName, clubs, navigate])

  function handleReroll(teamIndex = null) {
    setIsRolling(true)
    setTimeout(() => {
      const { newTeams, remainingPlayers, remainingCoaches } = rollDraft(teams, availablePool, teamIndex, availableCoachesPool)
      setTeams(newTeams)
      setAvailablePool(remainingPlayers)
      setAvailableCoachesPool(remainingCoaches || [])
      setIsRolling(false)
    }, 400) // Small delay for visual feedback
  }

  async function handleConfirm() {
    setIsRolling(true) // Disable buttons
    const saveObj = {
      name: saveName,
      settings: { startingBudgets: Object.fromEntries(teams.map(team => [team.club_id, team.budget])) },
      teams: teams,
      freeAgents: availablePool,
      freeAgentsCoaches: availableCoachesPool,
      currentWeek: 1
    }
    try {
      const newSaveId = await createDraftState(saveObj)
      navigate(`/draft/${newSaveId}`)
    } catch (err) {
      console.error('Failed to create save', err)
      alert('Failed to save to database')
      setIsRolling(false)
    }
  }

  if (loading) return <div className="p-8 text-center font-heading font-bold text-[#0A1318]">Preparing Draft Pool...</div>

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-black text-[#0A1318] uppercase tracking-wider mb-2">Draft Results</h1>
          <p className="text-gray-500 text-sm">Review drafted players. You can re-roll if you don't like the RNG.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => handleReroll(null)}
            disabled={isRolling}
            className="px-6 py-3 rounded-xl font-heading font-black text-xs uppercase tracking-widest bg-gray-100 text-[#0A1318] hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Re-roll All
          </button>
          <button 
            onClick={handleConfirm}
            className="px-6 py-3 rounded-xl font-heading font-black text-xs uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
          >
            Confirm & Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teams.map((team, idx) => (
          <div key={team.club_id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-opacity ${isRolling ? 'opacity-50' : 'opacity-100'}`}>
            <div className="p-4 flex items-center justify-between border-b border-gray-50" style={{ borderBottomColor: team.badge_color || '#eee' }}>
              <div className="flex items-center gap-3 min-w-0">
                {team.badge_url ? (
                  <img src={team.badge_url} alt={team.club_name} className="w-8 h-8 object-contain" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[10px]">
                    Logo
                  </div>
                )}
                <h3 className="font-heading font-black text-sm text-[#0A1318] uppercase tracking-wide truncate">{team.club_name}</h3>
              </div>
              <button 
                onClick={() => handleReroll(idx)}
                disabled={isRolling}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#FD5461] hover:bg-red-50 transition-colors shrink-0"
                title="Re-roll this team"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-5.41 5.41"/>
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-3 bg-gray-50/50">
              {(team.roster || []).map(p => {
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
                return <PlayerCard key={player.id} player={player} compact={true} />
              })}

              {(team.coaches || []).length > 0 && (
                <div className="pt-2 mt-2 border-t border-gray-100 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Coaches ({team.coaches.length})</div>
                  {team.coaches.map((c, cIdx) => (
                    <div key={c.id || cIdx} className="flex items-center justify-between text-xs font-semibold bg-white p-2 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-[#FD5461]">{cIdx === 0 ? 'HC' : 'AC'}</span>
                        <span className="truncate text-gray-800">{c.name}</span>
                      </div>
                      <span className="font-bold text-gray-500 text-[11px]">{c.ovr} OVR</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
