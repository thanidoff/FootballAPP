export function formatCurrency(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return `${value}`
}

export function parseCurrency(str) {
  const cleaned = str.replace(/[^0-9.]/g, '')
  return parseFloat(cleaned) || 0
}
