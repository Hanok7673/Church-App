-- Show and authorize fellowship preparation posting only for church leaders,
-- church administrators, fellowship staff, or members with an active
-- responsibility in the selected fellowship.

create or replace function private.can_post_fellowship_preparation(
  target_membership_id bigint,
  target_fellowship_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.memberships membership
      join public.fellowships fellowship
        on fellowship.id = target_fellowship_id
       and fellowship.church_id = membership.church_id
       and fellowship.status <> 'cancelled'
      where membership.id = target_membership_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and (
          membership.role in ('owner', 'admin', 'leader')
          or exists (
            select 1
            from public.fellowship_staff staff
            where staff.fellowship_id = fellowship.id
              and staff.church_id = membership.church_id
              and staff.membership_id = membership.id
          )
          or exists (
            select 1
            from public.assignments assignment
            where assignment.fellowship_id = fellowship.id
              and assignment.member_membership_id = membership.id
              and assignment.status in ('assigned', 'accepted')
          )
        )
    );
$$;

create or replace function private.enforce_preparation_posting_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_author boolean;
begin
  select exists (
    select 1
    from public.memberships membership
    where membership.id = new.membership_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  ) into actor_is_author;

  if actor_is_author
    and not (select private.can_post_fellowship_preparation(new.membership_id, new.fellowship_id)) then
    raise exception 'Preparation posting requires a church leadership role, fellowship post, or active responsibility';
  end if;

  return new;
end;
$$;

drop trigger if exists fellowship_preparations_posting_eligibility
  on public.fellowship_preparations;
create trigger fellowship_preparations_posting_eligibility
before insert or update on public.fellowship_preparations
for each row execute function private.enforce_preparation_posting_eligibility();

drop policy if exists fellowship_preparations_insert on public.fellowship_preparations;
create policy fellowship_preparations_insert
on public.fellowship_preparations for insert to authenticated
with check (
  (select private.can_post_fellowship_preparation(membership_id, fellowship_id))
);

drop policy if exists fellowship_preparations_update on public.fellowship_preparations;
create policy fellowship_preparations_update
on public.fellowship_preparations for update to authenticated
using (
  (
    exists (
      select 1
      from public.memberships own_membership
      where own_membership.id = fellowship_preparations.membership_id
        and own_membership.user_id = (select auth.uid())
        and own_membership.status = 'active'
    )
    and (select private.can_post_fellowship_preparation(membership_id, fellowship_id))
  )
  or (select private.is_church_admin(church_id))
)
with check (
  (
    exists (
      select 1
      from public.memberships own_membership
      where own_membership.id = fellowship_preparations.membership_id
        and own_membership.user_id = (select auth.uid())
        and own_membership.status = 'active'
    )
    and (select private.can_post_fellowship_preparation(membership_id, fellowship_id))
  )
  or (select private.is_church_admin(church_id))
);

create or replace function public.can_post_preparations()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.fellowships fellowship
      on fellowship.church_id = membership.church_id
     and fellowship.status <> 'cancelled'
    where membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (select private.can_post_fellowship_preparation(membership.id, fellowship.id))
  );
$$;

create or replace function public.list_preparation_posting_fellowships(
  p_membership_id bigint
)
returns table (
  id bigint,
  title text,
  starts_at timestamptz,
  status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select fellowship.id, fellowship.title, fellowship.starts_at, fellowship.status
  from public.fellowships fellowship
  join public.memberships membership
    on membership.id = p_membership_id
   and membership.church_id = fellowship.church_id
   and membership.user_id = (select auth.uid())
   and membership.status = 'active'
  where fellowship.status <> 'cancelled'
    and (select private.can_post_fellowship_preparation(membership.id, fellowship.id))
  order by fellowship.starts_at, fellowship.id;
$$;

revoke all on function private.can_post_fellowship_preparation(bigint, bigint)
  from public, anon, authenticated, service_role;
grant execute on function private.can_post_fellowship_preparation(bigint, bigint)
  to authenticated;
revoke all on function private.enforce_preparation_posting_eligibility()
  from public, anon, authenticated, service_role;

revoke all on function public.can_post_preparations() from public, anon;
grant execute on function public.can_post_preparations() to authenticated;
revoke all on function public.list_preparation_posting_fellowships(bigint)
  from public, anon;
grant execute on function public.list_preparation_posting_fellowships(bigint)
  to authenticated;

comment on function public.can_post_preparations() is
  'Returns whether the caller has any leader, post-holder, or active-responsibility preparation posting route.';
comment on function public.list_preparation_posting_fellowships(bigint) is
  'Lists only fellowships where the caller may submit preparation because of leadership, staff, or an active assignment.';

notify pgrst, 'reload schema';
