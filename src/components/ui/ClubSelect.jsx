import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import FreeAgentIcon from './FreeAgentIcon'

function ClubBadge({ club, isSelected }) {
  if (club.id === 'free_agent' || club.club_id === 'free_agent' || club.short_name === 'FA') {
    return <FreeAgentIcon light={isSelected} size={20} className="flex-shrink-0" />
  }

  if (club.badge_url) {
    return (
      <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 shadow-sm bg-white">
        <img src={club.badge_url} alt={club.name} className="w-full h-full object-contain p-0.5" />
      </div>
    )
  }
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center font-heading font-black text-white text-xs flex-shrink-0 shadow-sm"
      style={{ backgroundColor: club.badge_color ?? "#6b7280" }}
    >
      {club.short_name?.slice(0, 2)}
    </div>
  )
}

export default function ClubSelect({ label, value, onChange, clubs = [], error }) {
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [closing, setClosing] = useState(false)
  const [query, setQuery] = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef()
  const triggerRef = useRef()
  const ref = useRef()
  const portalRef = useRef()

  const selectedClub = clubs.find((c) => c.id === value) ?? null

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setDropPos({ top: rect.bottom + 6, left: rect.left, width: rect.width })
  }

  useLayoutEffect(() => {
    if (open) {
      updatePosition()
      setRendered(true)
      setClosing(false)
      const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
      return () => cancelAnimationFrame(frame)
    }
    if (!rendered) return
    setClosing(true)
    const timer = window.setTimeout(() => {
      setRendered(false)
      setClosing(false)
      setQuery('')
    }, 180)
    return () => window.clearTimeout(timer)
  }, [open, rendered])

  useEffect(() => {
    function handleClick(e) {
      const inTrigger = ref.current?.contains(e.target)
      const inPortal = portalRef.current?.contains(e.target)
      if (!inTrigger && !inPortal) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    const reposition = () => updatePosition()
    const containScroll = event => {
      if (!portalRef.current?.contains(event.target)) event.preventDefault()
    }
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    document.addEventListener('wheel', containScroll, { passive: false, capture: true })
    document.addEventListener('touchmove', containScroll, { passive: false, capture: true })
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      document.removeEventListener('wheel', containScroll, { capture: true })
      document.removeEventListener('touchmove', containScroll, { capture: true })
    }
  }, [open])

  const displayed = query.length < 1
    ? clubs
    : clubs.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  function handleSelect(val) {
    onChange(val)
    setOpen(false)
  }

  function handleOpen() {
    setOpen(true)
  }

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && (
        <label className="type-label text-gray-600">
          {label}
        </label>
      )}
      <div className="relative">
        {/* Trigger */}
        {!rendered && (
          <button
            ref={triggerRef}
            type="button"
            onClick={handleOpen}
            className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left text-sm transition-[border-color,box-shadow] duration-200 hover:border-gray-300
              ${error ? 'border-red-400' : 'border-gray-200'}`}
          >
            {selectedClub ? (
              <>
                <ClubBadge club={selectedClub} />
                <span className="flex-1 text-gray-900">{selectedClub.name}</span>
              </>
            ) : (
              <>
                <FreeAgentIcon />
                <span className="flex-1 text-gray-400">Free Agent</span>
              </>
            )}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-400 flex-shrink-0">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {/* Search input */}
        {rendered && (
          <div ref={triggerRef} className={`flex min-h-11 w-full items-center rounded-xl border bg-white px-3 transition-[border-color,box-shadow] duration-200 ${closing ? 'border-gray-200' : 'border-[#FD5461] ring-2 ring-[#FD5461]/15'}`}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              disabled={closing}
              placeholder="Search club..."
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}
              className="ui-inner-input h-10 w-full border-0 bg-transparent text-sm outline-none"
            />
          </div>
        )}

        {/* Dropdown via portal — escapes modal overflow */}
        {rendered && createPortal(
          <div
            ref={portalRef}
            style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
            className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl will-change-[transform,opacity,clip-path] ${closing ? 'ui-dropdown-exit' : 'ui-dropdown-enter'}`}
          >
            <div
              className="max-h-56 overscroll-contain overflow-y-auto py-1"
              onWheel={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
            >
              {displayed.length === 0 && query.length > 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 font-heading font-bold">No results</div>
              )}

              {displayed.map((club) => {
                const isSelected = club.id === value
                const isDisabled = Boolean(club.disabled)
                return (
                  <button
                    key={club.id}
                    type="button"
                    disabled={closing || isDisabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => !isDisabled && handleSelect(club.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left
                      ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50/50' : isSelected ? 'bg-gray-900' : 'hover:bg-gray-50'}`}
                  >
                    <ClubBadge club={club} isSelected={isSelected} />
                    <span className={`flex-1 truncate ${isSelected ? 'text-white font-medium' : isDisabled ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-700'}`}>
                      {club.name}
                    </span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                        <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
