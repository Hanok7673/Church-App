create index church_invites_created_by_idx
  on public.church_invites (created_by);

create index membership_join_requests_invite_id_idx
  on public.membership_join_requests (invite_id);

create index membership_join_requests_membership_id_idx
  on public.membership_join_requests (membership_id);
