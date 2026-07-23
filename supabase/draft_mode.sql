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
  owner_id uuid references auth.users(id) on delete cascade,
  schema_version integer not null default 2,
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table draft_saves enable row level security;

create policy "Owners can read career saves" on draft_saves for select to authenticated using (auth.uid() = owner_id);
create policy "Owners can create career saves" on draft_saves for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners can update career saves" on draft_saves for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can delete career saves" on draft_saves for delete to authenticated using (auth.uid() = owner_id);
