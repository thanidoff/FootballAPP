import { useState, useEffect } from 'react'
import { fetchNationalTeams, fetchClubTeams, seedNationalTeams } from '../../services/worldCup'
import { FIFA_NATIONS } from '../../utils/fifaNations'
import { supabase } from '../../lib/supabase'

// Build lookup: nation name → ISO code
const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))

function flagUrl(code) {
  if (!code) return null
  return `https://flagcdn.com/w40/${code}.png`
}

export default function WorldCupSetupModal({ open, onClose, onCreate, mode = 'national' }) {
  const isClub = mode === 'club'
  const [teamSize, setTeamSize] = useState(8)
  const [teams, setTeams]       = useState([])
  const [ovrMap, setOvrMap]     = useState({}) // nationality → avg ovr
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [seeding, setSeeding]   = useState(false)
  const [search, setSearch]   = useState('')
  const [nameSort, setNameSort] = useState('asc') // 'asc' | 'desc'
  const [ovrSort, setOvrSort]   = useState(null)  // null | 'desc' | 'asc'

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
      isClub ? fetchClubTeams() : fetchNationalTeams(),
      // fetch avg ovr per nationality
      supabase.from('players').select('nationality, club_id, ovr, roster_order, national_roster_order'),
    ]).then(([t, { data: players }]) => {
      setTeams(t)
      const map = {}
      if (players) {
        const acc = {}
        for (const p of players) {
          // club mode: key by club_id; national mode: key by nationality
          const key = isClub ? p.club_id : p.nationality
          if (!key) continue
          if (!acc[key]) acc[key] = []
          acc[key].push(p)
        }
        const orderKey = isClub ? 'roster_order' : 'national_roster_order'
        for (const [k, plist] of Object.entries(acc)) {
          plist.sort((a, b) => {
            const aHas = a[orderKey] != null;
            const bHas = b[orderKey] != null;
            if (aHas && bHas) return a[orderKey] - b[orderKey];
            if (aHas) return -1;
            if (bHas) return 1;
            return b.ovr - a.ovr;
          });
          const top5 = plist.slice(0, 5);
          if (top5.length > 0) {
            map[k] = Math.round(top5.reduce((sum, p) => sum + p.ovr, 0) / top5.length);
          }
        }
      }
      setOvrMap(map)
    }).catch(() => {
      setTeams([])
      setOvrMap({})
    }).finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const filtered = teams
    .filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.short_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aOvr = isClub ? (ovrMap[a.id] ?? 0) : (ovrMap[a.name] ?? 0)
      const bOvr = isClub ? (ovrMap[b.id] ?? 0) : (ovrMap[b.name] ?? 0)
      if (ovrSort === 'desc') return bOvr - aOvr
      if (ovrSort === 'asc')  return aOvr - bOvr
      return nameSort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < teamSize) next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (selected.size !== teamSize) return
    setSaving(true)
    try { await onCreate([...selected]) }
    finally { setSaving(false) }
  }

  const remaining = teamSize - selected.size

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
        style={{ animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <div className="font-heading font-black text-xl uppercase tracking-wide text-[#0A1318]">{isClub ? 'เลือกสโมสร' : 'เลือกทีมชาติ'}</div>
            <div className="text-xs text-gray-400 mt-0.5">เลือก {teamSize} ทีมเพื่อเริ่มการแข่งขัน</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Team Size Selector */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {[4, 8, 16].map(size => (
              <button key={size} onClick={() => { setTeamSize(size); setSelected(new Set()) }}
                className={`flex-1 py-1.5 text-xs font-heading font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer
                  ${teamSize === size ? 'bg-white text-[#0A1318] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                {size} Teams
              </button>
            ))}
          </div>
        </div>

        {/* Counter bar */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: teamSize }).map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i < selected.size ? 'bg-[#FD5461] w-3' : 'bg-gray-200 w-1.5'}`} />
              ))}
            </div>
            <span className="text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 ml-1">
              {selected.size}/{teamSize}
            </span>
          </div>
        </div>

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
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">{isClub ? '🏟️' : '🌍'}</div>
              <div className="font-heading font-black text-base uppercase tracking-wide text-gray-300">{isClub ? 'ยังไม่มีสโมสร' : 'ยังไม่มีทีมชาติ'}</div>
              {isClub ? (
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs">ไปที่หน้า <strong>Clubs</strong> เพื่อสร้างสโมสรก่อน</p>
              ) : (
                <>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-xs">กด Import เพื่อสร้างทีมชาติทั้ง 211 ทีม จาก FIFA</p>
                  <button
                    onClick={async () => {
                      setSeeding(true)
                      try {
                        await seedNationalTeams()
                        const data = await fetchNationalTeams()
                        setTeams(data)
                      } finally { setSeeding(false) }
                    }}
                    disabled={seeding}
                    className="px-6 py-3 bg-[#0A1318] text-white rounded-xl font-heading font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-60">
                    {seeding ? 'กำลัง Import...' : '🌍 Import 211 ทีมชาติ'}
                  </button>
                </>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-300 font-heading font-bold uppercase tracking-widest text-xs">ไม่พบทีม</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(team => {
                const isSelected = selected.has(team.id)
                const isDisabled = !isSelected && selected.size >= teamSize
                const code = !isClub ? NATION_CODE[team.name] : null
                const flagSrc = !isClub ? flagUrl(code) : null
                const ovr  = isClub ? ovrMap[team.id] : ovrMap[team.name]

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
                    {/* Badge / Flag */}
                    {flagSrc ? (
                      <div className="w-10 h-7 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-200">
                        <img src={flagSrc} alt={team.name} className="w-full h-full object-cover" />
                      </div>
                    ) : team.badge_url ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0 ring-1 ring-gray-200">
                        <img src={team.badge_url} alt={team.name} className="w-full h-full object-contain p-1" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0"
                        style={{ backgroundColor: team.badge_color ?? '#0A1318' }}>
                        {team.short_name}
                      </div>
                    )}

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-medium text-sm text-[#0A1318] truncate">{team.name}</div>
                    </div>

                    {/* OVR */}
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
            disabled={selected.size !== teamSize || saving}
            className="w-full py-4 rounded-2xl font-heading font-black text-sm uppercase tracking-widest transition-all cursor-pointer
              disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed
              bg-[#FD5461] text-white hover:bg-red-500 disabled:hover:bg-gray-100">
            {saving ? 'กำลังสร้าง...' : remaining > 0 ? `เลือกอีก ${remaining} ทีม` : 'เริ่มต้นการแข่งขัน 🏆'}
          </button>
        </div>
      </div>
    </div>
  )
}
