import { getOVRTier } from '../../utils/stats'

const TIER_STYLES = {
  special: 'bg-[#FD5461] text-white',
  gold: 'bg-[#0A1318] text-white',
  silver: 'bg-gray-600 text-white',
  bronze: 'bg-gray-400 text-white',
}

const SIZE_STYLES = {
  sm: 'h-9 min-w-9 rounded-lg px-2 text-sm',
  md: 'h-10 min-w-10 rounded-lg px-2 text-base',
  lg: 'h-14 min-w-16 rounded-xl px-3 text-xl',
}

export default function OvrBadge({ value, size = 'md', label }) {
  const numericValue = Number(value) || 0
  return <span className={`inline-flex shrink-0 flex-col items-center justify-center font-semibold leading-none ${TIER_STYLES[getOVRTier(numericValue)]} ${SIZE_STYLES[size] || SIZE_STYLES.md}`}>
    {label && <span className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-75">{label}</span>}
    <span className="tabular-nums">{numericValue || '-'}</span>
  </span>
}
