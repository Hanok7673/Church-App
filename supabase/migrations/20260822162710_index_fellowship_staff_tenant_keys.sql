create index fellowship_staff_fellowship_church_idx
  on public.fellowship_staff (fellowship_id, church_id);

create index fellowship_staff_membership_church_idx
  on public.fellowship_staff (membership_id, church_id);
