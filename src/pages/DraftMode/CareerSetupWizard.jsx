import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Award, Check, ChevronDown, ChevronLeft, Crown, Flame, Medal, Minus, Plus, UserRound, X, Zap } from 'lucide-react'
import { fetchClubs } from '../../services/clubs'
import { fetchPlayers } from '../../services/players'
import useOverlayBehavior from '../../hooks/useOverlayBehavior'
import OvrBadge from '../../components/ui/OvrBadge'
import PositionBadge from '../../components/ui/PositionBadge'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import { DEFAULT_CUP_MATCH_PRIZES, DEFAULT_CUP_PRIZES, DEFAULT_LEAGUE_PRIZES } from '../../services/draftSave'

const PODIUM_STYLES = [
  { badge: 'bg-[#FD5461] text-white shadow-sm shadow-red-200' },
  { badge: 'bg-[#0A1318] text-white shadow-sm shadow-gray-200' },
  { badge: 'border-2 border-[#FD5461] bg-white text-[#FD5461]' },
]

function RankBadge({ rank }) {
  const podium = PODIUM_STYLES[rank - 1]
  if (!podium) return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 font-heading text-xs font-black text-gray-500">{rank}</span>
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${podium.badge}`} aria-label={`Rank ${rank}`}>
      {rank === 1 ? <Crown size={14} strokeWidth={2.5} /> : <Medal size={14} strokeWidth={2.5} />}
    </span>
  )
}

function PrizeValueRow({ label, description, value, onChange }) {
  const adjust = delta => onChange(Math.max(0, (Number(value) || 0) + delta))
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="text-sm font-bold text-[#0A1318]">{label}</div>
        <div className="text-xs text-gray-400">{description}</div>
      </div>
      <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto">
        <button type="button" onClick={() => adjust(-10_000_000)} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-10</button>
        <button type="button" onClick={() => adjust(-1_000_000)} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-1</button>
        <span className="relative flex h-9 min-w-0 flex-1 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50 sm:w-24 sm:flex-none">
          <input
            type="text"
            inputMode="decimal"
            value={((Number(value) || 0) / 1_000_000).toFixed(1)}
            onFocus={event => event.target.select()}
            onChange={event => {
              const raw = event.target.value.replace(/[^0-9.]/g, '')
              if (!/^\d*(?:\.\d?)?$/.test(raw)) return
              const millions = Number.parseFloat(raw)
              if (Number.isFinite(millions)) onChange(Math.round(millions * 1_000_000))
            }}
            className="w-full bg-transparent text-right text-sm font-bold tabular-nums outline-none"
          />
          <span className="ml-1 text-xs font-bold leading-none text-gray-400">M</span>
        </span>
        <button type="button" onClick={() => adjust(1_000_000)} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+1</button>
        <button type="button" onClick={() => adjust(10_000_000)} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+10</button>
      </div>
    </div>
  )
}

const STEPS = ['Save', 'Clubs', 'Team setup', 'Prizes']
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
  useOverlayBehavior(true, onClose)
  const [step, setStep] = useState(0)
  const [saveName, setSaveName] = useState(initialName)
  const [clubs, setClubs] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [teamSettings, setTeamSettings] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Prizes config state
  const [hasLeague, setHasLeague] = useState(true)
  const [hasCup, setHasCup] = useState(true)
  const [leaguePlacements, setLeaguePlacements] = useState(() => [...DEFAULT_LEAGUE_PRIZES.placements])
  const [awardPrizes, setAwardPrizes] = useState(() => ({ ...DEFAULT_LEAGUE_PRIZES.awards }))
  const [leagueMatchPrizes, setLeagueMatchPrizes] = useState(() => ({ ...DEFAULT_LEAGUE_PRIZES.matchPrizes }))
  const [cupPrizes, setCupPrizes] = useState(() => [...DEFAULT_CUP_PRIZES])
  const [cupMatchPrizes, setCupMatchPrizes] = useState(() => ({ ...DEFAULT_CUP_MATCH_PRIZES }))

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
      prizes: {
        hasLeague,
        hasCup,
        prizeSettings: {
          placements: leaguePlacements,
          awards: awardPrizes,
          matchPrizes: leagueMatchPrizes,
        },
        cupPrizeSettings: cupPrizes,
        cupMatchPrizes,
      },
    })
  }

  const hasEnoughCompetitionClubs = (!hasLeague || selectedIds.length >= 5) && selectedIds.length >= 2
  const canContinue = step === 0
    ? Boolean(saveName.trim())
    : step === 1
      ? selectedIds.length >= 2
      : step === 3
        ? (hasLeague || hasCup) && hasEnoughCompetitionClubs
        : true

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button aria-label="Close career setup" onClick={onClose} className="fixed inset-0 bg-[#0A1318]/60 backdrop-blur-sm cursor-default border-none outline-none" />
      <section className="relative flex h-[min(700px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl z-10">
        <header className="border-b border-gray-100 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-heading text-2xl font-black uppercase tracking-wide text-[#0A1318]">Create your game</h2>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"><X size={18} strokeWidth={2} /></button>
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
                <input value={saveName} onChange={event => setSaveName(event.target.value)} placeholder="e.g. Bangkok Road to Glory" className="mt-7 w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-base text-[#0A1318] outline-none transition-colors focus:border-[#FD5461] focus:ring-4 focus:ring-red-50" />
              </div>
            </div>

            <div className="h-full w-full shrink-0 overflow-y-auto px-6 py-6 sm:px-8">
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-xl font-black uppercase tracking-wide text-[#0A1318]">Add clubs</h3>
                    <p className="mt-1 text-sm text-gray-500">Add clubs one at a time. A league career needs at least five clubs.</p>
                  </div>
                  <span className="font-heading text-xs font-black uppercase tracking-wider text-[#FD5461]">{selectedIds.length} selected</span>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {clubs.map(club => {
                    const selected = selectedIds.includes(club.id)
                    const clubPlayerCount = players.filter(p => p.club_id === club.id).length
                    return (
                      <button key={club.id} onClick={() => selected ? removeClub(club.id) : addClub(club)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selected ? 'border-[#FD5461] bg-red-50 shadow-sm shadow-red-500/10' : 'border-gray-200 bg-white hover:border-[#FD5461] hover:bg-red-50/30 hover:shadow-sm'}`}>
                        <ClubBadge club={club} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading text-sm font-black uppercase text-[#0A1318]">{club.name}</span>
                          <span className={`mt-0.5 block text-xs ${selected ? 'font-bold text-[#FD5461]' : 'text-gray-400'}`}>
                            {clubPlayerCount} players
                          </span>
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
                            <button type="button" onClick={() => adjustBudget(club.id, -100_000_000)} aria-label={`Decrease ${club.name} budget by 100M`} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-100</button>
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
                            <button type="button" onClick={() => adjustBudget(club.id, 100_000_000)} aria-label={`Increase ${club.name} budget by 100M`} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+100</button>
                          </div>
                          <button
                            disabled={roster.length === 0}
                            onClick={() => setExpandedId(open ? null : club.id)}
                            aria-expanded={open && roster.length > 0}
                            aria-label={`${open ? 'Collapse' : 'Expand'} ${club.name} players`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#FD5461] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          >
                            <ChevronDown size={18} strokeWidth={2.25} className={`transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open && roster.length > 0 ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                        <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open && roster.length > 0 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                          <div className={`grid gap-2 border-t bg-[#FAFBFD] px-4 transition-[padding,border-color] duration-500 sm:grid-cols-2 ${open ? 'border-gray-100 py-4' : 'border-transparent py-0'}`}>
                            {slots.map((player, index) => player ? (
                              <div key={player.id} className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5">
                                <OvrBadge value={player.ovr} size="sm" />
                                {player.photo_url ? (
                                  <img src={player.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-gray-100 ring-1 ring-black/5" />
                                ) : (
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 font-heading text-xs font-black text-gray-400">{player.name.charAt(0)}</span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-heading text-xs font-bold text-[#0A1318]">{player.name}</span>
                                  <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                                    <PositionBadge position={player.position} />
                                    {(() => {
                                      const code = FIFA_NATIONS.find(n => n.name === player.nationality)?.code
                                      return code ? <img src={`https://flagcdn.com/${code}.svg`} className="h-3 w-4.5 shrink-0 rounded-sm object-cover ring-1 ring-black/10" alt={player.nationality} title={player.nationality} /> : null
                                    })()}
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

            {/* STEP 4: Prizes & Competition Setup */}
            <div className="h-full w-full shrink-0 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="font-heading text-xl font-black uppercase tracking-wide text-[#0A1318]">Competitions & Prizes</h3>
                  <p className="mt-1 text-sm text-gray-500">Toggle competitions and customize placement rewards for your career.</p>
                </div>

                {/* Competition Toggles */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    onClick={() => setHasLeague(prev => !prev)}
                    className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                      hasLeague ? 'border-[#FD5461] bg-red-50/40 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="font-heading text-sm font-black uppercase text-[#0A1318]">League Match</div>
                      <div className="text-xs text-gray-400">Regular round-robin league</div>
                    </div>
                    {/* Switch */}
                    <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out ${hasLeague ? 'bg-[#FD5461]' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${hasLeague ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
                    </div>
                  </div>

                  <div
                    onClick={() => setHasCup(prev => !prev)}
                    className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                      hasCup ? 'border-[#FD5461] bg-red-50/40 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="font-heading text-sm font-black uppercase text-[#0A1318]">Tournament Cup</div>
                      <div className="text-xs text-gray-400">Knockout cup competition</div>
                    </div>
                    {/* Switch */}
                    <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out ${hasCup ? 'bg-[#FD5461]' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${hasCup ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
                    </div>
                  </div>
                </div>

                {/* League Prizes Config Accordion */}
                <div className={`grid transition-[grid-template-rows,opacity,margin] duration-400 ease-out ${hasLeague ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 -mt-6'}`}>
                  <div className="overflow-hidden">
                    <div className="space-y-3">
                      <h4 className="font-heading text-xs font-black uppercase tracking-wider text-gray-400">League Placement Prizes</h4>
                      <div className="space-y-2">
                        {leaguePlacements.slice(0, Math.min(selectedClubs.length, 5)).map((amount, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
                            <div className="flex items-center gap-2.5">
                              <RankBadge rank={idx + 1} />
                              <span className="text-sm font-bold text-[#0A1318]">Position {idx + 1}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button type="button" onClick={() => setLeaguePlacements(prev => prev.map((v, i) => i === idx ? Math.max(0, v - 10_000_000) : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-10</button>
                              <button type="button" onClick={() => setLeaguePlacements(prev => prev.map((v, i) => i === idx ? Math.max(0, v - 1_000_000) : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-1</button>
                              <span className="relative flex h-9 w-24 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={(amount / 1_000_000).toFixed(1)}
                                  onFocus={event => event.target.select()}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9.]/g, '')
                                    if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                                    const millions = Number.parseFloat(raw)
                                    if (Number.isFinite(millions)) setLeaguePlacements(prev => prev.map((v, i) => i === idx ? Math.round(millions * 1_000_000) : v))
                                  }}
                                  className="w-full bg-transparent text-right text-sm font-bold tabular-nums outline-none focus:outline-none"
                                />
                                <span className="ml-1 text-xs font-bold text-gray-400 leading-none">M</span>
                              </span>
                              <button type="button" onClick={() => setLeaguePlacements(prev => prev.map((v, i) => i === idx ? v + 1_000_000 : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+1</button>
                              <button type="button" onClick={() => setLeaguePlacements(prev => prev.map((v, i) => i === idx ? v + 10_000_000 : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+10</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`grid transition-[grid-template-rows,opacity,margin] duration-400 ease-out ${hasLeague ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 -mt-6'}`}>
                  <div className="overflow-hidden">
                    <div className="space-y-3">
                      <h4 className="font-heading text-xs font-black uppercase tracking-wider text-gray-400">League Per-Match Rewards</h4>
                      {[
                        ['win', 'Match Win Prize', 'Paid to the winning club'],
                        ['draw', 'Match Draw Prize', 'Paid to each club after a draw'],
                        ['loss', 'Match Loss Prize', 'Paid to the losing club'],
                      ].map(([key, label, description]) => (
                        <PrizeValueRow key={key} label={label} description={description} value={leagueMatchPrizes[key]} onChange={amount => setLeagueMatchPrizes(current => ({ ...current, [key]: amount }))} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cup Prizes Config Accordion */}
                <div className={`grid transition-[grid-template-rows,opacity,margin] duration-400 ease-out ${hasCup ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 -mt-6'}`}>
                  <div className="overflow-hidden">
                    <div className="space-y-3">
                      <h4 className="font-heading text-xs font-black uppercase tracking-wider text-gray-400">Cup Tournament Prizes</h4>
                      <div className="space-y-2">
                        {[
                          { label: 'Champion', pos: 0, rank: 1 },
                          { label: 'Runner-up', pos: 1, rank: 2 },
                          { label: 'Semi-finalists', pos: 2, rank: 3 },
                        ].map((tier) => (
                          <div key={tier.label} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
                            <div className="flex items-center gap-2.5">
                              <RankBadge rank={tier.rank} />
                              <span className="text-sm font-bold text-[#0A1318]">{tier.label}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button type="button" onClick={() => setCupPrizes(prev => prev.map((v, i) => i === tier.pos ? Math.max(0, v - 10_000_000) : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-10</button>
                              <button type="button" onClick={() => setCupPrizes(prev => prev.map((v, i) => i === tier.pos ? Math.max(0, v - 1_000_000) : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-1</button>
                              <span className="relative flex h-9 w-24 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={(((cupPrizes[tier.pos] || 0)) / 1_000_000).toFixed(1)}
                                  onFocus={event => event.target.select()}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9.]/g, '')
                                    if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                                    const millions = Number.parseFloat(raw)
                                    if (Number.isFinite(millions)) setCupPrizes(prev => prev.map((v, i) => i === tier.pos ? Math.round(millions * 1_000_000) : v))
                                  }}
                                  className="w-full bg-transparent text-right text-sm font-bold tabular-nums outline-none focus:outline-none"
                                />
                                <span className="ml-1 text-xs font-bold text-gray-400 leading-none">M</span>
                              </span>
                              <button type="button" onClick={() => setCupPrizes(prev => prev.map((v, i) => i === tier.pos ? v + 1_000_000 : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+1</button>
                              <button type="button" onClick={() => setCupPrizes(prev => prev.map((v, i) => i === tier.pos ? v + 10_000_000 : v))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+10</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`grid transition-[grid-template-rows,opacity,margin] duration-400 ease-out ${hasCup ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 -mt-6'}`}>
                  <div className="overflow-hidden">
                    <div className="space-y-3">
                      <h4 className="font-heading text-xs font-black uppercase tracking-wider text-gray-400">Cup Per-Match Rewards</h4>
                      {[
                        ['win', 'Cup Match Win Prize', 'Paid to the club that advances'],
                        ['loss', 'Cup Match Loss Prize', 'Paid to the eliminated club'],
                      ].map(([key, label, description]) => (
                        <PrizeValueRow key={key} label={label} description={description} value={cupMatchPrizes[key]} onChange={amount => setCupMatchPrizes(current => ({ ...current, [key]: amount }))} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Season Player Awards Section */}
                <div className="space-y-3">
                  <h4 className="font-heading text-xs font-black uppercase tracking-wider text-gray-400">Season Player Award Bonuses</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'topScorers', label: 'Top Scorer', sub: 'Club of player with most goals', icon: <Flame size={16} strokeWidth={2.5} className="text-[#FD5461]" />, bg: 'bg-red-50' },
                      { key: 'topAssists', label: 'Top Assists', sub: 'Club of player with most assists', icon: <Zap size={16} strokeWidth={2.5} className="text-amber-500" />, bg: 'bg-amber-50' },
                      { key: 'mostMvps', label: 'Most MVP', sub: 'Club of player with most MVP awards', icon: <Award size={16} strokeWidth={2.5} className="text-blue-500" />, bg: 'bg-blue-50' },
                    ].map((award) => (
                      <div key={award.key} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${award.bg}`}>
                            {award.icon}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-[#0A1318]">{award.label}</div>
                            <div className="text-xs text-gray-400">{award.sub}</div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button type="button" onClick={() => setAwardPrizes(prev => ({ ...prev, [award.key]: Math.max(0, (prev[award.key] || 0) - 10_000_000) }))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-10</button>
                          <button type="button" onClick={() => setAwardPrizes(prev => ({ ...prev, [award.key]: Math.max(0, (prev[award.key] || 0) - 1_000_000) }))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">-1</button>
                          <span className="relative flex h-9 w-24 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={(((awardPrizes[award.key] || 0)) / 1_000_000).toFixed(1)}
                              onFocus={event => event.target.select()}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, '')
                                if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                                const millions = Number.parseFloat(raw)
                                if (Number.isFinite(millions)) setAwardPrizes(prev => ({ ...prev, [award.key]: Math.round(millions * 1_000_000) }))
                              }}
                              className="w-full bg-transparent text-right text-sm font-bold tabular-nums outline-none focus:outline-none"
                            />
                            <span className="ml-1 text-xs font-bold text-gray-400 leading-none">M</span>
                          </span>
                          <button type="button" onClick={() => setAwardPrizes(prev => ({ ...prev, [award.key]: (prev[award.key] || 0) + 1_000_000 }))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+1</button>
                          <button type="button" onClick={() => setAwardPrizes(prev => ({ ...prev, [award.key]: (prev[award.key] || 0) + 10_000_000 }))} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461]">+10</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-gray-100 px-6 py-4 sm:px-8">
          {step > 0 ? (
            <button onClick={() => changeStep(step - 1)} className="flex items-center gap-1 rounded-xl px-4 py-3 font-heading text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer">
              <ChevronLeft size={16} strokeWidth={2.5} />
              <span>Back</span>
            </button>
          ) : <div />}
          <button disabled={!canContinue || loading} onClick={() => step === STEPS.length - 1 ? finish() : changeStep(step + 1)} className="rounded-xl bg-[#FD5461] px-6 py-3 font-heading text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">{step === STEPS.length - 1 ? 'Create Career' : 'Continue'}</button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
