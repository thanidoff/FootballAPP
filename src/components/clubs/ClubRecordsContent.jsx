import { useState, useEffect } from 'react'
import { fetchClubRecords } from '../../services/clubs'
import Spinner from '../ui/Spinner'
import PositionBadge from '../ui/PositionBadge'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import FreeAgentIcon from '../ui/FreeAgentIcon'

export default function ClubRecordsContent({ club }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('goal') // 'goal' | 'assist' | 'mvp' | 'cards'

  useEffect(() => {
    if (club) {
      setLoading(true)
      fetchClubRecords(club.id)
        .then(setData)
        .finally(() => setLoading(false))
    }
  }, [club])

  if (!club) return null

  const getActiveList = () => {
    if (!data) return []
    if (tab === 'goal') return data.topScorers
    if (tab === 'assist') return data.topAssists
    if (tab === 'mvp') return data.mostMvps
    if (tab === 'cards') return [...data.mostYellows, ...data.mostReds].sort((a, b) => b.value - a.value)
    return []
  }

  const activeList = getActiveList()

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-100 px-6 pt-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'goal', label: 'Top Scorers', icon: '⚽' },
          { id: 'assist', label: 'Top Assists', icon: '🎯' },
          { id: 'mvp', label: 'MVPs', icon: '🏆' },
          { id: 'cards', label: 'Disciplines', icon: '🟨' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-4 font-heading font-black text-[11px] uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap flex items-center gap-2
              ${tab === t.id ? 'border-[#FD5461] text-[#0A1318]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px] p-6">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : activeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-300">
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
             </svg>
             <p className="mt-4 font-heading font-bold uppercase tracking-widest text-sm">No records found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeList.map((item, i) => {
              const p = item.player
              const flagCode = FIFA_NATIONS.find(n => n.name === p.nationality)?.code
              const playerClub = p.club

              return (
                <div 
                  key={p.id} 
                  className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:border-gray-200 transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-5 font-heading font-black text-base text-gray-200 group-hover:text-gray-300 transition-colors">
                      {i + 1}
                    </div>
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white ring-2 ring-white shadow-sm flex-shrink-0">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-black text-gray-400 uppercase bg-gray-100">
                            {p.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[#0A1318] border-2 border-white flex items-center justify-center shadow-sm">
                        <span className="text-[10px] font-black text-white">{p.ovr}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading font-black text-sm text-[#0A1318] uppercase tracking-tight truncate">{p.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <PositionBadge position={p.position} />
                        {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-2.5 w-4 object-cover rounded-sm shadow-sm" alt="" />}
                        {playerClub ? (
                          playerClub.badge_url
                            ? <img src={playerClub.badge_url} alt={playerClub.short_name} className="w-4 h-4 object-contain" />
                            : <div className="w-4 h-4 rounded-sm flex items-center justify-center text-white text-[6px] font-black" style={{ backgroundColor: playerClub.badge_color ?? "#6b7280" }}>{playerClub.short_name?.slice(0, 1)}</div>
                        ) : <FreeAgentIcon size={14} />}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 ml-3">
                    <span className="text-2xl font-heading font-black text-[#0A1318] tabular-nums">
                      {item.value}
                    </span>
                    <span className="text-[9px] font-heading font-black uppercase tracking-widest text-gray-400 -mt-1">
                      {tab === 'goal' ? 'Goals' : tab === 'assist' ? 'Assists' : tab === 'mvp' ? 'Awards' : 'Cards'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
