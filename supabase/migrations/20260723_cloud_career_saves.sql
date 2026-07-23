-- Private, cross-device Career/Play Game saves.
alter table public.draft_saves
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists schema_version integer not null default 2;

create index if not exists draft_saves_owner_updated_idx
  on public.draft_saves (owner_id, updated_at desc);

alter table public.draft_saves enable row level security;

drop policy if exists "public read draft_saves" on public.draft_saves;
drop policy if exists "public write draft_saves" on public.draft_saves;
drop policy if exists "Owners can read career saves" on public.draft_saves;
drop policy if exists "Owners can create career saves" on public.draft_saves;
drop policy if exists "Owners can update career saves" on public.draft_saves;
drop policy if exists "Owners can delete career saves" on public.draft_saves;

create policy "Owners can read career saves"
  on public.draft_saves for select to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can create career saves"
  on public.draft_saves for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update career saves"
  on public.draft_saves for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can delete career saves"
  on public.draft_saves for delete to authenticated
  using (auth.uid() = owner_id);
