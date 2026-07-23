import { useState, useEffect } from 'react'
import { fetchNationalTeams, fetchClubTeams } from '../../services/worldCup'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import { supabase } from '../../lib/supabase'
import { Check, Plus, X } from 'lucide-react'
import useOverlayBehavior from '../../hooks/useOverlayBehavior'

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
  const [nameSort, setNameSort] = useState('asc')
  const [ovrSort, setOvrSort] = useState(null)

  useEffect(() => {
    if (!open) return
    setSelected(new Set(initialSelectedIds))
    setStep(0)
    setSearch('')
    setNameSort('asc')
    setOvrSort(null)
    if (teams) {
      setAllTeams(teams)
      const map = {}, sums = {}, counts = {}
      ;(players || []).forEach(player => {
        if (!player.club_id) return
        sums[player.club_id] = (sums[player.club_id] || 0) + (player.ovr || 0)
        counts[player.club_id] = (counts[player.club_id] || 0) + 1
      })
      Object.keys(sums).forEach(id => { map[id] = Math.round(sums[id] / counts[id]) })
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
        const sums = {}, counts = {}
        for (const p of players) {
          if (!p.club_id) continue
          sums[p.club_id] = (sums[p.club_id] ?? 0) + (p.ovr_v2 ?? p.ovr ?? 0)
          counts[p.club_id] = (counts[p.club_id] ?? 0) + 1
        }
        for (const k of Object.keys(sums)) {
          map[k] = Math.round(sums[k] / counts[k])
        }
      }
      setOvrMap(map)
    }).catch(() => {
      setAllTeams([])
      setOvrMap({})
    }).finally(() => setLoading(false))
  }, [open, teams, players, initialSelectedIds])

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

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0A1318]/55 p-4 backdrop-blur-sm sm:p-6 ${closing ? 'ui-overlay-exit' : 'ui-overlay-enter'}`}
      onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`flex h-[min(700px,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${closing ? 'ui-modal-exit' : 'ui-modal-enter'}`}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 sm:px-8 flex-shrink-0 border-b border-gray-100">
          <div>
            <div className="font-heading font-black text-2xl uppercase tracking-wide text-[#0A1318]">
              {isNewSeason ? 'New Season' : 'เลือกสโมสร'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {isNewSeason
                ? `4 ทีมล็อค · เลือกเพิ่มอีก ${slotsNeeded} ทีม`
                : `เลือก ${requiredTeams} ทีมเพื่อเริ่มลีก`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-400 cursor-pointer">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <ol className="mx-auto flex w-full max-w-md items-center justify-center px-6 py-4">
          {['Clubs', 'Schedule'].map((label, index) => (
            <li key={label} className="flex shrink-0 items-center">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full font-heading text-[10px] font-black transition-colors duration-500 ${index <= step ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>{index + 1}</span>
              <span className={`ml-2 text-[10px] font-black uppercase tracking-wider ${index <= step ? 'text-[#0A1318]' : 'text-gray-400'}`}>{label}</span>
              {index === 0 && <span className={`mx-3 h-px w-24 transition-colors duration-500 ${step > 0 ? 'bg-[#FD5461]' : 'bg-gray-200'}`} />}
            </li>
          ))}
        </ol>

        {/* Selection count — same pattern as Create Play Game */}
        <div className={`${step === 0 ? 'flex' : 'hidden'} items-end justify-between px-6 pb-3 sm:px-8 flex-shrink-0`}>
          <div>
            <h3 className="font-heading text-sm font-black uppercase tracking-wide text-[#0A1318]">Select clubs</h3>
            <p className="mt-0.5 text-xs text-gray-400">Choose exactly {requiredTeams} clubs for this league.</p>
          </div>
          <span className="font-heading text-xs font-black uppercase tracking-wider text-[#FD5461]">
            {totalSelected} / {requiredTeams} selected
          </span>
        </div>

        {/* Locked teams (new season only) */}
        {isNewSeason && (
          <div className={`${step === 0 ? '' : 'hidden'} px-6 pb-3 flex-shrink-0`}>
            <div className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 mb-2">ทีมที่ล็อค (Top 4)</div>
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
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาทีม..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-colors"
          />
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
            <div className="text-center py-8 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">ไม่พบทีม</div>
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
                      {ovr && <span className="font-heading font-black text-xs text-[#0A1318] tabular-nums">{ovr}</span>}
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg font-black transition-all ${isSelected ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-500'}`}>
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
          <div className="flex-1 overflow-y-auto px-6 pb-6 sm:px-8" style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(.22,1,.36,1) both' }}>
            <div className="mx-auto max-w-xl">
              <h3 className="font-heading text-xl font-black uppercase tracking-wide text-[#0A1318]">Ready to create league</h3>
              <p className="mt-1 text-sm text-gray-500">Review the five clubs. A double round-robin schedule will be generated automatically.</p>
              <div className="mt-5 space-y-2">
                {[...selected].map((id, index) => {
                  const team = allTeams.find(item => item.id === id) || lockedTeams.find(item => (item.club_id || item.id) === id)
                  if (!team) return null
                  return <div key={id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl font-heading text-[10px] font-black text-white" style={{ backgroundColor: team.badge_color || '#0A1318' }}>{team.short_name || team.name?.slice(0, 3).toUpperCase()}</span><span className="min-w-0 flex-1 truncate font-heading text-sm font-black uppercase text-[#0A1318]">{team.name}</span><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FD5461] text-white"><Check size={13} strokeWidth={2.5} /></span></div>
                })}
              </div>
              <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-xs leading-6 text-gray-500"><strong className="text-[#0A1318]">League rules:</strong> 5 clubs · home and away fixtures · bottom club relegated after the season.</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 sm:px-8 flex-shrink-0 border-t border-gray-100 bg-white">
          {step === 1 && <button onClick={() => setStep(0)} className="rounded-xl px-5 py-4 font-heading text-xs font-black uppercase tracking-wider text-gray-500 transition-colors hover:bg-gray-100">Back</button>}
          <button
            onClick={() => step === 0 ? setStep(1) : handleCreate()}
            disabled={selected.size !== slotsNeeded || saving}
            className="flex-1 py-4 rounded-2xl font-heading font-black text-sm uppercase tracking-widest transition-all cursor-pointer
              disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed
              bg-[#FD5461] text-white hover:bg-red-500 disabled:hover:bg-gray-100">
            {saving ? 'กำลังสร้าง...' : remaining > 0 ? `เลือกอีก ${remaining} ทีม` : step === 0 ? 'Continue' : 'Create League'}
          </button>
        </div>
      </div>
    </div>
  )
}
