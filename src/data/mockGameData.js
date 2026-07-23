export const MOCK_CLUBS = [
  ['bangkok-tigers', 'Bangkok Tigers', 'BKT', '#EF4444'],
  ['chao-phraya-fc', 'Chao Phraya FC', 'CPF', '#2563EB'],
  ['chiang-mai-united', 'Chiang Mai United', 'CMU', '#F97316'],
  ['phuket-wave', 'Phuket Wave', 'PHW', '#06B6D4'],
  ['korat-knights', 'Korat Knights', 'KKT', '#7C3AED'],
  ['pattaya-dolphins', 'Pattaya Dolphins', 'PTD', '#0EA5E9'],
  ['hat-yai-hawks', 'Hat Yai Hawks', 'HYH', '#16A34A'],
  ['buriram-blaze', 'Buriram Blaze', 'BRB', '#DC2626'],
].map(([id, name, short_name, badge_color]) => ({
  id, name, short_name, badge_color, badge_url: null, is_national: false,
}))

const PLAYER_BLUEPRINTS = [
  ['Arthit Suriya', 'Thailand', 25, 'GK', 78], ['Niran Chaiyo', 'Thailand', 22, 'GK', 73],
  ['Marco Silva', 'Portugal', 27, 'GK', 80], ['Krit Panyasak', 'Thailand', 21, 'GK', 70],
  ['Thanawat Kittipong', 'Thailand', 24, 'DEF', 77], ['Lucas Moreira', 'Brazil', 26, 'DEF', 79],
  ['Preecha Klongsai', 'Thailand', 23, 'DEF', 74], ['Hiro Tanaka', 'Japan', 25, 'DEF', 78],
  ['Sompong Daengnoi', 'Thailand', 28, 'DEF', 76], ['Mateo Cruz', 'Spain', 24, 'DEF', 75],
  ['Aekachai Nimit', 'Thailand', 22, 'DEF', 72], ['Joon Park', 'South Korea', 27, 'DEF', 80],
  ['Kawin Phromchai', 'Thailand', 25, 'MF', 79], ['Rafael Costa', 'Brazil', 28, 'MF', 82],
  ['Tawan Chotika', 'Thailand', 21, 'MF', 73], ['Sota Nakamura', 'Japan', 24, 'MF', 78],
  ['Chanon Wongsawat', 'Thailand', 26, 'MF', 76], ['Diego Ramos', 'Argentina', 25, 'MF', 81],
  ['Nattapon Rattanakul', 'Thailand', 23, 'MF', 75], ['Minho Lee', 'South Korea', 22, 'MF', 77],
  ['Thanon Suksai', 'Thailand', 29, 'MF', 74], ['Elias Berg', 'Sweden', 26, 'MF', 80],
  ['Phurin Srisuk', 'Thailand', 24, 'FWD', 81], ['Bruno Almeida', 'Brazil', 27, 'FWD', 84],
  ['Kittisak Lertchai', 'Thailand', 22, 'FWD', 76], ['Ren Ito', 'Japan', 23, 'FWD', 79],
  ['Chaiwat Thongdee', 'Thailand', 25, 'FWD', 77], ['Mateo Alvarez', 'Argentina', 28, 'FWD', 83],
  ['Saran Phuengkaew', 'Thailand', 21, 'FWD', 72], ['Oskar Lind', 'Sweden', 24, 'FWD', 78],
  ['Pongsakorn Meechai', 'Thailand', 26, 'FWD', 75], ['Jae Kim', 'South Korea', 22, 'FWD', 74],
]

function makeStats(position, ovr) {
  const value = (offset) => Math.max(45, Math.min(99, ovr + offset))
  return position === 'GK'
    ? { stat_div: value(2), stat_han: value(0), stat_kic: value(-2), stat_ref: value(3), stat_spd: value(-6), stat_pos: value(1), stat_pac: 50, stat_sho: 50, stat_pas: 50, stat_dri: 50, stat_def: 50, stat_phy: 50 }
    : { stat_pac: value(position === 'FWD' ? 4 : 0), stat_sho: value(position === 'FWD' ? 3 : -4), stat_pas: value(position === 'MF' ? 3 : -2), stat_dri: value(1), stat_def: value(position === 'DEF' ? 4 : -8), stat_phy: value(position === 'DEF' ? 2 : 0), stat_div: 50, stat_han: 50, stat_kic: 50, stat_ref: 50, stat_spd: 50, stat_pos: 50 }
}

export const MOCK_PLAYERS = PLAYER_BLUEPRINTS.map(([name, nationality, age, position, ovr], index) => ({
  id: `mock-player-${index + 1}`,
  name,
  nationality,
  age,
  position,
  ovr,
  market_value: ovr * 1000000,
  club_id: null,
  clubs: null,
  roster_order: null,
  national_roster_order: null,
  photo_url: null,
  created_at: '2026-07-22T00:00:00.000Z',
  ...makeStats(position, ovr),
}))
