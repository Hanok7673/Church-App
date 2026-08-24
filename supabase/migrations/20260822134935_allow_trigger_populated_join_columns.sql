alter table public.membership_join_requests
  alter column invite_id drop not null,
  alter column church_id drop not null,
  alter column membership_id drop not null;

comment on column public.membership_join_requests.invite_id is
  'Populated by the protected redemption trigger before insert; nullable metadata allows typed clients to omit it.';
comment on column public.membership_join_requests.church_id is
  'Populated by the protected redemption trigger before insert; every stored redemption has a value.';
comment on column public.membership_join_requests.membership_id is
  'Populated by the protected redemption trigger before insert; every stored redemption has a value.';
