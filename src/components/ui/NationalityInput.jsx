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
  const inputRef = useRef()
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = FIFA_NATIONS.find((c) => c.name === value) ?? null

  const displayed = query.length < 1
    ? FIFA_NATIONS
    : FIFA_NATIONS.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  function handleSelect(nation) {
    onChange(nation.name)
    setQuery('')
    setOpen(false)
  }

  function handleOpen() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
        Nationality
      </label>
      <div className="relative">
        {/* Trigger */}
        {!open && (
          <button
            type="button"
            onClick={handleOpen}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-left hover:border-gray-300 transition-colors cursor-pointer"
          >
            {selected ? (
              <>
                <FlagImg code={selected.code} name={selected.name} />
                <span className="flex-1 text-gray-900">{selected.name}</span>
              </>
            ) : (
              <span className="flex-1 text-gray-400">Select nationality</span>
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
            placeholder="Search country..."
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-400 ring-2 ring-gray-900/20 bg-white text-sm focus:outline-none"
          />
        )}

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-56 overflow-y-auto py-1">
              {displayed.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 font-heading font-bold">No results</div>
              )}
              {displayed.map((c) => {
                const isSelected = c.name === value
                return (
                  <button
                    key={c.code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left
                      ${isSelected ? 'bg-gray-900' : 'hover:bg-gray-50'}`}
                  >
                    <FlagImg code={c.code} name={c.name} />
                    <span className={`flex-1 ${isSelected ? 'text-white font-medium' : 'text-gray-700'}`}>
                      {c.name}
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
          </div>
        )}
      </div>
    </div>
  )
}
