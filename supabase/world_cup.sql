-- Add national team flag to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_national boolean NOT NULL DEFAULT false;

-- World Cup seasons
CREATE TABLE IF NOT EXISTS world_cup_seasons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  number        int NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  current_round int NOT NULL DEFAULT 1,
  champion_club_id uuid REFERENCES clubs(id),
  started_at    timestamptz DEFAULT now(),
  ended_at      timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- 16 teams registered per season
CREATE TABLE IF NOT EXISTS world_cup_teams (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES world_cup_seasons(id) ON DELETE CASCADE,
  club_id   uuid REFERENCES clubs(id) ON DELETE CASCADE
);

-- Knockout matches (round 1=R16, 2=QF, 3=SF, 4=Final)
CREATE TABLE IF NOT EXISTS world_cup_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid REFERENCES world_cup_seasons(id) ON DELETE CASCADE,
  round           int NOT NULL CHECK (round BETWEEN 1 AND 4),
  match_order     int NOT NULL,
  home_club_id    uuid REFERENCES clubs(id),
  away_club_id    uuid REFERENCES clubs(id),
  status          text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed')),
  home_score      int,
  away_score      int,
  winner_club_id  uuid REFERENCES clubs(id),
  played_at       timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Match events (goal/assist/yellow_card/red_card/mvp)
CREATE TABLE IF NOT EXISTS world_cup_match_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid REFERENCES world_cup_matches(id) ON DELETE CASCADE,
  player_id   uuid REFERENCES players(id) ON DELETE CASCADE,
  club_id     uuid REFERENCES clubs(id),
  event_type  text NOT NULL CHECK (event_type IN ('goal','assist','yellow_card','red_card','mvp')),
  minute      int,
  created_at  timestamptz DEFAULT now()
);

-- Club Cup support (type: 'national' | 'club')
ALTER TABLE world_cup_seasons ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'national';

-- RLS
ALTER TABLE world_cup_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_cup_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_cup_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_cup_match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON world_cup_seasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON world_cup_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON world_cup_matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON world_cup_match_events FOR ALL USING (true) WITH CHECK (true);
