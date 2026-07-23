alter table public.world_cup_matches
  add column if not exists penalty_home_score integer,
  add column if not exists penalty_away_score integer;

alter table public.world_cup_matches
  drop constraint if exists world_cup_matches_penalty_scores_check;

alter table public.world_cup_matches
  add constraint world_cup_matches_penalty_scores_check check (
    (penalty_home_score is null and penalty_away_score is null)
    or
    (penalty_home_score >= 0 and penalty_away_score >= 0 and penalty_home_score <> penalty_away_score)
  );
