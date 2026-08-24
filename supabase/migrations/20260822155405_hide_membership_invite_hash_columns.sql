revoke select on public.church_invites from authenticated;
grant select (
  id,
  church_id,
  role,
  max_uses,
  use_count,
  expires_at,
  revoked_at,
  created_by,
  created_at
) on public.church_invites to authenticated;

revoke select on public.membership_join_requests from authenticated;
grant select (
  id,
  user_id,
  invite_id,
  church_id,
  membership_id,
  created_at
) on public.membership_join_requests to authenticated;

comment on column public.membership_join_requests.submitted_code_hash is
  'Transient insert-only SHA-256 digest. Cleared by the redemption trigger and not selectable through the authenticated Data API.';
