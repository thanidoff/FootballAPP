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
  GK: ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'],
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
}

// FIFA-style OVR weights per position
const OVR_WEIGHTS = {
  GK: { DIV: 0.21, HAN: 0.18, KIC: 0.09, REF: 0.21, SPD: 0.08, POS: 0.23 },
  DEF: { PAC: 0.17, SHO: 0.05, PAS: 0.15, DRI: 0.13, DEF: 0.32, PHY: 0.18 },
  MF: { PAC: 0.15, SHO: 0.10, PAS: 0.32, DRI: 0.23, DEF: 0.10, PHY: 0.10 },
  FWD: { PAC: 0.21, SHO: 0.45, PAS: 0.10, DRI: 0.14, DEF: 0.03, PHY: 0.07 },
}

export function calculateOVR(position, stats) {
  const weights = OVR_WEIGHTS[position]
  if (!weights) return 0
  const keys = STATS_BY_POSITION[position]
  const total = keys.reduce((sum, key) => {
    return sum + (stats[key] ?? 0) * (weights[key] ?? 0)
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
  return Object.fromEntries(STATS_BY_POSITION[position].map((s) => [s, 50]))
}

export function getStatLabel(value) {
  if (value > 99) return 'Superhuman'
  if (value >= 85) return 'World Class'
  if (value >= 75) return 'Professional'
  if (value >= 60) return 'Average'
  return 'Below Average'
}
