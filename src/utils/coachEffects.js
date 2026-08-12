const KEYS = ['TAC', 'MGT', 'MOT', 'ATT', 'DEF', 'PHY']

function coachStat(coach, key) {
  return Number(coach?.stats?.[key] ?? coach?.[`stat_${key.toLowerCase()}`] ?? 70)
}

export function getCoachEffects(coaches = []) {
  const active = coaches.filter(Boolean).slice(0, 2)
  if (!active.length) return { ...Object.fromEntries(KEYS.map(key => [key, 0])), ratings: Object.fromEntries(KEYS.map(key => [key, 0])), hasCoach: false, label: 'No coach' }
  // The head coach provides the full foundation. An assistant only adds 20% of
  // the part above a 70 rating, so a second coach can help but never doubles a team.
  const ratings = Object.fromEntries(KEYS.map(key => {
    const headRating = coachStat(active[0], key)
    const assistantBonus = active[1] ? Math.max(0, coachStat(active[1], key) - 70) * 0.2 : 0
    return [key, Math.min(140, headRating + assistantBonus)]
  }))
  const effects = Object.fromEntries(KEYS.map(key => [key, Math.max(-8, Math.min(10, (ratings[key] - 70) / 4))]))
  return { ...effects, ratings, hasCoach: true, label: active.map(coach => coach.name).join(' + ') }
}

export function describeCoachEffects(effects) {
  return [
    ['Tactics', effects.TAC], ['Attack', effects.ATT], ['Defence', effects.DEF],
    ['Motivation', effects.MOT], ['Development', effects.MGT], ['Fitness', effects.PHY],
  ]
}
