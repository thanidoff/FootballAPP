import { aggregateCareerLeaderStats } from './careerLeaders'
import { ANNUAL_AWARD_DEFINITIONS } from './seasonAwards'

const emptyStats = () => ({ goal: 0, assist: 0, mvp: 0, yellow_card: 0, red_card: 0 })

const clubView = team => team ? {
  id: team.club_id ?? team.id,
  name: team.club_name ?? team.name,
  short_name: team.short_name || (team.club_name ?? team.name)?.slice(0, 3).toUpperCase(),
  badge_url: team.badge_url || null,
  badge_color: team.badge_color || null,
  is_national: Boolean(team.is_national),
} : null

const competitionMatches = competition => Object.values(competition?.rounds || {}).flat().filter(Boolean)

export function resolveDraftPlayer(saveData, player) {
  if (!player) return null
  const id = String(player.id)
  const team = (saveData?.teams || []).find(item => (item.roster || []).some(member => String(member.id) === id))
  const savedPlayer = team?.roster?.find(member => String(member.id) === id)
    || (saveData?.freeAgents || []).find(member => String(member.id) === id)
    || player
  return { ...player, ...savedPlayer, club: clubView(team) }
}

export function buildDraftPlayerProfileData(saveData, playerId) {
  const id = String(playerId)
  const seasons = saveData?.settings?.seasons || []
  const cups = saveData?.settings?.cups || []
  const nationalCups = saveData?.settings?.nationalCups || []
  const currentTeam = (saveData?.teams || []).find(team => (team.roster || []).some(player => String(player.id) === id))
  const fallbackClub = clubView(currentTeam)
  const history = new Map()
  const fallbackSeasonId = seasons[seasons.length - 1]?.id
  const competitionSeasonId = competition => String(competition.seasonId ?? fallbackSeasonId ?? '')

  const ensureHistory = club => {
    if (!club) return null
    const normalized = clubView(club)
    const key = String(normalized.id)
    if (!history.has(key)) history.set(key, { club: normalized, stats: emptyStats() })
    return history.get(key)
  }

  const resolveMatchClub = (match, player, competition) => {
    const eventTeamId = player?.team === 'home' ? match.home : player?.team === 'away' ? match.away : null
    const playerIdValue = String(player?.id ?? player?.player_id ?? '')
    const participant = (competition?.participants || []).find(item =>
      String(item.id) === String(eventTeamId)
      || (item.roster || []).some(member => String(member.id) === playerIdValue))
    if (participant) return clubView({ ...participant, club_id: participant.id, club_name: participant.name, is_national: String(participant.id).startsWith('nation:') })
    const team = (saveData?.teams || []).find(item => String(item.club_id) === String(eventTeamId))
      || (saveData?.teams || []).find(item => (item.roster || []).some(member => String(member.id) === playerIdValue))
    return clubView(team) || fallbackClub
  }

  const rawTotalsBySeason = new Map()
  const rawTotal = seasonId => {
    const key = String(seasonId)
    if (!rawTotalsBySeason.has(key)) rawTotalsBySeason.set(key, { goal: 0, assist: 0, mvp: 0 })
    return rawTotalsBySeason.get(key)
  }
  const includeMatch = (match, seasonId, competition = null) => {
    if (!match?.played) return
    ;(match.events || []).forEach(event => {
      if (event.type === 'goal' && String(event.player?.id ?? event.scorer?.id ?? '') === id) {
        const target = ensureHistory(resolveMatchClub(match, { ...(event.player || event.scorer), team: event.team }, competition))
        if (target) target.stats.goal += 1
        rawTotal(seasonId).goal += 1
      }
      if (event.type === 'goal' && String(event.assist?.id ?? '') === id) {
        const target = ensureHistory(resolveMatchClub(match, { ...event.assist, team: event.team }, competition))
        if (target) target.stats.assist += 1
        rawTotal(seasonId).assist += 1
      }
      if (event.type === 'foul' && String(event.player?.id ?? '') === id) {
        const target = ensureHistory(resolveMatchClub(match, { ...event.player, team: event.team }, competition))
        if (target) target.stats[event.card === 'red' ? 'red_card' : 'yellow_card'] += 1
      }
    })
    if (String(match.mvp?.id ?? '') === id) {
      const target = ensureHistory(resolveMatchClub(match, match.mvp, competition))
      if (target) target.stats.mvp += 1
      rawTotal(seasonId).mvp += 1
    }
  }

  seasons.forEach(season => {
    ;(season.matches || []).forEach(week => (week.matches || []).forEach(match => includeMatch(match, season.id)))
    cups.filter(cup => competitionSeasonId(cup) === String(season.id)).forEach(cup => competitionMatches(cup).forEach(match => includeMatch(match, season.id, cup)))
    nationalCups.filter(cup => competitionSeasonId(cup) === String(season.id)).forEach(cup => competitionMatches(cup).forEach(match => includeMatch(match, season.id, cup)))

    const totals = aggregateCareerLeaderStats({ seasons, cups, nationalCups, seasonId: season.id })
    const raw = rawTotal(season.id)
    const snapshot = season.stats?.playerSnapshots?.[id] || season.externalPlayerStats?.playerSnapshots?.[id]
    const remainderClub = snapshot?.club || fallbackClub
    const remainder = ensureHistory(remainderClub)
    if (remainder) {
      remainder.stats.goal += Math.max(0, Number(totals.topScorers?.[id] || 0) - raw.goal)
      remainder.stats.assist += Math.max(0, Number(totals.topAssists?.[id] || 0) - raw.assist)
      remainder.stats.mvp += Math.max(0, Number(totals.mostMvps?.[id] || 0) - raw.mvp)
    }
  })

  const awards = []
  const awardKeys = new Set()
  const addAward = (season, seasonIndex, label, club, key) => {
    const uniqueKey = `${season.id}-${key}`
    if (awardKeys.has(uniqueKey)) return
    awardKeys.add(uniqueKey)
    awards.push({ season_name: season.name || `Season ${seasonIndex + 1}`, award_type: label, club: clubView(club) || fallbackClub })
  }
  seasons.forEach((season, seasonIndex) => {
    ;(season.prizePayouts || []).filter(payout => String(payout.playerId) === id && ['player_award', 'annual_award'].includes(payout.type)).forEach(payout => {
      const team = (saveData?.teams || []).find(item => String(item.club_id) === String(payout.clubId))
      addAward(season, seasonIndex, payout.label, team || { id: payout.clubId, name: payout.clubName }, `${payout.type}-${payout.label}`)
    })
    ANNUAL_AWARD_DEFINITIONS.forEach(definition => {
      const winner = season.annualAwards?.[definition.key]
      if (String(winner?.id ?? '') === id) addAward(season, seasonIndex, definition.label, winner.club, `annual_award-${definition.label}`)
    })
  })

  return { history: [...history.values()], awards: awards.reverse() }
}
