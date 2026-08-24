-- Permit the protected super-admin provisioning function to create exactly one
-- initial owner while preserving all existing owner and invitation safeguards.

create or replace function private.enforce_membership_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text;
  target_church_id bigint;
  invite_redemption boolean := coalesce(
    current_setting('church_app.invite_redemption', true) = 'on',
    false
  );
  platform_provisioning boolean := coalesce(
    current_setting('church_app.platform_provisioning', true) = 'on',
    false
  );
begin
  if tg_op = 'DELETE' then
    target_church_id := old.church_id;
  else
    target_church_id := new.church_id;
  end if;

  select membership.role
  into actor_role
  from public.memberships membership
  where membership.church_id = target_church_id
    and membership.user_id = actor_id
    and membership.status = 'active';

  if tg_op = 'INSERT' then
    if platform_provisioning
      and (select private.is_platform_super_admin())
      and new.role = 'owner'
      and new.status = 'active'
      and new.user_id <> actor_id
      and exists (
        select 1
        from public.churches church
        where church.id = new.church_id
          and church.created_by = actor_id
      )
      and not exists (
        select 1
        from public.memberships membership
        where membership.church_id = new.church_id
      ) then
      return new;
    end if;

    if new.role = 'owner'
      and new.status = 'active'
      and new.user_id = actor_id
      and exists (
        select 1
        from public.churches church
        where church.id = new.church_id
          and church.created_by = actor_id
      )
      and not exists (
        select 1
        from public.memberships membership
        where membership.church_id = new.church_id
      ) then
      return new;
    end if;

    if invite_redemption
      and new.user_id = actor_id
      and new.role in ('leader', 'member')
      and new.status = 'active' then
      return new;
    end if;

    if actor_role = 'owner' and new.role in ('admin', 'leader', 'member') then
      return new;
    end if;

    if actor_role = 'admin' and new.role in ('leader', 'member') then
      return new;
    end if;

    raise exception 'You are not allowed to create this membership role';
  end if;

  if tg_op = 'UPDATE' then
    if new.church_id <> old.church_id
      or new.user_id <> old.user_id
      or new.joined_at <> old.joined_at then
      raise exception 'Membership identity and join date cannot be changed';
    end if;

    if old.role = 'owner' then
      raise exception 'Owner membership cannot be changed directly';
    end if;

    if actor_role = 'owner' and new.role in ('admin', 'leader', 'member') then
      return new;
    end if;

    if actor_role = 'admin'
      and old.role in ('leader', 'member')
      and new.role in ('leader', 'member') then
      return new;
    end if;

    raise exception 'You are not allowed to change this membership';
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'Owner membership cannot be deleted directly';
    end if;

    if actor_role = 'owner' then
      return old;
    end if;

    if actor_role = 'admin' and old.role in ('leader', 'member') then
      return old;
    end if;

    raise exception 'You are not allowed to delete this membership';
  end if;

  raise exception 'Unsupported membership operation';
end;
$$;

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

  insert into public.churches (name, name_ne, address, created_by)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_name_ne, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    (select auth.uid())
  )
  returning id into v_church_id;

  perform set_config('church_app.platform_provisioning', 'on', true);

  insert into public.memberships (church_id, user_id, role, status)
  values (v_church_id, v_admin_user_id, 'owner', 'active');

  perform set_config('church_app.platform_provisioning', 'off', true);

  return query
  select v_church_id, trim(p_name), v_admin_user_id, v_admin_email;
end;
$$;

revoke all on function private.enforce_membership_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.provision_church(text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.provision_church(text, text, text, text)
  to authenticated;

comment on function private.provision_church(text, text, text, text) is
  'Guarded platform provisioning transaction that creates one church and one distinct initial owner.';

notify pgrst, 'reload schema';
