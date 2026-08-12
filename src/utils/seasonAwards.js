import { createSeededRandom } from './matchEngine'

export const ANNUAL_AWARD_DEFINITIONS = [
  { key: 'ballonDor', label: "Ballon d'Or", defaultPrize: 15_000_000 },
  { key: 'bestGK', label: 'Goalkeeper of the Year', position: 'GK', defaultPrize: 8_000_000 },
  { key: 'bestDEF', label: 'Defender of the Year', position: 'DF', defaultPrize: 8_000_000 },
  { key: 'bestMF', label: 'Midfielder of the Year', position: 'MF', defaultPrize: 8_000_000 },
  { key: 'bestFWD', label: 'Forward of the Year', position: 'FW', defaultPrize: 8_000_000 },
]

const positionGroup = position => {
  const value = String(position || '').toUpperCase()
  if (value.includes('GK')) return 'GK'
  if (value.includes('CB') || value.includes('LB') || value.includes('RB') || value.includes('DF')) return 'DF'
  if (value.includes('MF') || value.includes('CM') || value.includes('DM') || value.includes('AM')) return 'MF'
  return 'FW'
}

const snapshot = (player, team) => ({
  id: player.id,
  name: player.name,
  photo_url: player.photo_url || null,
  nationality: player.nationality || null,
  position: player.position || null,
  overall: Number(player.overall ?? player.ovr ?? 0),
  club: team ? { id: team.club_id, name: team.club_name, short_name: team.short_name, badge_url: team.badge_url, badge_color: team.badge_color } : null,
})

export function generateOutsideLeagueStats(teams, season, freeAgents = []) {
  const leagueIds = new Set((season?.teamIds || []).map(String))
  const stats = { topScorers: {}, topAssists: {}, mostMvps: {}, playerSnapshots: {}, performance: {} }
  const externalGroups = [
    ...(teams || []).filter(team => !leagueIds.has(String(team.club_id))).map(team => ({ team, players: team.roster || [] })),
    { team: null, players: freeAgents || [] },
  ]
  externalGroups.forEach(({ team, players }) => {
    ;(players || []).forEach(player => {
      const random = createSeededRandom(`outside-${season?.id}-${team?.club_id || 'market'}-${player.id}`)
      const ovr = Number(player.overall ?? player.ovr ?? 60)
      const quality = Math.max(0, (ovr - 55) / 45)
      const group = positionGroup(player.position)
      const appearances = Math.max(8, Math.round(18 + random() * 16))
      const goals = Math.max(0, Math.round((group === 'FW' ? 3.5 : group === 'MF' ? 2.1 : group === 'DF' ? 0.8 : 0.15) * quality + random() * (group === 'FW' ? 8 : 4)))
      const assists = Math.max(0, Math.round((group === 'MF' ? 3.2 : group === 'FW' ? 2.1 : group === 'DF' ? 1.1 : 0.1) * quality + random() * 6))
      const mvps = Math.max(0, Math.round(quality * 1.8 + random() * (group === 'GK' ? 3 : 2)))
      if (goals) stats.topScorers[player.id] = goals
      if (assists) stats.topAssists[player.id] = assists
      if (mvps) stats.mostMvps[player.id] = mvps
      stats.playerSnapshots[player.id] = snapshot(player, team)
      stats.performance[player.id] = {
        appearances, goals, assists, mvps,
        saves: group === 'GK' ? Math.round(appearances * (2.2 + random() * 2.8) * (0.75 + quality * 0.35)) : 0,
        cleanSheets: group === 'GK' || group === 'DF' ? Math.round(appearances * (0.12 + quality * 0.22 + random() * 0.08)) : 0,
        defensiveActions: group === 'DF' || group === 'MF' ? Math.round(appearances * (group === 'DF' ? 3.5 : 1.8) * (0.75 + quality * 0.45)) : 0,
        chancesCreated: group === 'MF' || group === 'FW' ? Math.round(appearances * (group === 'MF' ? 1.8 : 0.9) * (0.7 + quality * 0.5)) : 0,
        source: 'external',
      }
    })
  })
  return stats
}

export function calculateAnnualAwards(stats, teams, season, cups = [], nationalCups = []) {
  const players = new Map()
  ;(teams || []).forEach(team => (team.roster || []).forEach(player => players.set(String(player.id), snapshot(player, team))))
  Object.values(stats?.playerSnapshots || {}).forEach(player => players.set(String(player.id), player))
  const leagueChampion = String(season?.champion || '')
  const clubChampion = String(cups.find(cup => String(cup.seasonId) === String(season?.id) && cup.status === 'completed')?.champion || '')
  const nationalChampions = new Set((nationalCups || []).filter(cup => String(cup.seasonId) === String(season?.id) && cup.status === 'completed').flatMap(cup => cup.championPlayerIds || [] ).map(String))
  const scored = [...players.values()].filter(player => player.club?.id || nationalChampions.has(String(player.id))).map(player => {
    const id = String(player.id)
    const goals = Number(stats?.topScorers?.[id] || 0)
    const assists = Number(stats?.topAssists?.[id] || 0)
    const mvps = Number(stats?.mostMvps?.[id] || 0)
    const clubId = String(player.club?.id || '')
    const title = (clubId === leagueChampion ? 10 : 0) + (clubId === clubChampion ? 8 : 0) + (nationalChampions.has(id) ? 14 : 0)
    const group = positionGroup(player.position)
    const contribution = group === 'GK' ? mvps * 8 + goals * 2 + assists * 2 : group === 'DF' ? goals * 5 + assists * 4 + mvps * 7 : goals * 4 + assists * 3 + mvps * 6
    return { ...player, positionGroup: group, goals, assists, mvps, score: contribution + title + Number(player.overall || 0) * 0.18 }
  }).sort((a, b) => b.score - a.score || b.mvps - a.mvps || b.goals - a.goals || String(a.name).localeCompare(String(b.name)))
  const winner = predicate => scored.find(predicate) || null
  return {
    ballonDor: winner(() => true),
    bestGK: winner(player => player.positionGroup === 'GK'),
    bestDEF: winner(player => player.positionGroup === 'DF'),
    bestMF: winner(player => player.positionGroup === 'MF'),
    bestFWD: winner(player => player.positionGroup === 'FW'),
  }
}

export function mergeSeasonStats(base, ...sources) {
  const result = { topScorers: {}, topAssists: {}, mostMvps: {}, mostFouls: {}, playerSnapshots: {}, performance: {} }
  ;[base, ...sources].filter(Boolean).forEach(source => {
    ;['topScorers', 'topAssists', 'mostMvps', 'mostFouls'].forEach(key => Object.entries(source[key] || {}).forEach(([id, value]) => { result[key][id] = (result[key][id] || 0) + (Number(value) || 0) }))
    Object.assign(result.playerSnapshots, source.playerSnapshots || {})
    Object.entries(source.performance || {}).forEach(([id, metrics]) => {
      const current = result.performance[id] || {}
      result.performance[id] = { ...current, ...metrics }
      ;['appearances', 'goals', 'assists', 'mvps', 'saves', 'cleanSheets', 'defensiveActions', 'chancesCreated'].forEach(key => {
        result.performance[id][key] = (Number(current[key]) || 0) + (Number(metrics[key]) || 0)
      })
    })
  })
  return result
}
