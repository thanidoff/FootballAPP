begin;

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nationality text not null default '',
  age smallint not null default 45 check (age >= 0),
  club_id uuid references public.clubs(id) on delete set null,
  market_value bigint not null default 2000000 check (market_value >= 0),
  photo_url text,
  stat_tac smallint not null default 70 check (stat_tac between 1 and 140),
  stat_mgt smallint not null default 70 check (stat_mgt between 1 and 140),
  stat_mot smallint not null default 70 check (stat_mot between 1 and 140),
  stat_att smallint not null default 70 check (stat_att between 1 and 140),
  stat_def smallint not null default 70 check (stat_def between 1 and 140),
  stat_phy smallint not null default 70 check (stat_phy between 1 and 140),
  ovr smallint generated always as (
    round((stat_tac + stat_mgt + stat_mot + stat_att + stat_def + stat_phy) / 6.0)
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists coaches_club_id_idx on public.coaches(club_id);
create index if not exists coaches_ovr_idx on public.coaches(ovr desc);

alter table public.coaches enable row level security;
drop policy if exists "public read coaches" on public.coaches;
drop policy if exists "public write coaches" on public.coaches;
drop policy if exists "authenticated write coaches" on public.coaches;
create policy "public read coaches" on public.coaches for select using (true);
create policy "authenticated write coaches" on public.coaches
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('coach-photos', 'coach-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read coach-photos" on storage.objects;
drop policy if exists "authenticated upload coach-photos" on storage.objects;
drop policy if exists "authenticated update coach-photos" on storage.objects;
drop policy if exists "authenticated delete coach-photos" on storage.objects;
-- Public bucket URLs remain readable without exposing a list of every object.
create policy "authenticated upload coach-photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-photos');
create policy "authenticated update coach-photos" on storage.objects for update to authenticated
  using (bucket_id = 'coach-photos') with check (bucket_id = 'coach-photos');
create policy "authenticated delete coach-photos" on storage.objects for delete to authenticated
  using (bucket_id = 'coach-photos');

commit;
