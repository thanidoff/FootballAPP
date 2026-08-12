export default function SegmentedControl({ items, value, onChange, ariaLabel = 'View options', className = '', itemClassName = '', compactOnMobile = false }) {
  const activeIndex = Math.max(0, items.findIndex(item => item.id === value))
  const itemCount = Math.max(1, items.length)
  const gapPixels = 4
  const horizontalPadding = 8

  return (
    <div role="tablist" aria-label={ariaLabel} className={`relative grid gap-1 rounded-xl bg-slate-100 p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${itemCount}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg bg-[#FD5461] shadow-sm shadow-[#FD5461]/20 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `calc((100% - ${horizontalPadding + (itemCount - 1) * gapPixels}px) / ${itemCount})`, transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * gapPixels}px))` }} />
      {items.map(item => {
        const Icon = item.icon
        const active = item.id === value
        return <button key={item.id} type="button" role="tab" aria-label={compactOnMobile ? item.label : undefined} title={compactOnMobile ? item.label : undefined} aria-selected={active} onClick={() => onChange?.(item.id)} disabled={item.disabled} className={`relative z-10 flex min-h-10 min-w-0 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 ${active ? 'font-semibold text-white' : 'font-medium text-slate-500 hover:text-slate-900'} ${itemClassName}`}>
          {Icon && <Icon size={16} strokeWidth={2} className="shrink-0" />}
          <span className={compactOnMobile ? 'sr-only sm:not-sr-only' : ''}>{item.label}</span>
        </button>
      })}
    </div>
  )
}
