import { useOutletContext, useNavigate } from 'react-router-dom'

export default function DraftOverviewTab() {
  const { saveData, saveId } = useOutletContext()
  const navigate = useNavigate()

  // Calculate some overview stats if needed
  // If we have matches, maybe show next match here
  
  // Sort teams by points (PTS), then Goal Difference (GD), then Goals For (GF)
  // For now, if no stats exist, just sort by OVR or display as is. We'll add PTS later.
  const seasons = saveData.settings?.seasons || []
  const activeSeason = seasons.find(s => s.status === 'active') || seasons[seasons.length - 1]
  
  // Sort teams by points (PTS), then Goal Difference (GD), then Goals For (GF)
  let standings = []
  if (activeSeason?.status === 'active') {
    standings = [...(saveData.teams || [])].map(t => ({
      club_id: t.club_id,
      club_name: t.club_name,
      badge_url: t.badge_url,
      stats: t.stats || {}
    })).sort((a, b) => {
      const aPts = a.stats?.PTS || 0
      const bPts = b.stats?.PTS || 0
      if (aPts !== bPts) return bPts - aPts
      const aGd = a.stats?.GD || 0
      const bGd = b.stats?.GD || 0
      if (aGd !== bGd) return bGd - aGd
      const aGf = a.stats?.GF || 0
      const bGf = b.stats?.GF || 0
      return bGf - aGf
    })
  } else {
    standings = activeSeason?.standings || []
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Standings */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="font-heading font-black text-lg text-[#0A1318] uppercase tracking-wide mb-4 border-b border-gray-100 pb-2 flex justify-between items-end">
          <span>League Standings</span>
          <span className="text-[10px] text-gray-400">PTS (GD)</span>
        </h2>
        <div className="space-y-3">
          {standings.map((t, idx) => (
            <div 
              key={t.club_id} 
              onClick={() => navigate(`/draft/${saveId}/squads?team=${t.club_id}`)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100"
            >
              <div className="w-6 font-bold text-gray-400 text-sm text-center">{idx + 1}</div>
              {t.badge_url ? (
                <img src={t.badge_url} alt={t.club_name} className="w-6 h-6 object-contain" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200" />
              )}
              <div className="flex-1 font-bold text-sm text-[#0A1318] truncate">{t.club_name}</div>
              <div className="font-mono text-xs font-bold text-gray-900">
                {t.stats?.PTS || 0} <span className="text-gray-400 font-normal">({t.stats?.GD > 0 ? '+' : ''}{t.stats?.GD || 0})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Market Access */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="text-4xl mb-4">🛒</div>
        <h2 className="font-heading font-black text-lg text-[#0A1318] uppercase tracking-wide">Free Agents Market</h2>
        <p className="text-sm text-gray-400 mt-2">{saveData.freeAgents?.length || 0} players available</p>
        <button 
          onClick={() => navigate(`/draft/${saveId}/transfers`)}
          className="mt-6 px-6 py-2 rounded-lg font-heading font-black text-xs uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors"
        >
          Go to Market
        </button>
      </div>

      {/* Quick Matches Access */}
      <div className="bg-[#0A1318] rounded-2xl border border-gray-800 p-6 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <svg width="150" height="150" viewBox="0 0 24 24" fill="currentColor">
             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
        </div>
        <div className="text-4xl mb-4 z-10">⚽</div>
        <h2 className="font-heading font-black text-lg text-white uppercase tracking-wide z-10">Match Day</h2>
        <p className="text-sm text-gray-400 mt-2 z-10">Week {saveData.currentWeek || 1}</p>
        <button 
          onClick={() => navigate(`/draft/${saveId}/matches`)}
          className="mt-6 px-6 py-2 rounded-lg font-heading font-black text-xs uppercase tracking-widest bg-white text-[#0A1318] hover:bg-gray-100 transition-colors z-10"
        >
          View Fixtures
        </button>
      </div>
    </div>
  )
}
