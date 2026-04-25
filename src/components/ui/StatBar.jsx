import { getStatColor, STAT_MAX } from '../../utils/stats'

export default function StatBar({ label, value, dark = false }) {
  const color = getStatColor(value)
  const pct = Math.min(100, (value / STAT_MAX) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className={`w-8 text-xs font-heading font-bold tracking-wider uppercase ${dark ? 'text-white/30' : 'text-gray-400'}`}>
        {label}
      </span>
      <span className="w-8 text-sm font-heading font-bold" style={{ color }}>
        {value}
      </span>
      <div className={`flex-1 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
