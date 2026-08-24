-- Cover every foreign-key lookup introduced by the fellowship service batch.

create index fellowship_service_items_created_by_idx
  on public.fellowship_service_items (created_by);

create index fellowship_service_items_plan_church_idx
  on public.fellowship_service_items (plan_id, church_id);

create index fellowship_service_plans_fellowship_church_idx
  on public.fellowship_service_plans (fellowship_id, church_id);

create index member_fellowship_notes_fellowship_church_idx
  on public.member_fellowship_notes (fellowship_id, church_id);

create index member_verse_highlights_fellowship_church_idx
  on public.member_verse_highlights (fellowship_id, church_id);

create index member_voice_notes_fellowship_church_idx
  on public.member_voice_notes (fellowship_id, church_id);
