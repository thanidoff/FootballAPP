import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Trash2, UserRound, X } from 'lucide-react'
import { fetchClubs } from '../../services/clubs'
import { fetchPlayers } from '../../services/players'
import useOverlayBehavior from '../../hooks/useOverlayBehavior'
import Modal from '../../components/ui/Modal'

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

export default function CareerSetupWizard({ open = true, initialName = '', onClose, onComplete }) {
  const { shouldRender, closing } = useOverlayBehavior(open, onClose)
  const [step, setStep] = useState(0)
  const [saveName, setSaveName] = useState(initialName)
  const [clubs, setClubs] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [teamSettings, setTeamSettings] = useState({})
  const [pickingForClubId, setPickingForClubId] = useState(null)
  const [playerSearch, setPlayerSearch] = useState('')

  const availablePlayers = useMemo(() => {
    const attachedIds = new Set(Object.values(teamSettings).flatMap(s => (s.roster || []).map(p => p.id)))
    return players.filter(p => !attachedIds.has(p.id) && (
      !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()) || p.nationality?.toLowerCase().includes(playerSearch.toLowerCase())
    ))
  }, [players, teamSettings, playerSearch])

  function addPlayerToClub(clubId, player) {
    setTeamSettings(settings => ({
      ...settings,
      [clubId]: {
        ...settings[clubId],
        roster: [...(settings[clubId]?.roster || []), player],
      },
    }))
    setPickingForClubId(null)
    setPlayerSearch('')
  }

  const inputRef = useRef(null)

  useEffect(() => {
    Promise.all([fetchClubs(), fetchPlayers()])
      .then(([clubData, playerData]) => {
        setClubs(clubData.filter(club => !club.is_national))
        setPlayers(playerData)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (open && step === 0) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open, step])

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
                <span className={`flex h-8 w-8 items-center justify-center rounded-full font-heading text-xs font-black ${index <= step ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>{index + 1}</span>
                <span className={`ml-2.5 hidden text-sm font-black uppercase tracking-wider sm:block ${index <= step ? 'text-[#0A1318]' : 'text-gray-400'}`}>{label}</span>
                {index < STEPS.length - 1 && <span className={`mx-3.5 h-px w-10 transition-colors duration-500 sm:w-16 ${index < step ? 'bg-[#FD5461]' : 'bg-gray-200'}`} />}
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
                <input ref={inputRef} autoFocus value={saveName} onChange={event => setSaveName(event.target.value)} placeholder="e.g. Bangkok Road to Glory" className="mt-7 w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-base text-[#0A1318] outline-none focus:outline-none transition-colors focus:border-[#FD5461] focus:ring-4 focus:ring-red-50" />
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
                              <span className="mt-0.5 block text-xs text-gray-400">{roster.length} players</span>
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="mr-1 text-sm font-medium text-gray-600">Budget</span>
                            <button type="button" onClick={() => adjustBudget(club.id, -10_000_000)} aria-label={`Decrease ${club.name} budget by 10M`} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-10</button>
                            <button type="button" onClick={() => adjustBudget(club.id, -1_000_000)} aria-label={`Decrease ${club.name} budget by 1M`} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-1</button>
                            <span className="relative flex h-9 w-24 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
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
                                className="w-full bg-transparent text-right text-sm font-bold tabular-nums outline-none focus:outline-none"
                              />
                              <span className="ml-1 text-xs font-bold text-gray-400 leading-none">M</span>
                            </span>
                            <button type="button" onClick={() => adjustBudget(club.id, 1_000_000)} aria-label={`Increase ${club.name} budget by 1M`} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+1</button>
                            <button type="button" onClick={() => adjustBudget(club.id, 10_000_000)} aria-label={`Increase ${club.name} budget by 10M`} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+10</button>
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
                              <button
                                key={`empty-${index}`}
                                type="button"
                                onClick={() => { setPickingForClubId(club.id); setPlayerSearch('') }}
                                className="flex min-h-16 items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-2.5 transition-all hover:border-[#FD5461] hover:bg-red-50/40 hover:shadow-sm active:scale-[0.99]"
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400 transition-colors group-hover:bg-[#FD5461] group-hover:text-white">
                                  <Plus size={18} strokeWidth={2.5} />
                                </span>
                                <div className="text-left">
                                  <span className="block font-heading text-xs font-bold uppercase tracking-wide text-gray-600">Add Player</span>
                                  <span className="text-[10px] text-gray-400">Click to select player</span>
                                </div>
                              </button>
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
          {step > 0 ? (
            <button
              type="button"
              onClick={() => changeStep(step - 1)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-heading text-xs font-black uppercase tracking-wider text-gray-500 transition-all hover:bg-gray-100 active:scale-95"
            >
              <ChevronLeft size={16} strokeWidth={2.5} className="text-gray-400" />
              <span>Back</span>
            </button>
          ) : <div />}

          <button
            type="button"
            disabled={!canContinue || loading}
            onClick={() => (step === STEPS.length - 1 ? finish() : changeStep(step + 1))}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FD5461] px-6 py-2.5 font-heading text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <span>{step === STEPS.length - 1 ? 'Create Career' : 'Continue'}</span>
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </footer>
      </section>

      <Modal
        open={Boolean(pickingForClubId)}
        onClose={() => { setPickingForClubId(null); setPlayerSearch('') }}
        title="Select Player to Add"
        width="max-w-xl"
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search by name or nationality..."
            value={playerSearch}
            onChange={e => setPlayerSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-[#0A1318] outline-none transition-colors focus:border-[#FD5461] focus:bg-white focus:ring-2 focus:ring-red-50"
          />

          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {availablePlayers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No available players found</div>
            ) : (
              availablePlayers.map(player => (
                <div
                  key={player.id}
                  onClick={() => addPlayerToClub(pickingForClubId, player)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-[#FD5461] hover:bg-red-50/30 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#455268] font-heading text-xs font-black text-white">{player.ovr}</span>
                    <div>
                      <span className="block font-heading text-xs font-black uppercase text-[#0A1318]">{player.name}</span>
                      <span className="text-[10px] text-gray-400">{player.nationality} · {player.age} yrs · <span className="font-bold text-[#FD5461]">{player.position}</span></span>
                    </div>
                  </div>
                  <span className="flex h-8 items-center gap-1 rounded-lg bg-[#FD5461] px-3 font-heading text-[10px] font-black uppercase tracking-wider text-white">
                    <Plus size={14} strokeWidth={2.5} /> Add
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>,
    document.body
  )
}
