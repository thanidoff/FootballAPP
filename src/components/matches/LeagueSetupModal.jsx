import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { fetchNationalTeams, fetchClubTeams } from '../../services/worldCup'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import { supabase } from '../../lib/supabase'
import { Check, ChevronLeft, Plus, RefreshCw, Search, X } from 'lucide-react'
import useOverlayBehavior from '../../hooks/useOverlayBehavior'
import OvrBadge from '../ui/OvrBadge'
import { generateSchedule } from '../../utils/draftLogic'

const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))

function flagUrl(code) {
  if (!code) return null
  return `https://flagcdn.com/w40/${code}.png`
}

const REQUIRED = 6
const EMPTY_SELECTED_IDS = []

// lockedTeamIds: top 4 from previous season (if new season)
// relegatedTeamIds: bottom 2 (shown but user cannot re-select them)
export default function LeagueSetupModal({ open, onClose, onCreate, lockedTeams = [], initialSelectedIds = EMPTY_SELECTED_IDS, teams = null, players = null, requiredTeams = REQUIRED }) {
  const { shouldRender, closing } = useOverlayBehavior(open, onClose)
  const isNewSeason = lockedTeams.length > 0
  const lockedIds = new Set(lockedTeams.map(t => t.club_id ?? t.id))
  const slotsNeeded = requiredTeams - lockedTeams.length

  const [allTeams, setAllTeams] = useState([])
  const [ovrMap, setOvrMap] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [nameSort, setNameSort] = useState(null)
  const [ovrSort, setOvrSort] = useState('desc')

  useEffect(() => {
    if (!open) return
    setSelected(new Set(initialSelectedIds))
    setStep(0)
    setSearch('')
    setNameSort(null)
    setOvrSort('desc')
    if (teams) {
      setAllTeams(teams)
      const map = {}
      const playersByClub = {}
      ;(players || []).forEach(player => {
        if (!player.club_id) return
        if (!playersByClub[player.club_id]) playersByClub[player.club_id] = []
        playersByClub[player.club_id].push(player.ovr_v2 ?? player.ovr ?? 0)
      })
      Object.keys(playersByClub).forEach(id => {
        const top5 = playersByClub[id].sort((a, b) => b - a).slice(0, 5)
        map[id] = top5.length ? Math.round(top5.reduce((sum, v) => sum + v, 0) / top5.length) : 0
      })
      setOvrMap(map)
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      fetchClubTeams(),
      supabase.from('players').select('club_id, ovr, ovr_v2'),
    ]).then(([clubs, { data: players }]) => {
      setAllTeams(clubs)
      const map = {}
      if (players) {
        const playersByClub = {}
        for (const p of players) {
          if (!p.club_id) continue
          if (!playersByClub[p.club_id]) playersByClub[p.club_id] = []
          playersByClub[p.club_id].push(p.ovr_v2 ?? p.ovr ?? 0)
        }
        for (const k of Object.keys(playersByClub)) {
          const top5 = playersByClub[k].sort((a, b) => b - a).slice(0, 5)
          map[k] = top5.length ? Math.round(top5.reduce((sum, v) => sum + v, 0) / top5.length) : 0
        }
      }
      setOvrMap(map)
    }).catch(() => {
      setAllTeams([])
      setOvrMap({})
    }).finally(() => setLoading(false))
  }, [open, teams, players, initialSelectedIds])

  const [scheduleSeed, setScheduleSeed] = useState(0)

  const selectedTeamObjects = useMemo(() => [
    ...lockedTeams.map(t => ({ id: t.club_id ?? t.id, name: t.club_name ?? t.name, short_name: t.short_name, badge_url: t.badge_url, badge_color: t.badge_color, locked: true })),
    ...allTeams.filter(t => selected.has(t.id ?? t.club_id))
  ], [lockedTeams, allTeams, selected])

  const previewSchedule = useMemo(() => {
    if (selectedTeamObjects.length === 0) return []
    const teamIds = selectedTeamObjects.map(t => t.id ?? t.club_id)
    if (scheduleSeed > 0) {
      // Shuffle non-locked teams order to generate different schedule variations
      const shuffledIds = [...teamIds].sort(() => Math.random() - 0.5)
      return generateSchedule(shuffledIds)
    }
    return generateSchedule(teamIds)
  }, [selectedTeamObjects, scheduleSeed])

  if (!shouldRender) return null

  // Exclude locked teams from selectable list
  const available = allTeams.filter(t => !lockedIds.has(t.id))

  const filtered = available
    .filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.short_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aOvr = ovrMap[a.id] ?? 0
      const bOvr = ovrMap[b.id] ?? 0
      if (ovrSort === 'desc') return bOvr - aOvr
      if (ovrSort === 'asc') return aOvr - bOvr
      return nameSort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < slotsNeeded) next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (selected.size !== slotsNeeded) return
    setSaving(true)
    const lockedClubIds = lockedTeams.map(t => t.club_id ?? t.id)
    try { await onCreate([...lockedClubIds, ...selected]) }
    finally { setSaving(false) }
  }

  const totalSelected = lockedTeams.length + selected.size
  const remaining = requiredTeams - totalSelected

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0A1318]/55 p-4 backdrop-blur-sm sm:p-6 ${closing ? 'ui-overlay-exit' : 'ui-overlay-enter'}`}
      onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`flex h-[min(700px,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${closing ? 'ui-modal-exit' : 'ui-modal-enter'}`}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-5 sm:px-8 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-heading text-2xl font-black uppercase tracking-wide text-[#0A1318]">
              {isNewSeason ? 'New Season' : 'Select Club League'}
            </h2>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <ol className="mx-auto mt-5 flex max-w-xl items-center justify-center">
            {['Clubs', 'Schedule'].map((label, index) => (
              <li key={label} className="flex shrink-0 items-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full font-heading text-xs font-black transition-colors duration-500 ${index <= step ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>{index + 1}</span>
                <span className={`ml-2.5 text-sm font-heading font-black uppercase tracking-wider ${index <= step ? 'text-[#0A1318]' : 'text-gray-400'}`}>{label}</span>
                {index === 0 && <span className={`mx-3.5 h-px w-10 transition-colors duration-500 sm:w-16 ${step > 0 ? 'bg-[#FD5461]' : 'bg-gray-200'}`} />}
              </li>
            ))}
          </ol>
        </div>

        {/* Selection count — same pattern as Create Play Game */}
        <div className={`${step === 0 ? 'flex' : 'hidden'} items-end justify-between px-6 pt-4 pb-3 sm:px-8 flex-shrink-0`}>
          <div>
            <h3 className="font-heading text-sm font-black uppercase tracking-wide text-[#0A1318]">Select clubs</h3>
          </div>
          <span className="font-heading text-xs font-black uppercase tracking-wider text-[#FD5461]">
            {totalSelected} / {requiredTeams} selected
          </span>
        </div>

        {/* Locked teams (new season only) */}
        {isNewSeason && (
          <div className={`${step === 0 ? '' : 'hidden'} px-6 pb-3 flex-shrink-0`}>
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-2">Locked Teams (Top 4)</div>
            <div className="space-y-1">
              {lockedTeams.map(t => {
                const club = t.club ?? t
                const ovr = ovrMap[club.id]
                return (
                  <div key={club.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                    {club.badge_url ? (
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-white flex-shrink-0 ring-1 ring-gray-200">
                        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-0.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-heading font-black text-white flex-shrink-0"
                        style={{ backgroundColor: club.badge_color ?? '#0A1318', fontSize: '8px' }}>
                        {club.short_name}
                      </div>
                    )}
                    <span className="font-heading font-medium text-sm text-[#0A1318] flex-1 truncate">{club.name}</span>
                    <span className="text-[10px] font-heading font-black uppercase tracking-widest text-[#FD5461]">Locked</span>
                    {ovr && <span className="font-heading font-black text-sm text-[#0A1318] tabular-nums">{ovr}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Search + Sort */}
        <div className={`${step === 0 ? '' : 'hidden'} px-6 pb-4 sm:px-8 flex-shrink-0 gap-2`} style={{ display: step === 0 ? 'flex' : 'none' }}>
          <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-gray-900/20 transition-all">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search team..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={() => { setNameSort(s => s === 'asc' ? 'desc' : 'asc'); setOvrSort(null) }}
            className={`px-3 py-2 rounded-xl border text-[10px] font-heading font-black uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap
              ${!ovrSort ? 'bg-[#0A1318] text-white border-[#0A1318]' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
          >
            A–Z {nameSort === 'asc' ? '↓' : '↑'}
          </button>
          <button
            onClick={() => setOvrSort(s => s === 'desc' ? 'asc' : 'desc')}
            className={`px-3 py-2 rounded-xl border text-[10px] font-heading font-black uppercase tracking-widest transition-colors cursor-pointer whitespace-nowrap
              ${ovrSort ? 'bg-[#0A1318] text-white border-[#0A1318]' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
          >
            OVR {ovrSort === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Team list */}
        <div className={`${step === 0 ? '' : 'hidden'} flex-1 overflow-y-auto px-6 pb-4 sm:px-8`}>
          {loading ? (
            <div className="text-center py-12 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">No teams found</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((team, index) => {
                const isSelected = selected.has(team.id)
                const isDisabled = !isSelected && selected.size >= slotsNeeded
                const ovr = ovrMap[team.id]
                return (
                  <button
                    key={team.id}
                    onClick={() => !isDisabled && toggle(team.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer outline-none
                      ${isSelected
                        ? 'border-[#FD5461] bg-red-50 shadow-sm shadow-red-500/10'
                        : isDisabled
                          ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:border-[#FD5461] hover:bg-red-50/30 hover:shadow-sm'
                      }`}
                    style={{ animation: `fadeSlideUp 0.35s cubic-bezier(.22,1,.36,1) ${Math.min(index, 8) * 35}ms both` }}
                  >
                    {team.badge_url ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-gray-200">
                        <img src={team.badge_url} alt={team.name} className="w-full h-full object-contain p-1" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0"
                        style={{ backgroundColor: team.badge_color ?? '#0A1318' }}>
                        {team.short_name}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-black text-sm uppercase text-[#0A1318] truncate">{team.name}</div>
                      <div className={`mt-0.5 text-xs ${isSelected ? 'font-bold text-[#FD5461]' : 'text-gray-400'}`}>{isSelected ? 'Selected' : 'Add to league'}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ovr && <OvrBadge value={ovr} size="sm" />}
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg font-black transition-all ${isSelected ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-[#0A1318]'}`}>
                        {isSelected ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8" style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(.22,1,.36,1) both' }}>
            <div className="w-full space-y-6">
              <div>
                <h3 className="font-heading text-xl font-black uppercase tracking-wide text-[#0A1318]">Generated Fixtures Schedule</h3>
                <p className="mt-1 text-sm text-gray-500">Double round-robin schedule ({previewSchedule.length} weeks total)</p>
              </div>

              <div className="space-y-6">
                {previewSchedule.map(round => (
                  <div key={round.week} className="space-y-2.5">
                    {/* Week Pill Badge */}
                    <div>
                      <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-4 py-1.5 font-heading text-xs font-black text-[#FD5461]">
                        Week {round.week}
                      </span>
                    </div>

                    {/* Match Cards */}
                    <div className="space-y-2.5">
                      {round.matches.map((m, idx) => {
                        const homeTeam = selectedTeamObjects.find(t => String(t.id ?? t.club_id) === String(m.home))
                        const awayTeam = selectedTeamObjects.find(t => String(t.id ?? t.club_id) === String(m.away))
                        return (
                          <div key={idx} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-xs">
                            {/* Home */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {homeTeam?.badge_url ? (
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-gray-100 p-0.5">
                                  <img src={homeTeam.badge_url} alt="" className="w-full h-full object-contain" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0" style={{ backgroundColor: homeTeam?.badge_color || '#0A1318' }}>
                                  {homeTeam?.short_name || homeTeam?.name?.slice(0, 3).toUpperCase()}
                                </div>
                              )}
                              <span className="truncate font-heading font-black text-sm uppercase text-[#0A1318]">{homeTeam?.name || 'Home Team'}</span>
                            </div>

                            {/* VS Badge */}
                            <span className="px-4 text-xs font-heading font-black text-gray-400 shrink-0">VS</span>

                            {/* Away */}
                            <div className="flex items-center gap-3 justify-end min-w-0 flex-1 text-right">
                              <span className="truncate font-heading font-black text-sm uppercase text-[#0A1318]">{awayTeam?.name || 'Away Team'}</span>
                              {awayTeam?.badge_url ? (
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-gray-100 p-0.5">
                                  <img src={awayTeam.badge_url} alt="" className="w-full h-full object-contain" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0" style={{ backgroundColor: awayTeam?.badge_color || '#0A1318' }}>
                                  {awayTeam?.short_name || awayTeam?.name?.slice(0, 3).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-gray-100 px-6 py-4 sm:px-8 flex-shrink-0 bg-white">
          {step === 1 ? (
            <button onClick={() => setStep(0)} className="flex items-center gap-1 rounded-xl px-4 py-3 font-heading text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer">
              <ChevronLeft size={16} strokeWidth={2.5} />
              <span>Back</span>
            </button>
          ) : <div />}
          <div className="flex items-center gap-3">
            {step === 1 && (
              <button
                onClick={() => setScheduleSeed(s => s + 1)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 font-heading text-xs font-black uppercase tracking-widest text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} strokeWidth={2.5} />
                <span>Reshuffle</span>
              </button>
            )}
            <button
              onClick={() => step === 0 ? setStep(1) : handleCreate()}
              disabled={selected.size !== slotsNeeded || saving}
              className="rounded-xl bg-[#FD5461] px-6 py-3 font-heading text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-500/20 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer">
              {saving ? 'Creating...' : remaining > 0 ? `Select ${remaining} more ${remaining === 1 ? 'team' : 'teams'}` : step === 0 ? 'Continue' : 'Create League'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
