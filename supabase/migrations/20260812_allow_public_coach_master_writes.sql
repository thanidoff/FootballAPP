begin;

-- Master-data pages are intentionally editable without app authentication,
-- matching the existing player-management workflow.
drop policy if exists "public write coaches" on public.coaches;
create policy "public write coaches" on public.coaches
  for all to anon
  using (true)
  with check (true);

commit;
