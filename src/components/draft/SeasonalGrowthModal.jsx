import { useState } from 'react'
import { ArrowDown, ArrowUp, Sparkles, TrendingDown, TrendingUp, UserRound, X } from 'lucide-react'
import Modal from '../ui/Modal'
import PositionBadge from '../ui/PositionBadge'
import OvrBadge from '../ui/OvrBadge'
import PlayerProfileModal from '../players/PlayerProfileModal'
import { FIFA_NATIONS } from '../../utils/fifaNations'

export default function SeasonalGrowthModal({ open, onClose, adjustments = [], seasonName = 'Current Season' }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  if (!open) return null

  const positiveCount = adjustments.filter(a => a.deltaOvr > 0).length
  const negativeCount = adjustments.filter(a => a.deltaOvr < 0).length

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Seasonal Player Growth & Form (${seasonName})`} width="max-w-2xl">
        <div className="space-y-4">
          {/* Header Summary Banner */}
          <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <Sparkles size={20} strokeWidth={2.25} />
              </span>
              <div>
                <div className="font-heading text-sm font-black uppercase tracking-wide text-[#0A1318]">
                  Seasonal Rating Adjustments
                </div>
                <div className="text-xs text-gray-500">
                  {adjustments.length} players developed or declined rating changes this season (-5 to +5 OVR)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-200">
                <TrendingUp size={13} /> +{positiveCount} Up
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 border border-rose-200">
                <TrendingDown size={13} /> -{negativeCount} Down
              </span>
            </div>
          </div>

          {/* List of Adjusted Players */}
          {adjustments.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No rating changes recorded for this season yet.
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {adjustments.map((item) => {
                const isPositive = item.deltaOvr > 0
                const flagCode = FIFA_NATIONS.find(n => n.name === item.nationality)?.code

                return (
                  <div
                    key={item.playerId}
                    onClick={() => setSelectedPlayer({ id: item.playerId, name: item.name, position: item.position, stats: item.newStats, ovr: item.newOvr, photo_url: item.photo_url, nationality: item.nationality })}
                    className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-sm transition-all hover:border-amber-400/60 hover:shadow-md"
                  >
                    {/* Player Info */}
                    <div className="flex min-w-0 items-center gap-3">
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full bg-gray-100 object-cover ring-1 ring-black/5"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                          <UserRound size={20} />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-heading text-sm font-black text-[#0A1318] group-hover:text-amber-600">
                            {item.name}
                          </span>
                          <PositionBadge position={item.position} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                          {flagCode && (
                            <img
                              src={`https://flagcdn.com/${flagCode}.svg`}
                              alt=""
                              className="h-3 w-4.5 shrink-0 rounded-sm object-cover ring-1 ring-black/10"
                            />
                          )}
                          {item.clubBadge && (
                            <img src={item.clubBadge} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                          )}
                          <span className="truncate">{item.clubName || 'Free Agent'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rating Shift Display */}
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex items-center gap-1.5 font-heading">
                        <span className="text-xs font-bold text-gray-400 tabular-nums">{item.oldOvr}</span>
                        <span className={`flex items-center font-black ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isPositive ? <ArrowUp size={14} strokeWidth={3} /> : <ArrowDown size={14} strokeWidth={3} />}
                        </span>
                        <span className={`text-base font-black tabular-nums ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.newOvr}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-xl px-2.5 py-1 font-heading text-xs font-black tabular-nums shadow-sm ${
                          isPositive
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {isPositive ? `+${item.deltaOvr}` : item.deltaOvr} OVR
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Player Profile Details Modal */}
      {selectedPlayer && (
        <PlayerProfileModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  )
}
