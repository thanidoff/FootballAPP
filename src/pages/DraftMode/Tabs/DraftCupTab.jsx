import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Eye, Plus, Settings2, Shuffle, Trophy } from 'lucide-react'
import { DEFAULT_CUP_MATCH_PRIZES, DEFAULT_CUP_PRIZES, DEFAULT_LEAGUE_PRIZES, updateDraftCupPrizeSettings, updateDraftSeasonPrizeSettings, updateDraftState } from '../../../services/draftSave'
import { createSeededRandom } from '../../../utils/matchEngine'
import { generateMockRoster } from '../../../utils/draftLogic'
import { getSeasonMatchSize } from '../../../utils/matchFormat'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { ScoreChip } from '../../../components/draft/ResultScore'

const ROUND_NAMES = { 1: 'Quarter Finals', 2: 'Semi Finals', 3: 'Final' }

const CUP_PRIZE_GROUPS = [
  { label: 'Position 1', positions: [0] },
  { label: 'Position 2', positions: [1] },
  { label: 'Position 3', positions: [2] },
  { label: 'Positions 4–5', positions: [3, 4] },
  { label: 'Positions 6–8', positions: [5, 6, 7] },
]

function CupPrizeFields({ prizes, setPrizes, matchPrizes, setMatchPrizes, disabled = false }) {
  const updateGroup = (positions, value) => setPrizes(current => current.map((amount, index) => positions.includes(index) ? Math.max(0, Number(value) || 0) * 1_000_000 : amount))
  const adjustGroup = (positions, diffMillions) => setPrizes(current => current.map((amount, index) => positions.includes(index) ? Math.max(0, amount + diffMillions * 1_000_000) : amount))

  const adjustCupMatch = (key, diffMillions) => setMatchPrizes(current => ({
    ...current,
    [key]: Math.max(0, ((current[key] ?? DEFAULT_CUP_MATCH_PRIZES[key]) || 0) + diffMillions * 1_000_000),
  }))

  const setCupMatch = (key, millions) => setMatchPrizes(current => ({
    ...current,
    [key]: Math.max(0, Number(millions) || 0) * 1_000_000,
  }))

  const matchRows = [
    ['win', 'Match Win Prize', 'Bonus for winning a cup match'],
    ['loss', 'Match Loss Prize', 'Bonus for losing a cup match'],
  ]

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Final Tournament Standings</h4>
        <div className="space-y-2">
          {CUP_PRIZE_GROUPS.map((group, index) => (
            <div key={group.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-[#FD5461] text-white' : index === 1 ? 'bg-[#0A1318] text-white' : index === 2 ? 'border-2 border-[#FD5461] text-[#FD5461]' : 'bg-gray-100 text-gray-500'}`}>{index + 1}</span>
                <span className="truncate text-sm font-semibold">{group.label}</span>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-1.5">
                <button type="button" disabled={disabled} onClick={() => adjustGroup(group.positions, -10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-10</button>
                <button type="button" disabled={disabled} onClick={() => adjustGroup(group.positions, -1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-1</button>
                <span className="relative flex h-9 flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                  <span className="flex items-baseline justify-center w-full">
                    <input
                      disabled={disabled}
                      type="text"
                      inputMode="decimal"
                      value={((prizes[group.positions[0]] || 0) / 1_000_000).toFixed(1)}
                      onFocus={event => event.target.select()}
                      onChange={event => {
                        const raw = event.target.value.replace(/[^0-9.]/g, '')
                        if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                        const millions = Number.parseFloat(raw)
                        if (Number.isFinite(millions)) updateGroup(group.positions, millions)
                      }}
                      className="bg-transparent text-right text-sm font-bold tabular-nums outline-none disabled:bg-transparent min-w-0 flex-1"
                    />
                    <span className="ml-1 text-xs font-bold text-gray-400 shrink-0">M</span>
                  </span>
                </span>
                <button type="button" disabled={disabled} onClick={() => adjustGroup(group.positions, 1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+1</button>
                <button type="button" disabled={disabled} onClick={() => adjustGroup(group.positions, 10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+10</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Per-Match Rewards</h4>
        <div className="space-y-2">
          {matchRows.map(([key, label, description]) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#FD5461]"><Trophy size={18} /></span>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs text-gray-400">{description}</span>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-1.5">
                <button type="button" disabled={disabled} onClick={() => adjustCupMatch(key, -10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-10</button>
                <button type="button" disabled={disabled} onClick={() => adjustCupMatch(key, -1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">-1</button>
                <span className="relative flex h-9 flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-[#FD5461] focus-within:ring-2 focus-within:ring-red-50">
                  <span className="flex items-baseline justify-center w-full">
                    <input
                      disabled={disabled}
                      type="text"
                      inputMode="decimal"
                      value={(((matchPrizes?.[key] ?? DEFAULT_CUP_MATCH_PRIZES[key]) || 0) / 1_000_000).toFixed(1)}
                      onFocus={event => event.target.select()}
                      onChange={event => {
                        const raw = event.target.value.replace(/[^0-9.]/g, '')
                        if (!/^\d*(?:\.\d?)?$/.test(raw)) return
                        const val = Number.parseFloat(raw)
                        if (Number.isFinite(val)) setCupMatch(key, val)
                      }}
                      className="bg-transparent text-right text-sm font-bold tabular-nums outline-none disabled:bg-transparent min-w-0 flex-1"
                    />
                    <span className="ml-1 text-xs font-bold text-gray-400 shrink-0">M</span>
                  </span>
                </span>
                <button type="button" disabled={disabled} onClick={() => adjustCupMatch(key, 1)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+1</button>
                <button type="button" disabled={disabled} onClick={() => adjustCupMatch(key, 10)} className="flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-500 hover:border-[#FD5461] hover:text-[#FD5461] disabled:opacity-40">+10</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function toClub(team) {
  return team?.club_id ? { id: team.club_id, name: team.club_name, short_name: team.short_name || team.club_name.slice(0, 3).toUpperCase(), badge_url: team.badge_url, badge_color: team.badge_color, roster: team.roster || [] } : { ...team, roster: team?.roster || [] }
}

function Badge({ club }) {
  if (club?.badge_url) return <img src={club.badge_url} alt="" className="h-10 w-10 shrink-0 object-contain" />
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading text-[10px] font-black uppercase text-white" style={{ backgroundColor: club?.badge_color || '#0A1318' }}>{(club?.short_name || club?.name || 'CLB').slice(0, 3).toUpperCase()}</span>
}

function createCupTeam(club, index) {
  return {
    club_id: club.id,
    club_name: club.name,
    short_name: club.short_name,
    badge_url: club.badge_url,
    badge_color: club.badge_color,
    budget: 100_000_000,
    stats: { PTS: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 },
    roster: generateMockRoster(club, index),
  }
}

function BracketMatch({ match, home, away, homeLabel, awayLabel, active, onPlay }) {
  const homeWon = match?.played && String(match.winner) === String(match.home)
  const awayWon = match?.played && String(match.winner) === String(match.away)
  const winnerName = homeWon ? home?.name : awayWon ? away?.name : null

  // Display name: real team or placeholder with preview candidates if available
  const displayHomeName = home?.name || homeLabel
  const displayAwayName = away?.name || awayLabel

  return (
    <article className={`relative rounded-2xl border bg-white shadow-sm transition-all ${active ? 'border-[#FD5461]/40 shadow-red-500/10' : 'border-gray-200'}`}>
      <div className="divide-y divide-gray-100">
        <div className="flex h-14 items-center gap-3 px-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50">
            {home ? <Badge club={home} /> : <span className="text-xs font-black text-gray-300">?</span>}
          </span>
          <div className="min-w-0 flex-1">
            <span className={`block truncate text-xs font-bold ${home ? 'text-[#0A1318]' : 'text-gray-500'}`}>
              {displayHomeName}
            </span>
          </div>
          {match?.played && <ScoreChip value={match.homeScore} side="home" winner={homeWon ? 'home' : awayWon ? 'away' : null} />}
        </div>
        <div className="flex h-14 items-center gap-3 px-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50">
            {away ? <Badge club={away} /> : <span className="text-xs font-black text-gray-300">?</span>}
          </span>
          <div className="min-w-0 flex-1">
            <span className={`block truncate text-xs font-bold ${away ? 'text-[#0A1318]' : 'text-gray-500'}`}>
              {displayAwayName}
            </span>
          </div>
          {match?.played && <ScoreChip value={match.awayScore} side="away" winner={homeWon ? 'home' : awayWon ? 'away' : null} />}
        </div>
      </div>
      {match?.played && match.decidedOnPenalties && (
        <div className="border-t border-red-100 bg-red-50/60 px-3 py-2 text-center text-[11px] font-medium text-[#FD5461]">
          Penalties {match.penalties?.home}–{match.penalties?.away}{winnerName ? ` · ${winnerName} advances` : ''}
        </div>
      )}
      {active && !match?.played && <button onClick={onPlay} className="m-2 w-[calc(100%-1rem)] rounded-lg bg-[#0A1318] py-2 font-heading text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#FD5461]">Play match</button>}
    </article>
  )
}

export default function DraftCupTab() {
  const { saveData, setSaveData, saveId } = useOutletContext()
  const navigate = useNavigate()
  const [setupOpen, setSetupOpen] = useState(false)
  const [selected, setSelected] = useState([])
  const [mobileRound, setMobileRound] = useState(1)
  const [prizeOpen, setPrizeOpen] = useState(false)
  const [prizeDraft, setPrizeDraft] = useState(DEFAULT_CUP_PRIZES)
  const [cupMatchPrizeDraft, setCupMatchPrizeDraft] = useState(DEFAULT_CUP_MATCH_PRIZES)
  const [savingPrizes, setSavingPrizes] = useState(false)

  const leagueSeasons = saveData.settings?.seasons || []
  const completedLeague = [...leagueSeasons].reverse().find(season => season.status === 'completed')
  const qualifiedIds = completedLeague?.standings?.slice(0, 4).map(row => row.club_id) || []
  const allClubs = useMemo(() => {
    return (saveData.teams || []).map(team => toClub(team))
  }, [saveData.teams])
  const candidates = allClubs
  const cups = saveData.settings?.cups || []

  const [currentCupIdx, setCurrentCupIdx] = useState(() => {
    const activeIdx = cups.findIndex(c => c.status === 'active')
    return activeIdx >= 0 ? activeIdx : Math.max(0, cups.length - 1)
  })

  useEffect(() => {
    if (cups.length > 0 && !cups[currentCupIdx]) {
      setCurrentCupIdx(Math.max(0, cups.length - 1))
    }
  }, [cups, currentCupIdx])

  const cup = cups[currentCupIdx] || cups.find(item => item.status === 'active') || cups[cups.length - 1]
  const isActiveCup = cup?.status === 'active'
  const activeCupIdx = cups.findIndex(c => c.status === 'active')
  const isFirstCup = cups.length === 0 && !leagueSeasons.some(season => season.status === 'completed')
  const selectionTarget = candidates.length >= 8 ? 8 : candidates.length >= 4 ? 4 : 2

  const canGoPrev = currentCupIdx > 0
  const canGoNext = currentCupIdx < cups.length - 1

  useEffect(() => {
    if (cup) return
    setPrizeDraft([...(completedLeague?.cupPrizeSettings || saveData.settings?.customCupPrizes || DEFAULT_CUP_PRIZES)])
    setCupMatchPrizeDraft({
      ...DEFAULT_CUP_MATCH_PRIZES,
      ...(completedLeague?.cupMatchPrizes || saveData.settings?.customCupMatchPrizes || {}),
    })
  }, [cup, completedLeague, saveData.settings?.customCupMatchPrizes, saveData.settings?.customCupPrizes])

  useEffect(() => {
    if (!cup) return
    const firstAvailableRound = [1, 2, 3].find(round => (cup.rounds?.[round] || []).length > 0) || 1
    setMobileRound(current => Math.max(current, firstAvailableRound))
  }, [cup])

  function openSetup() {
    setSelected(isFirstCup ? [] : qualifiedIds.slice(0, 8))
    setSetupOpen(true)
  }

  function toggle(id) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : current.length < selectionTarget ? [...current, id] : current)
  }

  async function createCup() {
    if (selected.length !== selectionTarget) return
    const cupId = globalThis.crypto?.randomUUID?.() || `cup-${Date.now()}`
    const drawRandom = createSeededRandom(cupId)
    const shuffled = [...selected]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(drawRandom() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
    }
    const startingRound = selectionTarget === 8 ? 1 : selectionTarget === 4 ? 2 : 3
    const firstRound = Array.from({ length: selectionTarget / 2 }, (_, index) => ({ home: shuffled[index * 2], away: shuffled[index * 2 + 1], played: false }))
    const selectedQualifierIds = selected.filter(id => qualifiedIds.includes(id))
    const selectedInvitedIds = selected.filter(id => !qualifiedIds.includes(id))
    const targetSeason = completedLeague || leagueSeasons.find(season => season.status === 'active') || leagueSeasons[leagueSeasons.length - 1]
    const newCup = {
      id: cupId,
      seasonId: targetSeason?.id ?? null,
      number: cups.length + 1,
      status: 'active', round: startingRound, qualifiedIds: selectedQualifierIds, invitedIds: selectedInvitedIds,
      rounds: { [startingRound]: firstRound },
      prizeSettings: [...prizeDraft],
      matchPrizes: { ...cupMatchPrizeDraft },
      createdAt: new Date().toISOString(),
    }
    const cupTeamIds = new Set(selected)
    const existingIds = new Set((saveData.teams || []).map(team => team.club_id))
    const addedTeams = allClubs
      .filter(club => cupTeamIds.has(club.id) && !existingIds.has(club.id))
      .map((club, index) => createCupTeam(club, index))
    const newSaveData = {
      ...saveData,
      teams: [...(saveData.teams || []), ...addedTeams],
      settings: { ...saveData.settings, cups: [...cups, newCup] },
    }
    await updateDraftState(saveId, newSaveData)
    setSaveData(newSaveData)
    setMobileRound(startingRound)
    setSetupOpen(false)
    setSelected([])
  }

  function playMatch(match, index, round = cup.round) {
    const homeTeam = (saveData.teams || []).find(t => t.club_id === match.home)
    const awayTeam = (saveData.teams || []).find(t => t.club_id === match.away)
    const homeBase = allClubs.find(club => club.id === match.home)
    const awayBase = allClubs.find(club => club.id === match.away)
    const home = homeTeam ? { ...homeBase, id: homeTeam.club_id, name: homeTeam.club_name, roster: homeTeam.roster, coaches: homeTeam.coaches || [] } : homeBase
    const away = awayTeam ? { ...awayBase, id: awayTeam.club_id, name: awayTeam.club_name, roster: awayTeam.roster, coaches: awayTeam.coaches || [] } : awayBase
    const cupSeason = leagueSeasons.find(season => String(season.id) === String(cup?.seasonId)) || completedLeague
    navigate('/matches/draft/prematch', { state: { homeClub: home, awayClub: away, duration: 5, matchSize: getSeasonMatchSize(saveData.settings, cupSeason), returnPath: `/draft/${saveId}/cup`, saveId, cupRound: round, matchIndex: index } })
  }

  function openPrizeSettings() {
    setPrizeDraft([...(cup?.prizeSettings || completedLeague?.cupPrizeSettings || saveData.settings?.customCupPrizes || DEFAULT_CUP_PRIZES)])
    setCupMatchPrizeDraft({ ...DEFAULT_CUP_MATCH_PRIZES, ...(completedLeague?.cupMatchPrizes || saveData.settings?.customCupMatchPrizes || {}), ...(cup?.matchPrizes || {}) })
    setPrizeOpen(true)
  }

  async function savePrizeSettings() {
    setSavingPrizes(true)
    try {
      let nextState = await updateDraftCupPrizeSettings(saveId, cup.id, prizeDraft)
      nextState = {
        ...nextState,
        settings: {
          ...nextState.settings,
          cups: (nextState.settings.cups || []).map(c => String(c.id) === String(cup.id) ? { ...c, matchPrizes: cupMatchPrizeDraft } : c),
        },
      }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setPrizeOpen(false)
    } finally {
      setSavingPrizes(false)
    }
  }

  async function saveInitialPrizeSettings() {
    setSavingPrizes(true)
    try {
      const nextState = {
        ...saveData,
        settings: {
          ...saveData.settings,
          customCupPrizes: [...prizeDraft],
          customCupMatchPrizes: { ...cupMatchPrizeDraft },
        },
      }
      await updateDraftState(saveId, nextState)
      setSaveData(nextState)
      setPrizeOpen(false)
    } finally {
      setSavingPrizes(false)
    }
  }

  if (!isFirstCup && !completedLeague && cups.length === 0) return (
    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-20 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-[#FD5461]"><Trophy size={28} /></div>
      <h2 className="mt-5 font-heading text-2xl font-black uppercase tracking-wide text-[#0A1318]">Cup qualification</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">Complete a 5-team league season first. The top four clubs qualify automatically for the next 8-team cup.</p>
      <div className="mt-7 flex justify-center"><Button onClick={() => navigate(`/draft/${saveId}/matches`)}>Open League</Button></div>
    </div>
  )

  if (!cup) return (
    <>
      {cup?.champion && <div className="mb-5 rounded-2xl border border-[#FD5461]/35 bg-[#FD5461]/[0.07] p-5"><div className="text-[10px] font-black uppercase tracking-widest text-[#FD5461]">Last cup champion</div><div className="mt-1 font-heading text-xl font-black uppercase text-[#0A1318]">{allClubs.find(club => club.id === cup.champion)?.name}</div></div>}
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm"><Trophy size={32} className="mx-auto text-[#FD5461]" /><h2 className="mt-4 font-heading text-2xl font-black uppercase">Create the cup tournament</h2><p className="mt-2 text-sm text-gray-500">Select clubs for the cup tournament. League qualifiers are preselected but can be changed before the unrestricted random draw.</p><div className="mt-7 flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => {
        setPrizeDraft([...(completedLeague?.cupPrizeSettings || saveData.settings?.customCupPrizes || DEFAULT_CUP_PRIZES)])
        setCupMatchPrizeDraft({
          ...DEFAULT_CUP_MATCH_PRIZES,
          ...(completedLeague?.cupMatchPrizes || saveData.settings?.customCupMatchPrizes || {}),
        })
        setPrizeOpen(true)
      }} className="flex items-center gap-2"><Settings2 size={16} />Set prizes</Button><Button onClick={openSetup}>{`Select ${selectionTarget} clubs`}</Button></div></div>
      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Select Cup Clubs" width="max-w-3xl">
        <div className="space-y-5">
            <p className="type-body-sm text-gray-500">Select clubs · {selected.length}/{selectionTarget} selected · all pairings are random</p>
            <div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {candidates.map((club, index) => {
                  const active = selected.includes(club.id)
                  const qualifier = qualifiedIds.includes(club.id)
                  const isDisabled = !active && selected.length >= selectionTarget
                  const rosterCount = club.roster?.length ?? 0
                  return (
                    <button
                      key={club.id}
                      onClick={() => !isDisabled && toggle(club.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer outline-none
                        ${active
                          ? 'border-[#FD5461] bg-red-50 shadow-sm shadow-red-500/10'
                          : isDisabled
                            ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                            : 'border-gray-200 bg-white hover:border-[#FD5461] hover:bg-red-50/30 hover:shadow-sm'
                        }`}
                    >
                      {club.badge_url ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-gray-200 p-1 flex items-center justify-center">
                          <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0"
                          style={{ backgroundColor: club.badge_color ?? '#0A1318' }}>
                          {(club.short_name || club.name || 'CLB').slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-bold text-sm text-[#0A1318] truncate">{club.name}</div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          {qualifier ? <span className="font-medium text-[#FD5461]">League qualifier</span> : `${rosterCount} players`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                          active
                            ? 'bg-[#FD5461] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                        }`}>
                          {active ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={2.5} />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4"><button onClick={createCup} disabled={selected.length !== selectionTarget} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FD5461] py-3 type-body font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"><Shuffle size={16} />{selected.length === selectionTarget ? `Shuffle all ${selectionTarget} clubs` : `Select ${selectionTarget - selected.length} more`}</button></div>
        </div>
      </Modal>
      <Modal open={prizeOpen} onClose={() => setPrizeOpen(false)} title={`Cup prizes`} width="max-w-xl">
        <div className="space-y-5">
          <p className="text-sm text-gray-500">Set five reward tiers for the cup tournament.</p>
          <CupPrizeFields prizes={prizeDraft} setPrizes={setPrizeDraft} matchPrizes={cupMatchPrizeDraft} setMatchPrizes={setCupMatchPrizeDraft} />
          <button disabled={savingPrizes} onClick={saveInitialPrizeSettings} className="w-full rounded-xl bg-[#FD5461] py-3 text-sm font-semibold text-white disabled:opacity-50">{savingPrizes ? 'Saving...' : 'Save cup prizes'}</button>
        </div>
      </Modal>
    </>
  )

  const rounds = cup?.rounds || {}
  const qf = rounds[1] || []
  const sf = rounds[2] || []
  const finalRound = rounds[3] || []
  const firstRoundNumber = [1, 2, 3].find(round => (rounds[round] || []).length > 0) || 1
  const lineColor = done => done ? '#FD5461' : '#D7DCE2'
  const columnData = [
    { round: 1, title: 'Quarter Finals', short: 'Round of 8', count: 4 },
    { round: 2, title: 'Semi Finals', short: 'Final 4', count: 2 },
    { round: 3, title: 'Final', short: 'Championship', count: 1 },
  ]
  const championClub = cup?.champion ? allClubs.find(club => club.id === cup.champion) : null

  return (
    <div className="space-y-5">
      {/* Top Cup Season/Tournament Header Bar */}
      <div className={`flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 mb-5 sm:gap-4 ${isActiveCup ? 'border-gray-100 bg-gray-50' : 'border-[#FD5461]/20 bg-[#FD5461]/[0.06]'}`}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[#0A1318] sm:text-base">
          <span className="truncate font-heading font-black uppercase tracking-wide text-[#0A1318]">Club Cup {cup?.number || 1}</span>
          {isActiveCup && (
            <>
              <span className="text-gray-300">·</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FD5461]">
                <span className="h-2 w-2 rounded-full bg-[#FD5461]" />Active
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-xs font-medium text-gray-500">{ROUND_NAMES[cup.round]}</span>
            </>
          )}
          {!isActiveCup && championClub && (
            <>
              <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />
              <span className="inline-flex min-w-0 items-center gap-2">
                <Badge club={championClub} />
                <span className="truncate font-semibold text-sm">{championClub.name}</span>
                <span className="rounded-full bg-[#FD5461]/10 px-2.5 py-1 text-xs font-semibold text-[#FD5461]">Winner</span>
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openPrizeSettings}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={isActiveCup ? 'Cup prize settings' : 'View locked cup prizes'}
          >
            {isActiveCup ? <Settings2 size={16} strokeWidth={2.25} /> : <Eye size={16} strokeWidth={2} />}
            <span className="hidden sm:inline">{isActiveCup ? 'Prizes' : 'View prizes'}</span>
          </button>

          {!isActiveCup && activeCupIdx >= 0 && (
            <button
              type="button"
              onClick={() => setCurrentCupIdx(activeCupIdx)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-[#FD5461] px-3.5 text-sm font-semibold text-white shadow-sm shadow-red-500/20 transition-[background-color,transform,box-shadow] hover:bg-red-500 hover:shadow-md hover:shadow-red-500/25 active:scale-[0.98]"
              aria-label="Return to active cup"
            >
              <CalendarClock size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Current</span>
            </button>
          )}

          {cups.length > 1 && (
            <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => canGoPrev && setCurrentCupIdx(i => i - 1)}
                disabled={!canGoPrev}
                aria-label="Previous cup"
                className="flex h-7 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 hover:bg-gray-100 sm:h-8 sm:w-10"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              <div className="mx-0.5 h-4 w-px bg-gray-200" />
              <button
                type="button"
                onClick={() => canGoNext && setCurrentCupIdx(i => i + 1)}
                disabled={!canGoNext}
                aria-label="Next cup"
                className="flex h-7 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 hover:bg-gray-100 sm:h-8 sm:w-10"
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-[#F8F9FA] p-4 shadow-sm lg:hidden">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-2">
          <button onClick={() => setMobileRound(round => Math.max(1, round - 1))} disabled={mobileRound === 1} aria-label="Previous round" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-[#0A1318] transition-all hover:border-[#FD5461] hover:text-[#FD5461] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300 disabled:hover:border-gray-200"><ChevronLeft size={19} strokeWidth={2.25} /></button>
          <div className="min-w-0 text-center"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FD5461]">{columnData[mobileRound - 1].short}</p><h3 className="mt-0.5 truncate font-heading text-base font-black uppercase text-[#0A1318]">{columnData[mobileRound - 1].title}</h3></div>
          <button onClick={() => setMobileRound(round => Math.min(3, round + 1))} disabled={mobileRound === 3} aria-label="Next round" className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-[#0A1318] transition-all hover:border-[#FD5461] hover:text-[#FD5461] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300 disabled:hover:border-gray-200"><ChevronRight size={19} strokeWidth={2.25} /></button>
        </div>
        <div key={mobileRound} className="space-y-4" style={{ animation: 'fadeSlideUp 0.35s cubic-bezier(.22,1,.36,1) both' }}>
          {Array.from({ length: mobileRound < firstRoundNumber ? 0 : columnData[mobileRound - 1].count }, (_, index) => {
            const match = rounds[mobileRound]?.[index]
            const prevMatch1 = rounds[mobileRound - 1]?.[index * 2]
            const prevMatch2 = rounds[mobileRound - 1]?.[index * 2 + 1]

            const homeTeamId = match?.home || (prevMatch1?.played ? prevMatch1.winner : null)
            const awayTeamId = match?.away || (prevMatch2?.played ? prevMatch2.winner : null)

            const home = homeTeamId ? allClubs.find(club => club.id === homeTeamId) : null
            const away = awayTeamId ? allClubs.find(club => club.id === awayTeamId) : null

            const previousPrefix = mobileRound === 2 ? 'QF' : 'SF'
            const h1 = prevMatch1 ? allClubs.find(c => c.id === prevMatch1.home) : null
            const h2 = prevMatch1 ? allClubs.find(c => c.id === prevMatch1.away) : null
            const a1 = prevMatch2 ? allClubs.find(c => c.id === prevMatch2.home) : null
            const a2 = prevMatch2 ? allClubs.find(c => c.id === prevMatch2.away) : null

            const homeLabel = (h1 && h2) ? `${h1.short_name || h1.name} / ${h2.short_name || h2.name}` : `Winner of ${previousPrefix} ${index * 2 + 1}`
            const awayLabel = (a1 && a2) ? `${a1.short_name || a1.name} / ${a2.short_name || a2.name}` : `Winner of ${previousPrefix} ${index * 2 + 2}`

            return <BracketMatch key={index} match={match} home={home} away={away} homeLabel={homeLabel} awayLabel={awayLabel} active={mobileRound === cup.round && Boolean(match)} onPlay={() => playMatch(match, index, mobileRound)} />
          })}
        </div>
        <div className="mt-5 flex items-center justify-center gap-2">{[1, 2, 3].map(round => <button key={round} onClick={() => setMobileRound(round)} aria-label={`Show ${ROUND_NAMES[round]}`} className={`h-2 rounded-full transition-all ${mobileRound === round ? 'w-7 bg-[#FD5461]' : 'w-2 bg-gray-300'}`} />)}</div>
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-[#F8F9FA] p-5 shadow-sm lg:block">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-3 gap-12">
            {columnData.map(column => <header key={column.round} className="text-center"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FD5461]">{column.short}</p><h3 className="mt-1 font-heading text-lg font-black uppercase text-[#0A1318]">{column.title}</h3></header>)}
          </div>
          <div className="relative mt-4 h-[720px]">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 980 720" preserveAspectRatio="none" aria-hidden="true">
              <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-colors duration-500">
                <path d="M295 90 H319 V180" stroke={lineColor(qf[0]?.played)} />
                <path d="M295 270 H319 V180" stroke={lineColor(qf[1]?.played)} />
                <path d="M319 180 H343" stroke={lineColor(Boolean(sf[0]))} />
                <path d="M295 450 H319 V540" stroke={lineColor(qf[2]?.played)} />
                <path d="M295 630 H319 V540" stroke={lineColor(qf[3]?.played)} />
                <path d="M319 540 H343" stroke={lineColor(Boolean(sf[1]))} />
                <path d="M638 180 H662 V360" stroke={lineColor(sf[0]?.played)} />
                <path d="M638 540 H662 V360" stroke={lineColor(sf[1]?.played)} />
                <path d="M662 360 H686" stroke={lineColor(Boolean(finalRound[0]))} />
              </g>
              <circle cx="319" cy="180" r="3" fill={lineColor(Boolean(sf[0]))} className="transition-colors duration-500" />
              <circle cx="319" cy="540" r="3" fill={lineColor(Boolean(sf[1]))} className="transition-colors duration-500" />
              <circle cx="662" cy="360" r="3" fill={lineColor(Boolean(finalRound[0]))} className="transition-colors duration-500" />
            </svg>
            <div className="absolute inset-0 grid grid-cols-3 gap-12">
              {columnData.map(column => {
                const positions = column.round === 1 ? [90, 270, 450, 630] : column.round === 2 ? [180, 540] : [360]
                return <section key={column.round} className="relative h-full">{Array.from({ length: column.round < firstRoundNumber ? 0 : column.count }, (_, index) => {
                  const match = rounds[column.round]?.[index]
                  const prevMatch1 = rounds[column.round - 1]?.[index * 2]
                  const prevMatch2 = rounds[column.round - 1]?.[index * 2 + 1]

                  // If match has home/away set use it, otherwise if previous match played use its winner!
                  const homeTeamId = match?.home || (prevMatch1?.played ? prevMatch1.winner : null)
                  const awayTeamId = match?.away || (prevMatch2?.played ? prevMatch2.winner : null)

                  const home = homeTeamId ? allClubs.find(club => club.id === homeTeamId) : null
                  const away = awayTeamId ? allClubs.find(club => club.id === awayTeamId) : null

                  const previousPrefix = column.round === 2 ? 'QF' : 'SF'
                  const h1 = prevMatch1 ? allClubs.find(c => c.id === prevMatch1.home) : null
                  const h2 = prevMatch1 ? allClubs.find(c => c.id === prevMatch1.away) : null
                  const a1 = prevMatch2 ? allClubs.find(c => c.id === prevMatch2.home) : null
                  const a2 = prevMatch2 ? allClubs.find(c => c.id === prevMatch2.away) : null

                  const homeLabel = (h1 && h2) ? `${h1.short_name || h1.name} / ${h2.short_name || h2.name}` : `Winner of ${previousPrefix} ${index * 2 + 1}`
                  const awayLabel = (a1 && a2) ? `${a1.short_name || a1.name} / ${a2.short_name || a2.name}` : `Winner of ${previousPrefix} ${index * 2 + 2}`

                  return <div key={index} className="absolute left-0 right-0 -translate-y-1/2" style={{ top: positions[index] }}><BracketMatch match={match} home={home} away={away} homeLabel={homeLabel} awayLabel={awayLabel} active={column.round === cup.round && Boolean(match)} onPlay={() => playMatch(match, index, column.round)} /></div>
                })}</section>
              })}
            </div>
          </div>
        </div>
      </div>
      <Modal open={prizeOpen} onClose={() => setPrizeOpen(false)} title={`Club Cup ${cup.number} prizes`} width="max-w-xl">
        <div className="space-y-5">
          <CupPrizeFields prizes={prizeDraft} setPrizes={setPrizeDraft} matchPrizes={cupMatchPrizeDraft} setMatchPrizes={setCupMatchPrizeDraft} disabled={cup.status === 'completed'} />
          <button onClick={savePrizeSettings} disabled={savingPrizes} className="w-full rounded-xl bg-[#FD5461] py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">{savingPrizes ? 'Saving...' : 'Save cup prizes'}</button>
        </div>
      </Modal>
    </div>
  )
}
