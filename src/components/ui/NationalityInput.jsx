import { useState, useRef, useEffect } from 'react'
import { FIFA_NATIONS } from '../../utils/fifaNations'

function FlagImg({ code, name, className = 'w-6 h-4' }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={name}
      className={`${className} object-cover rounded-sm flex-shrink-0`}
    />
  )
}

export default function NationalityInput({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef()
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      setRendered(true)
      setClosing(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (rendered) {
      setClosing(true)
      const timer = setTimeout(() => {
        setRendered(false)
        setClosing(false)
        setQuery('')
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  const selected = FIFA_NATIONS.find((c) => c.name === value) ?? null

  const displayed = query.length < 1
    ? FIFA_NATIONS
    : FIFA_NATIONS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  function handleSelect(nation) {
    onChange(nation.name)
    handleClose()
  }

  function handleOpen() {
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="type-label text-gray-600">
        Nationality
      </label>
      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => (open ? handleClose() : handleOpen())}
          className={`min-h-11 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-white text-sm text-left transition-colors cursor-pointer ${
            open ? 'border-[#FD5461] ring-2 ring-[#FD5461]/15' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          {selected ? (
            <>
              <FlagImg code={selected.code} name={selected.name} />
              <span className="flex-1 text-gray-900">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 text-gray-400">Select nationality</span>
          )}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Dropdown Menu */}
        {rendered && (
          <div className={`absolute left-0 z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ${closing ? 'ui-dropdown-exit' : 'ui-dropdown-enter'}`}>
            <div className="p-2 border-b border-gray-100 bg-gray-50/50">
              <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder="Search country..."
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:border-[#FD5461] focus:ring-2 focus:ring-[#FD5461]/15 transition-all"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {displayed.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-400 font-medium text-center">No results found</div>
              )}
              {displayed.map((c) => {
                const isSelected = c.name === value
                return (
                  <button
                    key={c.code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(c)}
                    disabled={closing}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left
                      ${isSelected ? 'bg-[#FD5461] text-white font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <FlagImg code={c.code} name={c.name} />
                    <span className="flex-1">{c.name}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                        <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
