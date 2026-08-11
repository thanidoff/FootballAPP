-- =============================================
-- Coaches Schema
-- =============================================

create table if not exists coaches (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  nationality  text not null default '',
  age          smallint not null default 45,
  club_id      uuid references clubs(id) on delete set null,
  market_value bigint not null default 2000000,
  photo_url    text,

  -- Coach Stats (1 to 140)
  stat_tac     smallint not null default 70 check (stat_tac between 1 and 140),
  stat_mgt     smallint not null default 70 check (stat_mgt between 1 and 140),
  stat_mot     smallint not null default 70 check (stat_mot between 1 and 140),
  stat_att     smallint not null default 70 check (stat_att between 1 and 140),
  stat_def     smallint not null default 70 check (stat_def between 1 and 140),
  stat_phy     smallint not null default 70 check (stat_phy between 1 and 140),

  ovr          smallint generated always as (
    round((stat_tac + stat_mgt + stat_mot + stat_att + stat_def + stat_phy) / 6.0)
  ) stored,

  created_at   timestamptz default now()
);

-- Indexes
create index if not exists coaches_club_id_idx on coaches(club_id);
create index if not exists coaches_ovr_idx on coaches(ovr desc);

-- RLS Policies
alter table coaches enable row level security;

create policy "public read coaches"  on coaches for select using (true);
create policy "authenticated write coaches" on coaches for all to authenticated using (true) with check (true);
