-- Separate platform administration from church content, and add the
-- member-preparation -> church-admin review -> church feed workflow.

create table public.fellowship_preparations (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null,
  membership_id bigint not null,
  preparation_type text not null default 'program_note'
    check (preparation_type in ('program_note', 'testimony', 'prayer', 'song', 'scripture')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 2 and 5000),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'archived')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  foreign key (membership_id, church_id)
    references public.memberships (id, church_id) on delete cascade,
  check (
    (status = 'draft' and submitted_at is null and reviewed_at is null and reviewed_by is null and published_at is null)
    or (status = 'submitted' and submitted_at is not null and reviewed_at is null and reviewed_by is null and published_at is null)
    or (status = 'approved' and submitted_at is not null and reviewed_at is not null and reviewed_by is not null and published_at is not null)
    or (status = 'rejected' and submitted_at is not null and reviewed_at is not null and reviewed_by is not null and published_at is null)
    or (status = 'archived' and submitted_at is not null and reviewed_at is not null and reviewed_by is not null)
  )
);

create index fellowship_preparations_church_queue_idx
  on public.fellowship_preparations (church_id, status, submitted_at desc)
  where status = 'submitted';
create index fellowship_preparations_feed_idx
  on public.fellowship_preparations (church_id, published_at desc)
  where status = 'approved';
create index fellowship_preparations_fellowship_feed_idx
  on public.fellowship_preparations (fellowship_id, published_at desc)
  where status = 'approved';
create index fellowship_preparations_member_created_idx
  on public.fellowship_preparations (membership_id, created_at desc);
create index fellowship_preparations_reviewed_by_idx
  on public.fellowship_preparations (reviewed_by);

create table public.preparation_review_audit (
  id bigint generated always as identity primary key,
  preparation_id bigint not null references public.fellowship_preparations (id) on delete cascade,
  church_id bigint not null references public.churches (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('submitted', 'approved', 'rejected', 'archived')),
  previous_status text,
  next_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index preparation_review_audit_preparation_created_idx
  on public.preparation_review_audit (preparation_id, created_at desc);
create index preparation_review_audit_church_created_idx
  on public.preparation_review_audit (church_id, created_at desc);
create index preparation_review_audit_actor_idx
  on public.preparation_review_audit (actor_user_id);

create or replace function private.enforce_fellowship_preparation_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_author boolean;
  actor_is_admin boolean;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'A member can only create a draft or submitted preparation';
    end if;

    if not exists (
      select 1
      from public.memberships m
      where m.id = new.membership_id
        and m.church_id = new.church_id
        and m.user_id = actor_id
        and m.status = 'active'
    ) then
      raise exception 'Preparation membership must be the current active member';
    end if;

    new.title := btrim(new.title);
    new.body := btrim(new.body);
    new.submitted_at := case when new.status = 'submitted' then now() else null end;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := null;
    new.published_at := null;
    return new;
  end if;

  if new.church_id <> old.church_id
    or new.fellowship_id <> old.fellowship_id
    or new.membership_id <> old.membership_id
    or new.created_at <> old.created_at then
    raise exception 'Preparation ownership and fellowship cannot be changed';
  end if;

  select exists (
    select 1
    from public.memberships m
    where m.id = old.membership_id
      and m.church_id = old.church_id
      and m.user_id = actor_id
      and m.status = 'active'
  ) into actor_is_author;
  actor_is_admin := (select private.is_church_admin(old.church_id));

  if actor_is_author
    and old.status in ('draft', 'rejected')
    and new.status in ('draft', 'submitted') then
    new.title := btrim(new.title);
    new.body := btrim(new.body);
    new.submitted_at := case when new.status = 'submitted' then now() else null end;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := null;
    new.published_at := null;
    return new;
  end if;

  if actor_is_admin then
    if new.preparation_type is distinct from old.preparation_type
      or new.title is distinct from old.title
      or new.body is distinct from old.body then
      raise exception 'Reviewers cannot edit a member preparation';
    end if;

    if old.status = 'submitted' and new.status in ('approved', 'rejected') then
      new.submitted_at := old.submitted_at;
      new.reviewed_at := now();
      new.reviewed_by := actor_id;
      new.published_at := case when new.status = 'approved' then now() else null end;
      return new;
    end if;

    if old.status in ('approved', 'rejected') and new.status = 'archived' then
      new.submitted_at := old.submitted_at;
      new.reviewed_at := old.reviewed_at;
      new.reviewed_by := old.reviewed_by;
      new.review_note := coalesce(new.review_note, old.review_note);
      new.published_at := old.published_at;
      return new;
    end if;
  end if;

  raise exception 'This preparation status transition is not allowed';
end;
$$;

create or replace function private.audit_fellowship_preparation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.preparation_review_audit (
      preparation_id, church_id, actor_user_id, action, previous_status, next_status, note
    ) values (
      new.id, new.church_id, (select auth.uid()), 'submitted',
      case when tg_op = 'UPDATE' then old.status else null end,
      new.status, null
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status in ('approved', 'rejected', 'archived') then
    insert into public.preparation_review_audit (
      preparation_id, church_id, actor_user_id, action, previous_status, next_status, note
    ) values (
      new.id, new.church_id, (select auth.uid()), new.status,
      old.status, new.status, new.review_note
    );
  end if;
  return new;
end;
$$;

create trigger fellowship_preparations_enforce_workflow
before insert or update on public.fellowship_preparations
for each row execute function private.enforce_fellowship_preparation_workflow();

create trigger fellowship_preparations_set_updated_at
before update on public.fellowship_preparations
for each row execute function private.set_updated_at();

create trigger fellowship_preparations_audit
after insert or update of status on public.fellowship_preparations
for each row execute function private.audit_fellowship_preparation();

revoke all on function private.enforce_fellowship_preparation_workflow()
  from public, anon, authenticated, service_role;
revoke all on function private.audit_fellowship_preparation()
  from public, anon, authenticated, service_role;

alter table public.fellowship_preparations enable row level security;
alter table public.preparation_review_audit enable row level security;

create policy fellowship_preparations_select
on public.fellowship_preparations for select to authenticated
using (
  exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = fellowship_preparations.membership_id
      and own_membership.user_id = (select auth.uid())
  )
  or (select private.is_church_admin(church_id))
  or (
    status = 'approved'
    and published_at <= now()
    and (select private.is_church_member(church_id))
  )
);

create policy fellowship_preparations_insert
on public.fellowship_preparations for insert to authenticated
with check (
  exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = fellowship_preparations.membership_id
      and own_membership.church_id = fellowship_preparations.church_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
  )
);

create policy fellowship_preparations_update
on public.fellowship_preparations for update to authenticated
using (
  exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = fellowship_preparations.membership_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
  )
  or (select private.is_church_admin(church_id))
)
with check (
  exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = fellowship_preparations.membership_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
  )
  or (select private.is_church_admin(church_id))
);

create policy fellowship_preparations_delete_draft
on public.fellowship_preparations for delete to authenticated
using (
  status = 'draft'
  and exists (
    select 1
    from public.memberships own_membership
    where own_membership.id = fellowship_preparations.membership_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.status = 'active'
  )
);

create policy preparation_review_audit_select
on public.preparation_review_audit for select to authenticated
using (
  (select private.is_church_admin(church_id))
  or exists (
    select 1
    from public.fellowship_preparations preparation
    join public.memberships own_membership
      on own_membership.id = preparation.membership_id
    where preparation.id = preparation_review_audit.preparation_id
      and own_membership.user_id = (select auth.uid())
  )
);

revoke all on public.fellowship_preparations from public, anon, authenticated;
grant select, insert, update, delete on public.fellowship_preparations to authenticated;
grant usage, select on sequence public.fellowship_preparations_id_seq to authenticated;
grant select, insert, update, delete on public.fellowship_preparations to service_role;
grant usage, select on sequence public.fellowship_preparations_id_seq to service_role;

revoke all on public.preparation_review_audit from public, anon, authenticated;
grant select on public.preparation_review_audit to authenticated;
grant select on public.preparation_review_audit to service_role;

-- Platform super admins can see aggregate church health only. They no longer
-- receive direct Data API access to members, fellowships, or fellowship staff.
drop policy memberships_select on public.memberships;
create policy memberships_select
on public.memberships for select to authenticated
using ((select private.is_church_member(church_id)));

drop policy fellowships_select on public.fellowships;
create policy fellowships_select
on public.fellowships for select to authenticated
using ((select private.is_church_member(church_id)));

drop policy fellowship_staff_select on public.fellowship_staff;
create policy fellowship_staff_select
on public.fellowship_staff for select to authenticated
using ((select private.is_church_member(church_id)));

-- Only a church owner/admin can create a fellowship. An explicit coordinator
-- or scheduler may update an existing schedule, but cannot create or delete it.
drop policy fellowships_insert on public.fellowships;
create policy fellowships_insert
on public.fellowships for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
);

drop policy fellowships_update on public.fellowships;
create policy fellowships_update
on public.fellowships for update to authenticated
using (
  (select private.is_church_admin(church_id))
  or (select private.can_manage_fellowship(id, 'schedule'))
)
with check (
  (select private.is_church_admin(church_id))
  or (select private.can_manage_fellowship(id, 'schedule'))
);

drop policy fellowships_delete on public.fellowships;
create policy fellowships_delete
on public.fellowships for delete to authenticated
using ((select private.is_church_admin(church_id)));

create or replace function private.enforce_fellowship_administration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by <> (select auth.uid())
      or not (select private.is_church_admin(new.church_id)) then
      raise exception 'Only a church owner or administrator can create a fellowship';
    end if;
    return new;
  end if;

  if new.church_id <> old.church_id or new.created_by <> old.created_by then
    raise exception 'Fellowship church and creator cannot be changed';
  end if;
  return new;
end;
$$;

create trigger fellowships_enforce_administration
before insert or update on public.fellowships
for each row execute function private.enforce_fellowship_administration();

revoke all on function private.enforce_fellowship_administration()
  from public, anon, authenticated, service_role;

-- A platform-only super admin may change only platform status fields. Church
-- names and content remain under that church's owner/admin authority.
create or replace function private.enforce_church_administration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_super boolean := (select private.is_platform_super_admin());
  actor_is_church_admin boolean := (select private.is_church_admin(old.id));
begin
  if new.created_by <> old.created_by then
    raise exception 'Church creator cannot be changed';
  end if;

  if actor_is_super and not actor_is_church_admin and (
    new.name is distinct from old.name
    or new.name_ne is distinct from old.name_ne
    or new.description is distinct from old.description
    or new.address is distinct from old.address
  ) then
    raise exception 'A platform super administrator can change only church platform status';
  end if;

  if new.status is distinct from old.status then
    if not actor_is_super then
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

drop policy churches_delete on public.churches;
create policy churches_delete
on public.churches for delete to authenticated
using ((select private.is_church_owner(id)));

create or replace function private.list_admin_churches_impl()
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
security definer
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
  where (select auth.uid()) is not null
    and (
      (select private.is_platform_super_admin())
      or admin_membership.role is not null
    )
  order by c.name, c.id;
$$;

revoke all on function private.list_admin_churches_impl()
  from public, anon, authenticated, service_role;
grant execute on function private.list_admin_churches_impl()
  to authenticated;

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
  select * from private.list_admin_churches_impl();
$$;

revoke all on function public.list_admin_churches() from public, anon;
grant execute on function public.list_admin_churches() to authenticated;

-- Flattened, tenant-safe read APIs keep profile and church joins out of the
-- browser while retaining caller RLS because each public RPC is an invoker.
create or replace function public.list_preparation_feed(
  p_church_id bigint,
  p_limit integer default 50
)
returns table (
  id bigint,
  fellowship_id bigint,
  fellowship_title text,
  preparation_type text,
  title text,
  body text,
  author_name text,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    preparation.id,
    preparation.fellowship_id,
    fellowship.title,
    preparation.preparation_type,
    preparation.title,
    preparation.body,
    profile.full_name,
    preparation.published_at
  from public.fellowship_preparations preparation
  join public.fellowships fellowship on fellowship.id = preparation.fellowship_id
  join public.memberships membership on membership.id = preparation.membership_id
  join public.profiles profile on profile.id = membership.user_id
  where preparation.church_id = p_church_id
    and preparation.status = 'approved'
    and preparation.published_at <= now()
    and (select private.is_church_member(p_church_id))
  order by preparation.published_at desc, preparation.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.list_preparation_queue(
  p_church_id bigint,
  p_limit integer default 50
)
returns table (
  id bigint,
  fellowship_id bigint,
  fellowship_title text,
  preparation_type text,
  title text,
  body text,
  author_name text,
  submitted_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    preparation.id,
    preparation.fellowship_id,
    fellowship.title,
    preparation.preparation_type,
    preparation.title,
    preparation.body,
    profile.full_name,
    preparation.submitted_at
  from public.fellowship_preparations preparation
  join public.fellowships fellowship on fellowship.id = preparation.fellowship_id
  join public.memberships membership on membership.id = preparation.membership_id
  join public.profiles profile on profile.id = membership.user_id
  where preparation.church_id = p_church_id
    and preparation.status = 'submitted'
    and (select private.is_church_admin(p_church_id))
  order by preparation.submitted_at, preparation.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.list_my_preparations(
  p_membership_id bigint,
  p_limit integer default 50
)
returns table (
  id bigint,
  fellowship_id bigint,
  fellowship_title text,
  preparation_type text,
  title text,
  body text,
  status text,
  review_note text,
  submitted_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    preparation.id,
    preparation.fellowship_id,
    fellowship.title,
    preparation.preparation_type,
    preparation.title,
    preparation.body,
    preparation.status,
    preparation.review_note,
    preparation.submitted_at,
    preparation.published_at,
    preparation.updated_at
  from public.fellowship_preparations preparation
  join public.fellowships fellowship on fellowship.id = preparation.fellowship_id
  where preparation.membership_id = p_membership_id
    and exists (
      select 1
      from public.memberships own_membership
      where own_membership.id = p_membership_id
        and own_membership.user_id = (select auth.uid())
        and own_membership.status = 'active'
    )
  order by preparation.updated_at desc, preparation.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.list_preparation_feed(bigint, integer) from public, anon;
revoke all on function public.list_preparation_queue(bigint, integer) from public, anon;
revoke all on function public.list_my_preparations(bigint, integer) from public, anon;
grant execute on function public.list_preparation_feed(bigint, integer) to authenticated;
grant execute on function public.list_preparation_queue(bigint, integer) to authenticated;
grant execute on function public.list_my_preparations(bigint, integer) to authenticated;

comment on table public.fellowship_preparations is
  'Member-authored fellowship preparation. Church members see a submission only after owner/admin approval.';
comment on table public.preparation_review_audit is
  'Immutable status-transition history for fellowship preparation moderation.';
comment on function public.list_preparation_feed(bigint, integer) is
  'Approved preparation feed for active members of one church; executes with caller RLS.';
comment on function public.list_preparation_queue(bigint, integer) is
  'Submitted preparation queue for an active owner/admin of one church; executes with caller RLS.';
