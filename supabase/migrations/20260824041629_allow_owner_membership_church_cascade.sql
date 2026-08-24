-- Direct owner-membership deletion remains forbidden, but deleting the parent
-- church must be allowed to cascade all of that church's membership rows.

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
        select 1 from public.churches church
        where church.id = new.church_id
          and church.created_by = actor_id
      )
      and not exists (
        select 1 from public.memberships membership
        where membership.church_id = new.church_id
      ) then
      return new;
    end if;

    if new.role = 'owner'
      and new.status = 'active'
      and new.user_id = actor_id
      and exists (
        select 1 from public.churches church
        where church.id = new.church_id
          and church.created_by = actor_id
      )
      and not exists (
        select 1 from public.memberships membership
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
      if not exists (
        select 1 from public.churches church
        where church.id = old.church_id
      ) then
        return old;
      end if;
      raise exception 'Owner membership cannot be deleted directly';
    end if;

    if actor_role = 'owner' then
      return old;
    end if;

    if actor_role = 'admin' and old.role in ('leader', 'member') then
      return old;
    end if;

    if not exists (
      select 1 from public.churches church
      where church.id = old.church_id
    ) then
      return old;
    end if;

    raise exception 'You are not allowed to delete this membership';
  end if;

  raise exception 'Unsupported membership operation';
end;
$$;

create or replace function private.audit_membership_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from public.churches church
    where church.id = old.church_id
  ) then
    return old;
  end if;

  if tg_op = 'DELETE' then
    insert into public.membership_role_audit (
      church_id,
      membership_id,
      target_user_id,
      actor_user_id,
      operation,
      old_role,
      new_role,
      old_status,
      new_status
    ) values (
      old.church_id,
      null,
      old.user_id,
      (select auth.uid()),
      'delete',
      old.role,
      null,
      old.status,
      null
    );
    return old;
  end if;

  insert into public.membership_role_audit (
    church_id,
    membership_id,
    target_user_id,
    actor_user_id,
    operation,
    old_role,
    new_role,
    old_status,
    new_status
  ) values (
    new.church_id,
    new.id,
    new.user_id,
    (select auth.uid()),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then old.role else null end,
    case when tg_op in ('INSERT', 'UPDATE') then new.role else null end,
    case when tg_op in ('UPDATE', 'DELETE') then old.status else null end,
    case when tg_op in ('INSERT', 'UPDATE') then new.status else null end
  );
  return new;
end;
$$;

revoke all on function private.enforce_membership_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.audit_membership_mutation()
  from public, anon, authenticated, service_role;

comment on function private.enforce_membership_mutation() is
  'Protects membership roles while allowing membership deletion only as part of a parent church cascade.';

notify pgrst, 'reload schema';
