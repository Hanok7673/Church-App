alter table public.profile_private
  drop constraint if exists profile_private_text_scale_override_check;

alter table public.profile_private
  add constraint profile_private_text_scale_override_check
  check (text_scale_override between 0.90 and 1.50);

comment on column public.profile_private.text_scale_override is
  'Optional authenticated-user text scale override. Church App currently offers 0.90 through 1.30.';
