import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, RefreshCw, Sparkles, TrendingDown, TrendingUp, UserRound, X } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import PositionBadge from '../ui/PositionBadge'
import OvrBadge from '../ui/OvrBadge'
import FreeAgentIcon from '../ui/FreeAgentIcon'
import PlayerProfileModal from '../players/PlayerProfileModal'
import { FIFA_NATIONS } from '../../utils/fifaNations'

export default function SeasonalGrowthModal({
  open,
  onClose,
  adjustments = [],
  seasonName = 'Current Season',
  isLocked = false,
  onReshufflePreview,
  onConfirmSave,
  onRestorePrevious,
  entityLabel = 'Player',
  saveData = null,
}) {
  const entityPlural = entityLabel === 'Coach' ? 'Coaches' : `${entityLabel}s`
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [targetMode, setTargetMode] = useState('30') // '30', 'custom', 'all'
  const [customCountInput, setCustomCountInput] = useState('30')

  if (!open) return null

  // Ensure sorting by Old OVR descending
  const sortedAdjustments = [...adjustments].sort((a, b) => (b.oldOvr || 0) - (a.oldOvr || 0) || (b.newOvr || 0) - (a.newOvr || 0))

  const positiveCount = sortedAdjustments.filter(a => a.deltaOvr > 0).length
  const negativeCount = sortedAdjustments.filter(a => a.deltaOvr < 0).length

  function handleTriggerReshuffle(mode, countVal) {
    if (!onReshufflePreview) return
    if (mode === 'all') {
      onReshufflePreview('all')
    } else {
      const num = Math.max(1, parseInt(countVal || '30', 10) || 30)
      onReshufflePreview(num)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Seasonal ${entityLabel} Growth & Form (${seasonName})`} width="max-w-2xl">
        <div className="space-y-4">
          {/* Rating Count Target Controls */}
          {!isLocked && onReshufflePreview && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-black/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Target {entityPlural}:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTargetMode('30')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      targetMode === '30' ? 'bg-[#FD5461] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    30 {entityPlural}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetMode('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      targetMode === 'all' ? 'bg-[#FD5461] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    ALL {entityPlural}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetMode('custom')
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      targetMode === 'custom' ? 'bg-[#FD5461] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Custom #
                  </button>
                </div>
              </div>

              {targetMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={customCountInput}
                    onChange={(e) => setCustomCountInput(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-20 px-2 py-1 text-xs font-bold rounded-lg border border-gray-200 bg-white text-center focus:outline-none focus:ring-2 focus:ring-[#FD5461]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Header Summary & Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0A1318]">
              <span className="flex items-center gap-1 text-emerald-600">
                <TrendingUp size={15} /> +{positiveCount} Increased
              </span>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1 text-rose-600">
                <TrendingDown size={15} /> -{negativeCount} Decreased
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-gray-500 font-normal">
                (Total: {sortedAdjustments.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isLocked && onReshufflePreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerReshuffle(targetMode, customCountInput)}
                  className="flex items-center gap-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"
                >
                  <RefreshCw size={14} /> Reshuffle
                </Button>
              )}
              {isLocked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRestorePrevious}
                  disabled={!onRestorePrevious}
                  className="flex items-center gap-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-wider text-rose-600"
                >
                  <RefreshCw size={14} /> Restore Previous Ratings
                </Button>
              ) : onConfirmSave ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onConfirmSave}
                  disabled={sortedAdjustments.length === 0}
                  className="flex items-center gap-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"
                >
                  <Sparkles size={14} /> Save Ratings
                </Button>
              ) : null}
            </div>
          </div>

          {/* List of Adjusted Players (Sorted by Old OVR Descending) */}
          {sortedAdjustments.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
              <Sparkles size={32} className="mb-2 text-[#FD5461]/60" />
              <p className="text-sm font-semibold text-gray-700">No seasonal rating adjustments generated yet</p>
              <p className="mt-1 max-w-sm text-xs text-gray-400">
                {entityLabel} rating changes can be previewed and reshuffled before saving to this season.
              </p>
              {onReshufflePreview && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleTriggerReshuffle(targetMode, customCountInput)}
                  className="mt-4 flex items-center gap-2 rounded-xl font-heading text-xs font-bold uppercase tracking-wider"
                >
                  <Sparkles size={16} /> Preview Rating Changes Now
                </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="divide-y divide-gray-100">
                {sortedAdjustments.map((item) => {
                  const flagCode = FIFA_NATIONS.find(n => n.name === item.nationality)?.code

                  return (
                    <div
                      key={item.playerId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
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
                          <div className="truncate font-heading text-sm font-black text-[#0A1318]">
                            {item.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                            <PositionBadge position={item.position} />
                            {flagCode && (
                              <img
                                src={`https://flagcdn.com/${flagCode}.svg`}
                                alt=""
                                className="h-3 w-4.5 shrink-0 rounded-sm object-cover ring-1 ring-black/10"
                              />
                            )}
                            {item.clubBadge ? (
                              <img src={item.clubBadge} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
                            ) : (
                              <FreeAgentIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            {item.clubName && <span className="truncate">{item.clubName}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Rating Shift Display */}
                      <div className="flex shrink-0 items-center gap-2">
                        <OvrBadge value={item.oldOvr} size="md" />

                        <ChevronRight
                          size={18}
                          strokeWidth={3}
                          className={
                            item.deltaOvr > 0
                              ? 'text-emerald-500'
                              : item.deltaOvr < 0
                              ? 'text-rose-500'
                              : 'text-gray-300'
                          }
                        />

                        <OvrBadge value={item.newOvr} size="md" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Player Profile Details Modal */}
      {selectedPlayer && (
        <PlayerProfileModal
          open
          player={selectedPlayer}
          saveData={saveData}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  )
}
