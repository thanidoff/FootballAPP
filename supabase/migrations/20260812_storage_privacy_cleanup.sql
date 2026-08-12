-- Public buckets do not require broad SELECT policies to serve public URLs.
-- Removing these policies prevents clients from listing every stored filename.
drop policy if exists "public read player-photos" on storage.objects;
drop policy if exists "public read club-badges" on storage.objects;
drop policy if exists "public read coach-photos" on storage.objects;
