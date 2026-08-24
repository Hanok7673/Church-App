create table public.membership_role_audit (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  membership_id bigint references public.memberships (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  old_role text check (old_role is null or old_role in ('owner', 'admin', 'leader', 'member')),
  new_role text check (new_role is null or new_role in ('owner', 'admin', 'leader', 'member')),
  old_status text check (old_status is null or old_status in ('invited', 'active', 'inactive')),
  new_status text check (new_status is null or new_status in ('invited', 'active', 'inactive')),
  created_at timestamptz not null default now()
);

create index membership_role_audit_church_created_idx
  on public.membership_role_audit (church_id, created_at desc);
create index membership_role_audit_membership_id_idx
  on public.membership_role_audit (membership_id);
create index membership_role_audit_target_user_id_idx
  on public.membership_role_audit (target_user_id);
create index membership_role_audit_actor_user_id_idx
  on public.membership_role_audit (actor_user_id);

create or replace function private.is_church_owner(target_church_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.memberships m
      where m.church_id = target_church_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role = 'owner'
    );
$$;

revoke all on function private.is_church_owner(bigint)
  from public, anon, authenticated, service_role;

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

create or replace function private.audit_membership_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke all on function private.audit_membership_mutation()
  from public, anon, authenticated, service_role;

create trigger memberships_enforce_mutation
before insert or update or delete on public.memberships
for each row execute function private.enforce_membership_mutation();

create trigger memberships_audit_mutation
after insert or update or delete on public.memberships
for each row execute function private.audit_membership_mutation();

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

  perform set_config('church_app.invite_redemption', 'on', true);

  insert into public.memberships (church_id, user_id, role, status)
  values (target_invite.church_id, new.user_id, target_invite.role, 'active')
  on conflict (church_id, user_id) do update
  set role = case
      when public.memberships.role = 'owner' then 'owner'
      when public.memberships.role = 'admin' then 'admin'
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

alter table public.membership_role_audit enable row level security;

create policy membership_role_audit_select
on public.membership_role_audit
for select to authenticated
using (
  target_user_id = (select auth.uid())
  or (select private.is_church_admin(church_id))
);

revoke all on public.membership_role_audit from anon, authenticated;
grant select on public.membership_role_audit to authenticated;

create or replace function public.list_church_members(
  p_church_id bigint,
  p_search_text text default '',
  p_page_size integer default 50,
  p_page_offset integer default 0
)
returns table (
  membership_id bigint,
  user_id uuid,
  full_name text,
  avatar_url text,
  role text,
  joined_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.user_id,
    p.full_name,
    p.avatar_url,
    m.role,
    m.joined_at,
    count(*) over ()
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.church_id = p_church_id
    and m.status = 'active'
    and (
      nullif(btrim(p_search_text), '') is null
      or p.full_name ilike '%' || btrim(p_search_text) || '%'
    )
  order by p.full_name, m.id
  limit least(greatest(coalesce(p_page_size, 50), 1), 100)
  offset greatest(coalesce(p_page_offset, 0), 0);
$$;

revoke all on function public.list_church_members(bigint, text, integer, integer)
  from public, anon;
grant execute on function public.list_church_members(bigint, text, integer, integer)
  to authenticated;

comment on table public.membership_role_audit is
  'Immutable audit log for membership creation, role/status changes, and deletion.';
comment on function public.list_church_members(bigint, text, integer, integer) is
  'RLS-enforced same-church directory returning only public profile and active membership fields.';
