const KEYS = ['TAC', 'MGT', 'MOT', 'ATT', 'DEF', 'PHY']

function coachStat(coach, key) {
  return Number(coach?.stats?.[key] ?? coach?.[`stat_${key.toLowerCase()}`] ?? 70)
}

export function getCoachEffects(coaches = []) {
  const active = coaches.filter(Boolean).slice(0, 2)
  if (!active.length) return { ...Object.fromEntries(KEYS.map(key => [key, 0])), ratings: Object.fromEntries(KEYS.map(key => [key, 0])), hasCoach: false, label: 'No coach' }
  const weights = active.length > 1 ? [0.7, 0.3] : [1]
  const ratings = Object.fromEntries(KEYS.map(key => [key, active.reduce((sum, coach, index) => sum + coachStat(coach, key) * weights[index], 0)]))
  const effects = Object.fromEntries(KEYS.map(key => [key, Math.max(-10, Math.min(10, (ratings[key] - 70) / 3))]))
  return { ...effects, ratings, hasCoach: true, label: active.map(coach => coach.name).join(' + ') }
}

export function describeCoachEffects(effects) {
  return [
    ['Tactics', effects.TAC], ['Attack', effects.ATT], ['Defence', effects.DEF],
    ['Motivation', effects.MOT], ['Development', effects.MGT], ['Fitness', effects.PHY],
  ]
}
