drop policy fellowships_select on public.fellowships;

create policy fellowships_select
on public.fellowships for select to authenticated
using (
  (select private.is_church_member(church_id))
  and (
    status <> 'draft'
    or (select private.is_church_admin(church_id))
    or (select private.can_manage_fellowship(id, 'schedule'))
  )
);

comment on policy fellowships_select on public.fellowships is
  'Active church members see published schedule states; draft schedules remain limited to church admins and assigned schedule staff.';
