const STYLES = {
  GK:  'text-amber-500',
  DEF: 'text-blue-500',
  MF:  'text-green-500',
  FWD: 'text-[#FD5461]',
}

const LABELS = {
  GK: 'GK',
  DEF: 'DF',
  MF:  'MF',
  FWD: 'FW',
}

export default function PositionBadge({ position, size = 'sm' }) {
  const base = size === 'lg' ? 'text-sm' : 'text-xs'
  return (
    <span className={`font-heading font-bold tracking-widest uppercase ${base} ${STYLES[position] ?? 'text-gray-400'}`}>
      {LABELS[position] ?? position}
    </span>
  )
}
