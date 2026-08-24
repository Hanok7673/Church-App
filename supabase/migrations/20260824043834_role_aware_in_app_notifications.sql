-- Persistent, tenant-safe in-app notifications generated only by protected
-- church workflow events. Platform roles do not grant notification access.

create table public.notifications (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'assignment_created',
      'preparation_approved',
      'preparation_rejected',
      'recap_published',
      'schedule_created',
      'schedule_updated',
      'schedule_cancelled',
      'attendance_marked',
      'attendance_changed',
      'attendance_removed'
    )
  ),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  body text not null check (char_length(btrim(body)) between 2 and 1000),
  route text not null check (char_length(route) between 2 and 300 and left(route, 1) = '#'),
  source_table text not null check (
    source_table in ('assignments', 'fellowship_preparations', 'recaps', 'fellowships', 'attendance')
  ),
  source_id bigint not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (church_id, recipient_user_id)
    references public.memberships (church_id, user_id) on delete cascade,
  check (read_at is null or read_at >= created_at)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;
create index notifications_church_created_idx
  on public.notifications (church_id, created_at desc);
create index notifications_church_recipient_idx
  on public.notifications (church_id, recipient_user_id);
create index notifications_actor_idx
  on public.notifications (actor_user_id)
  where actor_user_id is not null;
create index notifications_source_idx
  on public.notifications (source_table, source_id);

alter table public.notifications enable row level security;

create policy notifications_select_own
on public.notifications for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
);

create policy notifications_update_own
on public.notifications for update to authenticated
using (
  recipient_user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
)
with check (
  recipient_user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
);

create or replace function private.enforce_notification_read_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id <> old.id
    or new.church_id <> old.church_id
    or new.recipient_user_id <> old.recipient_user_id
    or new.event_type <> old.event_type
    or new.title <> old.title
    or new.body <> old.body
    or new.route <> old.route
    or new.source_table <> old.source_table
    or new.source_id <> old.source_id
    or new.actor_user_id is distinct from old.actor_user_id
    or new.created_at <> old.created_at then
    raise exception 'Only notification read status can be changed';
  end if;

  if (select auth.uid()) is null
    or old.recipient_user_id <> (select auth.uid())
    or not (select private.is_church_member(old.church_id)) then
    raise exception 'A notification can only be updated by its active recipient';
  end if;

  if new.read_at is not null and new.read_at < old.created_at then
    raise exception 'Notification read time cannot precede creation';
  end if;

  return new;
end;
$$;

create trigger notifications_enforce_read_update
before update on public.notifications
for each row execute function private.enforce_notification_read_update();

create or replace function private.create_member_notification(
  target_church_id bigint,
  target_user_id uuid,
  target_event_type text,
  target_title text,
  target_body text,
  target_route text,
  target_source_table text,
  target_source_id bigint,
  target_actor_user_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (
    church_id, recipient_user_id, event_type, title, body, route,
    source_table, source_id, actor_user_id
  )
  select
    target_church_id, target_user_id, target_event_type, btrim(target_title),
    btrim(target_body), target_route, target_source_table, target_source_id,
    target_actor_user_id
  where exists (
    select 1
    from public.memberships membership
    where membership.church_id = target_church_id
      and membership.user_id = target_user_id
      and membership.status = 'active'
  );
$$;

create or replace function private.notify_assignment_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_church_id bigint;
  target_user_id uuid;
  fellowship_title text;
  role_name text;
begin
  select fellowship.church_id, membership.user_id, fellowship.title, role.name_ne
  into target_church_id, target_user_id, fellowship_title, role_name
  from public.fellowships fellowship
  join public.memberships membership on membership.id = new.member_membership_id
  join public.ministry_roles role on role.id = new.ministry_role_id
  where fellowship.id = new.fellowship_id
    and membership.church_id = fellowship.church_id
    and membership.status = 'active';

  if target_user_id is not null then
    perform private.create_member_notification(
      target_church_id,
      target_user_id,
      'assignment_created',
      'नयाँ जिम्मेवारी तोकियो',
      fellowship_title || ' मा तपाईंलाई ' || role_name || ' जिम्मेवारी तोकिएको छ।',
      '#assignments/' || new.id,
      'assignments',
      new.id,
      new.assigned_by
    );
  end if;
  return new;
end;
$$;

create trigger assignments_create_notification
after insert on public.assignments
for each row execute function private.notify_assignment_created();

create or replace function private.notify_preparation_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  fellowship_title text;
begin
  if old.status is not distinct from new.status
    or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  select membership.user_id, fellowship.title
  into target_user_id, fellowship_title
  from public.memberships membership
  join public.fellowships fellowship
    on fellowship.id = new.fellowship_id
   and fellowship.church_id = new.church_id
  where membership.id = new.membership_id
    and membership.church_id = new.church_id
    and membership.status = 'active';

  if target_user_id is not null then
    perform private.create_member_notification(
      new.church_id,
      target_user_id,
      case when new.status = 'approved' then 'preparation_approved' else 'preparation_rejected' end,
      case when new.status = 'approved' then 'तपाईंको तयारी स्वीकृत भयो' else 'तपाईंको तयारी सुधारका लागि फिर्ता भयो' end,
      fellowship_title || ': “' || new.title || '” ' ||
        case when new.status = 'approved'
          then 'स्वीकृत भई मण्डलीमा प्रकाशित भएको छ।'
          else 'अस्वीकृत भएको छ। समीक्षा टिप्पणी हेरेर फेरि पठाउन सक्नुहुन्छ।'
        end,
      '#preparations',
      'fellowship_preparations',
      new.id,
      new.reviewed_by
    );
  end if;
  return new;
end;
$$;

create trigger fellowship_preparations_decision_notification
after update of status on public.fellowship_preparations
for each row execute function private.notify_preparation_decision();

create or replace function private.notify_recap_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fellowship_title text;
begin
  if new.status <> 'published' or old.status = 'published' then
    return new;
  end if;

  select fellowship.title into fellowship_title
  from public.fellowships fellowship
  where fellowship.id = new.fellowship_id
    and fellowship.church_id = new.church_id;

  insert into public.notifications (
    church_id, recipient_user_id, event_type, title, body, route,
    source_table, source_id, actor_user_id
  )
  select
    new.church_id,
    membership.user_id,
    'recap_published',
    'नयाँ फेलोशिप पुनरावलोकन प्रकाशित भयो',
    coalesce(fellowship_title, 'फेलोशिप') || ': “' || new.title || '” अब पढ्न उपलब्ध छ।',
    '#recaps/' || new.id,
    'recaps',
    new.id,
    new.published_by
  from public.memberships membership
  where membership.church_id = new.church_id
    and membership.status = 'active'
    and membership.user_id is distinct from new.published_by;

  return new;
end;
$$;

create trigger recaps_publish_notification
after update of status on public.recaps
for each row execute function private.notify_recap_published();

create or replace function private.notify_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_event text;
  notification_title text;
  notification_body text;
  actor_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.status <> 'scheduled' then
      return new;
    end if;
    notification_event := 'schedule_created';
    notification_title := 'नयाँ फेलोशिप तालिका प्रकाशित भयो';
    notification_body := '“' || new.title || '” को नयाँ तालिका हेर्नुहोस्।';
  else
    if not (
      new.title is distinct from old.title
      or new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or new.location_name is distinct from old.location_name
      or new.address is distinct from old.address
      or new.status is distinct from old.status
    ) then
      return new;
    end if;

    if new.status = 'cancelled' then
      notification_event := 'schedule_cancelled';
      notification_title := 'फेलोशिप तालिका रद्द भयो';
      notification_body := '“' || new.title || '” रद्द गरिएको छ।';
    elsif new.status = 'scheduled' and old.status <> 'scheduled' then
      notification_event := 'schedule_created';
      notification_title := 'नयाँ फेलोशिप तालिका प्रकाशित भयो';
      notification_body := '“' || new.title || '” को तालिका अब उपलब्ध छ।';
    elsif new.status in ('scheduled', 'completed') then
      notification_event := 'schedule_updated';
      notification_title := 'फेलोशिप तालिका परिवर्तन भयो';
      notification_body := '“' || new.title || '” को समय, स्थान वा अवस्था परिवर्तन भएको छ।';
    else
      return new;
    end if;
  end if;

  insert into public.notifications (
    church_id, recipient_user_id, event_type, title, body, route,
    source_table, source_id, actor_user_id
  )
  select
    new.church_id,
    membership.user_id,
    notification_event,
    notification_title,
    notification_body,
    '#schedule',
    'fellowships',
    new.id,
    actor_id
  from public.memberships membership
  where membership.church_id = new.church_id
    and membership.status = 'active'
    and membership.user_id is distinct from actor_id;

  return new;
end;
$$;

create trigger fellowships_schedule_notification
after insert or update of title, starts_at, ends_at, location_name, address, status
on public.fellowships
for each row execute function private.notify_schedule_change();

create or replace function private.notify_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_attendance public.attendance%rowtype;
  fellowship_title text;
  notification_event text;
  notification_title text;
  notification_body text;
begin
  source_attendance := case when tg_op = 'DELETE' then old else new end;

  if tg_op = 'UPDATE'
    and old.status is not distinct from new.status
    and old.notes is not distinct from new.notes then
    return new;
  end if;

  select fellowship.title into fellowship_title
  from public.fellowships fellowship
  where fellowship.id = source_attendance.fellowship_id
    and fellowship.church_id = source_attendance.church_id;

  if tg_op = 'INSERT' then
    notification_event := 'attendance_marked';
    notification_title := 'हाजिरी अद्यावधिक भयो';
    notification_body := coalesce(fellowship_title, 'फेलोशिप') || ' मा तपाईंको हाजिरी “' ||
      case new.status when 'attended' then 'उपस्थित' when 'missed' then 'अनुपस्थित' when 'excused' then 'बिदा' else new.status end || '” राखिएको छ।';
  elsif tg_op = 'DELETE' then
    notification_event := 'attendance_removed';
    notification_title := 'हाजिरी अभिलेख हटाइयो';
    notification_body := coalesce(fellowship_title, 'फेलोशिप') || ' को तपाईंको हाजिरी अभिलेख हटाइएको छ।';
  else
    notification_event := 'attendance_changed';
    notification_title := 'हाजिरी परिवर्तन भयो';
    notification_body := coalesce(fellowship_title, 'फेलोशिप') || ' मा तपाईंको हाजिरी “' ||
      case new.status when 'attended' then 'उपस्थित' when 'missed' then 'अनुपस्थित' when 'excused' then 'बिदा' else new.status end || '” मा परिवर्तन भएको छ।';
  end if;

  perform private.create_member_notification(
    source_attendance.church_id,
    source_attendance.user_id,
    notification_event,
    notification_title,
    notification_body,
    '#attendance',
    'attendance',
    source_attendance.id,
    case when tg_op = 'DELETE' then (select auth.uid()) else source_attendance.marked_by end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger attendance_change_notification
after insert or update or delete on public.attendance
for each row execute function private.notify_attendance_change();

create or replace function public.list_my_notifications(
  p_limit integer default 100
)
returns table (
  notification_id bigint,
  church_id bigint,
  church_name text,
  church_name_ne text,
  event_type text,
  title text,
  body text,
  route text,
  source_table text,
  source_id bigint,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    notification.id,
    notification.church_id,
    church.name,
    church.name_ne,
    notification.event_type,
    notification.title,
    notification.body,
    notification.route,
    notification.source_table,
    notification.source_id,
    notification.created_at,
    notification.read_at
  from public.notifications notification
  join public.churches church on church.id = notification.church_id
  where notification.recipient_user_id = (select auth.uid())
    and (select private.is_church_member(notification.church_id))
  order by notification.created_at desc, notification.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

create or replace function public.notification_unread_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)
  from public.notifications notification
  where notification.recipient_user_id = (select auth.uid())
    and notification.read_at is null
    and (select private.is_church_member(notification.church_id));
$$;

revoke all on function private.enforce_notification_read_update()
  from public, anon, authenticated, service_role;
revoke all on function private.create_member_notification(bigint, uuid, text, text, text, text, text, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.notify_assignment_created()
  from public, anon, authenticated, service_role;
revoke all on function private.notify_preparation_decision()
  from public, anon, authenticated, service_role;
revoke all on function private.notify_recap_published()
  from public, anon, authenticated, service_role;
revoke all on function private.notify_schedule_change()
  from public, anon, authenticated, service_role;
revoke all on function private.notify_attendance_change()
  from public, anon, authenticated, service_role;

revoke all on public.notifications from public, anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;
grant usage, select on sequence public.notifications_id_seq to service_role;

revoke all on function public.list_my_notifications(integer) from public, anon;
revoke all on function public.notification_unread_count() from public, anon;
grant execute on function public.list_my_notifications(integer) to authenticated;
grant execute on function public.notification_unread_count() to authenticated;

comment on table public.notifications is
  'Per-recipient, church-scoped in-app notifications created only by protected workflow triggers.';
comment on function public.list_my_notifications(integer) is
  'Lists only the authenticated active member own notifications across their church memberships.';
comment on function public.notification_unread_count() is
  'Counts unread notifications visible to the authenticated active member.';
