import { useState, useEffect } from 'react'
import { fetchClubRecords } from '../../services/clubs'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'
import PositionBadge from '../ui/PositionBadge'

export default function ClubRecordsModal({ club, open, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('goal') // 'goal' | 'assist' | 'mvp' | 'cards'

  useEffect(() => {
    if (open && club) {
      setLoading(true)
      fetchClubRecords(club.id)
        .then(setData)
        .finally(() => setLoading(false))
    }
  }, [open, club])

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
    <Modal open={open} onClose={onClose} title={`${club.name} - All-Time Records`} width="max-w-xl">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-100 mb-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'goal', label: 'Top Scorers', icon: '⚽' },
          { id: 'assist', label: 'Top Assists', icon: '🎯' },
          { id: 'mvp', label: 'MVPs', icon: '🏆' },
          { id: 'cards', label: 'Disciplines', icon: '🟨' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 font-heading font-black text-[11px] uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap flex items-center gap-2
              ${tab === t.id ? 'border-[#0A1318] text-[#0A1318]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
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
          <div className="space-y-2">
            {activeList.map((item, i) => (
              <div 
                key={item.player.id} 
                className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 font-heading font-black text-lg text-gray-200 group-hover:text-gray-300 transition-colors">
                    {i + 1}
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 ring-2 ring-white shadow-sm flex-shrink-0">
                    {item.player.photo_url ? (
                      <img src={item.player.photo_url} alt={item.player.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-400 uppercase bg-gray-50">
                        {item.player.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-heading font-black text-sm text-[#0A1318] uppercase tracking-tight">{item.player.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PositionBadge position={item.player.position} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-heading font-black text-[#0A1318] tabular-nums">
                    {item.value}
                  </span>
                  <span className="text-[9px] font-heading font-black uppercase tracking-widest text-gray-400 -mt-1">
                    {tab === 'goal' ? 'Goals' : tab === 'assist' ? 'Assists' : tab === 'mvp' ? 'Awards' : 'Cards'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
