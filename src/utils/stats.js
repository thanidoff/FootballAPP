export const POSITIONS = {
  GK: 'GK',
  DEF: 'DEF',
  MF: 'MF',
  FWD: 'FWD',
}

export const POSITION_LABELS = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MF: 'Midfielder',
  FWD: 'Forward',
}

export const STATS_BY_POSITION = {
  GK: ['PAC', 'PAS', 'DRI', 'PHY', 'SAV', 'GKA'],
  DEF: ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'],
  MF: ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'],
  FWD: ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'],
}

export const STAT_LABELS = {
  DIV: 'Diving',
  HAN: 'Handling',
  KIC: 'Kicking',
  REF: 'Reflexes',
  SPD: 'Speed',
  POS: 'Positioning',
  PAC: 'Pace',
  SHO: 'Shooting',
  PAS: 'Passing',
  DRI: 'Dribbling',
  DEF: 'Defending',
  PHY: 'Physicality',
  SAV: 'Saving',
  GKA: 'Goalkeeper Awareness',
}

export const ALL_STATS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'SAV', 'GKA']

const OVR_WEIGHTS = {
  GK:  { SAV: 0.40, GKA: 0.30, PAS: 0.10, PHY: 0.08, PAC: 0.07, DRI: 0.05 },
  DEF: { DEF: 0.37, PHY: 0.24, PAC: 0.14, PAS: 0.13, DRI: 0.08, SHO: 0.04 },
  MF:  { PAS: 0.28, DRI: 0.22, DEF: 0.17, PHY: 0.13, PAC: 0.10, SHO: 0.10 },
  FWD: { SHO: 0.32, DRI: 0.20, PAC: 0.18, PHY: 0.13, PAS: 0.12, DEF: 0.05 },
}

export function normalizeStats(stats) {
  const safeStats = stats || {}
  const average = (...values) => {
    const present = values.filter(value => Number.isFinite(Number(value))).map(Number)
    return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : 50
  }
  const normalized = {
    PAC: safeStats.PAC ?? safeStats.SPD ?? 50,
    SHO: safeStats.SHO ?? 30,
    PAS: safeStats.PAS ?? safeStats.KIC ?? 50,
    DRI: safeStats.DRI ?? average(safeStats.HAN, safeStats.KIC),
    DEF: safeStats.DEF ?? 30,
    PHY: safeStats.PHY ?? safeStats.HAN ?? 50,
    SAV: safeStats.SAV ?? average(safeStats.REF, safeStats.DIV, safeStats.HAN),
    GKA: safeStats.GKA ?? average(safeStats.POS, safeStats.SPD, safeStats.HAN),
  }
  return Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, Math.round(Number(value) || 0)]))
}

export function calculateOVR(position, stats) {
  const weights = OVR_WEIGHTS[position]
  if (!weights) return 0
  if (!stats || Object.keys(stats).length === 0) return 0
  const normalized = normalizeStats(stats)
  const keys = STATS_BY_POSITION[position]
  const total = keys.reduce((sum, key) => {
    return sum + (normalized[key] ?? 0) * (weights[key] ?? 0)
  }, 0)
  return Math.round(total)
}

export const STAT_MAX = 140

export function getStatColor(value) {
  if (value >= 100) return '#FD5461'
  if (value >= 90)  return '#0A1318'
  if (value >= 80)  return 'rgba(10,19,24,0.75)'
  if (value >= 70)  return 'rgba(10,19,24,0.50)'
  if (value >= 60)  return 'rgba(10,19,24,0.30)'
  return 'rgba(10,19,24,0.15)'
}

export function getOVRTier(ovr) {
  if (ovr > 99) return 'special'
  if (ovr >= 85) return 'gold'
  if (ovr >= 75) return 'silver'
  return 'bronze'
}

export function getDefaultStats(position) {
  return Object.fromEntries(ALL_STATS.map((stat) => [stat, 50]))
}

export function getStatLabel(value) {
  if (value > 99) return 'Superhuman'
  if (value >= 85) return 'World Class'
  if (value >= 75) return 'Professional'
  if (value >= 60) return 'Average'
  return 'Below Average'
}
