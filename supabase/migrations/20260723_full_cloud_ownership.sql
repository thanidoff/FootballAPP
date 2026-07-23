-- User-scoped competition data and authenticated master-data writes.
alter table public.friendly_seasons add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.league_seasons add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.world_cup_seasons add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.player_awards add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists friendly_seasons_owner_idx on public.friendly_seasons(owner_id, number);
create index if not exists league_seasons_owner_idx on public.league_seasons(owner_id, number);
create index if not exists world_cup_seasons_owner_idx on public.world_cup_seasons(owner_id, type, number);
create index if not exists player_awards_owner_idx on public.player_awards(owner_id, season_id);

-- Master data is readable by everyone, but only signed-in users can change it.
do $$
declare table_name text;
begin
  foreach table_name in array array['clubs','players','transfers'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'public write ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_god_mode', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_authenticated_write', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', table_name || '_authenticated_write', table_name);
  end loop;
end $$;

-- Parent seasons belong to one account.
do $$
declare table_name text;
begin
  foreach table_name in array array['friendly_seasons','league_seasons','world_cup_seasons'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_allow_all', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_god_mode', table_name);
    execute format('drop policy if exists "allow_all" on public.%I', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_access', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id)', table_name || '_owner_access', table_name);
  end loop;
end $$;

-- Child rows inherit access from their season.
alter table public.friendly_matches enable row level security;
alter table public.friendly_match_events enable row level security;
drop policy if exists friendly_matches_god_mode on public.friendly_matches;
drop policy if exists friendly_match_events_god_mode on public.friendly_match_events;
drop policy if exists friendly_matches_owner_access on public.friendly_matches;
drop policy if exists friendly_match_events_owner_access on public.friendly_match_events;
create policy friendly_matches_owner_access on public.friendly_matches for all to authenticated
  using (exists (select 1 from public.friendly_seasons s where s.id = season_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.friendly_seasons s where s.id = season_id and s.owner_id = auth.uid()));
create policy friendly_match_events_owner_access on public.friendly_match_events for all to authenticated
  using (exists (select 1 from public.friendly_matches m join public.friendly_seasons s on s.id = m.season_id where m.id = match_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.friendly_matches m join public.friendly_seasons s on s.id = m.season_id where m.id = match_id and s.owner_id = auth.uid()));

alter table public.league_teams enable row level security;
alter table public.league_matches enable row level security;
alter table public.league_match_events enable row level security;
drop policy if exists league_teams_allow_all on public.league_teams;
drop policy if exists league_matches_allow_all on public.league_matches;
drop policy if exists league_match_events_allow_all on public.league_match_events;
drop policy if exists league_teams_owner_access on public.league_teams;
drop policy if exists league_matches_owner_access on public.league_matches;
drop policy if exists league_match_events_owner_access on public.league_match_events;
create policy league_teams_owner_access on public.league_teams for all to authenticated
  using (exists (select 1 from public.league_seasons s where s.id = season_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.league_seasons s where s.id = season_id and s.owner_id = auth.uid()));
create policy league_matches_owner_access on public.league_matches for all to authenticated
  using (exists (select 1 from public.league_seasons s where s.id = season_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.league_seasons s where s.id = season_id and s.owner_id = auth.uid()));
create policy league_match_events_owner_access on public.league_match_events for all to authenticated
  using (exists (select 1 from public.league_matches m join public.league_seasons s on s.id = m.season_id where m.id = match_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.league_matches m join public.league_seasons s on s.id = m.season_id where m.id = match_id and s.owner_id = auth.uid()));

alter table public.world_cup_teams enable row level security;
alter table public.world_cup_matches enable row level security;
alter table public.world_cup_match_events enable row level security;
drop policy if exists "allow_all" on public.world_cup_teams;
drop policy if exists "allow_all" on public.world_cup_matches;
drop policy if exists "allow_all" on public.world_cup_match_events;
drop policy if exists world_cup_teams_owner_access on public.world_cup_teams;
drop policy if exists world_cup_matches_owner_access on public.world_cup_matches;
drop policy if exists world_cup_match_events_owner_access on public.world_cup_match_events;
create policy world_cup_teams_owner_access on public.world_cup_teams for all to authenticated
  using (exists (select 1 from public.world_cup_seasons s where s.id = season_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.world_cup_seasons s where s.id = season_id and s.owner_id = auth.uid()));
create policy world_cup_matches_owner_access on public.world_cup_matches for all to authenticated
  using (exists (select 1 from public.world_cup_seasons s where s.id = season_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.world_cup_seasons s where s.id = season_id and s.owner_id = auth.uid()));
create policy world_cup_match_events_owner_access on public.world_cup_match_events for all to authenticated
  using (exists (select 1 from public.world_cup_matches m join public.world_cup_seasons s on s.id = m.season_id where m.id = match_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.world_cup_matches m join public.world_cup_seasons s on s.id = m.season_id where m.id = match_id and s.owner_id = auth.uid()));

alter table public.player_awards enable row level security;
drop policy if exists player_awards_god_mode on public.player_awards;
drop policy if exists player_awards_owner_access on public.player_awards;
create policy player_awards_owner_access on public.player_awards for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Images remain publicly viewable; mutations require a signed-in account.
drop policy if exists "public upload player-photos" on storage.objects;
drop policy if exists "public update player-photos" on storage.objects;
drop policy if exists "public delete player-photos" on storage.objects;
drop policy if exists "public upload club-badges" on storage.objects;
drop policy if exists "public update club-badges" on storage.objects;
drop policy if exists "public delete club-badges" on storage.objects;
drop policy if exists "authenticated media insert" on storage.objects;
drop policy if exists "authenticated media update" on storage.objects;
drop policy if exists "authenticated media delete" on storage.objects;
create policy "authenticated media insert" on storage.objects for insert to authenticated with check (bucket_id in ('player-photos','club-badges'));
create policy "authenticated media update" on storage.objects for update to authenticated using (bucket_id in ('player-photos','club-badges')) with check (bucket_id in ('player-photos','club-badges'));
create policy "authenticated media delete" on storage.objects for delete to authenticated using (bucket_id in ('player-photos','club-badges'));
