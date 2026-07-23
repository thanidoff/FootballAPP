-- Football Manager: reconnect the restored project to the current 8-stat model.
-- This migration is intentionally additive: legacy goalkeeper columns and `ovr`
-- remain available for older clients and rollback.

begin;

alter table public.players
  add column if not exists stat_sav smallint not null default 50,
  add column if not exists stat_gka smallint not null default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and conname = 'players_stat_sav_range'
  ) then
    alter table public.players
      add constraint players_stat_sav_range check (stat_sav between 1 and 140);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.players'::regclass
      and conname = 'players_stat_gka_range'
  ) then
    alter table public.players
      add constraint players_stat_gka_range check (stat_gka between 1 and 140);
  end if;
end $$;

-- Convert legacy GK attributes into the current internal model. Hidden outfield
-- attributes are retained so a goalkeeper can be assigned another position.
update public.players
set
  stat_sav = greatest(1, least(140, round((stat_ref + stat_div + stat_han) / 3.0)::int)),
  stat_gka = greatest(1, least(140, stat_pos)),
  stat_pac = case when position = 'GK' then stat_spd else stat_pac end,
  stat_pas = case when position = 'GK' then stat_kic else stat_pas end,
  stat_dri = case when position = 'GK' then round((stat_han + stat_kic) / 2.0)::int else stat_dri end,
  stat_phy = case when position = 'GK' then stat_han else stat_phy end;

-- Keep the original generated `ovr` for old clients. New clients use `ovr_v2`.
alter table public.players
  add column if not exists ovr_v2 smallint generated always as (
    case position
      when 'GK' then round(
        stat_sav * 0.40 + stat_gka * 0.30 + stat_pas * 0.10 +
        stat_phy * 0.08 + stat_pac * 0.07 + stat_dri * 0.05
      )
      when 'DEF' then round(
        stat_def * 0.37 + stat_phy * 0.24 + stat_pac * 0.14 +
        stat_pas * 0.13 + stat_dri * 0.08 + stat_sho * 0.04
      )
      when 'MF' then round(
        stat_pas * 0.28 + stat_dri * 0.22 + stat_def * 0.17 +
        stat_phy * 0.13 + stat_pac * 0.10 + stat_sho * 0.10
      )
      when 'FWD' then round(
        stat_sho * 0.32 + stat_dri * 0.20 + stat_pac * 0.18 +
        stat_phy * 0.13 + stat_pas * 0.12 + stat_def * 0.05
      )
    end
  ) stored;

create index if not exists players_ovr_v2_idx on public.players (ovr_v2 desc);

-- Awards are shared by friendly, league and cup seasons. The restored schema
-- incorrectly constrained season_id to friendly_seasons only and lacked the
-- club snapshot used by the current UI.
alter table public.player_awards
  drop constraint if exists player_awards_season_id_fkey,
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists competition_type text not null default 'friendly',
  add column if not exists metric_value integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.player_awards'::regclass
      and conname = 'player_awards_competition_type_check'
  ) then
    alter table public.player_awards add constraint player_awards_competition_type_check
      check (competition_type in ('friendly', 'league', 'cup'));
  end if;
end $$;

create unique index if not exists player_awards_competition_unique
  on public.player_awards (player_id, season_id, award_type, competition_type);

-- These restored tables were the four Security Advisor findings. Enable RLS
-- without changing the current local god-mode behaviour. The permissive policy
-- is a compatibility bridge until the app adopts real Supabase Auth.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'friendly_seasons',
    'friendly_matches',
    'friendly_match_events',
    'player_awards'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_god_mode', table_name);
      execute format(
        'create policy %I on public.%I for all using (true) with check (true)',
        table_name || '_god_mode', table_name
      );
    end if;
  end loop;
end $$;

commit;
