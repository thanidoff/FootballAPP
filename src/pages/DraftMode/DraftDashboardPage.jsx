import { useState, useEffect } from 'react'
import { useParams, useNavigate, Outlet, useLocation, Link } from 'react-router-dom'
import { loadDraftState } from '../../services/draftSave'

const TABS = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'squads', label: 'Squads' },
  { id: 'transfers', label: 'Transfer Market' },
  { id: 'matches', label: 'Matches' }
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
    return <div className="max-w-7xl mx-auto py-16 text-center font-heading font-black text-gray-400 uppercase tracking-widest">Loading Draft Mode...</div>
  }
  
  if (!saveData) return null

  const currentTab = location.pathname.split('/').pop()

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-heading font-black text-[#0A1318] uppercase tracking-wider mb-1">{saveData.name}</h1>
          <p className="text-gray-500 font-bold text-sm">Week {saveData.currentWeek || 1}</p>
        </div>
        <button 
          onClick={() => navigate('/draft')}
          className="px-6 py-2 rounded-xl font-heading font-black text-xs uppercase tracking-widest bg-gray-100 text-[#0A1318] hover:bg-gray-200 transition-colors"
        >
          Exit Save
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto hide-scrollbar gap-8 mb-8 border-b border-gray-100 px-1">
        {TABS.map(tab => (
          <Link
            key={tab.id}
            to={`/draft/${saveId}/${tab.id}`}
            className={`whitespace-nowrap pb-3 font-heading font-black text-sm uppercase tracking-widest transition-all cursor-pointer border-b-2 -mb-[1px] ${
              currentTab === tab.id
                ? 'border-[#0A1318] text-[#0A1318]'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab Content via Outlet */}
      <div className="bg-transparent">
        {/* We pass the context to children so they can access saveData and refresh it */}
        <Outlet context={{ saveData, setSaveData, saveId }} />
      </div>
    </div>
  )
}
