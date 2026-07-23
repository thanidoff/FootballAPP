import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function AnimatedTabs({ items, value, onChange, ariaLabel = 'Sections', className = '', itemClassName = '' }) {
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
  }, [value, items])

  return (
    <div ref={containerRef} role="tablist" aria-label={ariaLabel} className={`relative flex overflow-x-auto border-b border-gray-100 hide-scrollbar ${className}`}>
      {items.map(item => {
        const active = item.id === value
        const shared = {
          ref: node => node ? itemRefs.current.set(item.id, node) : itemRefs.current.delete(item.id),
          role: 'tab',
          'aria-selected': active,
          className: `relative z-10 flex min-h-11 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap px-4 pb-2 pt-1 text-sm ui-transition-normal transition-colors ${active ? 'font-semibold text-[#0A1318]' : 'font-normal text-gray-400 hover:text-gray-700'} ${itemClassName}`,
          children: item.label,
        }
        return item.to
          ? <Link key={item.id} to={item.to} {...shared} />
          : <button key={item.id} type="button" onClick={() => onChange?.(item.id)} {...shared} />
      })}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-[#FD5461] transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)`, opacity: indicator.ready ? 1 : 0 }} />
    </div>
  )
}
