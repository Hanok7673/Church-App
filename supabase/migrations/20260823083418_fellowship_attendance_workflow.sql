-- Tenant-safe fellowship attendance workflow.
-- Members can read only their own history; church admins and explicitly
-- assigned fellowship coordinators manage the roster.

create or replace function private.can_manage_fellowship(
  target_fellowship_id bigint,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_action in ('schedule', 'program', 'attendance')
    and exists (
      select 1
      from public.fellowships fellowship
      where fellowship.id = target_fellowship_id
        and (
          (select private.is_church_admin(fellowship.church_id))
          or exists (
            select 1
            from public.fellowship_staff staff
            join public.memberships membership
              on membership.id = staff.membership_id
             and membership.church_id = staff.church_id
            where staff.fellowship_id = fellowship.id
              and membership.user_id = (select auth.uid())
              and membership.status = 'active'
              and (
                staff.role = 'coordinator'
                or (requested_action = 'schedule' and staff.role = 'scheduler')
                or (requested_action = 'program' and staff.role = 'publisher')
              )
          )
        )
    );
$$;

revoke all on function private.can_manage_fellowship(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_manage_fellowship(bigint, text)
  to authenticated;

alter table public.attendance
  add column church_id bigint,
  add column marked_by uuid references public.profiles (id) on delete set null,
  add column notes text,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

update public.attendance attendance_row
set church_id = fellowship.church_id,
    marked_by = fellowship.created_by
from public.fellowships fellowship
where fellowship.id = attendance_row.fellowship_id;

alter table public.attendance
  alter column church_id set not null;

alter table public.attendance drop constraint attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check
    check (status in ('attended', 'missed', 'excused', 'unknown')),
  add constraint attendance_notes_length_check
    check (notes is null or char_length(notes) <= 500),
  add constraint attendance_fellowship_church_fkey
    foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  add constraint attendance_church_user_membership_fkey
    foreign key (church_id, user_id)
    references public.memberships (church_id, user_id) on delete cascade;

create index attendance_fellowship_church_idx
  on public.attendance (fellowship_id, church_id);
create index attendance_church_user_marked_idx
  on public.attendance (church_id, user_id, marked_at desc);
create index attendance_marked_by_idx
  on public.attendance (marked_by);

create table public.attendance_audit (
  id bigint generated always as identity primary key,
  attendance_id bigint,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('marked', 'changed', 'removed')),
  previous_status text,
  new_status text,
  occurred_at timestamptz not null default now(),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  foreign key (church_id, user_id)
    references public.memberships (church_id, user_id) on delete cascade
);

create index attendance_audit_attendance_time_idx
  on public.attendance_audit (attendance_id, occurred_at desc);
create index attendance_audit_church_time_idx
  on public.attendance_audit (church_id, occurred_at desc);
create index attendance_audit_fellowship_church_idx
  on public.attendance_audit (fellowship_id, church_id);
create index attendance_audit_church_user_idx
  on public.attendance_audit (church_id, user_id);
create index attendance_audit_user_idx
  on public.attendance_audit (user_id);
create index attendance_audit_actor_idx
  on public.attendance_audit (actor_id)
  where actor_id is not null;

alter table public.attendance_audit enable row level security;

create or replace function private.enforce_attendance_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_manage_fellowship(new.fellowship_id, 'attendance')) then
    raise exception 'Only an authorized church administrator or fellowship coordinator can mark attendance';
  end if;

  if new.status not in ('attended', 'missed', 'excused') then
    raise exception 'Recorded attendance must be attended, missed, or excused';
  end if;

  if not exists (
    select 1
    from public.fellowships fellowship
    join public.memberships membership
      on membership.church_id = fellowship.church_id
     and membership.user_id = new.user_id
     and membership.status = 'active'
    where fellowship.id = new.fellowship_id
      and fellowship.church_id = new.church_id
  ) then
    raise exception 'Attendance member and fellowship must belong to the same active church';
  end if;

  if tg_op = 'INSERT' then
    new.marked_by := (select auth.uid());
    new.marked_at := now();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id
    or new.fellowship_id <> old.fellowship_id
    or new.church_id <> old.church_id
    or new.user_id <> old.user_id
    or new.created_at <> old.created_at then
    raise exception 'Attendance church, fellowship, member, and identity fields cannot be changed';
  end if;

  new.marked_by := (select auth.uid());
  new.marked_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists attendance_enforce_workflow on public.attendance;
create trigger attendance_enforce_workflow
before insert or update on public.attendance
for each row execute function private.enforce_attendance_workflow();

create or replace function private.audit_attendance_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.attendance_audit (
    attendance_id, church_id, fellowship_id, user_id, actor_id,
    action, previous_status, new_status
  ) values (
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op = 'DELETE' then old.church_id else new.church_id end,
    case when tg_op = 'DELETE' then old.fellowship_id else new.fellowship_id end,
    case when tg_op = 'DELETE' then old.user_id else new.user_id end,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'marked' when tg_op = 'DELETE' then 'removed' else 'changed' end,
    case when tg_op = 'INSERT' then null else old.status end,
    case when tg_op = 'DELETE' then null else new.status end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_audit_workflow on public.attendance;
create trigger attendance_audit_workflow
after insert or update or delete on public.attendance
for each row execute function private.audit_attendance_workflow();

drop policy attendance_select on public.attendance;
drop policy attendance_insert on public.attendance;
drop policy attendance_update on public.attendance;
drop policy attendance_delete on public.attendance;

create policy attendance_select
on public.attendance for select to authenticated
using (
  (
    user_id = (select auth.uid())
    and (select private.is_church_member(church_id))
  )
  or (select private.can_manage_fellowship(fellowship_id, 'attendance'))
);

create policy attendance_insert
on public.attendance for insert to authenticated
with check (
  marked_by = (select auth.uid())
  and (select private.can_manage_fellowship(fellowship_id, 'attendance'))
);

create policy attendance_update
on public.attendance for update to authenticated
using ((select private.can_manage_fellowship(fellowship_id, 'attendance')))
with check ((select private.can_manage_fellowship(fellowship_id, 'attendance')));

create policy attendance_delete
on public.attendance for delete to authenticated
using ((select private.can_manage_fellowship(fellowship_id, 'attendance')));

create policy attendance_audit_select
on public.attendance_audit for select to authenticated
using ((select private.can_manage_fellowship(fellowship_id, 'attendance')));

revoke all on function private.enforce_attendance_workflow()
  from public, anon, authenticated, service_role;
revoke all on function private.audit_attendance_workflow()
  from public, anon, authenticated, service_role;

revoke all on public.attendance_audit from anon, authenticated;
grant select on public.attendance_audit to authenticated;
grant select on public.attendance_audit to service_role;

create or replace function public.list_fellowship_attendance(
  p_fellowship_id bigint
)
returns table (
  membership_id bigint,
  user_id uuid,
  member_name text,
  membership_role text,
  attendance_id bigint,
  attendance_status text,
  attendance_notes text,
  marked_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    membership.id,
    membership.user_id,
    profile.full_name,
    membership.role,
    attendance_row.id,
    coalesce(attendance_row.status, 'unknown'),
    attendance_row.notes,
    attendance_row.marked_at
  from public.fellowships fellowship
  join public.memberships membership
    on membership.church_id = fellowship.church_id
   and membership.status = 'active'
  join public.profiles profile on profile.id = membership.user_id
  left join public.attendance attendance_row
    on attendance_row.fellowship_id = fellowship.id
   and attendance_row.church_id = fellowship.church_id
   and attendance_row.user_id = membership.user_id
  where fellowship.id = p_fellowship_id
    and (select private.can_manage_fellowship(p_fellowship_id, 'attendance'))
  order by profile.full_name, membership.id;
$$;

create or replace function public.list_my_attendance(
  p_church_id bigint,
  p_limit integer default 100
)
returns table (
  attendance_id bigint,
  fellowship_id bigint,
  fellowship_title text,
  fellowship_starts_at timestamptz,
  attendance_status text,
  attendance_notes text,
  marked_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    attendance_row.id,
    attendance_row.fellowship_id,
    fellowship.title,
    fellowship.starts_at,
    attendance_row.status,
    attendance_row.notes,
    attendance_row.marked_at
  from public.attendance attendance_row
  join public.fellowships fellowship on fellowship.id = attendance_row.fellowship_id
  where attendance_row.church_id = p_church_id
    and attendance_row.user_id = (select auth.uid())
    and (select private.is_church_member(p_church_id))
  order by fellowship.starts_at desc, attendance_row.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

revoke all on function public.list_fellowship_attendance(bigint) from public, anon;
revoke all on function public.list_my_attendance(bigint, integer) from public, anon;
grant execute on function public.list_fellowship_attendance(bigint) to authenticated;
grant execute on function public.list_my_attendance(bigint, integer) to authenticated;

comment on table public.attendance_audit is
  'Immutable tenant-scoped history of attendance marking, changes, and removal.';
comment on function public.list_fellowship_attendance(bigint) is
  'Returns the active same-church member roster only to authorized attendance managers.';
comment on function public.list_my_attendance(bigint, integer) is
  'Returns only the authenticated active member own attendance history in one church.';
comment on function private.can_manage_fellowship(bigint, text) is
  'Checks church-admin or explicit fellowship-scoped schedule, program, or attendance authority.';

notify pgrst, 'reload schema';
