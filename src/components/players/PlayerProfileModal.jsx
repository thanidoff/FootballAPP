import { useState, useEffect } from 'react'
import { fetchPlayerHistory } from '../../services/players'
import Modal from '../ui/Modal'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import PositionBadge from '../ui/PositionBadge'
import StatBar from '../ui/StatBar'
import { STATS_BY_POSITION } from '../../utils/stats'
import Spinner from '../ui/Spinner'

const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))

function ClubBadge({ club, size = 'sm' }) {
  const isLg = size === 'lg'
  const s = isLg ? 'w-10 h-10' : 'w-6 h-6'
  if (!club) return <div className={`${s} rounded-lg bg-gray-100 flex-shrink-0`} />
  
  if (club.is_national) {
    const flagCode = NATION_CODE[club.name] || club.short_name?.toLowerCase()
    const rectSize = isLg ? 'w-10 h-7' : 'w-7 h-5'
    return (
      <div className={`${rectSize} rounded shadow-sm overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-black/5`}>
        <img src={`https://flagcdn.com/${flagCode}.svg`} alt={club.name} className="w-full h-full object-cover" />
      </div>
    )
  }

  if (club.badge_url) {
    return (
      <div className={`${s} rounded-lg overflow-hidden bg-white flex-shrink-0 ring-1 ring-black/5 p-0.5`}>
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain" />
      </div>
    )
  }
  return (
    <div className={`${s} rounded-lg flex items-center justify-center font-heading font-black text-white flex-shrink-0 shadow-sm`}
      style={{ backgroundColor: club.badge_color ?? "#6b7280", fontSize: isLg ? '10px' : '8px' }}>
      {club.short_name?.slice(0, 2)}
    </div>
  )
}

export default function PlayerProfileModal({ player, open, onClose, onEdit, onRelease }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stats') // 'stats' | 'history' | 'awards'

  useEffect(() => {
    if (open && player) {
      setLoading(true)
      fetchPlayerHistory(player.id)
        .then(setData)
        .finally(() => setLoading(false))
    }
  }, [open, player])

  if (!player) return null

  const flagCode = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
  const statKeys = STATS_BY_POSITION[player.position] || []

  return (
    <Modal open={open} onClose={onClose} title="Player Profile" width="max-w-2xl">
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        {/* Photo and Basic Info */}
        <div className="flex flex-col items-center gap-4 flex-shrink-0">
          <div className="w-32 h-32 rounded-3xl overflow-hidden bg-gray-100 ring-4 ring-gray-50 shadow-inner">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-heading font-black text-gray-300">
                {player.name.charAt(0)}
              </div>
            )}
          </div>
          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center -mt-10 z-10 shadow-lg border-2 border-white
            ${player.ovr >= 85 ? 'bg-[#FD5461] text-white' : player.ovr >= 75 ? 'bg-[#0A1318] text-white' : 'bg-gray-400 text-white'}`}>
            <span className="text-xl font-bold leading-none">{player.ovr}</span>
            <span className="text-[8px] font-black uppercase tracking-tighter opacity-80 mt-0.5">{player.position}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-heading font-black uppercase tracking-tight text-gray-900 truncate">{player.name}</h2>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} className="h-3 w-5 object-cover rounded-sm" alt="" />}
                  <span className="text-sm font-medium text-gray-600">{player.nationality}</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-sm font-medium text-gray-600">{player.age} years old</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <PositionBadge position={player.position} />
              </div>
            </div>

            <div className="flex gap-2">
              {onEdit && (
                <button
                  onClick={() => { onClose(); onEdit(player) }}
                  className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Edit Player"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              {onRelease && (
                <button
                  onClick={() => { onClose(); onRelease(player) }}
                  className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  title="Release Player"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 block mb-1">Current Club</span>
              <div className="flex items-center gap-2">
                <ClubBadge club={player.club} size="sm" />
                <span className="font-heading font-bold text-sm text-gray-900 truncate">
                  {player.club ? player.club.name : 'Free Agent'}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 block mb-1">Market Value</span>
              <span className="font-heading font-black text-lg text-gray-900">
                ${new Intl.NumberFormat().format(player.market_value)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-100 mb-6">
        {[
          { id: 'stats', label: 'Abilities' },
          { id: 'history', label: 'Career History' },
          { id: 'awards', label: 'Awards' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 font-heading font-black text-xs uppercase tracking-widest transition-all border-b-2 -mb-px
              ${tab === t.id ? 'border-[#FD5461] text-[#0A1318]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {tab === 'stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {statKeys.map(key => (
              <StatBar key={key} label={key} value={player.stats[key]} />
            ))}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !data?.history?.length ? (
              <div className="text-center py-12 text-gray-400 font-heading font-bold uppercase tracking-widest text-sm">No career data available</div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-heading font-black uppercase tracking-widest text-gray-400">Club / National Team</th>
                      <th className="px-4 py-3 text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 text-center">G</th>
                      <th className="px-4 py-3 text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 text-center">A</th>
                      <th className="px-4 py-3 text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 text-center">MVP</th>
                      <th className="px-4 py-3 text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 text-center">🟨</th>
                      <th className="px-4 py-3 text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 text-center">🟥</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.history.sort((a,b) => b.stats.goal - a.stats.goal).map((h, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ClubBadge club={h.club} size="sm" />
                            <span className="font-heading font-bold text-sm text-gray-900">{h.club.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-heading font-black text-gray-900">{h.stats.goal}</td>
                        <td className="px-4 py-3 text-center font-heading font-bold text-gray-600">{h.stats.assist}</td>
                        <td className="px-4 py-3 text-center font-heading font-bold text-amber-500">{h.stats.mvp}</td>
                        <td className="px-4 py-3 text-center font-heading font-bold text-yellow-600">{h.stats.yellow_card}</td>
                        <td className="px-4 py-3 text-center font-heading font-bold text-red-600">{h.stats.red_card}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'awards' && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !data?.awards?.length ? (
              <div className="text-center py-12 text-gray-400 font-heading font-bold uppercase tracking-widest text-sm">No awards yet</div>
            ) : (
              data.awards.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-xl">🏆</div>
                    <div>
                      <div className="text-[10px] font-heading font-black uppercase tracking-widest text-amber-600 mb-0.5">{a.season_name}</div>
                      <div className="font-heading font-black text-sm uppercase tracking-wide text-[#0A1318]">
                        {a.award_type.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium mr-1">Achieved with</span>
                    <ClubBadge club={a.club} size="sm" />
                    <span className="text-xs font-heading font-bold text-gray-700">{a.club.short_name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
