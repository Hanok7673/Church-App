alter table public.assignments
  add column status text not null default 'assigned'
    check (status in ('assigned', 'accepted', 'declined', 'completed')),
  add column responded_at timestamptz,
  add column completed_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint assignments_notes_length_check
    check (notes is null or char_length(notes) <= 2000),
  add constraint assignments_status_timestamps_check
    check (
      (status = 'assigned' and responded_at is null and completed_at is null)
      or (status in ('accepted', 'declined') and responded_at is not null and completed_at is null)
      or (status = 'completed' and responded_at is not null and completed_at is not null)
    );

create index assignments_member_status_created_idx
  on public.assignments (member_membership_id, status, created_at desc);

create index assignments_fellowship_status_idx
  on public.assignments (fellowship_id, status);

create table public.assignment_audit (
  id bigint generated always as identity primary key,
  assignment_id bigint references public.assignments (id) on delete set null,
  church_id bigint not null references public.churches (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null
    check (action in ('assigned', 'accepted', 'declined', 'completed', 'notes_updated', 'removed')),
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create index assignment_audit_assignment_created_idx
  on public.assignment_audit (assignment_id, created_at desc);
create index assignment_audit_church_created_idx
  on public.assignment_audit (church_id, created_at desc);
create index assignment_audit_target_user_idx
  on public.assignment_audit (target_user_id);
create index assignment_audit_actor_user_idx
  on public.assignment_audit (actor_user_id);

create or replace function private.enforce_assignment_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_member boolean;
  actor_can_manage boolean;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  if tg_op = 'INSERT' then
    if not (select private.can_manage_fellowship(new.fellowship_id, 'program')) then
      raise exception 'Only an authorized church program manager can assign a role';
    end if;
    if new.assigned_by <> actor_id then
      raise exception 'Assignment actor must be the current user';
    end if;
    new.status := 'assigned';
    new.responded_at := null;
    new.completed_at := null;
    new.notes := nullif(btrim(new.notes), '');
    return new;
  end if;

  if new.fellowship_id <> old.fellowship_id
    or new.member_membership_id <> old.member_membership_id
    or new.ministry_role_id <> old.ministry_role_id
    or new.assigned_by <> old.assigned_by
    or new.created_at <> old.created_at then
    raise exception 'Assignment identity cannot be changed';
  end if;

  select exists (
    select 1
    from public.memberships membership
    where membership.id = old.member_membership_id
      and membership.user_id = actor_id
      and membership.status = 'active'
  ) into actor_is_member;
  actor_can_manage := (select private.can_manage_fellowship(old.fellowship_id, 'program'));

  if actor_is_member then
    if old.status = 'assigned' and new.status in ('accepted', 'declined') then
      new.notes := old.notes;
      new.responded_at := now();
      new.completed_at := null;
      return new;
    end if;
    if old.status = 'accepted' and new.status = 'declined' then
      new.notes := old.notes;
      new.responded_at := now();
      new.completed_at := null;
      return new;
    end if;
  end if;

  if actor_can_manage then
    new.notes := nullif(btrim(new.notes), '');
    if new.status = old.status then
      new.responded_at := old.responded_at;
      new.completed_at := old.completed_at;
      return new;
    end if;
    if new.status = 'assigned' then
      new.responded_at := null;
      new.completed_at := null;
      return new;
    end if;
    if old.status = 'accepted' and new.status = 'completed' then
      new.responded_at := old.responded_at;
      new.completed_at := now();
      return new;
    end if;
  end if;

  raise exception 'This assignment transition is not allowed';
end;
$$;

create or replace function private.audit_assignment_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_assignment public.assignments%rowtype;
  target_church_id bigint;
  target_user uuid;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    source_assignment := old;
  else
    source_assignment := new;
  end if;

  select fellowship.church_id, membership.user_id
  into target_church_id, target_user
  from public.fellowships fellowship
  join public.memberships membership
    on membership.id = source_assignment.member_membership_id
  where fellowship.id = source_assignment.fellowship_id;

  if tg_op = 'INSERT' then
    audit_action := 'assigned';
  elsif tg_op = 'DELETE' then
    audit_action := 'removed';
  elsif old.status is distinct from new.status then
    audit_action := new.status;
  elsif old.notes is distinct from new.notes then
    audit_action := 'notes_updated';
  else
    return source_assignment;
  end if;

  insert into public.assignment_audit (
    assignment_id,
    church_id,
    target_user_id,
    actor_user_id,
    action,
    old_status,
    new_status
  ) values (
    case when tg_op = 'DELETE' then null else source_assignment.id end,
    target_church_id,
    target_user,
    (select auth.uid()),
    audit_action,
    case when tg_op in ('UPDATE', 'DELETE') then old.status else null end,
    case when tg_op in ('INSERT', 'UPDATE') then new.status else null end
  );

  return source_assignment;
end;
$$;

create trigger assignments_enforce_workflow
before insert or update on public.assignments
for each row execute function private.enforce_assignment_workflow();

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function private.set_updated_at();

create trigger assignments_audit_workflow
after insert or update or delete on public.assignments
for each row execute function private.audit_assignment_workflow();

revoke all on function private.enforce_assignment_workflow()
  from public, anon, authenticated, service_role;
revoke all on function private.audit_assignment_workflow()
  from public, anon, authenticated, service_role;

drop policy assignments_select on public.assignments;
create policy assignments_select
on public.assignments for select to authenticated
using (
  exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = assignments.member_membership_id
      and own_membership.user_id = (select auth.uid())
  )
  or (select private.can_manage_fellowship(fellowship_id, 'program'))
);

drop policy assignments_insert on public.assignments;
create policy assignments_insert
on public.assignments for insert to authenticated
with check (
  assigned_by = (select auth.uid())
  and (select private.can_manage_fellowship(fellowship_id, 'program'))
);

drop policy assignments_update on public.assignments;
create policy assignments_update
on public.assignments for update to authenticated
using (
  exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = assignments.member_membership_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
  )
  or (select private.can_manage_fellowship(fellowship_id, 'program'))
)
with check (
  exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = assignments.member_membership_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
  )
  or (select private.can_manage_fellowship(fellowship_id, 'program'))
);

drop policy assignments_delete on public.assignments;
create policy assignments_delete
on public.assignments for delete to authenticated
using ((select private.can_manage_fellowship(fellowship_id, 'program')));

alter table public.assignment_audit enable row level security;

create policy assignment_audit_select
on public.assignment_audit for select to authenticated
using (
  target_user_id = (select auth.uid())
  or (select private.is_church_admin(church_id))
);

revoke all on public.assignment_audit from public, anon, authenticated;
grant select on public.assignment_audit to authenticated;
grant select on public.assignment_audit to service_role;

revoke all on public.assignments from anon, authenticated;
grant select, insert, update, delete on public.assignments to authenticated;

create or replace function public.list_my_assignments(
  p_membership_id bigint,
  p_limit integer default 100
)
returns table (
  assignment_id bigint,
  fellowship_id bigint,
  fellowship_title text,
  location_name text,
  address text,
  starts_at timestamptz,
  ends_at timestamptz,
  fellowship_status text,
  ministry_role_id bigint,
  ministry_role_code text,
  ministry_role_name_ne text,
  notes text,
  assignment_status text,
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    assignment.id,
    fellowship.id,
    fellowship.title,
    fellowship.location_name,
    fellowship.address,
    fellowship.starts_at,
    fellowship.ends_at,
    fellowship.status,
    ministry_role.id,
    ministry_role.code,
    ministry_role.name_ne,
    assignment.notes,
    assignment.status,
    assignment.responded_at,
    assignment.completed_at,
    assignment.created_at,
    assignment.updated_at
  from public.assignments assignment
  join public.fellowships fellowship on fellowship.id = assignment.fellowship_id
  join public.ministry_roles ministry_role on ministry_role.id = assignment.ministry_role_id
  where assignment.member_membership_id = p_membership_id
    and exists (
      select 1
      from public.memberships own_membership
      where own_membership.id = p_membership_id
        and own_membership.user_id = (select auth.uid())
        and own_membership.status = 'active'
    )
  order by fellowship.starts_at desc, assignment.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

create or replace function public.list_fellowship_assignments(
  p_fellowship_id bigint
)
returns table (
  assignment_id bigint,
  member_membership_id bigint,
  member_name text,
  ministry_role_id bigint,
  ministry_role_code text,
  ministry_role_name_ne text,
  notes text,
  assignment_status text,
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    assignment.id,
    membership.id,
    profile.full_name,
    ministry_role.id,
    ministry_role.code,
    ministry_role.name_ne,
    assignment.notes,
    assignment.status,
    assignment.responded_at,
    assignment.completed_at,
    assignment.created_at
  from public.assignments assignment
  join public.memberships membership on membership.id = assignment.member_membership_id
  join public.profiles profile on profile.id = membership.user_id
  join public.ministry_roles ministry_role on ministry_role.id = assignment.ministry_role_id
  where assignment.fellowship_id = p_fellowship_id
    and (select private.can_manage_fellowship(p_fellowship_id, 'program'))
  order by ministry_role.sort_order, profile.full_name, assignment.id;
$$;

revoke all on function public.list_my_assignments(bigint, integer) from public, anon;
revoke all on function public.list_fellowship_assignments(bigint) from public, anon;
grant execute on function public.list_my_assignments(bigint, integer) to authenticated;
grant execute on function public.list_fellowship_assignments(bigint) to authenticated;

comment on table public.assignment_audit is
  'Immutable assignment lifecycle history visible only to the assigned member and church administrators.';
comment on function public.list_my_assignments(bigint, integer) is
  'Returns only the current authenticated member assignment history through caller RLS.';
comment on function public.list_fellowship_assignments(bigint) is
  'Returns a fellowship assignment roster only to church admins or explicitly authorized program staff.';
