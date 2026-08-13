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
  const seasonById = new Map(seasons.map(season => [String(season.id), season]))
  const rebuiltSeasonIds = new Set()
  const fallbackSeasonId = [...seasons].reverse().find(season => selectedIds.has(String(season.id)))?.id
  const competitionSeasonId = competition => String(competition.seasonId ?? fallbackSeasonId ?? '')

  seasons.filter(season => selectedIds.has(String(season.id))).forEach(season => {
    const leagueMatches = (season.matches || []).flatMap(week => week.matches || []).filter(match => match?.played)
    if (leagueMatches.length) {
      rebuiltSeasonIds.add(String(season.id))
      leagueMatches.forEach(match => includeMatch(metrics, match))
      const external = season.externalPlayerStats || {}
      const clubPlayerIds = new Set(Object.entries(external.playerSnapshots || {}).filter(([, player]) => player.club?.id).map(([id]) => String(id)))
      ;['topScorers', 'topAssists', 'mostMvps', 'mostFouls'].forEach(key => Object.entries(external[key] || {}).forEach(([id, value]) => {
        if (!clubPlayerIds.has(String(id))) return
        metrics[key][String(id)] = (metrics[key][String(id)] || 0) + (Number(value) || 0)
      }))
    } else {
      Object.keys(metrics).forEach(key => Object.entries(season.stats?.[key] || {}).forEach(([id, value]) => {
        metrics[key][String(id)] = (metrics[key][String(id)] || 0) + (Number(value) || 0)
      }))
    }
  })
  // Completed cups are already merged into season.stats by the settlement
  // flow. Only live competitions need to be layered on top of that canonical
  // snapshot, which also keeps older saves whose match events are incomplete.
  const needsLiveLayer = competition => {
    const resolvedSeasonId = competitionSeasonId(competition)
    if (!selectedIds.has(resolvedSeasonId)) return false
    if (competition.status !== 'completed') return true
    if (competition.statsMergedAt) return false
    const season = seasonById.get(resolvedSeasonId)
    // Legacy recovery: the old settlement flow skipped merging a club cup when
    // league awards had already been paid before that cup was completed.
    const awardsAt = Date.parse(season?.awardsPaidAt || '')
    const completedAt = Date.parse(competition.completedAt || '')
    return Number.isFinite(awardsAt) && Number.isFinite(completedAt) && completedAt >= awardsAt
  }
  cups.filter(cup => rebuiltSeasonIds.has(competitionSeasonId(cup)) || needsLiveLayer(cup)).forEach(cup => competitionMatches(cup).forEach(match => includeMatch(metrics, match)))
  nationalCups.filter(cup => rebuiltSeasonIds.has(competitionSeasonId(cup)) || (cup.status !== 'completed' && selectedIds.has(competitionSeasonId(cup)))).forEach(cup => competitionMatches(cup).forEach(match => includeMatch(metrics, match)))

  return metrics
}
