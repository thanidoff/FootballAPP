CREATE TABLE IF NOT EXISTS league_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  number int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  current_week int NOT NULL DEFAULT 1,
  champion_club_id uuid REFERENCES clubs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE league_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS league_seasons_allow_all ON league_seasons;
CREATE POLICY league_seasons_allow_all ON league_seasons FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS league_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id)
);
ALTER TABLE league_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS league_teams_allow_all ON league_teams;
CREATE POLICY league_teams_allow_all ON league_teams FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS league_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  week int NOT NULL,
  match_order int NOT NULL DEFAULT 1,
  home_club_id uuid NOT NULL REFERENCES clubs(id),
  away_club_id uuid REFERENCES clubs(id),
  status text NOT NULL DEFAULT 'scheduled',
  home_score int,
  away_score int,
  played_at timestamptz,
  is_final boolean NOT NULL DEFAULT false
);
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS league_matches_allow_all ON league_matches;
CREATE POLICY league_matches_allow_all ON league_matches FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS league_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id),
  club_id uuid NOT NULL REFERENCES clubs(id),
  event_type text NOT NULL,
  minute int
);
ALTER TABLE league_match_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS league_match_events_allow_all ON league_match_events;
CREATE POLICY league_match_events_allow_all ON league_match_events FOR ALL USING (true) WITH CHECK (true);
