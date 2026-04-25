-- Storage buckets for images
insert into storage.buckets (id, name, public)
values
  ('player-photos', 'player-photos', true),
  ('club-badges',   'club-badges',   true)
on conflict (id) do nothing;

-- Public read policies
create policy "public read player-photos"
  on storage.objects for select
  using (bucket_id = 'player-photos');

create policy "public upload player-photos"
  on storage.objects for insert
  with check (bucket_id = 'player-photos');

create policy "public update player-photos"
  on storage.objects for update
  using (bucket_id = 'player-photos');

create policy "public delete player-photos"
  on storage.objects for delete
  using (bucket_id = 'player-photos');

create policy "public read club-badges"
  on storage.objects for select
  using (bucket_id = 'club-badges');

create policy "public upload club-badges"
  on storage.objects for insert
  with check (bucket_id = 'club-badges');

create policy "public update club-badges"
  on storage.objects for update
  using (bucket_id = 'club-badges');

create policy "public delete club-badges"
  on storage.objects for delete
  using (bucket_id = 'club-badges');

-- Add image columns to existing tables
alter table players add column if not exists photo_url text;
alter table clubs   add column if not exists badge_url text;
