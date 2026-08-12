import { useLayoutEffect, useRef, useState } from 'react'

export default function SegmentedControl({ items, value, onChange, ariaLabel = 'View options', className = '', itemClassName = '', compactOnMobile = false }) {
  const containerRef = useRef(null)
  const itemRefs = useRef(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  useLayoutEffect(() => {
    const container = containerRef.current
    const active = itemRefs.current.get(value)
    if (!container || !active) return undefined
    const update = () => setIndicator({ left: active.offsetLeft, width: active.offsetWidth, ready: true })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(active)
    return () => observer.disconnect()
  }, [items, value])

  return (
    <div ref={containerRef} role="tablist" aria-label={ariaLabel} className={`relative grid gap-1 rounded-xl bg-slate-100 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-1 top-1 rounded-lg bg-[#FD5461] shadow-sm shadow-[#FD5461]/20 transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)`, opacity: indicator.ready ? 1 : 0 }} />
      {items.map(item => {
        const Icon = item.icon
        const active = item.id === value
        return <button key={item.id} ref={node => node ? itemRefs.current.set(item.id, node) : itemRefs.current.delete(item.id)} type="button" role="tab" aria-label={compactOnMobile ? item.label : undefined} title={compactOnMobile ? item.label : undefined} aria-selected={active} onClick={() => onChange?.(item.id)} disabled={item.disabled} className={`relative z-10 flex min-h-10 min-w-0 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 ${active ? 'font-semibold text-white' : 'font-medium text-slate-500 hover:text-slate-900'} ${itemClassName}`}>
          {Icon && <Icon size={16} strokeWidth={2} className="shrink-0" />}
          <span className={compactOnMobile ? 'sr-only sm:not-sr-only' : ''}>{item.label}</span>
        </button>
      })}
    </div>
  )
}
