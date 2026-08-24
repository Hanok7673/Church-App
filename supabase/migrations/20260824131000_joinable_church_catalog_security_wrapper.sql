-- Keep the anonymous signup catalog deliberately small while avoiding an
-- elevated function in the exposed public API schema.

create or replace function private.list_joinable_churches()
returns table (
  church_id bigint,
  church_name text,
  church_name_ne text,
  address text
)
language sql
stable
security definer
set search_path = ''
as $$
  select church.id, church.name, church.name_ne, church.address
  from public.churches church
  where church.status = 'active'
  order by coalesce(church.name_ne, church.name), church.id;
$$;

create or replace function public.list_joinable_churches()
returns table (
  church_id bigint,
  church_name text,
  church_name_ne text,
  address text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_joinable_churches();
$$;

revoke all on function private.list_joinable_churches()
  from public, anon, authenticated, service_role;
grant usage on schema private to anon, authenticated;
grant execute on function private.list_joinable_churches() to anon, authenticated;

revoke all on function public.list_joinable_churches() from public;
grant execute on function public.list_joinable_churches() to anon, authenticated;

comment on function private.list_joinable_churches() is
  'Elevated implementation for the limited active-church signup catalog; private schema is not exposed by PostgREST.';
comment on function public.list_joinable_churches() is
  'Invoker wrapper exposing only active church id, name, Nepali name, and address during signup.';

notify pgrst, 'reload schema';
