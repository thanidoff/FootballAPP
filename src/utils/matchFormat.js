export const MATCH_SIZES = [3, 5, 7]

export function normalizeMatchSize(value, fallback = 5) {
  const parsed = Number(value)
  return MATCH_SIZES.includes(parsed) ? parsed : fallback
}

export function getSeasonMatchSize(settings, season = null) {
  const activeSeason = season
    || settings?.seasons?.find(item => item.status === 'active')
    || settings?.seasons?.at(-1)
  return normalizeMatchSize(activeSeason?.matchSize ?? settings?.matchSize)
}

export function getSimulationPace(matchSize) {
  return ({ 3: 1.25, 5: 1, 7: 0.85 })[normalizeMatchSize(matchSize)]
}

export function orderStartingLineup(roster = [], matchSize = 5) {
  const size = normalizeMatchSize(matchSize)
  const seen = new Set()
  const available = roster.filter(player => {
    if (!player || seen.has(String(player.id))) return false
    seen.add(String(player.id))
    return true
  })
  const goalkeeper = available.find(player => player.position === 'GK') || available.at(size - 1) || available.at(-1)
  const outfield = available.filter(player => player.id !== goalkeeper?.id).slice(0, Math.max(0, size - 1))
  const starters = [...outfield, goalkeeper].filter(Boolean)
  const starterIds = new Set(starters.map(player => String(player.id)))
  return [...starters, ...available.filter(player => !starterIds.has(String(player.id)))]
}
