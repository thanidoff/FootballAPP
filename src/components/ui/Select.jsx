import { useState, useRef, useEffect } from 'react'

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-400 flex-shrink-0">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Native select fallback for form compatibility — hidden, kept in sync
export default function Select({ label, error, children, className = '', value, onChange, ...props }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  // Parse options from children
  const options = []
  const parseChildren = (nodes) => {
    if (!nodes) return
    const arr = Array.isArray(nodes) ? nodes : [nodes]
    arr.forEach((child) => {
      if (!child) return
      if (child.type === 'option') {
        options.push({ value: child.props.value ?? '', label: child.props.children })
      }
    })
  }
  parseChildren(children)

  const selected = options.find((o) => String(o.value) === String(value ?? ''))

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(val) {
    onChange?.({ target: { value: val } })
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && (
        <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`
            w-full flex items-center justify-between gap-2
            px-3 py-2 rounded-lg border bg-white text-gray-900 text-sm text-left
            transition-colors cursor-pointer
            ${open ? 'border-gray-400 ring-2 ring-gray-900/20' : 'border-gray-200 hover:border-gray-300'}
            ${error ? 'border-red-400' : ''}
            ${className}
          `}
        >
          <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
            {selected ? selected.label : 'Select...'}
          </span>
          <Chevron />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="max-h-56 overflow-y-auto py-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`
                    w-full text-left px-3 py-2 text-sm transition-colors
                    ${String(opt.value) === String(value ?? '')
                      ? 'bg-gray-900 text-white font-heading font-bold'
                      : 'text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
