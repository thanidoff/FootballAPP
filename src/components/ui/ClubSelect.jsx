import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import FreeAgentIcon from './FreeAgentIcon'

function ClubBadge({ club }) {
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
  const [query, setQuery] = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef()
  const triggerRef = useRef()
  const ref = useRef()
  const portalRef = useRef()

  const selectedClub = clubs.find((c) => c.id === value) ?? null

  useEffect(() => {
    function handleClick(e) {
      const inTrigger = ref.current?.contains(e.target)
      const inPortal = portalRef.current?.contains(e.target)
      if (!inTrigger && !inPortal) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayed = query.length < 1
    ? clubs
    : clubs.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  function handleSelect(val) {
    onChange(val)
    setQuery('')
    setOpen(false)
  }

  function handleOpen() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && (
        <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
          {label}
        </label>
      )}
      <div className="relative">
        {/* Trigger */}
        {!open && (
          <button
            ref={triggerRef}
            type="button"
            onClick={handleOpen}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-white text-sm text-left hover:border-gray-300 transition-colors cursor-pointer
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
        {open && (
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search club..."
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-400 ring-2 ring-gray-900/20 bg-white text-sm focus:outline-none"
          />
        )}

        {/* Dropdown via portal — escapes modal overflow */}
        {open && createPortal(
          <div
            ref={portalRef}
            style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
            className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
          >
            <div
              className="max-h-56 overflow-y-auto py-1"
              onWheel={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
            >
              {/* Free Agent option */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect('')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left
                  ${!value ? 'bg-gray-900' : 'hover:bg-gray-50'}`}
              >
                <FreeAgentIcon light={!value} />
                <span className={`flex-1 ${!value ? 'text-white font-medium' : 'text-gray-700'}`}>
                  Free Agent
                </span>
                {!value && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                    <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              {clubs.length > 0 && <div className="border-t border-gray-100 my-1" />}

              {displayed.length === 0 && query.length > 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 font-heading font-bold">No results</div>
              )}

              {displayed.map((club) => {
                const isSelected = club.id === value
                return (
                  <button
                    key={club.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(club.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left
                      ${isSelected ? 'bg-gray-900' : 'hover:bg-gray-50'}`}
                  >
                    <ClubBadge club={club} />
                    <span className={`flex-1 truncate ${isSelected ? 'text-white font-medium' : 'text-gray-700'}`}>
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
