export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return '0'
  const absVal = Math.abs(value)
  const isNegative = value < 0
  const prefix = isNegative ? '-' : ''
  if (absVal >= 1_000_000) return `${prefix}${(absVal / 1_000_000).toFixed(1)}M`
  if (absVal >= 1_000) return `${prefix}${(absVal / 1_000).toFixed(0)}K`
  return `${value}`
}

export function parseCurrency(str) {
  const cleaned = str.replace(/[^0-9.]/g, '')
  return parseFloat(cleaned) || 0
}
