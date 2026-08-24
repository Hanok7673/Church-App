create table public.church_invites (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'member' check (role in ('leader', 'member')),
  max_uses smallint not null default 1 check (max_uses between 1 and 100),
  use_count smallint not null default 0 check (use_count between 0 and max_uses),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.membership_join_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  submitted_code_hash text,
  invite_id bigint not null references public.church_invites (id) on delete restrict,
  church_id bigint not null references public.churches (id) on delete cascade,
  membership_id bigint not null references public.memberships (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, invite_id)
);

create index church_invites_church_expires_idx
  on public.church_invites (church_id, expires_at)
  where revoked_at is null;

create index membership_join_requests_user_id_idx
  on public.membership_join_requests (user_id);

create index membership_join_requests_church_id_idx
  on public.membership_join_requests (church_id);

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
    joined_at = now()
  returning id into redeemed_membership_id;

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

revoke all on function private.redeem_church_invite() from public, anon, authenticated, service_role;

create trigger membership_join_requests_redeem
before insert on public.membership_join_requests
for each row execute function private.redeem_church_invite();

alter table public.church_invites enable row level security;
alter table public.membership_join_requests enable row level security;

create policy church_invites_select on public.church_invites
for select to authenticated
using ((select private.is_church_admin(church_id)));

create policy church_invites_insert on public.church_invites
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_church_admin(church_id))
);

create policy church_invites_update on public.church_invites
for update to authenticated
using ((select private.is_church_admin(church_id)))
with check ((select private.is_church_admin(church_id)));

create policy membership_join_requests_select on public.membership_join_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_church_admin(church_id))
);

create policy membership_join_requests_insert on public.membership_join_requests
for insert to authenticated
with check (user_id = (select auth.uid()));

revoke all on public.church_invites from anon, authenticated;
revoke all on public.membership_join_requests from anon, authenticated;

grant select on public.church_invites to authenticated;
grant insert (church_id, code_hash, role, max_uses, expires_at, created_by)
  on public.church_invites to authenticated;
grant update (revoked_at) on public.church_invites to authenticated;

grant select on public.membership_join_requests to authenticated;
grant insert (user_id, submitted_code_hash)
  on public.membership_join_requests to authenticated;

grant usage, select on sequence public.church_invites_id_seq to authenticated;
grant usage, select on sequence public.membership_join_requests_id_seq to authenticated;

comment on table public.church_invites is
  'Hashed, expiring bearer invitations created only by active church owners or administrators.';
comment on column public.church_invites.code_hash is
  'SHA-256 digest of a cryptographically random code. The plaintext code is displayed only once to its creator.';
comment on table public.membership_join_requests is
  'Auditable invitation redemptions. The submitted bearer-code hash is cleared by the validation trigger before storage.';
