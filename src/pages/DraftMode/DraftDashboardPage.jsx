import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { loadDraftState } from '../../services/draftSave'
import AnimatedTabs from '../../components/ui/AnimatedTabs'
import { LogOut } from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'squads', label: 'Squads' },
  { id: 'transfers', label: 'Player Market' },
  { id: 'coach-transfers', label: 'Coach Market' },
  { id: 'matches', label: 'League' },
  { id: 'cup', label: 'Cup' }
]

export default function DraftDashboardPage() {
  const { saveId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [saveData, setSaveData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSave = useCallback(async (silent = false) => {
    if (!silent) setLoading(!saveData)
    try {
      const data = await loadDraftState(saveId)
      if (!data) navigate('/draft')
      else setSaveData(data)
    } catch (err) {
      console.error('Failed to load save', err)
      navigate('/draft')
    } finally {
      setLoading(false)
    }
  }, [saveId])

  // Initial load
  useEffect(() => {
    fetchSave()
  }, [fetchSave])

  // Listen for smooth refresh events from the RefreshButton in Layout
  useEffect(() => {
    function onRefetch() { fetchSave(true) }
    window.addEventListener('app:refetch', onRefetch)
    return () => window.removeEventListener('app:refetch', onRefetch)
  }, [fetchSave])

  if (loading) {
    return <div className="max-w-7xl mx-auto py-16 text-center font-heading font-black text-gray-400 uppercase tracking-widest">Loading Career...</div>
  }
  
  if (!saveData) return null

  const currentTab = location.pathname.split('/').pop()
  const seasons = saveData.settings?.seasons || []
  const activeSeasonIndex = seasons.findIndex(season => season.status === 'active')
  const displayedSeasonIndex = activeSeasonIndex >= 0 ? activeSeasonIndex : Math.max(0, seasons.length - 1)
  const displayedSeasonNumber = seasons[displayedSeasonIndex]?.id || displayedSeasonIndex + 1

  return (
    <div className="w-full py-0 sm:py-2">
      {/* Tabs Navigation */}
      <AnimatedTabs items={TABS.map(tab => ({ ...tab, to: `/draft/${saveId}/${tab.id}` }))} value={currentTab} ariaLabel="Career sections" className="mb-8 gap-3" />

      {/* Tab Content via Outlet */}
      <div key={currentTab} className="bg-transparent ui-tab-content-enter">
        {/* We pass the context to children so they can access saveData and refresh it */}
        <Outlet context={{ saveData, setSaveData, saveId }} />
      </div>
    </div>
  )
}
