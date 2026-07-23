function scoreTone(side, winner) {
  if (!winner) return 'bg-gray-200 text-gray-700'
  return side === winner
    ? 'bg-[#FD5461] text-white shadow-sm shadow-red-200/70'
    : 'bg-[#34414A] text-white'
}

export function ScoreChip({ value, side, winner, compact = false }) {
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-lg font-semibold tabular-nums transition-colors ${compact ? 'h-7 min-w-7 px-1.5 text-sm' : 'h-8 min-w-8 px-2 text-base'} ${scoreTone(side, winner)}`}>{value}</span>
}

export default function ResultScore({ homeScore, awayScore, winner, compact = false, className = '' }) {
  const resolvedWinner = winner || (homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : null)
  return <span className={`inline-flex items-center justify-center gap-1.5 ${className}`} aria-label={`${homeScore} to ${awayScore}`}><ScoreChip value={homeScore} side="home" winner={resolvedWinner} compact={compact} /><span className="text-sm font-medium text-gray-400">–</span><ScoreChip value={awayScore} side="away" winner={resolvedWinner} compact={compact} /></span>
}
