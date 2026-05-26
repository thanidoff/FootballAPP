import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { resetFriendlyData, resetWorldCupData, resetLeagueData, resetAllMatchData, releaseAllPlayers } from '../../services/admin'

const NAV_ITEMS = [
  { to: '/players', label: 'Players' },
  { to: '/clubs', label: 'Clubs' },
  { to: '/matches', label: 'Matches' },
]

const RESET_ITEMS = [
  { key: 'friendly',  label: 'Friendly',  fn: resetFriendlyData },
  { key: 'worldcup',  label: 'World Cup / Club Cup', fn: resetWorldCupData },
  { key: 'league',    label: 'League',    fn: resetLeagueData },
  { key: 'all',       label: 'All Matches', fn: resetAllMatchData },
]

function ResetRow({ label, onDone }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try { await onDone() } finally { setLoading(false); setConfirm(false) }
  }

  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
      <span className="flex-1 font-heading font-bold text-xs uppercase tracking-wide text-[#0A1318]">{label}</span>
      {!confirm ? (
        <button onClick={() => setConfirm(true)}
          className="px-3 py-1.5 rounded-lg font-heading font-black text-[10px] uppercase tracking-widest bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-[#FD5461] transition-colors cursor-pointer">
          Reset
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-heading font-black text-[#FD5461] uppercase">ยืนยัน?</span>
          <button onClick={() => setConfirm(false)}
            className="px-2.5 py-1.5 rounded-lg font-heading font-black text-[10px] uppercase tracking-widest bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer">
            No
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="px-2.5 py-1.5 rounded-lg font-heading font-black text-[10px] uppercase tracking-widest bg-[#FD5461] text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-60">
            {loading ? '...' : 'Yes'}
          </button>
        </div>
      )}
    </div>
  )
}

function AdminDrawer({ open, onClose }) {
  const [releaseConfirm, setReleaseConfirm] = useState(false)
  const [loadingRelease, setLoadingRelease] = useState(false)

  function handleClose() {
    setReleaseConfirm(false)
    onClose()
  }

  async function handleRelease() {
    setLoadingRelease(true)
    try { await releaseAllPlayers() } finally { setLoadingRelease(false); setReleaseConfirm(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white w-full max-w-xs h-full shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.25s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="font-heading font-black text-base uppercase tracking-wide text-[#0A1318]">Admin</span>
          </div>
          <button onClick={handleClose} className="text-gray-300 hover:text-gray-500 text-lg font-bold cursor-pointer transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Reset by type */}
          <div className="bg-gray-50 rounded-2xl px-4 py-2">
            <div className="font-heading font-black text-[10px] uppercase tracking-widest text-gray-400 pt-2 pb-1">Reset Match Data</div>
            {RESET_ITEMS.map(item => (
              <ResetRow key={item.key} label={item.label} onDone={item.fn} />
            ))}
          </div>

          {/* Release players */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <div>
              <div className="font-heading font-black text-sm uppercase tracking-wide text-[#0A1318]">Release All Players</div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">ปล่อยนักเตะทุกคนเป็น Free Agent</p>
            </div>
            {!releaseConfirm ? (
              <button onClick={() => setReleaseConfirm(true)}
                className="w-full py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-widest bg-[#0A1318] text-white hover:bg-gray-800 transition-colors cursor-pointer">
                Release All
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-heading font-black text-[#0A1318] uppercase tracking-wide text-center">ยืนยัน?</p>
                <div className="flex gap-2">
                  <button onClick={() => setReleaseConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-widest bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={handleRelease} disabled={loadingRelease}
                    className="flex-1 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-widest bg-[#0A1318] text-white hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-60">
                    {loadingRelease ? 'Releasing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const menuRef = useRef(null)
  const location = useLocation()

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="min-h-screen bg-[#FEFEFE]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-[#FD5461] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="white" strokeWidth="1.5"/>
                <path d="M8 1.5c0 0 1.5 2.5 0 6.5s0 6.5 0 6.5M1.5 8h13M3 3.5c0 0 2.5 1.5 5 1.5s5-1.5 5-1.5M3 12.5c0 0 2.5-1.5 5-1.5s5 1.5 5 1.5" stroke="white" strokeWidth="1"/>
              </svg>
            </div>
            <span className="font-heading font-black text-lg uppercase tracking-wide text-[#0A1318] leading-tight">
              Football<br className="sm:hidden" /> Manager
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-lg text-sm font-heading font-bold uppercase tracking-wide transition-colors
                  ${isActive ? 'bg-[#FD5461] text-white' : 'text-gray-500 hover:text-[#0A1318] hover:bg-gray-100'}`
                }
              >
                {label}
              </NavLink>
            ))}
            <button onClick={() => setAdminOpen(true)}
              className="w-8 h-8 ml-1 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Admin">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </nav>

          {/* Mobile hamburger */}
          <div className="sm:hidden relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className={`block w-5 h-0.5 bg-[#0A1318] rounded-full transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#0A1318] rounded-full transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#0A1318] rounded-full transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-11 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                style={{ animation: 'dropDown 0.2s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>
                {NAV_ITEMS.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `block px-4 py-3 text-sm font-heading font-bold uppercase tracking-wide transition-colors
                      ${isActive ? 'text-[#FD5461] bg-red-50' : 'text-[#0A1318] hover:bg-gray-50'}`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
                <button onClick={() => { setMenuOpen(false); setAdminOpen(true) }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-heading font-bold uppercase tracking-wide text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer border-t border-gray-100">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Admin
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <AdminDrawer open={adminOpen} onClose={() => setAdminOpen(false)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      <style>{`
        @keyframes dropDown {
          0%   { transform: translateY(-8px) scale(0.95); opacity: 0; }
          100% { transform: translateY(0)    scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
