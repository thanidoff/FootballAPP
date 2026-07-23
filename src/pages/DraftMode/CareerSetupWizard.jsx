import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Minus, Plus, UserRound, X } from 'lucide-react'
import { fetchClubs } from '../../services/clubs'
import { fetchPlayers } from '../../services/players'
import useOverlayBehavior from '../../hooks/useOverlayBehavior'

const STEPS = ['Save', 'Clubs', 'Team setup']
const DEFAULT_BUDGET = 100_000_000

function ClubBadge({ club }) {
  if (club.badge_url) return <img src={club.badge_url} alt="" className="h-10 w-10 object-contain" />
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: club.badge_color || '#64748b' }}>
      {club.short_name}
    </span>
  )
}

export default function CareerSetupWizard({ initialName = '', onClose, onComplete }) {
  const { shouldRender, closing } = useOverlayBehavior(true, onClose)
  const [step, setStep] = useState(0)
  const [saveName, setSaveName] = useState(initialName)
  const [clubs, setClubs] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [teamSettings, setTeamSettings] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchClubs(), fetchPlayers()])
      .then(([clubData, playerData]) => {
        setClubs(clubData.filter(club => !club.is_national))
        setPlayers(playerData)
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedClubs = useMemo(
    () => selectedIds.map(id => clubs.find(club => club.id === id)).filter(Boolean),
    [clubs, selectedIds],
  )

  function addClub(club) {
    if (selectedIds.includes(club.id)) return
    const attachedPlayers = players.filter(player => player.club_id === club.id)
    setSelectedIds(ids => [...ids, club.id])
    setTeamSettings(settings => ({
      ...settings,
      [club.id]: { budget: DEFAULT_BUDGET, roster: attachedPlayers },
    }))
  }

  function removeClub(clubId) {
    setSelectedIds(ids => ids.filter(id => id !== clubId))
    setTeamSettings(settings => {
      const next = { ...settings }
      delete next[clubId]
      return next
    })
    if (expandedId === clubId) setExpandedId(null)
  }

  function releasePlayer(clubId, playerId) {
    setTeamSettings(settings => ({
      ...settings,
      [clubId]: {
        ...settings[clubId],
        roster: settings[clubId].roster.filter(player => player.id !== playerId),
      },
    }))
  }

  function updateBudget(clubId, value) {
    const budget = Math.max(0, Number(value) || 0)
    setTeamSettings(settings => ({
      ...settings,
      [clubId]: { ...settings[clubId], budget },
    }))
  }

  function adjustBudget(clubId, delta) {
    const current = teamSettings[clubId]?.budget ?? DEFAULT_BUDGET
    updateBudget(clubId, Math.max(0, current + delta))
  }

  function changeStep(nextStep) {
    setStep(nextStep)
  }

  function finish() {
    const configuredClubs = selectedClubs.map(club => ({
      ...club,
      startingBudget: teamSettings[club.id]?.budget ?? DEFAULT_BUDGET,
      startingRoster: teamSettings[club.id]?.roster ?? [],
    }))
    const attachedIds = new Set(configuredClubs.flatMap(club => club.startingRoster.map(player => player.id)))
    onComplete({
      name: saveName.trim(),
      clubs: configuredClubs,
      freeAgents: players.filter(player => !attachedIds.has(player.id)),
    })
  }

  const canContinue = step === 0 ? Boolean(saveName.trim()) : step === 1 ? selectedIds.length >= 2 : true

  if (!shouldRender) return null

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${closing ? 'ui-overlay-exit' : 'ui-overlay-enter'}`}>
      <button aria-label="Close career setup" onClick={onClose} disabled={closing} className="absolute inset-0 bg-[#0A1318]/55 backdrop-blur-sm" />
      <section className={`relative flex h-[min(700px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${closing ? 'ui-modal-exit' : 'ui-modal-enter'}`}>
        <header className="border-b border-gray-100 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-heading text-2xl font-black uppercase tracking-wide text-[#0A1318]">Create your game</h2>
            <button onClick={onClose} aria-label="Close" disabled={closing} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"><X size={18} strokeWidth={2} /></button>
          </div>
          <ol className="mx-auto mt-5 flex max-w-xl items-center justify-center">
            {STEPS.map((label, index) => (
              <li key={label} className="flex shrink-0 items-center">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full font-heading text-[10px] font-black ${index <= step ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>{index + 1}</span>
                <span className={`ml-2 hidden text-[10px] font-black uppercase tracking-wider sm:block ${index <= step ? 'text-[#0A1318]' : 'text-gray-400'}`}>{label}</span>
                {index < STEPS.length - 1 && <span className={`mx-3 h-px w-12 transition-colors duration-500 sm:w-20 ${index < step ? 'bg-[#FD5461]' : 'bg-gray-200'}`} />}
              </li>
            ))}
          </ol>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex h-full will-change-transform transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ transform: `translate3d(-${step * 100}%, 0, 0)` }}
          >
            <div className="h-full w-full shrink-0 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="mx-auto flex h-full max-w-lg flex-col justify-center pb-12">
                <h3 className="font-heading text-2xl font-black uppercase tracking-wide text-[#0A1318]">Name your save</h3>
                <p className="mt-2 text-sm text-gray-500">Give this career a name you will recognize later.</p>
                <input autoFocus value={saveName} onChange={event => setSaveName(event.target.value)} placeholder="e.g. Bangkok Road to Glory" className="mt-7 w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-base text-[#0A1318] outline-none transition-colors focus:border-[#FD5461] focus:ring-4 focus:ring-red-50" />
              </div>
            </div>

            <div className="h-full w-full shrink-0 overflow-y-auto px-6 py-6 sm:px-8">
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-xl font-black uppercase tracking-wide text-[#0A1318]">Add clubs</h3>
                    <p className="mt-1 text-sm text-gray-500">Add clubs one at a time. A career needs at least two.</p>
                  </div>
                  <span className="font-heading text-xs font-black uppercase tracking-wider text-[#FD5461]">{selectedIds.length} selected</span>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {clubs.map(club => {
                    const selected = selectedIds.includes(club.id)
                    return (
                      <button key={club.id} onClick={() => selected ? removeClub(club.id) : addClub(club)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selected ? 'border-[#FD5461] bg-red-50 shadow-sm shadow-red-500/10' : 'border-gray-200 bg-white hover:border-[#FD5461] hover:bg-red-50/30 hover:shadow-sm'}`}>
                        <ClubBadge club={club} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading text-sm font-black uppercase text-[#0A1318]">{club.name}</span>
                          <span className={`mt-0.5 block text-xs ${selected ? 'font-bold text-[#FD5461]' : 'text-gray-400'}`}>{selected ? 'Selected' : 'Add to career'}</span>
                        </span>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg font-black ${selected ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-500'}`}>{selected ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="h-full w-full shrink-0 overflow-y-auto px-6 py-6 sm:px-8">
              <div>
                <h3 className="font-heading text-xl font-black uppercase tracking-wide text-[#0A1318]">Team setup</h3>
                <p className="mt-1 text-sm text-gray-500">Set each club budget and review its starting-player slots.</p>
                <div className="mt-5 space-y-3">
                  {selectedClubs.map(club => {
                    const settings = teamSettings[club.id]
                    const roster = settings?.roster ?? []
                    const open = expandedId === club.id
                    const visibleSlotCount = Math.max(2, Math.ceil((roster.length + 1) / 2) * 2)
                    const slots = Array.from({ length: visibleSlotCount }, (_, index) => roster[index] ?? null)
                    return (
                      <article key={club.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <div className="flex items-center gap-3 p-4">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <ClubBadge club={club} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-heading text-sm font-black uppercase text-[#0A1318]">{club.name}</span>
                              <span className="mt-0.5 block text-xs text-gray-400">{roster.length} attached players · {visibleSlotCount - roster.length} open slots</span>
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="mr-1 text-sm font-medium text-gray-600">Budget</span>
                            <button type="button" onClick={() => adjustBudget(club.id, -10_000_000)} aria-label={`Decrease ${club.name} budget by 10M`} className="flex h-9 items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]"><Minus size={12} strokeWidth={2.25} />10M</button>
                            <button type="button" onClick={() => adjustBudget(club.id, -1_000_000)} aria-label={`Decrease ${club.name} budget by 1M`} className="flex h-9 items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]"><Minus size={12} strokeWidth={2.25} />1M</button>
                            <span className="relative block w-24">
                              <input
                                type="text"
                                inputMode="decimal"
                                aria-label={`${club.name} budget in millions`}
                                value={((settings?.budget ?? DEFAULT_BUDGET) / 1_000_000).toFixed(1)}
                                onFocus={event => event.target.select()}
                                onChange={event => {
                                  const raw = event.target.value.replace(/[^0-9.]/g, '')
                                  if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                                  const millions = Number.parseFloat(raw)
                                  if (Number.isFinite(millions)) updateBudget(club.id, Math.round(millions * 1_000_000))
                                }}
                                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-2 pr-7 text-right text-sm font-bold tabular-nums outline-none focus:border-[#FD5461] focus:ring-2 focus:ring-red-50"
                              />
                              <span className="pointer-events-none absolute right-2 top-2.5 text-[10px] font-bold text-gray-400">M</span>
                            </span>
                            <button type="button" onClick={() => adjustBudget(club.id, 1_000_000)} aria-label={`Increase ${club.name} budget by 1M`} className="flex h-9 items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]"><Plus size={12} strokeWidth={2.25} />1M</button>
                            <button type="button" onClick={() => adjustBudget(club.id, 10_000_000)} aria-label={`Increase ${club.name} budget by 10M`} className="flex h-9 items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]"><Plus size={12} strokeWidth={2.25} />10M</button>
                          </div>
                          <button onClick={() => setExpandedId(open ? null : club.id)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${club.name} players`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#FD5461]">
                            <ChevronDown size={18} strokeWidth={2.25} className={`transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                        <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                          <div className={`grid gap-2 border-t bg-[#FAFBFD] px-4 transition-[padding,border-color] duration-500 sm:grid-cols-2 ${open ? 'border-gray-100 py-4' : 'border-transparent py-0'}`}>
                            {slots.map((player, index) => player ? (
                              <div key={player.id} className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#455268] font-heading text-sm font-black text-white">{player.ovr}</span>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 font-heading text-xs font-black text-gray-400">{player.name.charAt(0)}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-heading text-xs font-black uppercase text-[#0A1318]">{player.name}</span>
                                  <span className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <span className="truncate">{player.nationality}</span>
                                    <span>·</span>
                                    <span>{player.age} yrs</span>
                                    <span className="font-black text-[#FD5461]">{player.position}</span>
                                  </span>
                                </span>
                                <button onClick={() => releasePlayer(club.id, player.id)} title="Release to free agents" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-[#FD5461]"><X size={15} strokeWidth={2.25} /></button>
                              </div>
                            ) : (
                              <div key={`empty-${index}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-300"><UserRound size={17} strokeWidth={1.75} /></span>
                                <span className="text-sm font-normal text-gray-400">Empty player slot</span>
                              </div>
                            ))}
                          </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-gray-100 px-6 py-4 sm:px-8">
          <button onClick={() => step === 0 ? onClose() : changeStep(step - 1)} className="rounded-xl px-4 py-3 font-heading text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100">{step === 0 ? 'Cancel' : 'Back'}</button>
          <button disabled={!canContinue || loading} onClick={() => step === STEPS.length - 1 ? finish() : changeStep(step + 1)} className="rounded-xl bg-[#FD5461] px-6 py-3 font-heading text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">{step === STEPS.length - 1 ? 'Create Career' : 'Continue'}</button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
