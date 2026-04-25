-- =============================================
-- Football Manager Schema
-- =============================================

-- Clubs
create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_name  text not null,
  badge_color text not null default '#1a56db',
  budget      bigint not null default 10000000,
  created_at  timestamptz default now()
);

-- Players
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  nationality text not null default '',
  age         smallint not null default 22,
  position    text not null check (position in ('GK','DEF','MF','FWD')),
  club_id     uuid references clubs(id) on delete set null,
  market_value bigint not null default 1000000,

  -- GK stats
  stat_div    smallint not null default 50 check (stat_div between 1 and 140),
  stat_han    smallint not null default 50 check (stat_han between 1 and 140),
  stat_kic    smallint not null default 50 check (stat_kic between 1 and 140),
  stat_ref    smallint not null default 50 check (stat_ref between 1 and 140),
  stat_spd    smallint not null default 50 check (stat_spd between 1 and 140),
  stat_pos    smallint not null default 50 check (stat_pos between 1 and 140),

  -- Outfield stats
  stat_pac    smallint not null default 50 check (stat_pac between 1 and 140),
  stat_sho    smallint not null default 50 check (stat_sho between 1 and 140),
  stat_pas    smallint not null default 50 check (stat_pas between 1 and 140),
  stat_dri    smallint not null default 50 check (stat_dri between 1 and 140),
  stat_def    smallint not null default 50 check (stat_def between 1 and 140),
  stat_phy    smallint not null default 50 check (stat_phy between 1 and 140),

  ovr         smallint generated always as (
    case position
      when 'GK'  then round(stat_div*0.21 + stat_han*0.18 + stat_kic*0.09 + stat_ref*0.21 + stat_spd*0.08 + stat_pos*0.23)
      when 'DEF' then round(stat_pac*0.17 + stat_sho*0.05 + stat_pas*0.15 + stat_dri*0.13 + stat_def*0.32 + stat_phy*0.18)
      when 'MF'  then round(stat_pac*0.15 + stat_sho*0.10 + stat_pas*0.32 + stat_dri*0.23 + stat_def*0.10 + stat_phy*0.10)
      when 'FWD' then round(stat_pac*0.21 + stat_sho*0.45 + stat_pas*0.10 + stat_dri*0.14 + stat_def*0.03 + stat_phy*0.07)
    end
  ) stored,

  created_at  timestamptz default now()
);

-- Transfer history
create table if not exists transfers (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  from_club   uuid references clubs(id) on delete set null,
  to_club     uuid not null references clubs(id) on delete cascade,
  fee         bigint not null default 0,
  transferred_at timestamptz default now()
);

-- Indexes
create index if not exists players_club_id_idx on players(club_id);
create index if not exists players_position_idx on players(position);
create index if not exists transfers_player_id_idx on transfers(player_id);

-- RLS (enable, but allow all for now — tighten per project need)
alter table clubs    enable row level security;
alter table players  enable row level security;
alter table transfers enable row level security;

create policy "public read clubs"    on clubs    for select using (true);
create policy "public write clubs"   on clubs    for all    using (true);
create policy "public read players"  on players  for select using (true);
create policy "public write players" on players  for all    using (true);
create policy "public read transfers"  on transfers for select using (true);
create policy "public write transfers" on transfers for all    using (true);
