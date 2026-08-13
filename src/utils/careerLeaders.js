const emptyMetrics = () => ({ topScorers: {}, topAssists: {}, mostMvps: {}, mostFouls: {} })

const add = (target, key, player, amount = 1) => {
  const id = player?.id ?? player?.player_id
  if (id == null) return
  const normalizedId = String(id)
  target[key][normalizedId] = (target[key][normalizedId] || 0) + amount
}

const includeMatch = (metrics, match) => {
  if (!match?.played) return
  ;(match.events || []).forEach(event => {
    if (event.type === 'goal') {
      add(metrics, 'topScorers', event.player || event.scorer)
      add(metrics, 'topAssists', event.assist)
    }
    if (event.type === 'foul') add(metrics, 'mostFouls', event.player)
  })
  add(metrics, 'mostMvps', match.mvp)
}

const competitionMatches = competition => Object.values(competition?.rounds || {}).flat().filter(Boolean)

export function aggregateCareerLeaderStats({ seasons = [], cups = [], nationalCups = [], seasonId = null } = {}) {
  const metrics = emptyMetrics()
  const selectedIds = new Set((seasonId == null ? seasons : seasons.filter(season => String(season.id) === String(seasonId))).map(season => String(season.id)))

  seasons.filter(season => selectedIds.has(String(season.id))).forEach(season => {
    ;(season.matches || []).flatMap(week => week.matches || []).forEach(match => includeMatch(metrics, match))
  })
  cups.filter(cup => selectedIds.has(String(cup.seasonId))).forEach(cup => competitionMatches(cup).forEach(match => includeMatch(metrics, match)))
  nationalCups.filter(cup => selectedIds.has(String(cup.seasonId))).forEach(cup => competitionMatches(cup).forEach(match => includeMatch(metrics, match)))

  return metrics
}
