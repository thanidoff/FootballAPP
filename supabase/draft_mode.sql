-- =============================================
-- Draft Mode Saves Schema
-- =============================================

create table if not exists draft_saves (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Draft Save',
  settings jsonb not null default '{}',
  teams jsonb not null default '[]',
  free_agents jsonb not null default '[]',
  current_week smallint not null default 1,
  created_at timestamptz default now()
);

-- RLS
alter table draft_saves enable row level security;

create policy "public read draft_saves"  on draft_saves for select using (true);
create policy "public write draft_saves" on draft_saves for all    using (true);
