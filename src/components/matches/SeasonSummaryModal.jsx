import { useState, useEffect } from 'react'
import { fetchSeasonStats } from '../../services/friendlyMatches'

function ClubBadge({ club }) {
  if (!club) return null
  if (club.badge_url) {
    return (
      <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-0.5" />
      </div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-heading font-black text-white text-[10px] flex-shrink-0"
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>
      {club.short_name}
    </div>
  )
}

function PlayerAvatar({ player }) {
  if (!player) return null
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
      {player.photo_url
        ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center font-heading font-black text-gray-400 text-sm">{player.name?.charAt(0)}</div>
      }
    </div>
  )
}

function PerformerRow({ entry, valueLabel }) {
  if (!entry) return (
    <div className="text-xs text-gray-300 font-heading font-bold py-2">No data</div>
  )
  const list = Array.isArray(entry) ? entry : [entry]
  return (
    <div className="space-y-2">
      {list.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <PlayerAvatar player={item.player} />
          <div className="flex-1 min-w-0">
            <div className="font-heading font-bold text-sm text-[#0A1318] truncate">{item.player?.name ?? '—'}</div>
            <div className="text-[11px] text-gray-400">{item.club?.short_name}</div>
          </div>
          <div className="font-heading font-black text-lg text-[#0A1318] tabular-nums">
            {item.value}
            <span className="text-xs text-gray-400 font-bold ml-0.5">{valueLabel}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SeasonSummaryModal({ season, open, onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !season) return
    setLoading(true)
    fetchSeasonStats(season.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [open, season])

  if (!open || !season) return null

  const startDate = season.started_at
    ? new Date(season.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const endDate = season.ended_at
    ? new Date(season.ended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318]">{season.name}</div>
            {startDate && (
              <div className="text-xs text-gray-400 font-heading font-medium mt-0.5">
                {startDate}{endDate ? ` – ${endDate}` : ' · Active'}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl font-bold cursor-pointer">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">
          {loading && (
            <div className="text-center py-10 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">
              Loading season data...
            </div>
          )}

          {!loading && stats && (
            <>
              {/* Standings Table */}
              <div>
                <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-3">Standings</div>
                {stats.standings.length === 0 ? (
                  <div className="text-xs text-gray-300 font-heading font-bold text-center py-4">No matches played</div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 px-4 py-2.5 border-b border-gray-100"
                      style={{ gridTemplateColumns: '1fr repeat(7, 32px)' }}>
                      <span>Club</span>
                      <span className="text-center">P</span>
                      <span className="text-center">W</span>
                      <span className="text-center">D</span>
                      <span className="text-center">L</span>
                      <span className="text-center">GF</span>
                      <span className="text-center">GA</span>
                      <span className="text-center font-black text-[#0A1318]">GD</span>
                    </div>
                    {stats.standings.map((row, i) => (
                      <div key={i}
                        className="grid items-center px-4 py-2.5 border-b border-gray-100 last:border-0"
                        style={{ gridTemplateColumns: '1fr repeat(7, 32px)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-heading font-black text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                          <ClubBadge club={row.club} />
                          <span className="font-heading font-bold text-xs text-[#0A1318] truncate">{row.club?.short_name}</span>
                        </div>
                        {[row.p, row.w, row.d, row.l, row.gf, row.ga].map((v, j) => (
                          <span key={j} className="text-xs font-heading font-bold text-gray-500 text-center tabular-nums">{v}</span>
                        ))}
                        <span className={`text-xs font-heading font-black text-center tabular-nums
                          ${row.gd > 0 ? 'text-green-600' : row.gd < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {row.gd > 0 ? `+${row.gd}` : row.gd}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Awards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'topScorer',  icon: '⚽', label: 'Top Scorer',  data: stats.topScorer,  unit: '' },
                  { key: 'topAssist',  icon: '👟', label: 'Top Assist',  data: stats.topAssist,  unit: '' },
                  { key: 'mostMvp',   icon: '⭐', label: 'Most MVP',    data: stats.mostMvp,   unit: 'x' },
                  { key: 'mostYellow',icon: '🟨', label: 'Most Yellow', data: stats.mostYellow, unit: '' },
                  { key: 'mostRed',   icon: '🟥', label: 'Most Red',    data: stats.mostRed,    unit: '' },
                ].map(({ key, icon, label, data, unit }) => (
                  <div key={key} className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{icon}</span>
                      <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400">{label}</span>
                    </div>
                    <PerformerRow entry={data} valueLabel={unit} />
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !stats && (
            <div className="text-center py-10 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">
              No data available
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
