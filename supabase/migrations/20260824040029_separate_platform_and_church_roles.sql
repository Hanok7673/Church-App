-- Separate global platform administration from church-scoped administration.
-- New Auth users receive no elevated role. A platform super admin provisions a
-- church and assigns a different, confirmed account as its initial owner.

drop trigger if exists on_church_created on public.churches;

drop policy if exists churches_insert on public.churches;

-- Church rows are created only through provision_church(). Removing the table
-- INSERT grant prevents a browser client from bypassing initial-admin checks.
revoke insert on public.churches from authenticated;

create or replace function private.enforce_platform_church_role_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from auth.users auth_user
  where auth_user.id = new.user_id
  for update;

  if exists (
    select 1
    from public.memberships membership
    where membership.user_id = new.user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  ) then
    raise exception 'A platform super administrator cannot also be a church owner or administrator';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_membership_platform_role_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and new.role in ('owner', 'admin') then
    perform 1
    from auth.users auth_user
    where auth_user.id = new.user_id
    for update;

    if exists (
      select 1
      from public.platform_roles platform_role
      where platform_role.user_id = new.user_id
        and platform_role.role = 'super_admin'
    ) then
      raise exception 'A church owner or administrator cannot also be a platform super administrator';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists platform_roles_enforce_role_separation on public.platform_roles;
create trigger platform_roles_enforce_role_separation
before insert or update on public.platform_roles
for each row execute function private.enforce_platform_church_role_separation();

drop trigger if exists memberships_enforce_platform_role_separation on public.memberships;
create trigger memberships_enforce_platform_role_separation
before insert or update of user_id, role, status on public.memberships
for each row execute function private.enforce_membership_platform_role_separation();

create or replace function private.provision_church(
  p_name text,
  p_admin_email text,
  p_name_ne text default null,
  p_address text default null
)
returns table (
  church_id bigint,
  church_name text,
  admin_user_id uuid,
  admin_email text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user_id uuid;
  v_admin_email text;
  v_email_confirmed_at timestamptz;
  v_church_id bigint;
begin
  if not (select private.is_platform_super_admin()) then
    raise exception 'Only a platform super administrator can register a church';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Church name must contain at least three characters';
  end if;

  if char_length(trim(coalesce(p_name, ''))) > 200
    or char_length(trim(coalesce(p_name_ne, ''))) > 200
    or char_length(trim(coalesce(p_address, ''))) > 500 then
    raise exception 'Church name or address exceeds the allowed length';
  end if;

  select auth_user.id, auth_user.email, auth_user.email_confirmed_at
  into v_admin_user_id, v_admin_email, v_email_confirmed_at
  from auth.users auth_user
  where lower(auth_user.email) = lower(trim(coalesce(p_admin_email, '')))
    and auth_user.deleted_at is null
  limit 1
  for update;

  if v_admin_user_id is null then
    raise exception 'No active account exists for the church administrator email';
  end if;

  if v_email_confirmed_at is null then
    raise exception 'The church administrator email must be confirmed first';
  end if;

  if v_admin_user_id = (select auth.uid())
    or exists (
      select 1
      from public.platform_roles platform_role
      where platform_role.user_id = v_admin_user_id
        and platform_role.role = 'super_admin'
    ) then
    raise exception 'The platform super administrator and church administrator must be different accounts';
  end if;

  insert into public.churches (
    name,
    name_ne,
    address,
    created_by
  ) values (
    trim(p_name),
    nullif(trim(coalesce(p_name_ne, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    (select auth.uid())
  )
  returning id into v_church_id;

  insert into public.memberships (
    church_id,
    user_id,
    role,
    status
  ) values (
    v_church_id,
    v_admin_user_id,
    'owner',
    'active'
  );

  return query
  select v_church_id, trim(p_name), v_admin_user_id, v_admin_email;
end;
$$;

create or replace function public.provision_church(
  p_name text,
  p_admin_email text,
  p_name_ne text default null,
  p_address text default null
)
returns table (
  church_id bigint,
  church_name text,
  admin_user_id uuid,
  admin_email text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.provision_church(p_name, p_admin_email, p_name_ne, p_address);
$$;

revoke all on function private.enforce_platform_church_role_separation()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_membership_platform_role_separation()
  from public, anon, authenticated, service_role;
revoke all on function private.provision_church(text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.provision_church(text, text, text, text)
  to authenticated;

revoke all on function public.provision_church(text, text, text, text)
  from public, anon;
grant execute on function public.provision_church(text, text, text, text)
  to authenticated;

comment on function public.provision_church(text, text, text, text) is
  'Super-admin-only church registration that assigns a different confirmed account as the initial church owner.';
comment on function private.enforce_platform_church_role_separation() is
  'Prevents one active account from combining platform super-admin and church owner/admin authority.';
comment on function private.enforce_membership_platform_role_separation() is
  'Prevents an active church owner/admin membership from being assigned to a platform super admin.';

notify pgrst, 'reload schema';
