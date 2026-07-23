import { useState, useEffect } from 'react'
import { useParams, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { loadDraftState } from '../../services/draftSave'
import AnimatedTabs from '../../components/ui/AnimatedTabs'
import { LogOut } from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'squads', label: 'Squads' },
  { id: 'transfers', label: 'Transfer Market' },
  { id: 'matches', label: 'League' },
  { id: 'cup', label: 'Cup' }
]

export default function DraftDashboardPage() {
  const { saveId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [saveData, setSaveData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetchSave() {
      if (!saveData) setLoading(true)
      try {
        const data = await loadDraftState(saveId)
        if (!mounted) return
        if (!data) navigate('/draft')
        else setSaveData(data)
      } catch (err) {
        console.error('Failed to load save', err)
        if (mounted) navigate('/draft')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchSave()
    return () => { mounted = false }
  }, [saveId])

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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-heading font-black text-[#0A1318] uppercase tracking-wider mb-1">{saveData.name}</h1>
          <p className="text-sm font-medium text-gray-500">Season {displayedSeasonNumber} <span className="mx-1.5 text-[#FD5461]">·</span> Week {saveData.currentWeek || 1}</p>
        </div>
        <button 
          onClick={() => navigate('/draft')}
          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-gray-100 px-5 py-2 text-sm font-medium text-[#0A1318] transition-colors hover:bg-slate-200"
        >
          <LogOut size={16} strokeWidth={2} />
          Exit Save
        </button>
      </div>

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
