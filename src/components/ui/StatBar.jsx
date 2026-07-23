import { getStatColor, STAT_MAX } from '../../utils/stats'

export default function StatBar({ label, value, dark = false, dense = false }) {
  const color = getStatColor(value)
  const pct = Math.min(100, (value / STAT_MAX) * 100)
  return (
    <div className={`flex items-center ${dense ? 'gap-1.5' : 'gap-2'}`}>
      <span className={`${dense ? 'w-7 text-[10px] font-semibold tracking-wide' : 'w-8 text-xs font-bold tracking-wider'} font-heading uppercase ${dark ? 'text-white/30' : 'text-gray-400'}`}>
        {label}
      </span>
      <span className={`${dense ? 'w-7 text-xs font-medium' : 'w-8 text-sm font-bold'} font-heading tabular-nums`} style={{ color }}>
        {value}
      </span>
      <div className={`flex-1 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <div
          className="h-full rounded-full ui-transition-normal transition-[width,background-color]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
