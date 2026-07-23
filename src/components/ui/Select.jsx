import { useState, useRef, useEffect, useId, useLayoutEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'

// Native select fallback for form compatibility — hidden, kept in sync
export default function Select({ label, error, children, className = '', value, onChange, reserveErrorSpace = true, ...props }) {
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [closing, setClosing] = useState(false)
  const ref = useRef()
  const listboxId = useId()

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

  useLayoutEffect(() => {
    if (open) {
      setRendered(true)
      setClosing(false)
      return
    }
    if (!rendered) return
    setClosing(true)
    const timer = window.setTimeout(() => {
      setRendered(false)
      setClosing(false)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [open, rendered])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  function handleSelect(val) {
    onChange?.({ target: { value: val } })
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && (
        <label className="type-label text-gray-600">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          className={`
            w-full flex items-center justify-between gap-2
            min-h-11 px-3 py-2 rounded-xl border bg-white text-gray-900 type-body text-left
            ui-transition-fast transition-[border-color,box-shadow,background-color] cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD5461]/15
            ${open ? 'border-[#FD5461] ring-2 ring-[#FD5461]/15' : 'border-gray-200 hover:border-gray-300'}
            ${error ? 'border-red-400' : ''}
            ${className}
          `}
        >
          <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
            {selected ? selected.label : 'Select...'}
          </span>
          <ChevronDown size={16} strokeWidth={2} className={`shrink-0 text-gray-400 ui-transition-normal transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {rendered && (
          <div id={listboxId} role="listbox" className={`absolute right-0 z-50 mt-1 w-full min-w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ${closing ? 'ui-dropdown-exit' : 'ui-dropdown-enter'}`}>
            <div className="max-h-56 overflow-y-auto py-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  disabled={closing}
                  role="option"
                  aria-selected={String(opt.value) === String(value ?? '')}
                  className={`
                    flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left type-body ui-transition-fast transition-colors
                    ${String(opt.value) === String(value ?? '')
                      ? 'bg-[#FD5461] text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  <span>{opt.label}</span>{String(opt.value) === String(value ?? '') && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {(reserveErrorSpace || error) && <div className="min-h-4">{error && <p className="animate-fadeIn type-body-sm text-red-500">{error}</p>}</div>}
    </div>
  )
}
