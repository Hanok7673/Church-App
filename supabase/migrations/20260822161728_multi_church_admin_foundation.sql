create table public.platform_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role = 'super_admin'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index platform_roles_created_by_idx
  on public.platform_roles (created_by);

create or replace function private.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.platform_roles pr
      where pr.user_id = (select auth.uid())
        and pr.role = 'super_admin'
    );
$$;

revoke all on function private.is_platform_super_admin()
  from public, anon, authenticated, service_role;

alter table public.churches
  add column status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  add column status_changed_at timestamptz,
  add column status_changed_by uuid references public.profiles (id) on delete set null;

create index churches_status_idx on public.churches (status);
create index churches_status_changed_by_idx on public.churches (status_changed_by);

create table public.church_status_audit (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  old_status text not null check (old_status in ('active', 'suspended', 'archived')),
  new_status text not null check (new_status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now()
);

create index church_status_audit_church_created_idx
  on public.church_status_audit (church_id, created_at desc);
create index church_status_audit_actor_user_id_idx
  on public.church_status_audit (actor_user_id);

create or replace function private.enforce_church_administration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by <> old.created_by then
    raise exception 'Church creator cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if not (select private.is_platform_super_admin()) then
      raise exception 'Only a platform super administrator can change church status';
    end if;

    new.status_changed_at := now();
    new.status_changed_by := (select auth.uid());
  else
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_church_administration()
  from public, anon, authenticated, service_role;

create or replace function private.audit_church_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.church_status_audit (
      church_id,
      actor_user_id,
      old_status,
      new_status
    ) values (
      new.id,
      (select auth.uid()),
      old.status,
      new.status
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_church_status()
  from public, anon, authenticated, service_role;

create trigger churches_enforce_administration
before update on public.churches
for each row execute function private.enforce_church_administration();

create trigger churches_audit_status
after update of status on public.churches
for each row execute function private.audit_church_status();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'memberships_id_church_unique'
      and conrelid = 'public.memberships'::regclass
  ) then
    alter table public.memberships
      add constraint memberships_id_church_unique unique (id, church_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fellowships_id_church_unique'
      and conrelid = 'public.fellowships'::regclass
  ) then
    alter table public.fellowships
      add constraint fellowships_id_church_unique unique (id, church_id);
  end if;
end;
$$;

create table public.fellowship_staff (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null,
  membership_id bigint not null,
  role text not null check (role in ('coordinator', 'scheduler', 'publisher')),
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fellowship_id, membership_id),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  foreign key (membership_id, church_id)
    references public.memberships (id, church_id) on delete cascade
);

create index fellowship_staff_church_role_idx
  on public.fellowship_staff (church_id, role);
create index fellowship_staff_membership_id_idx
  on public.fellowship_staff (membership_id);
create index fellowship_staff_assigned_by_idx
  on public.fellowship_staff (assigned_by);

create trigger fellowship_staff_set_updated_at
before update on public.fellowship_staff
for each row execute function private.set_updated_at();

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
  select requested_action in ('schedule', 'program')
    and exists (
      select 1
      from public.fellowships f
      where f.id = target_fellowship_id
        and (
          (select private.is_church_admin(f.church_id))
          or exists (
            select 1
            from public.fellowship_staff fs
            join public.memberships m
              on m.id = fs.membership_id
             and m.church_id = fs.church_id
            where fs.fellowship_id = f.id
              and m.user_id = (select auth.uid())
              and m.status = 'active'
              and (
                fs.role = 'coordinator'
                or (requested_action = 'schedule' and fs.role = 'scheduler')
                or (requested_action = 'program' and fs.role = 'publisher')
              )
          )
        )
    );
$$;

revoke all on function private.can_manage_fellowship(bigint, text)
  from public, anon, authenticated, service_role;

drop policy churches_select on public.churches;
create policy churches_select
on public.churches for select to authenticated
using (
  (select private.is_platform_super_admin())
  or (select private.is_church_member(id))
);

drop policy churches_update on public.churches;
create policy churches_update
on public.churches for update to authenticated
using (
  (select private.is_platform_super_admin())
  or (select private.is_church_admin(id))
)
with check (
  (select private.is_platform_super_admin())
  or (select private.is_church_admin(id))
);

drop policy churches_delete on public.churches;
create policy churches_delete
on public.churches for delete to authenticated
using (
  (select private.is_platform_super_admin())
  or (select private.is_church_owner(id))
);

drop policy memberships_select on public.memberships;
create policy memberships_select
on public.memberships for select to authenticated
using (
  (select private.is_platform_super_admin())
  or (select private.is_church_member(church_id))
);

drop policy fellowships_select on public.fellowships;
create policy fellowships_select
on public.fellowships for select to authenticated
using (
  (select private.is_platform_super_admin())
  or (select private.is_church_member(church_id))
);

alter table public.platform_roles enable row level security;
alter table public.church_status_audit enable row level security;
alter table public.fellowship_staff enable row level security;

create policy platform_roles_select_own
on public.platform_roles for select to authenticated
using (user_id = (select auth.uid()));

create policy church_status_audit_select
on public.church_status_audit for select to authenticated
using (
  (select private.is_platform_super_admin())
  or (select private.is_church_admin(church_id))
);

create policy fellowship_staff_select
on public.fellowship_staff for select to authenticated
using (
  (select private.is_platform_super_admin())
  or (select private.is_church_member(church_id))
);

create policy fellowship_staff_insert
on public.fellowship_staff for insert to authenticated
with check (
  assigned_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
  and exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and m.church_id = fellowship_staff.church_id
      and m.status = 'active'
  )
);

create policy fellowship_staff_update
on public.fellowship_staff for update to authenticated
using ((select private.is_church_admin(church_id)))
with check (
  assigned_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
  and exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and m.church_id = fellowship_staff.church_id
      and m.status = 'active'
  )
);

create policy fellowship_staff_delete
on public.fellowship_staff for delete to authenticated
using ((select private.is_church_admin(church_id)));

revoke all on public.platform_roles from anon, authenticated;
grant select on public.platform_roles to authenticated;
grant select, insert, update, delete on public.platform_roles to service_role;

revoke all on public.church_status_audit from anon, authenticated;
grant select on public.church_status_audit to authenticated;
grant select on public.church_status_audit to service_role;

revoke all on public.fellowship_staff from anon, authenticated;
grant select, insert, update, delete on public.fellowship_staff to authenticated;
grant usage, select on sequence public.fellowship_staff_id_seq to authenticated;
grant select, insert, update, delete on public.fellowship_staff to service_role;
grant usage, select on sequence public.fellowship_staff_id_seq to service_role;

create or replace function public.list_admin_churches()
returns table (
  church_id bigint,
  church_name text,
  church_name_ne text,
  address text,
  status text,
  my_role text,
  member_count bigint,
  fellowship_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.name_ne,
    c.address,
    c.status,
    case
      when (select private.is_platform_super_admin()) then 'super_admin'
      else admin_membership.role
    end,
    (select count(*) from public.memberships cm where cm.church_id = c.id and cm.status = 'active'),
    (select count(*) from public.fellowships cf where cf.church_id = c.id and cf.status <> 'cancelled'),
    c.created_at,
    c.updated_at
  from public.churches c
  left join lateral (
    select m.role
    from public.memberships m
    where m.church_id = c.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'admin')
    limit 1
  ) admin_membership on true
  where (select private.is_platform_super_admin())
     or admin_membership.role is not null
  order by c.name, c.id;
$$;

revoke all on function public.list_admin_churches()
  from public, anon;
grant execute on function public.list_admin_churches()
  to authenticated;

comment on table public.platform_roles is
  'Server-managed global platform roles. Normal users cannot create or change these rows.';
comment on table public.fellowship_staff is
  'Tenant-safe, fellowship-scoped permissions for schedule and program publishing.';
comment on function private.can_manage_fellowship(bigint, text) is
  'Checks church-admin or explicit fellowship-scoped schedule/program authority.';
comment on function public.list_admin_churches() is
  'RLS-enforced admin overview: all churches for super admins, assigned churches for church owners/admins.';
