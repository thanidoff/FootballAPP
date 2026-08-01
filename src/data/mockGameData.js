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

export const MOCK_COACHES = [
  { id: 'mock-coach-1', name: 'Pep Guardiola', nationality: 'Spain', age: 53, market_value: 15000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', stat_tac: 96, stat_mgt: 94, stat_mot: 90, stat_att: 95, stat_def: 88, stat_phy: 85 },
  { id: 'mock-coach-2', name: 'Jurgen Klopp', nationality: 'Germany', age: 56, market_value: 14000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', stat_tac: 92, stat_mgt: 96, stat_mot: 98, stat_att: 94, stat_def: 86, stat_phy: 90 },
  { id: 'mock-coach-3', name: 'Carlo Ancelotti', nationality: 'Italy', age: 64, market_value: 12000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', stat_tac: 93, stat_mgt: 97, stat_mot: 92, stat_att: 90, stat_def: 89, stat_phy: 82 },
  { id: 'mock-coach-4', name: 'Zinedine Zidane', nationality: 'France', age: 51, market_value: 11000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80', stat_tac: 89, stat_mgt: 95, stat_mot: 93, stat_att: 91, stat_def: 87, stat_phy: 84 },
  { id: 'mock-coach-5', name: 'Sir Alex Ferguson', nationality: 'Scotland', age: 82, market_value: 20000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80', stat_tac: 97, stat_mgt: 99, stat_mot: 99, stat_att: 93, stat_def: 91, stat_phy: 88 },
  { id: 'mock-coach-6', name: 'Kiatisuk Senamuang', nationality: 'Thailand', age: 50, market_value: 5000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80', stat_tac: 82, stat_mgt: 85, stat_mot: 88, stat_att: 84, stat_def: 80, stat_phy: 81 },
  { id: 'mock-coach-7', name: 'Mikel Arteta', nationality: 'Spain', age: 42, market_value: 10000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80', stat_tac: 91, stat_mgt: 89, stat_mot: 92, stat_att: 89, stat_def: 88, stat_phy: 85 },
  { id: 'mock-coach-8', name: 'Jose Mourinho', nationality: 'Portugal', age: 61, market_value: 11000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80', stat_tac: 94, stat_mgt: 92, stat_mot: 95, stat_att: 84, stat_def: 96, stat_phy: 83 },
  { id: 'mock-coach-9', name: 'Xabi Alonso', nationality: 'Spain', age: 42, market_value: 12500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&auto=format&fit=crop&q=80', stat_tac: 93, stat_mgt: 90, stat_mot: 91, stat_att: 92, stat_def: 89, stat_phy: 86 },
  { id: 'mock-coach-10', name: 'Luis Enrique', nationality: 'Spain', age: 54, market_value: 9500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80', stat_tac: 88, stat_mgt: 89, stat_mot: 91, stat_att: 92, stat_def: 83, stat_phy: 85 },
  { id: 'mock-coach-11', name: 'Arne Slot', nationality: 'Netherlands', age: 45, market_value: 9000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80', stat_tac: 89, stat_mgt: 87, stat_mot: 88, stat_att: 90, stat_def: 84, stat_phy: 83 },
  { id: 'mock-coach-12', name: 'Simone Inzaghi', nationality: 'Italy', age: 48, market_value: 9800000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80', stat_tac: 92, stat_mgt: 88, stat_mot: 89, stat_att: 88, stat_def: 93, stat_phy: 85 },
  { id: 'mock-coach-13', name: 'Unai Emery', nationality: 'Spain', age: 52, market_value: 8500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=300&auto=format&fit=crop&q=80', stat_tac: 90, stat_mgt: 86, stat_mot: 87, stat_att: 87, stat_def: 88, stat_phy: 82 },
  { id: 'mock-coach-14', name: 'Hans-Dieter Flick', nationality: 'Germany', age: 59, market_value: 10500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80', stat_tac: 91, stat_mgt: 90, stat_mot: 93, stat_att: 95, stat_def: 82, stat_phy: 89 },
  { id: 'mock-coach-15', name: 'Julian Nagelsmann', nationality: 'Germany', age: 36, market_value: 9500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', stat_tac: 92, stat_mgt: 85, stat_mot: 86, stat_att: 91, stat_def: 85, stat_phy: 84 },
  { id: 'mock-coach-16', name: 'Diego Simeone', nationality: 'Argentina', age: 54, market_value: 11500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', stat_tac: 89, stat_mgt: 94, stat_mot: 98, stat_att: 82, stat_def: 97, stat_phy: 92 },
  { id: 'mock-coach-17', name: 'Roberto De Zerbi', nationality: 'Italy', age: 44, market_value: 8000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80', stat_tac: 90, stat_mgt: 84, stat_mot: 86, stat_att: 92, stat_def: 78, stat_phy: 80 },
  { id: 'mock-coach-18', name: 'Arsene Wenger', nationality: 'France', age: 74, market_value: 13000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80', stat_tac: 94, stat_mgt: 96, stat_mot: 92, stat_att: 96, stat_def: 83, stat_phy: 81 },
  { id: 'mock-coach-19', name: 'Antonio Conte', nationality: 'Italy', age: 54, market_value: 10000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80', stat_tac: 91, stat_mgt: 90, stat_mot: 96, stat_att: 86, stat_def: 92, stat_phy: 91 },
  { id: 'mock-coach-20', name: 'Erik ten Hag', nationality: 'Netherlands', age: 54, market_value: 7500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80', stat_tac: 86, stat_mgt: 82, stat_mot: 83, stat_att: 85, stat_def: 84, stat_phy: 80 },
  { id: 'mock-coach-21', name: 'Ishii Masatada', nationality: 'Japan', age: 57, market_value: 6000000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&auto=format&fit=crop&q=80', stat_tac: 84, stat_mgt: 87, stat_mot: 86, stat_att: 81, stat_def: 85, stat_phy: 83 },
  { id: 'mock-coach-22', name: 'Totchtawan Sripan', nationality: 'Thailand', age: 52, market_value: 4500000, club_id: null, photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80', stat_tac: 80, stat_mgt: 83, stat_mot: 85, stat_att: 82, stat_def: 79, stat_phy: 80 },
].map(coach => ({
  ...coach,
  ovr: Math.round((coach.stat_tac + coach.stat_mgt + coach.stat_mot + coach.stat_att + coach.stat_def + coach.stat_phy) / 6),
}))

