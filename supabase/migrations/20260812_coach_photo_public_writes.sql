-- Coach master data is editable from the same public admin UI as players and
-- clubs, so its public image bucket must use the same write permissions.
drop policy if exists "authenticated upload coach-photos" on storage.objects;
drop policy if exists "authenticated update coach-photos" on storage.objects;
drop policy if exists "authenticated delete coach-photos" on storage.objects;
drop policy if exists "public upload coach-photos" on storage.objects;
drop policy if exists "public update coach-photos" on storage.objects;
drop policy if exists "public delete coach-photos" on storage.objects;

create policy "public upload coach-photos"
  on storage.objects for insert
  with check (bucket_id = 'coach-photos');

create policy "public update coach-photos"
  on storage.objects for update
  using (bucket_id = 'coach-photos')
  with check (bucket_id = 'coach-photos');

create policy "public delete coach-photos"
  on storage.objects for delete
  using (bucket_id = 'coach-photos');
