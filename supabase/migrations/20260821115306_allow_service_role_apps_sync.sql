create policy "Service role manages app metadata"
on public.apps
for all
to service_role
using (true)
with check (true);

