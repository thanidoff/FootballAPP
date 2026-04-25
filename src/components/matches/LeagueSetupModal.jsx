import { useState, useEffect } from 'react'
import { fetchNationalTeams, fetchClubTeams } from '../../services/worldCup'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import { supabase } from '../../lib/supabase'

const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))

function flagUrl(code) {
  if (!code) return null
  return `https://flagcdn.com/w40/${code}.png`
}

const REQUIRED = 6

// lockedTeamIds: top 4 from previous season (if new season)
// relegatedTeamIds: bottom 2 (shown but user cannot re-select them)
export default function LeagueSetupModal({ open, onClose, onCreate, lockedTeams = [] }) {
  const isNewSeason = lockedTeams.length > 0
  const lockedIds = new Set(lockedTeams.map(t => t.club_id ?? t.id))
  const slotsNeeded = REQUIRED - lockedTeams.length // 6 if fresh, 2 if new season

  const [allTeams, setAllTeams] = useState([])
  const [ovrMap, setOvrMap] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [nameSort, setNameSort] = useState('asc')
  const [ovrSort, setOvrSort] = useState(null)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setSearch('')
    setNameSort('asc')
    setOvrSort(null)
    setLoading(true)
    Promise.all([
      fetchClubTeams(),
      supabase.from('players').select('club_id, ovr'),
    ]).then(([clubs, { data: players }]) => {
      setAllTeams(clubs)
      const map = {}
      if (players) {
        const sums = {}, counts = {}
        for (const p of players) {
          if (!p.club_id) continue
          sums[p.club_id] = (sums[p.club_id] ?? 0) + (p.ovr ?? 0)
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
  }, [open])

  if (!open) return null

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
  const remaining = REQUIRED - totalSelected

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
        style={{ animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <div className="font-heading font-black text-xl uppercase tracking-wide text-[#0A1318]">
              {isNewSeason ? 'New Season' : 'เลือกสโมสร'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {isNewSeason
                ? `4 ทีมล็อค · เลือกเพิ่มอีก ${slotsNeeded} ทีม`
                : `เลือก ${REQUIRED} ทีมเพื่อเริ่มลีก`}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Counter bar */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: REQUIRED }).map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i < totalSelected ? 'bg-[#FD5461] w-3' : 'bg-gray-200 w-1.5'}`} />
              ))}
            </div>
            <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 ml-1">
              {totalSelected}/{REQUIRED}
            </span>
          </div>
        </div>

        {/* Locked teams (new season only) */}
        {isNewSeason && (
          <div className="px-6 pb-3 flex-shrink-0">
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
        <div className="px-6 pb-3 flex-shrink-0 flex gap-2">
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
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400 font-heading font-bold uppercase tracking-widest text-xs">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">ไม่พบทีม</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(team => {
                const isSelected = selected.has(team.id)
                const isDisabled = !isSelected && selected.size >= slotsNeeded
                const ovr = ovrMap[team.id]
                return (
                  <button
                    key={team.id}
                    onClick={() => !isDisabled && toggle(team.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all cursor-pointer outline-none
                      ${isSelected
                        ? 'border-[#FD5461] bg-[#FD5461]/5'
                        : isDisabled
                          ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                          : 'border-gray-100 bg-white hover:border-gray-300'
                      }`}
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
                      <div className="font-heading font-medium text-sm text-[#0A1318] truncate">{team.name}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ovr ? (
                        <span className="font-heading font-black text-sm text-[#0A1318] tabular-nums">{ovr}</span>
                      ) : (
                        <span className="font-heading font-bold text-xs text-gray-300">—</span>
                      )}
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#FD5461] flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex-shrink-0 border-t border-gray-100">
          <button
            onClick={handleCreate}
            disabled={selected.size !== slotsNeeded || saving}
            className="w-full py-4 rounded-2xl font-heading font-black text-sm uppercase tracking-widest transition-all cursor-pointer
              disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed
              bg-[#FD5461] text-white hover:bg-red-500 disabled:hover:bg-gray-100">
            {saving ? 'กำลังสร้าง...' : remaining > 0 ? `เลือกอีก ${remaining} ทีม` : 'เริ่มต้นลีก ⚽'}
          </button>
        </div>
      </div>
    </div>
  )
}
