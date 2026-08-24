create index fellowship_preparations_fellowship_church_idx
  on public.fellowship_preparations (fellowship_id, church_id);

create index fellowship_preparations_membership_church_idx
  on public.fellowship_preparations (membership_id, church_id);
