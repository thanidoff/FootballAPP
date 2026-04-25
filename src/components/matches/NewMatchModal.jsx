import { useState, useEffect } from 'react'
import { fetchClubs } from '../../services/clubs'
import { fetchPlayers } from '../../services/players'
import { createMatch } from '../../services/friendlyMatches'

const DURATIONS = [5, 10, 20, 30]

function ClubBadge({ club, size = 'md' }) {
  const s = size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm'
  if (club.badge_url) {
    return (
      <div className={`${s} rounded-xl overflow-hidden bg-white flex-shrink-0`}>
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-1" />
      </div>
    )
  }
  return (
    <div className={`${s} rounded-xl flex items-center justify-center font-heading font-black text-white flex-shrink-0`}
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}>
      {club.short_name}
    </div>
  )
}

function StepDot({ label, index, step }) {
  const done = index < step
  const active = index === step
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-heading font-black transition-colors
        ${done ? 'bg-[#0A1318] text-white' : active ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-400'}`}>
        {done ? '✓' : index + 1}
      </div>
      <span className={`text-xs font-heading font-bold uppercase tracking-wide hidden sm:block
        ${active ? 'text-[#FD5461]' : done ? 'text-[#0A1318]' : 'text-gray-300'}`}>
        {label}
      </span>
    </div>
  )
}

function ClubTypeTabs({ tab, onChange }) {
  return (
    <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
      {[['club', 'Club'], ['national', 'National Team']].map(([value, label]) => (
        <button key={value} onClick={() => onChange(value)}
          className={`flex-1 py-1.5 rounded-lg font-heading font-black text-xs uppercase tracking-widest transition-colors cursor-pointer
            ${tab === value ? 'bg-white text-[#0A1318] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function NewMatchModal({ open, onClose, seasonId, onCreated }) {
  const [step, setStep] = useState(0)
  const [clubs, setClubs] = useState([])
  const [clubStats, setClubStats] = useState({})
  const [homeClub, setHomeClub] = useState(null)
  const [awayClub, setAwayClub] = useState(null)
  const [duration, setDuration] = useState(10)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('club')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setStep(0); setHomeClub(null); setAwayClub(null); setDuration(10); setSearch(''); setError(null)
    setTab('club')
    if (clubs.length > 0) return
    setLoading(true)
    Promise.all([fetchClubs(), fetchPlayers()])
      .then(([clubsData, playersData]) => {
        setClubs(clubsData)
        const stats = {}
        clubsData.forEach(c => {
          const squad = playersData.filter(p => p.club_id === c.id)
          stats[c.id] = {
            count: squad.length,
            avgOvr: squad.length ? Math.round(squad.reduce((s, p) => s + p.ovr, 0) / squad.length) : 0,
          }
        })
        setClubStats(stats)
      })
      .finally(() => setLoading(false))
  }, [open])

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const match = await createMatch({
        seasonId,
        homeClubId: homeClub.id,
        awayClubId: awayClub.id,
        duration,
      })
      onCreated(match)
      onClose()
    } catch (err) {
      setError('Failed to create match. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isNationalTab = tab === 'national'
  const filtered = clubs
    .filter(c => !!c.is_national === isNationalTab)
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  if (!open) return null

  const STEPS = ['Home Team', 'Away Team', 'Kick Off']

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <div className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318]">
              {STEPS[step] === 'Home Team' ? 'Select Home Team' : STEPS[step] === 'Away Team' ? 'Select Away Team' : 'Kick Off'}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl font-bold cursor-pointer transition-colors">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <StepDot label={label} index={i} step={step} />
              {i < STEPS.length - 1 && (
                <div className="relative h-px w-6 sm:w-10 bg-gray-200 overflow-hidden rounded-full">
                  <div className={`absolute inset-y-0 left-0 bg-[#0A1318] transition-all duration-500 ease-out ${i < step ? 'w-full' : 'w-0'}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 px-4 py-2.5 bg-red-50 rounded-xl text-xs text-red-600 font-heading font-bold">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-10 text-gray-400 font-heading font-bold uppercase tracking-wider text-xs">
              Loading clubs...
            </div>
          )}

          {/* Step 0: Home Team */}
          {!loading && step === 0 && (
            <div className="space-y-3">
              <ClubTypeTabs tab={tab} onChange={t => { setTab(t); setSearch('') }} />
              <input
                type="search" placeholder="Search club..." value={search} autoFocus
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border-0 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-gray-300"
              />
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filtered.map(club => (
                  <button key={club.id} onClick={() => setHomeClub(club)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer
                      ${homeClub?.id === club.id ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <ClubBadge club={club} />
                    <div className="flex-1 min-w-0">
                      <div className="font-heading font-black text-sm uppercase tracking-wider text-[#0A1318] truncate">{club.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{clubStats[club.id]?.count ?? 0} players</div>
                    </div>
                    <div className={`font-heading font-black text-2xl tabular-nums transition-colors ${homeClub?.id === club.id ? 'text-[#FD5461]' : 'text-gray-200'}`}>
                      {clubStats[club.id]?.avgOvr || '—'}
                    </div>
                  </button>
                ))}
              </div>
              <button
                disabled={!homeClub}
                onClick={() => { setStep(1); setSearch(''); setTab('club') }}
                className="w-full py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest transition-colors cursor-pointer
                  disabled:opacity-40 disabled:cursor-not-allowed bg-[#0A1318] text-white hover:bg-gray-800">
                Next — Select Away Team
              </button>
            </div>
          )}

          {/* Step 1: Away Team */}
          {!loading && step === 1 && (
            <div className="space-y-3">
              <ClubTypeTabs tab={tab} onChange={t => { setTab(t); setSearch('') }} />
              <input
                type="search" placeholder="Search club..." value={search} autoFocus
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border-0 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-gray-300"
              />
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filtered.map(club => {
                  const isHome = club.id === homeClub?.id
                  return (
                    <button key={club.id} onClick={() => !isHome && setAwayClub(club)}
                      disabled={isHome}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                        ${isHome ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
                        ${awayClub?.id === club.id ? 'bg-red-50 ring-1 ring-red-100' : !isHome ? 'hover:bg-gray-50' : ''}`}>
                      <ClubBadge club={club} />
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-black text-sm uppercase tracking-wider text-[#0A1318] truncate">{club.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{clubStats[club.id]?.count ?? 0} players</div>
                      </div>
                      <div className={`font-heading font-black text-2xl tabular-nums ${awayClub?.id === club.id ? 'text-[#FD5461]' : 'text-gray-200'}`}>
                        {clubStats[club.id]?.avgOvr || '—'}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setStep(0); setSearch('') }}
                  className="px-5 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
                  Back
                </button>
                <button
                  disabled={!awayClub}
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest transition-colors cursor-pointer
                    disabled:opacity-40 disabled:cursor-not-allowed bg-[#0A1318] text-white hover:bg-gray-800">
                  Next — Kick Off
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Kick Off */}
          {step === 2 && homeClub && awayClub && (
            <div className="space-y-5">
              {/* VS Banner */}
              <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-6 py-4">
                <div className="flex flex-col items-center gap-2">
                  <ClubBadge club={homeClub} size="lg" />
                  <span className="font-heading font-black text-[#0A1318] text-xs uppercase tracking-wide">{homeClub.short_name}</span>
                </div>
                <div className="font-heading font-black text-3xl text-gray-200 tracking-widest">VS</div>
                <div className="flex flex-col items-center gap-2">
                  <ClubBadge club={awayClub} size="lg" />
                  <span className="font-heading font-black text-[#0A1318] text-xs uppercase tracking-wide">{awayClub.short_name}</span>
                </div>
              </div>

              {/* Duration */}
              <div>
                <div className="text-xs font-heading font-black uppercase tracking-widest text-gray-400 mb-3">Match Duration</div>
                <div className="flex gap-2">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`flex-1 py-3 rounded-xl font-heading font-black text-lg tracking-wide transition-colors cursor-pointer
                        ${duration === d ? 'bg-[#FD5461] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {d}'
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep(1)}
                  className="px-5 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl font-heading font-black text-sm uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-60">
                  {saving ? 'Creating...' : 'Create Match'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
