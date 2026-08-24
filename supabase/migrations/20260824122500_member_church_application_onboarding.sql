-- Let normal accounts choose an active church, submit a pending application,
-- and become visible in the real church directory only after church-admin
-- approval. Invitation codes remain an immediate, auditable join path.

alter table public.profile_private
  add column if not exists permanent_address text,
  add column if not exists temporary_address text,
  add column if not exists gender text;

alter table public.profile_private
  add constraint profile_private_phone_length_check
    check (phone is null or char_length(phone) <= 40),
  add constraint profile_private_permanent_address_length_check
    check (permanent_address is null or char_length(permanent_address) <= 500),
  add constraint profile_private_temporary_address_length_check
    check (temporary_address is null or char_length(temporary_address) <= 500),
  add constraint profile_private_gender_check
    check (gender is null or gender in ('female', 'male', 'other', 'prefer_not_to_say'));

alter table public.membership_join_requests
  add column if not exists request_status text,
  add column if not exists requested_role text,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists updated_at timestamptz not null default now();

update public.membership_join_requests
set request_status = case when membership_id is null then 'pending' else 'approved' end,
    requested_role = coalesce(
      (select ci.role from public.church_invites ci where ci.id = membership_join_requests.invite_id),
      'member'
    ),
    reviewed_at = case when membership_id is null then null else created_at end
where request_status is null or requested_role is null;

alter table public.membership_join_requests
  alter column request_status set default 'pending',
  alter column request_status set not null,
  alter column requested_role set default 'member',
  alter column requested_role set not null,
  add constraint membership_join_requests_status_check
    check (request_status in ('pending', 'approved', 'rejected')),
  add constraint membership_join_requests_role_check
    check (requested_role in ('leader', 'member')),
  add constraint membership_join_requests_review_note_length_check
    check (review_note is null or char_length(review_note) <= 1000),
  add constraint membership_join_requests_review_state_check
    check (
      (request_status = 'pending' and reviewed_at is null and reviewed_by is null)
      or (request_status in ('approved', 'rejected') and reviewed_at is not null)
    );

create unique index membership_join_requests_one_pending_idx
  on public.membership_join_requests (church_id, user_id)
  where request_status = 'pending';

create index membership_join_requests_church_status_created_idx
  on public.membership_join_requests (church_id, request_status, created_at desc);

create index membership_join_requests_reviewed_by_idx
  on public.membership_join_requests (reviewed_by)
  where reviewed_by is not null;

drop trigger if exists membership_join_requests_set_updated_at
  on public.membership_join_requests;
create trigger membership_join_requests_set_updated_at
before update on public.membership_join_requests
for each row execute function private.set_updated_at();

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
  signup_onboarding boolean := coalesce(
    current_setting('church_app.signup_onboarding', true) = 'on',
    false
  );
begin
  if not signup_onboarding
    and ((select auth.uid()) is null or new.user_id <> (select auth.uid())) then
    raise exception 'Membership request requires the current signed-in user';
  end if;

  if exists (
    select 1
    from public.platform_roles platform_role
    where platform_role.user_id = new.user_id
      and platform_role.role = 'super_admin'
  ) then
    raise exception 'Platform super administrators cannot request church membership';
  end if;

  -- No bearer-code hash means a normal, approval-required application.
  if new.submitted_code_hash is null then
    if new.church_id is null or not exists (
      select 1
      from public.churches church
      where church.id = new.church_id
        and church.status = 'active'
    ) then
      raise exception 'The selected church is not accepting membership requests';
    end if;

    if exists (
      select 1
      from public.memberships membership
      where membership.church_id = new.church_id
        and membership.user_id = new.user_id
        and membership.status = 'active'
    ) then
      raise exception 'You already have an active membership in this church';
    end if;

    if exists (
      select 1
      from public.membership_join_requests request
      where request.church_id = new.church_id
        and request.user_id = new.user_id
        and request.request_status = 'pending'
    ) then
      raise exception 'A membership request is already pending for this church';
    end if;

    new.invite_id := null;
    new.membership_id := null;
    new.requested_role := 'member';
    new.request_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
    return new;
  end if;

  if new.submitted_code_hash !~ '^[0-9a-f]{64}$' then
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
  from public.memberships membership
  where membership.church_id = target_invite.church_id
    and membership.user_id = new.user_id;

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
  new.requested_role := target_invite.role;
  new.request_status := 'approved';
  new.reviewed_by := null;
  new.reviewed_at := now();
  new.review_note := 'Approved by secure invitation';
  return new;
end;
$$;

revoke all on function private.redeem_church_invite()
  from public, anon, authenticated, service_role;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_church_id bigint;
  submitted_birth_date date;
  submitted_gender text;
  submitted_permanent_address text;
  submitted_temporary_address text;
  submitted_phone text;
begin
  submitted_phone := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')), 40), '');
  submitted_permanent_address := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'permanent_address', '')), 500), '');
  submitted_temporary_address := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'temporary_address', '')), 500), '');
  submitted_gender := case
    when new.raw_user_meta_data ->> 'gender' in ('female', 'male', 'other', 'prefer_not_to_say')
      then new.raw_user_meta_data ->> 'gender'
    else null
  end;
  submitted_birth_date := null;
  begin
    if coalesce(new.raw_user_meta_data ->> 'date_of_birth', '') ~ '^\d{4}-\d{2}-\d{2}$' then
      submitted_birth_date := (new.raw_user_meta_data ->> 'date_of_birth')::date;
      if submitted_birth_date >= current_date then
        submitted_birth_date := null;
      end if;
    end if;
  exception when others then
    submitted_birth_date := null;
  end;

  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'नयाँ सदस्य'), 200)
  )
  on conflict (id) do nothing;

  insert into public.profile_private (
    id,
    phone,
    date_of_birth,
    permanent_address,
    temporary_address,
    gender
  ) values (
    new.id,
    submitted_phone,
    submitted_birth_date,
    submitted_permanent_address,
    coalesce(submitted_temporary_address, submitted_permanent_address),
    submitted_gender
  )
  on conflict (id) do update
  set phone = excluded.phone,
      date_of_birth = excluded.date_of_birth,
      permanent_address = excluded.permanent_address,
      temporary_address = excluded.temporary_address,
      gender = excluded.gender;

  if coalesce(new.raw_user_meta_data ->> 'church_id', '') ~ '^\d{1,18}$' then
    selected_church_id := (new.raw_user_meta_data ->> 'church_id')::bigint;
    if exists (
      select 1 from public.churches church
      where church.id = selected_church_id and church.status = 'active'
    ) then
      perform set_config('church_app.signup_onboarding', 'on', true);
      insert into public.membership_join_requests (user_id, church_id)
      values (new.id, selected_church_id)
      on conflict do nothing;
      perform set_config('church_app.signup_onboarding', 'off', true);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user()
  from public, anon, authenticated, service_role;

create or replace function public.list_joinable_churches()
returns table (
  church_id bigint,
  church_name text,
  church_name_ne text,
  address text
)
language sql
stable
security definer
set search_path = ''
as $$
  select church.id, church.name, church.name_ne, church.address
  from public.churches church
  where church.status = 'active'
  order by coalesce(church.name_ne, church.name), church.id;
$$;

revoke all on function public.list_joinable_churches() from public;
grant execute on function public.list_joinable_churches() to anon, authenticated;

create or replace function private.list_my_membership_requests()
returns table (
  request_id bigint,
  church_id bigint,
  church_name text,
  church_name_ne text,
  request_status text,
  requested_role text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    request.church_id,
    church.name,
    church.name_ne,
    request.request_status,
    request.requested_role,
    request.review_note,
    request.created_at,
    request.reviewed_at
  from public.membership_join_requests request
  join public.churches church on church.id = request.church_id
  where (select auth.uid()) is not null
    and request.user_id = (select auth.uid())
  order by request.created_at desc, request.id desc;
$$;

create or replace function public.list_my_membership_requests()
returns table (
  request_id bigint,
  church_id bigint,
  church_name text,
  church_name_ne text,
  request_status text,
  requested_role text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_my_membership_requests();
$$;

create or replace function private.list_pending_membership_requests(target_church_id bigint)
returns table (
  request_id bigint,
  user_id uuid,
  full_name text,
  avatar_url text,
  requested_role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_church_admin(target_church_id)) then
    raise exception 'Only an active church owner or administrator can review membership requests';
  end if;

  return query
  select
    request.id,
    request.user_id,
    profile.full_name,
    profile.avatar_url,
    request.requested_role,
    request.created_at
  from public.membership_join_requests request
  join public.profiles profile on profile.id = request.user_id
  where request.church_id = target_church_id
    and request.request_status = 'pending'
  order by request.created_at, request.id;
end;
$$;

create or replace function public.list_pending_membership_requests(p_church_id bigint)
returns table (
  request_id bigint,
  user_id uuid,
  full_name text,
  avatar_url text,
  requested_role text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_pending_membership_requests(p_church_id);
$$;

create or replace function private.review_membership_request(
  target_request_id bigint,
  decision text,
  decision_note text default null
)
returns table (
  request_id bigint,
  request_status text,
  membership_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.membership_join_requests%rowtype;
  resolved_membership_id bigint;
begin
  if decision not in ('approved', 'rejected') then
    raise exception 'Membership decision must be approved or rejected';
  end if;

  if char_length(trim(coalesce(decision_note, ''))) > 1000 then
    raise exception 'Membership review note is too long';
  end if;

  select *
  into target_request
  from public.membership_join_requests request
  where request.id = target_request_id
  for update;

  if not found or target_request.request_status <> 'pending' then
    raise exception 'Pending membership request was not found';
  end if;

  if not (select private.is_church_admin(target_request.church_id)) then
    raise exception 'Only an active church owner or administrator can review membership requests';
  end if;

  if decision = 'approved' then
    insert into public.memberships (church_id, user_id, role, status)
    values (target_request.church_id, target_request.user_id, 'member', 'active')
    on conflict (church_id, user_id) do update
    set role = case
        when public.memberships.role in ('owner', 'admin', 'leader') then public.memberships.role
        else 'member'
      end,
      status = 'active',
      joined_at = public.memberships.joined_at
    returning id into resolved_membership_id;
  end if;

  update public.membership_join_requests request
  set request_status = decision,
      membership_id = resolved_membership_id,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(decision_note, '')), '')
  where request.id = target_request.id;

  return query
  select target_request.id, decision, resolved_membership_id;
end;
$$;

create or replace function public.review_membership_request(
  p_request_id bigint,
  p_decision text,
  p_review_note text default null
)
returns table (
  request_id bigint,
  request_status text,
  membership_id bigint
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.review_membership_request(p_request_id, p_decision, p_review_note);
$$;

revoke all on function private.list_my_membership_requests()
  from public, anon, authenticated, service_role;
revoke all on function private.list_pending_membership_requests(bigint)
  from public, anon, authenticated, service_role;
revoke all on function private.review_membership_request(bigint, text, text)
  from public, anon, authenticated, service_role;

grant execute on function private.list_my_membership_requests()
  to authenticated;
grant execute on function private.list_pending_membership_requests(bigint)
  to authenticated;
grant execute on function private.review_membership_request(bigint, text, text)
  to authenticated;

revoke all on function public.list_my_membership_requests() from public, anon;
revoke all on function public.list_pending_membership_requests(bigint) from public, anon;
revoke all on function public.review_membership_request(bigint, text, text) from public, anon;

grant execute on function public.list_my_membership_requests() to authenticated;
grant execute on function public.list_pending_membership_requests(bigint) to authenticated;
grant execute on function public.review_membership_request(bigint, text, text) to authenticated;

revoke insert on public.membership_join_requests from authenticated;
grant insert (user_id, church_id, submitted_code_hash)
  on public.membership_join_requests to authenticated;

comment on column public.profile_private.permanent_address is
  'Member-private permanent address; never exposed by the church directory API.';
comment on column public.profile_private.temporary_address is
  'Member-private current/temporary address; never exposed by the church directory API.';
comment on column public.profile_private.gender is
  'Member-private self-described gender used only for authorized church workflows.';
comment on table public.membership_join_requests is
  'Auditable invite redemptions and approval-required applications to active churches.';
comment on function public.list_joinable_churches() is
  'Public limited catalog of active churches available during account signup and membership onboarding.';
comment on function public.list_pending_membership_requests(bigint) is
  'Church-admin-only queue exposing only the applicant identity needed for approval.';
comment on function public.review_membership_request(bigint, text, text) is
  'Atomically approves or rejects one pending same-church membership request.';

notify pgrst, 'reload schema';
