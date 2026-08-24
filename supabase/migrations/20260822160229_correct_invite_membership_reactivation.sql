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
begin
  if tg_op = 'DELETE' then
    target_church_id := old.church_id;
  else
    target_church_id := new.church_id;
  end if;

  select m.role
  into actor_role
  from public.memberships m
  where m.church_id = target_church_id
    and m.user_id = actor_id
    and m.status = 'active';

  if tg_op = 'INSERT' then
    if new.role = 'owner'
      and new.status = 'active'
      and new.user_id = actor_id
      and exists (
        select 1 from public.churches c
        where c.id = new.church_id and c.created_by = actor_id
      )
      and not exists (
        select 1 from public.memberships m where m.church_id = new.church_id
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

    if invite_redemption
      and old.user_id = actor_id
      and new.user_id = actor_id
      and old.role in ('leader', 'member')
      and new.role in ('leader', 'member')
      and old.status = 'inactive'
      and new.status = 'active' then
      return new;
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

revoke all on function private.enforce_membership_mutation()
  from public, anon, authenticated, service_role;

create or replace function private.redeem_church_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_invite public.church_invites%rowtype;
  existing_membership public.memberships%rowtype;
  redeemed_membership_id bigint;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'Invitation redemption requires the current signed-in user';
  end if;

  if new.submitted_code_hash is null
    or new.submitted_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation code is invalid or expired';
  end if;

  select *
  into target_invite
  from public.church_invites ci
  where ci.code_hash = new.submitted_code_hash
  for update;

  if not found
    or target_invite.revoked_at is not null
    or target_invite.expires_at <= now()
    or target_invite.use_count >= target_invite.max_uses then
    raise exception 'Invitation code is invalid or expired';
  end if;

  select *
  into existing_membership
  from public.memberships m
  where m.church_id = target_invite.church_id
    and m.user_id = new.user_id;

  if found and existing_membership.status = 'active' then
    raise exception 'You already have an active membership in this church';
  end if;

  if found and existing_membership.role in ('owner', 'admin') then
    raise exception 'An owner must restore this membership';
  end if;

  perform set_config('church_app.invite_redemption', 'on', true);

  insert into public.memberships (church_id, user_id, role, status)
  values (target_invite.church_id, new.user_id, target_invite.role, 'active')
  on conflict (church_id, user_id) do update
  set role = case
      when public.memberships.role = 'leader' then 'leader'
      else excluded.role
    end,
    status = 'active',
    joined_at = public.memberships.joined_at
  returning id into redeemed_membership_id;

  perform set_config('church_app.invite_redemption', 'off', true);

  update public.church_invites
  set use_count = use_count + 1,
      revoked_at = case
        when use_count + 1 >= max_uses then coalesce(revoked_at, now())
        else revoked_at
      end
  where id = target_invite.id;

  new.invite_id := target_invite.id;
  new.church_id := target_invite.church_id;
  new.membership_id := redeemed_membership_id;
  new.submitted_code_hash := null;
  return new;
end;
$$;

revoke all on function private.redeem_church_invite()
  from public, anon, authenticated, service_role;
