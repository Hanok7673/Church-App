-- Ordered fellowship service slides, assigned worship/preacher preparation,
-- and a private member sermon notebook with Storage-backed voice clips.

create or replace function private.can_prepare_fellowship_service(
  target_fellowship_id bigint,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and requested_capability in ('program', 'worship', 'sermon')
    and exists (
      select 1
      from public.fellowships fellowship
      where fellowship.id = target_fellowship_id
        and (
          (select private.can_manage_fellowship(fellowship.id, 'program'))
          or (
            requested_capability <> 'program'
            and exists (
              select 1
              from public.assignments assignment
              join public.memberships membership
                on membership.id = assignment.member_membership_id
              join public.ministry_roles ministry_role
                on ministry_role.id = assignment.ministry_role_id
              where assignment.fellowship_id = fellowship.id
                and assignment.status in ('assigned', 'accepted')
                and membership.church_id = fellowship.church_id
                and membership.user_id = (select auth.uid())
                and membership.status = 'active'
                and ministry_role.code = case
                  when requested_capability = 'worship' then 'worship'
                  when requested_capability = 'sermon' then 'preach'
                end
            )
          )
        )
    );
$$;

create table public.fellowship_service_plans (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null unique,
  title text not null default 'फेलोशिप कार्यक्रम'
    check (char_length(btrim(title)) between 2 and 160),
  sermon_topic text check (sermon_topic is null or char_length(btrim(sermon_topic)) between 2 and 200),
  sermon_summary text check (sermon_summary is null or char_length(sermon_summary) <= 5000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, church_id),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  check (
    (status = 'draft' and published_at is null and published_by is null)
    or (status = 'published' and published_at is not null and published_by is not null)
  )
);

create index fellowship_service_plans_church_status_idx
  on public.fellowship_service_plans (church_id, status, updated_at desc);
create index fellowship_service_plans_created_by_idx
  on public.fellowship_service_plans (created_by);
create index fellowship_service_plans_published_by_idx
  on public.fellowship_service_plans (published_by)
  where published_by is not null;

create table public.fellowship_service_items (
  id bigint generated always as identity primary key,
  plan_id bigint not null,
  church_id bigint not null,
  item_kind text not null check (item_kind in ('song', 'scripture')),
  section text not null check (section in ('opening', 'worship', 'sermon', 'response', 'closing')),
  position smallint not null check (position between 1 and 500),
  song_id bigint references public.songs (id) on delete restrict,
  book_code text,
  book_name_ne text,
  chapter smallint,
  verse_start smallint,
  verse_end smallint,
  label text check (label is null or char_length(btrim(label)) <= 200),
  note text check (note is null or char_length(note) <= 1000),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, position),
  foreign key (plan_id, church_id)
    references public.fellowship_service_plans (id, church_id) on delete cascade,
  check (
    (
      item_kind = 'song'
      and song_id is not null
      and book_code is null
      and book_name_ne is null
      and chapter is null
      and verse_start is null
      and verse_end is null
    )
    or (
      item_kind = 'scripture'
      and song_id is null
      and char_length(btrim(book_code)) between 2 and 8
      and char_length(btrim(book_name_ne)) between 2 and 100
      and chapter > 0
      and verse_start > 0
      and verse_end >= verse_start
    )
  )
);

create index fellowship_service_items_church_idx
  on public.fellowship_service_items (church_id);
create index fellowship_service_items_song_idx
  on public.fellowship_service_items (song_id)
  where song_id is not null;

create or replace function private.can_edit_fellowship_service_plan(target_plan_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fellowship_service_plans plan
    where plan.id = target_plan_id
      and (
        (select private.can_prepare_fellowship_service(plan.fellowship_id, 'program'))
        or (select private.can_prepare_fellowship_service(plan.fellowship_id, 'worship'))
        or (select private.can_prepare_fellowship_service(plan.fellowship_id, 'sermon'))
      )
  );
$$;

create or replace function private.can_view_fellowship_service_plan(target_plan_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fellowship_service_plans plan
    where plan.id = target_plan_id
      and (
        (
          plan.status = 'published'
          and (select private.is_church_member(plan.church_id))
        )
        or (select private.can_edit_fellowship_service_plan(plan.id))
      )
  );
$$;

create or replace function private.enforce_fellowship_service_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_church_id bigint;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  select fellowship.church_id into target_church_id
  from public.fellowships fellowship
  where fellowship.id = new.fellowship_id;

  if target_church_id is null or new.church_id <> target_church_id then
    raise exception 'Service plan and fellowship must belong to the same church';
  end if;

  if tg_op = 'INSERT' then
    if not (
      (select private.can_prepare_fellowship_service(new.fellowship_id, 'program'))
      or (select private.can_prepare_fellowship_service(new.fellowship_id, 'worship'))
      or (select private.can_prepare_fellowship_service(new.fellowship_id, 'sermon'))
    ) then
      raise exception 'Only an assigned worship or preaching servant, or program manager, can create a service plan';
    end if;
    new.created_by := actor_id;
    new.status := 'draft';
    new.published_at := null;
    new.published_by := null;
    new.title := btrim(new.title);
    new.sermon_topic := nullif(btrim(coalesce(new.sermon_topic, '')), '');
    new.sermon_summary := nullif(btrim(coalesce(new.sermon_summary, '')), '');
    return new;
  end if;

  if new.id <> old.id
    or new.church_id <> old.church_id
    or new.fellowship_id <> old.fellowship_id
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Service plan church, fellowship, creator, and identity cannot be changed';
  end if;

  if new.title is distinct from old.title
    and not (select private.can_prepare_fellowship_service(new.fellowship_id, 'program')) then
    raise exception 'Only a program manager can change the service-plan title';
  end if;

  if (
    new.sermon_topic is distinct from old.sermon_topic
    or new.sermon_summary is distinct from old.sermon_summary
  ) and not (select private.can_prepare_fellowship_service(new.fellowship_id, 'sermon')) then
    raise exception 'Only the assigned preacher or a program manager can change sermon preparation';
  end if;

  if new.status is distinct from old.status then
    if not (select private.can_prepare_fellowship_service(new.fellowship_id, 'program')) then
      raise exception 'Only a program manager can publish or reopen a service plan';
    end if;

    if new.status = 'published' then
      if nullif(btrim(coalesce(new.sermon_topic, '')), '') is null then
        raise exception 'A sermon topic is required before publication';
      end if;
      if not exists (
        select 1 from public.fellowship_service_items item
        where item.plan_id = new.id and item.item_kind = 'song'
      ) then
        raise exception 'At least one worship song is required before publication';
      end if;
      if not exists (
        select 1 from public.fellowship_service_items item
        where item.plan_id = new.id and item.item_kind = 'scripture'
      ) then
        raise exception 'At least one Scripture passage is required before publication';
      end if;
      new.published_at := now();
      new.published_by := actor_id;
    else
      new.published_at := null;
      new.published_by := null;
    end if;
  else
    new.published_at := old.published_at;
    new.published_by := old.published_by;
  end if;

  if old.status = 'published' and new.status = 'published'
    and (
      new.title is distinct from old.title
      or new.sermon_topic is distinct from old.sermon_topic
      or new.sermon_summary is distinct from old.sermon_summary
    ) then
    raise exception 'Reopen the published service plan before editing its content';
  end if;

  new.title := btrim(new.title);
  new.sermon_topic := nullif(btrim(coalesce(new.sermon_topic, '')), '');
  new.sermon_summary := nullif(btrim(coalesce(new.sermon_summary, '')), '');
  return new;
end;
$$;

create trigger fellowship_service_plans_enforce
before insert or update on public.fellowship_service_plans
for each row execute function private.enforce_fellowship_service_plan();
create trigger fellowship_service_plans_set_updated_at
before update on public.fellowship_service_plans
for each row execute function private.set_updated_at();

create or replace function private.enforce_fellowship_service_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_item public.fellowship_service_items%rowtype;
  target_fellowship_id bigint;
  target_church_id bigint;
  plan_status text;
  required_capability text;
begin
  source_item := case when tg_op = 'DELETE' then old else new end;

  select plan.fellowship_id, plan.church_id, plan.status
  into target_fellowship_id, target_church_id, plan_status
  from public.fellowship_service_plans plan
  where plan.id = source_item.plan_id;

  if target_fellowship_id is null or source_item.church_id <> target_church_id then
    raise exception 'Service item and plan must belong to the same church';
  end if;
  if plan_status <> 'draft' then
    raise exception 'Reopen the service plan before changing slides';
  end if;

  required_capability := case
    when source_item.item_kind = 'song' then 'worship'
    else 'sermon'
  end;
  if not (select private.can_prepare_fellowship_service(target_fellowship_id, required_capability)) then
    raise exception 'This service slide requires the matching worship or preaching responsibility';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  elsif new.id <> old.id
    or new.plan_id <> old.plan_id
    or new.church_id <> old.church_id
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Service slide plan, church, creator, and identity cannot be changed';
  end if;

  new.label := nullif(btrim(coalesce(new.label, '')), '');
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  return new;
end;
$$;

create trigger fellowship_service_items_enforce
before insert or update or delete on public.fellowship_service_items
for each row execute function private.enforce_fellowship_service_item();
create trigger fellowship_service_items_set_updated_at
before update on public.fellowship_service_items
for each row execute function private.set_updated_at();

alter table public.fellowship_service_plans enable row level security;
alter table public.fellowship_service_items enable row level security;

create policy fellowship_service_plans_select
on public.fellowship_service_plans for select to authenticated
using ((select private.can_view_fellowship_service_plan(id)));

create policy fellowship_service_plans_insert
on public.fellowship_service_plans for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select private.can_prepare_fellowship_service(fellowship_id, 'program'))
    or (select private.can_prepare_fellowship_service(fellowship_id, 'worship'))
    or (select private.can_prepare_fellowship_service(fellowship_id, 'sermon'))
  )
);

create policy fellowship_service_plans_update
on public.fellowship_service_plans for update to authenticated
using ((select private.can_edit_fellowship_service_plan(id)))
with check ((select private.can_edit_fellowship_service_plan(id)));

create policy fellowship_service_plans_delete
on public.fellowship_service_plans for delete to authenticated
using (
  status = 'draft'
  and (select private.can_prepare_fellowship_service(fellowship_id, 'program'))
);

create policy fellowship_service_items_select
on public.fellowship_service_items for select to authenticated
using ((select private.can_view_fellowship_service_plan(plan_id)));

create policy fellowship_service_items_insert
on public.fellowship_service_items for insert to authenticated
with check ((select private.can_edit_fellowship_service_plan(plan_id)));

create policy fellowship_service_items_update
on public.fellowship_service_items for update to authenticated
using ((select private.can_edit_fellowship_service_plan(plan_id)))
with check ((select private.can_edit_fellowship_service_plan(plan_id)));

create policy fellowship_service_items_delete
on public.fellowship_service_items for delete to authenticated
using ((select private.can_edit_fellowship_service_plan(plan_id)));

create table public.member_fellowship_notes (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fellowship_id, user_id),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  foreign key (church_id, user_id)
    references public.memberships (church_id, user_id) on delete cascade
);

create index member_fellowship_notes_church_user_idx
  on public.member_fellowship_notes (church_id, user_id, updated_at desc);
create index member_fellowship_notes_user_idx
  on public.member_fellowship_notes (user_id);

create table public.member_verse_highlights (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_code text not null check (char_length(btrim(book_code)) between 2 and 8),
  book_name_ne text not null check (char_length(btrim(book_name_ne)) between 2 and 100),
  chapter smallint not null check (chapter > 0),
  verse_start smallint not null check (verse_start > 0),
  verse_end smallint not null check (verse_end >= verse_start),
  selected_text text not null check (char_length(btrim(selected_text)) between 1 and 1000),
  reflection text check (reflection is null or char_length(reflection) <= 5000),
  color text not null default 'gold' check (color in ('gold', 'green', 'blue', 'rose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  foreign key (church_id, user_id)
    references public.memberships (church_id, user_id) on delete cascade
);

create index member_verse_highlights_fellowship_user_idx
  on public.member_verse_highlights (fellowship_id, user_id, created_at desc);
create index member_verse_highlights_church_user_idx
  on public.member_verse_highlights (church_id, user_id);
create index member_verse_highlights_user_idx
  on public.member_verse_highlights (user_id);

create table public.member_voice_notes (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique
    check (char_length(storage_path) between 50 and 300),
  mime_type text not null
    check (mime_type in ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  duration_seconds integer not null check (duration_seconds between 1 and 300),
  caption text check (caption is null or char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade,
  foreign key (church_id, user_id)
    references public.memberships (church_id, user_id) on delete cascade
);

create index member_voice_notes_fellowship_user_idx
  on public.member_voice_notes (fellowship_id, user_id, created_at desc);
create index member_voice_notes_church_user_idx
  on public.member_voice_notes (church_id, user_id);
create index member_voice_notes_user_idx
  on public.member_voice_notes (user_id);

create or replace function private.enforce_member_fellowship_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_church_id bigint;
begin
  select fellowship.church_id into target_church_id
  from public.fellowships fellowship
  join public.fellowship_service_plans plan
    on plan.fellowship_id = fellowship.id
   and plan.status = 'published'
  where fellowship.id = new.fellowship_id;

  if actor_id is null
    or target_church_id is null
    or new.church_id <> target_church_id
    or not (select private.is_church_member(target_church_id)) then
    raise exception 'Private notes require a published same-church fellowship service';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := actor_id;
  elsif new.id <> old.id
    or new.church_id <> old.church_id
    or new.fellowship_id <> old.fellowship_id
    or new.user_id <> old.user_id
    or new.created_at <> old.created_at
    or old.user_id <> actor_id then
    raise exception 'Private note ownership and fellowship cannot be changed';
  end if;
  return new;
end;
$$;

create trigger member_fellowship_notes_enforce
before insert or update on public.member_fellowship_notes
for each row execute function private.enforce_member_fellowship_note();
create trigger member_fellowship_notes_set_updated_at
before update on public.member_fellowship_notes
for each row execute function private.set_updated_at();

create or replace function private.enforce_member_verse_highlight()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_church_id bigint;
begin
  select fellowship.church_id into target_church_id
  from public.fellowships fellowship
  where fellowship.id = new.fellowship_id;

  if actor_id is null
    or target_church_id is null
    or new.church_id <> target_church_id
    or not (select private.is_church_member(target_church_id)) then
    raise exception 'Verse highlights require an active same-church membership';
  end if;

  if not exists (
    select 1
    from public.fellowship_service_plans plan
    join public.fellowship_service_items item on item.plan_id = plan.id
    where plan.fellowship_id = new.fellowship_id
      and plan.status = 'published'
      and item.item_kind = 'scripture'
      and item.book_code = new.book_code
      and item.chapter = new.chapter
      and item.verse_start <= new.verse_start
      and item.verse_end >= new.verse_end
  ) then
    raise exception 'Highlights must belong to a published prepared Scripture passage';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := actor_id;
  elsif new.id <> old.id
    or new.church_id <> old.church_id
    or new.fellowship_id <> old.fellowship_id
    or new.user_id <> old.user_id
    or new.book_code <> old.book_code
    or new.chapter <> old.chapter
    or new.verse_start <> old.verse_start
    or new.verse_end <> old.verse_end
    or new.created_at <> old.created_at
    or old.user_id <> actor_id then
    raise exception 'Highlight ownership and Bible reference cannot be changed';
  end if;

  new.selected_text := btrim(new.selected_text);
  new.reflection := nullif(btrim(coalesce(new.reflection, '')), '');
  return new;
end;
$$;

create trigger member_verse_highlights_enforce
before insert or update on public.member_verse_highlights
for each row execute function private.enforce_member_verse_highlight();
create trigger member_verse_highlights_set_updated_at
before update on public.member_verse_highlights
for each row execute function private.set_updated_at();

create or replace function private.can_access_member_voice_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and object_name ~ '^[0-9a-f-]{36}/[0-9]+/[0-9]+/[0-9a-f-]{36}\.(webm|m4a|mp3|ogg|wav|mp4)$'
    and split_part(object_name, '/', 1) = (select auth.uid())::text
    and (select private.is_church_member(split_part(object_name, '/', 2)::bigint))
    and exists (
      select 1
      from public.fellowships fellowship
      where fellowship.id = split_part(object_name, '/', 3)::bigint
        and fellowship.church_id = split_part(object_name, '/', 2)::bigint
    );
$$;

create or replace function private.enforce_member_voice_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_church_id bigint;
begin
  select fellowship.church_id into target_church_id
  from public.fellowships fellowship
  join public.fellowship_service_plans plan
    on plan.fellowship_id = fellowship.id
   and plan.status = 'published'
  where fellowship.id = new.fellowship_id;

  if actor_id is null
    or target_church_id is null
    or new.church_id <> target_church_id
    or not (select private.is_church_member(target_church_id))
    or not (select private.can_access_member_voice_object(new.storage_path)) then
    raise exception 'Voice notes require an owned same-church Storage object';
  end if;

  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'member-voice-notes'
      and object.name = new.storage_path
      and object.owner_id = actor_id::text
  ) then
    raise exception 'Voice-note Storage object does not exist';
  end if;

  new.user_id := actor_id;
  new.caption := nullif(btrim(coalesce(new.caption, '')), '');
  return new;
end;
$$;

create trigger member_voice_notes_enforce
before insert on public.member_voice_notes
for each row execute function private.enforce_member_voice_note();

alter table public.member_fellowship_notes enable row level security;
alter table public.member_verse_highlights enable row level security;
alter table public.member_voice_notes enable row level security;

create policy member_fellowship_notes_own
on public.member_fellowship_notes for all to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
);

create policy member_verse_highlights_own
on public.member_verse_highlights for all to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
);

create policy member_voice_notes_select
on public.member_voice_notes for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
);

create policy member_voice_notes_insert
on public.member_voice_notes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
);

create policy member_voice_notes_delete
on public.member_voice_notes for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_church_member(church_id))
);

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'member-voice-notes',
  'member-voice-notes',
  false,
  10485760,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy member_voice_objects_select
on storage.objects for select to authenticated
using (
  bucket_id = 'member-voice-notes'
  and owner_id = (select auth.uid())::text
  and (select private.can_access_member_voice_object(name))
);

create policy member_voice_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-voice-notes'
  and owner_id = (select auth.uid())::text
  and (select private.can_access_member_voice_object(name))
);

create policy member_voice_objects_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-voice-notes'
  and owner_id = (select auth.uid())::text
  and (select private.can_access_member_voice_object(name))
);

create or replace function public.fellowship_service_capabilities(
  p_fellowship_id bigint
)
returns table (
  can_view boolean,
  can_manage_program boolean,
  can_prepare_worship boolean,
  can_prepare_sermon boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.fellowship_service_plans plan
      where plan.fellowship_id = p_fellowship_id
        and (select private.can_view_fellowship_service_plan(plan.id))
    ),
    (select private.can_prepare_fellowship_service(p_fellowship_id, 'program')),
    (select private.can_prepare_fellowship_service(p_fellowship_id, 'worship')),
    (select private.can_prepare_fellowship_service(p_fellowship_id, 'sermon'));
$$;

create or replace function private.list_fellowship_service_slides(
  p_fellowship_id bigint
)
returns table (
  plan_id bigint,
  church_id bigint,
  fellowship_id bigint,
  fellowship_title text,
  fellowship_starts_at timestamptz,
  plan_title text,
  plan_status text,
  sermon_topic text,
  sermon_summary text,
  preacher_name text,
  item_id bigint,
  item_kind text,
  section text,
  slide_position smallint,
  song_id bigint,
  song_external_id text,
  song_type text,
  song_number integer,
  song_title text,
  song_key text,
  song_lyrics text,
  song_chords text,
  book_code text,
  book_name_ne text,
  chapter smallint,
  verse_start smallint,
  verse_end smallint,
  item_label text,
  item_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    plan.id,
    plan.church_id,
    plan.fellowship_id,
    fellowship.title,
    fellowship.starts_at,
    plan.title,
    plan.status,
    plan.sermon_topic,
    plan.sermon_summary,
    preacher.full_name,
    item.id,
    item.item_kind,
    item.section,
    item.position,
    song.id,
    song.external_id,
    song.song_type,
    song.song_number,
    song.title_ne,
    coalesce(song.source_payload ->> 'key', song.description),
    song.lyrics_ne,
    song.chords,
    item.book_code,
    item.book_name_ne,
    item.chapter,
    item.verse_start,
    item.verse_end,
    item.label,
    item.note
  from public.fellowship_service_plans plan
  join public.fellowships fellowship on fellowship.id = plan.fellowship_id
  left join public.fellowship_service_items item on item.plan_id = plan.id
  left join public.songs song on song.id = item.song_id and song.is_published
  left join lateral (
    select profile.full_name
    from public.assignments assignment
    join public.memberships membership on membership.id = assignment.member_membership_id
    join public.profiles profile on profile.id = membership.user_id
    join public.ministry_roles ministry_role on ministry_role.id = assignment.ministry_role_id
    where assignment.fellowship_id = plan.fellowship_id
      and assignment.status in ('assigned', 'accepted', 'completed')
      and membership.status = 'active'
      and ministry_role.code = 'preach'
    order by assignment.id
    limit 1
  ) preacher on true
  where plan.fellowship_id = p_fellowship_id
    and (select private.can_view_fellowship_service_plan(plan.id))
  order by item.position nulls last, item.id;
$$;

create or replace function public.list_fellowship_service_slides(
  p_fellowship_id bigint
)
returns table (
  plan_id bigint,
  church_id bigint,
  fellowship_id bigint,
  fellowship_title text,
  fellowship_starts_at timestamptz,
  plan_title text,
  plan_status text,
  sermon_topic text,
  sermon_summary text,
  preacher_name text,
  item_id bigint,
  item_kind text,
  section text,
  slide_position smallint,
  song_id bigint,
  song_external_id text,
  song_type text,
  song_number integer,
  song_title text,
  song_key text,
  song_lyrics text,
  song_chords text,
  book_code text,
  book_name_ne text,
  chapter smallint,
  verse_start smallint,
  verse_end smallint,
  item_label text,
  item_note text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_fellowship_service_slides(p_fellowship_id);
$$;

revoke all on function private.can_prepare_fellowship_service(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function private.can_edit_fellowship_service_plan(bigint)
  from public, anon, authenticated, service_role;
revoke all on function private.can_view_fellowship_service_plan(bigint)
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_fellowship_service_plan()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_fellowship_service_item()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_member_fellowship_note()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_member_verse_highlight()
  from public, anon, authenticated, service_role;
revoke all on function private.can_access_member_voice_object(text)
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_member_voice_note()
  from public, anon, authenticated, service_role;
revoke all on function private.list_fellowship_service_slides(bigint)
  from public, anon, authenticated, service_role;

grant execute on function private.can_prepare_fellowship_service(bigint, text) to authenticated;
grant execute on function private.can_edit_fellowship_service_plan(bigint) to authenticated;
grant execute on function private.can_view_fellowship_service_plan(bigint) to authenticated;
grant execute on function private.can_access_member_voice_object(text) to authenticated;
grant execute on function private.list_fellowship_service_slides(bigint) to authenticated;

revoke all on public.fellowship_service_plans from public, anon;
revoke all on public.fellowship_service_items from public, anon;
revoke all on public.member_fellowship_notes from public, anon;
revoke all on public.member_verse_highlights from public, anon;
revoke all on public.member_voice_notes from public, anon;
grant select, insert, update, delete on public.fellowship_service_plans to authenticated;
grant select, insert, update, delete on public.fellowship_service_items to authenticated;
grant select, insert, update, delete on public.member_fellowship_notes to authenticated;
grant select, insert, update, delete on public.member_verse_highlights to authenticated;
grant select, insert, delete on public.member_voice_notes to authenticated;
grant usage, select on sequence public.fellowship_service_plans_id_seq to authenticated;
grant usage, select on sequence public.fellowship_service_items_id_seq to authenticated;
grant usage, select on sequence public.member_fellowship_notes_id_seq to authenticated;
grant usage, select on sequence public.member_verse_highlights_id_seq to authenticated;
grant usage, select on sequence public.member_voice_notes_id_seq to authenticated;

revoke all on function public.fellowship_service_capabilities(bigint) from public, anon;
revoke all on function public.list_fellowship_service_slides(bigint) from public, anon;
grant execute on function public.fellowship_service_capabilities(bigint) to authenticated;
grant execute on function public.list_fellowship_service_slides(bigint) to authenticated;

comment on table public.fellowship_service_plans is
  'One publishable, church-scoped worship and preaching plan for a fellowship.';
comment on table public.fellowship_service_items is
  'Ordered song and Scripture slides referencing the authorized worship catalog and Bible routes.';
comment on table public.member_fellowship_notes is
  'Private per-member written reflection for one published fellowship service.';
comment on table public.member_verse_highlights is
  'Private member-selected words or sentences from a prepared fellowship Scripture passage.';
comment on table public.member_voice_notes is
  'Private metadata for Storage-backed member voice reflections; audio bytes are not stored in Postgres.';
comment on function public.list_fellowship_service_slides(bigint) is
  'Returns a published plan to active same-church members, or a draft to its authorized preparers.';

notify pgrst, 'reload schema';
