import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { loadDraftState } from '../../services/draftSave'
import AnimatedTabs from '../../components/ui/AnimatedTabs'
import { Banknote, LayoutDashboard, Medal, ShieldCheck, Trophy, Users } from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'squads', label: 'Squads', icon: Users },
  { id: 'transfers', label: 'Player Market', icon: Banknote },
  { id: 'coach-transfers', label: 'Coach Market', icon: ShieldCheck },
  { id: 'matches', label: 'League', icon: Trophy },
  { id: 'cup', label: 'Cup', icon: Medal }
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
      const data = await loadDraftState(saveId, { force: silent })
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
      <AnimatedTabs compactOnMobile items={TABS.map(tab => ({ ...tab, to: `/draft/${saveId}/${tab.id}` }))} value={currentTab} ariaLabel="Career sections" className="mb-8 justify-between gap-0 sm:justify-start sm:gap-3" itemClassName="min-w-11 flex-1 px-2 sm:min-w-0 sm:flex-none sm:px-4" />

      {/* Tab Content via Outlet */}
      <div key={currentTab} className="bg-transparent ui-tab-content-enter">
        {/* We pass the context to children so they can access saveData and refresh it */}
        <Outlet context={{ saveData, setSaveData, saveId }} />
      </div>
    </div>
  )
}
