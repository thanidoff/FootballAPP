import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchClubs, createClub, updateClub, deleteClub } from '../services/clubs'
import { formatCurrency } from '../utils/currency'
import { FIFA_NATIONS } from '../utils/fifaNations'

const NATION_CODE = Object.fromEntries(FIFA_NATIONS.map(n => [n.name, n.code]))
import ClubForm from '../components/clubs/ClubForm'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import PageWrapper from '../components/ui/PageWrapper'
import { SkeletonClubCard } from '../components/ui/SkeletonCard'

// UEFA, CONMEBOL, CONCACAF, AFC, CAF, OFC
const ZONE_MAP = {
  EUR: ['al','ad','am','at','az','by','be','ba','bg','hr','cy','cz','dk','ee','fi','fr','ge','de','gi','gr','hu','is','ie','il','it','xk','lv','li','lt','lu','mt','md','mc','me','nl','mk','no','pl','pt','ro','ru','sm','rs','sk','si','es','se','ch','tr','ua','gb','gb-eng','gb-sct','gb-wls','gb-nir'],
  AME: ['ar','bo','br','cl','co','ec','gy','py','pe','sr','uy','ve','ag','bs','bb','bz','ca','cr','cu','dm','do','sv','gd','gt','ht','hn','jm','mx','ni','pa','kn','lc','vc','tt','us'],
  ASI: ['af','bh','bd','bt','bn','kh','cn','tw','in','id','ir','iq','jo','kz','kw','kg','la','lb','my','mv','mn','mm','np','kp','om','pk','ps','ph','qa','sa','sg','kr','lk','sy','tj','th','tl','tm','ae','uz','vn','ye'],
  AFR: ['dz','ao','bj','bw','bf','bi','cm','cv','cf','td','km','cg','cd','ci','dj','eg','gq','er','sz','et','ga','gm','gh','gn','gw','ke','ls','lr','ly','mg','mw','ml','mr','mu','ma','mz','na','ne','ng','rw','st','sn','sl','so','za','ss','sd','tz','tg','tn','ug','zm','zw'],
  OCE: ['au','fj','ki','mh','fm','nr','nz','pw','pg','ws','sb','to','tv','vu'],
}

const ZONES = ['ALL', 'EUR', 'AME', 'ASI', 'AFR', 'OCE']
const ZONE_LABELS = { ALL: 'All', EUR: 'Europe', AME: 'Americas', ASI: 'Asia', AFR: 'Africa', OCE: 'Oceania' }

function getZone(code) {
  const c = code?.toLowerCase()
  for (const [zone, codes] of Object.entries(ZONE_MAP)) {
    if (codes.includes(c)) return zone
  }
  return null
}

function ClubBadge({ club, size = 'md' }) {
  const s = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm'
  if (club.is_national) {
    const h = size === 'lg' ? 'h-11' : 'h-7'
    const w = size === 'lg' ? 'w-[66px]' : 'w-[42px]'
    return (
      <div className={`${w} ${h} rounded-lg overflow-hidden shadow-md flex-shrink-0 bg-gray-100`}>
        <img
          src={`https://flagcdn.com/${NATION_CODE[club.name] ?? club.short_name.toLowerCase()}.svg`}
          alt={club.name}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }
  if (club.badge_url) {
    return (
      <div className={`${s} rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-white`}>
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-1" />
      </div>
    )
  }
  return (
    <div
      className={`${s} rounded-xl flex items-center justify-center font-heading font-black text-white shadow-md flex-shrink-0`}
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}
    >
      {club.short_name}
    </div>
  )
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState([])
  const [ovrMap, setOvrMap] = useState({}) // club_id → avg ovr
  const [sizeMap, setSizeMap] = useState({}) // club_id/nat → count
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'clubs'
  const setTab = (val) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('tab', val); return n }, { replace: true })
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState('ALL')
  const [ovrSort, setOvrSort] = useState('desc') // 'desc' | 'asc' | null
  const [nameSort, setNameSort] = useState('asc') // 'asc' | 'desc'
  const navigate = useNavigate()
  const toast = useToast()

  // restore scroll after data finishes loading
  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem('clubs-scroll')
    if (saved) {
      sessionStorage.removeItem('clubs-scroll')
      setTimeout(() => { window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' }) }, 50)
    }
  }, [loading])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [clubsData, { data: players }] = await Promise.all([
        fetchClubs(),
        supabase.from('players').select('club_id, nationality, ovr, roster_order, national_roster_order'),
      ])
      setClubs(clubsData)
      // club OVR: keyed by club_id (for regular clubs)
      // national OVR: keyed by nationality name (for national teams)
      const clubAcc = {}, natAcc = {}
      for (const p of players ?? []) {
        if (p.club_id) {
          if (!clubAcc[p.club_id]) clubAcc[p.club_id] = { plist: [], count: 0 }
          clubAcc[p.club_id].plist.push(p)
          clubAcc[p.club_id].count += 1
        }
        if (p.nationality) {
          if (!natAcc[p.nationality]) natAcc[p.nationality] = { plist: [], count: 0 }
          natAcc[p.nationality].plist.push(p)
          natAcc[p.nationality].count += 1
        }
      }
      const map = {}
      const sizes = {}

      const calcAvg = (plist, orderKey) => {
        plist.sort((a, b) => {
          const aHas = a[orderKey] != null;
          const bHas = b[orderKey] != null;
          if (aHas && bHas) return a[orderKey] - b[orderKey];
          if (aHas) return -1;
          if (bHas) return 1;
          return b.ovr - a.ovr;
        });
        const top5 = plist.slice(0, 5);
        if (top5.length === 0) return 0;
        return Math.round(top5.reduce((sum, p) => sum + p.ovr, 0) / 5);
      }

      for (const [id, { plist, count }] of Object.entries(clubAcc)) {
        map[id] = calcAvg(plist, 'roster_order')
        sizes[id] = count
      }
      for (const [nat, { plist, count }] of Object.entries(natAcc)) {
        map[`nat:${nat}`] = calcAvg(plist, 'national_roster_order')
        sizes[`nat:${nat}`] = count
      }
      setOvrMap(map)
      setSizeMap(sizes)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(form) {
    try {
      setSaving(true)
      const club = await createClub(form)
      setClubs((prev) => [...prev, club].sort((a, b) => a.name.localeCompare(b.name)))
      setModal(null)
      toast.success('Club created')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(form) {
    try {
      setSaving(true)
      const updated = await updateClub(modal.club.id, form)
      setClubs((prev) => prev.map((c) => c.id === updated.id ? updated : c))
      setModal(null)
      toast.success('Club updated')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this club? Players will become free agents.')) return
    try {
      await deleteClub(id)
      setClubs((prev) => prev.filter((c) => c.id !== id))
      setModal(null)
      toast.success('Club deleted')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const clubCount = clubs.filter((c) => !c.is_national).length
  const nationalCount = clubs.filter((c) => c.is_national).length

  function clubOvr(club) {
    return club.is_national ? ovrMap[`nat:${club.name}`] : ovrMap[club.id]
  }

  function clubSize(club) {
    return club.is_national ? (sizeMap[`nat:${club.name}`] || 0) : (sizeMap[club.id] || 0)
  }

  const filtered = clubs
    .filter((c) => {
      const matchTab = tab === 'national' ? c.is_national : !c.is_national
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.short_name.toLowerCase().includes(search.toLowerCase())
      const matchZone = tab !== 'national' || zone === 'ALL' || getZone(c.short_name) === zone
      return matchTab && matchSearch && matchZone
    })
    .sort((a, b) => {
      if (ovrSort === 'desc') return (clubOvr(b) ?? 0) - (clubOvr(a) ?? 0)
      if (ovrSort === 'asc') return (clubOvr(a) ?? 0) - (clubOvr(b) ?? 0)
      return nameSort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading font-black text-3xl uppercase tracking-wide">Clubs</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clubs.length} clubs registered</p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })}>+ New Club</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'clubs', label: `Clubs (${clubCount})` },
          { key: 'national', label: `National Teams (${nationalCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setZone('ALL'); setSearch(''); setOvrSort('desc'); setNameSort('asc'); }}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-heading font-bold uppercase tracking-wide border-b-2 -mb-px transition-colors text-center cursor-pointer
              ${tab === key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Row 1: search + OVR sort */}
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search club name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
          <button
            onClick={() => { setNameSort((s) => s === 'asc' ? 'desc' : 'asc'); setOvrSort(null) }}
            className={`px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors cursor-pointer whitespace-nowrap
              ${ovrSort === null ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            A–Z {nameSort === 'asc' ? '↓' : '↑'}
          </button>
          <button
            onClick={() => setOvrSort((s) => s === 'desc' ? 'asc' : 'desc')}
            className={`px-3 py-2 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors cursor-pointer whitespace-nowrap
              ${ovrSort !== null ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            OVR {ovrSort === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Zone filter (national only) */}
        {tab === 'national' && (
          <div className="flex flex-wrap gap-1.5">
            {ZONES.map((z) => (
              <button
                key={z}
                onClick={() => setZone(z)}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold tracking-widest uppercase transition-colors cursor-pointer
                  ${zone === z ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {z === 'ALL' ? 'All Zones' : z}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonClubCard key={i} />)}
        </div>
      )}
      {error && <div className="text-center py-20 text-red-400 text-sm">{error}</div>}

      {!loading && !error && (
        <>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-24 gap-3">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-gray-200">
                <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2.5"/>
                <path d="M16 24h16M24 16v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.4"/>
              </svg>
              <p className="text-gray-400 font-heading font-bold uppercase tracking-wider text-sm">No clubs found</p>
              <p className="text-gray-300 text-xs">Try adjusting your filters</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((club, i) => (
              <div
                key={club.id}
                onClick={() => { sessionStorage.setItem('clubs-scroll', window.scrollY); navigate(`/clubs/${club.id}`) }}
                className="animate-fadeSlideUp bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-gray-200 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <ClubBadge club={club} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-black text-xl uppercase tracking-wide leading-tight truncate">
                      {club.name}
                    </h3>
                    <p className="text-gray-400 text-xs font-heading font-bold tracking-widest mt-0.5">
                      {club.short_name}
                      {tab === 'national' && getZone(club.short_name) && (
                        <span className="ml-2 text-gray-300">· {getZone(club.short_name)}</span>
                      )}
                      <span className="ml-2 text-gray-300">· {clubSize(club)} PLAYERS</span>
                    </p>
                  </div>
                  {(club.is_national || clubOvr(club) != null) && (
                    <div className="flex-shrink-0 text-right">
                      {clubOvr(club) != null
                        ? <div className="font-heading font-black text-2xl text-gray-900 leading-none">{clubOvr(club)}</div>
                        : <div className="font-heading font-black text-2xl text-gray-200 leading-none">—</div>
                      }
                    </div>
                  )}
                </div>

                {!club.is_national && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
                        Budget
                      </span>
                      <span className="font-heading font-black text-lg text-gray-900">
                        ${formatCurrency(club.budget)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FD5461] transition-all"
                        style={{ width: `${Math.min(100, (club.budget / 50_000_000) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="light"
                    size="sm"
                    className="flex-1 justify-center"
                    onClick={() => { sessionStorage.setItem('clubs-scroll', window.scrollY); navigate(`/clubs/${club.id}`) }}
                  >
                    View Roster
                  </Button>
                  {!club.is_national && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModal({ mode: 'edit', club })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(club.id)}
                      >
                        Del
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="New Club">
        <ClubForm onSubmit={handleCreate} loading={saving} />
      </Modal>

      <Modal open={modal?.mode === 'edit'} onClose={() => setModal(null)} title="Edit Club">
        {modal?.club && (
          <ClubForm
            initialValues={{
              name: modal.club.name,
              short_name: modal.club.short_name,
              badge_color: modal.club.badge_color,
              budget: modal.club.budget,
              is_national: modal.club.is_national,
              badge: modal.club.badge_url ? { preview: modal.club.badge_url } : null,
            }}
            onSubmit={handleEdit}
            loading={saving}
          />
        )}
      </Modal>
    </PageWrapper>
  )
}
