create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'नयाँ सदस्य',
  avatar_url text,
  preferred_language text not null default 'ne' check (preferred_language in ('ne', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  date_of_birth date,
  high_contrast boolean not null default false,
  text_scale_override numeric(3, 2) check (text_scale_override between 1.00 and 1.50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.churches (
  id bigint generated always as identity primary key,
  name text not null,
  name_ne text,
  description text,
  address text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'leader', 'member')),
  status text not null default 'active' check (status in ('invited', 'active', 'inactive')),
  joined_at timestamptz not null default now(),
  unique (church_id, user_id)
);

create table public.ministry_roles (
  id bigint generated always as identity primary key,
  code text not null unique,
  name_en text not null,
  name_ne text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

create table public.fellowships (
  id bigint generated always as identity primary key,
  church_id bigint not null references public.churches (id) on delete cascade,
  title text not null,
  host_membership_id bigint references public.memberships (id) on delete set null,
  location_name text,
  address text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  recurrence_rule text,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.assignments (
  id bigint generated always as identity primary key,
  fellowship_id bigint not null references public.fellowships (id) on delete cascade,
  member_membership_id bigint not null references public.memberships (id) on delete cascade,
  ministry_role_id bigint not null references public.ministry_roles (id),
  notes text,
  assigned_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (fellowship_id, ministry_role_id)
);

create table public.recaps (
  id bigint generated always as identity primary key,
  fellowship_id bigint not null unique references public.fellowships (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  title text,
  message_notes text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'draft' and published_at is null) or (status = 'published' and published_at is not null))
);

create table public.bible_references (
  id bigint generated always as identity primary key,
  source_code text not null default 'nepali',
  book_code text not null,
  book_name_ne text not null,
  chapter smallint not null check (chapter > 0),
  verse_start smallint check (verse_start > 0),
  verse_end smallint,
  label_ne text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (source_code, book_code, chapter, verse_start, verse_end),
  check (
    (verse_start is null and verse_end is null)
    or (verse_start is not null and (verse_end is null or verse_end >= verse_start))
  )
);

create table public.songs (
  id bigint generated always as identity primary key,
  church_id bigint references public.churches (id) on delete cascade,
  title_ne text not null,
  title_romanized text,
  category text not null default 'आराधना',
  lyrics_ne text not null,
  chords text,
  source_name text,
  source_url text,
  license_note text,
  is_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recap_items (
  id bigint generated always as identity primary key,
  recap_id bigint not null references public.recaps (id) on delete cascade,
  kind text not null check (kind in ('song', 'bible', 'note')),
  position smallint not null default 0 check (position >= 0),
  song_id bigint references public.songs (id) on delete restrict,
  bible_reference_id bigint references public.bible_references (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (kind = 'song' and song_id is not null and bible_reference_id is null and notes is null)
    or (kind = 'bible' and song_id is null and bible_reference_id is not null and notes is null)
    or (kind = 'note' and song_id is null and bible_reference_id is null and notes is not null)
  )
);

create table public.attendance (
  id bigint generated always as identity primary key,
  fellowship_id bigint not null references public.fellowships (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'unknown' check (status in ('attended', 'missed', 'unknown')),
  marked_at timestamptz not null default now(),
  unique (fellowship_id, user_id)
);

create table public.song_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_id bigint not null references public.songs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create index churches_created_by_idx on public.churches (created_by);
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_church_role_idx on public.memberships (church_id, role) where status = 'active';
create index fellowships_church_starts_idx on public.fellowships (church_id, starts_at);
create index fellowships_host_membership_id_idx on public.fellowships (host_membership_id);
create index fellowships_created_by_idx on public.fellowships (created_by);
create index assignments_fellowship_id_idx on public.assignments (fellowship_id);
create index assignments_member_membership_id_idx on public.assignments (member_membership_id);
create index assignments_ministry_role_id_idx on public.assignments (ministry_role_id);
create index assignments_assigned_by_idx on public.assignments (assigned_by);
create index recaps_author_id_idx on public.recaps (author_id);
create index bible_references_created_by_idx on public.bible_references (created_by);
create index bible_references_book_chapter_idx on public.bible_references (source_code, book_code, chapter);
create index songs_church_published_idx on public.songs (church_id, is_published);
create index songs_created_by_idx on public.songs (created_by);
create index recap_items_recap_position_idx on public.recap_items (recap_id, position);
create index recap_items_song_id_idx on public.recap_items (song_id);
create index recap_items_bible_reference_id_idx on public.recap_items (bible_reference_id);
create index attendance_user_id_idx on public.attendance (user_id);
create index song_favorites_song_id_idx on public.song_favorites (song_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'नयाँ सदस्य'))
  on conflict (id) do nothing;

  insert into public.profile_private (id, phone)
  values (new.id, new.phone)
  on conflict (id) do update set phone = excluded.phone;

  return new;
end;
$$;

create or replace function private.add_church_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by <> (select auth.uid()) then
    raise exception 'Church creator must be the current user';
  end if;

  insert into public.memberships (church_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active');

  return new;
end;
$$;

create or replace function private.is_church_member(target_church_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.memberships m
      where m.church_id = target_church_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    );
$$;

create or replace function private.is_church_leader(target_church_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.memberships m
      where m.church_id = target_church_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'leader')
    );
$$;

create or replace function private.is_church_admin(target_church_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.memberships m
      where m.church_id = target_church_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role in ('owner', 'admin')
    );
$$;

create or replace function private.validate_fellowship_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.host_membership_id is not null and not exists (
    select 1 from public.memberships m
    where m.id = new.host_membership_id and m.church_id = new.church_id
  ) then
    raise exception 'Fellowship host must belong to the same church';
  end if;
  return new;
end;
$$;

create or replace function private.validate_assignment_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.fellowships f
    join public.memberships m on m.church_id = f.church_id
    where f.id = new.fellowship_id
      and m.id = new.member_membership_id
      and m.status = 'active'
  ) then
    raise exception 'Assigned member must be active in the fellowship church';
  end if;
  return new;
end;
$$;

create or replace function private.shares_church(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select other_user_id = (select auth.uid())
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on theirs.church_id = mine.church_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = other_user_id
        and theirs.status = 'active'
    );
$$;

create or replace function private.can_read_recap(target_recap_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recaps r
    join public.fellowships f on f.id = r.fellowship_id
    where r.id = target_recap_id
      and private.is_church_member(f.church_id)
      and (
        r.status = 'published'
        or r.author_id = (select auth.uid())
        or private.is_church_leader(f.church_id)
      )
  );
$$;

create or replace function private.can_edit_recap(target_recap_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recaps r
    join public.fellowships f on f.id = r.fellowship_id
    where r.id = target_recap_id
      and private.is_church_member(f.church_id)
      and (
        r.author_id = (select auth.uid())
        or private.is_church_leader(f.church_id)
      )
  );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.add_church_owner() from public, anon, authenticated;
revoke all on function private.is_church_member(bigint) from public, anon;
revoke all on function private.is_church_leader(bigint) from public, anon;
revoke all on function private.is_church_admin(bigint) from public, anon;
revoke all on function private.validate_fellowship_host() from public, anon, authenticated;
revoke all on function private.validate_assignment_membership() from public, anon, authenticated;
revoke all on function private.shares_church(uuid) from public, anon;
revoke all on function private.can_read_recap(bigint) from public, anon;
revoke all on function private.can_edit_recap(bigint) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.is_church_member(bigint) to authenticated;
grant execute on function private.is_church_leader(bigint) to authenticated;
grant execute on function private.is_church_admin(bigint) to authenticated;
grant execute on function private.shares_church(uuid) to authenticated;
grant execute on function private.can_read_recap(bigint) to authenticated;
grant execute on function private.can_edit_recap(bigint) to authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger profile_private_set_updated_at before update on public.profile_private
for each row execute function private.set_updated_at();
create trigger churches_set_updated_at before update on public.churches
for each row execute function private.set_updated_at();
create trigger fellowships_set_updated_at before update on public.fellowships
for each row execute function private.set_updated_at();
create trigger fellowships_validate_host before insert or update on public.fellowships
for each row execute function private.validate_fellowship_host();
create trigger assignments_validate_membership before insert or update on public.assignments
for each row execute function private.validate_assignment_membership();
create trigger recaps_set_updated_at before update on public.recaps
for each row execute function private.set_updated_at();
create trigger songs_set_updated_at before update on public.songs
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger on_church_created
after insert on public.churches
for each row execute function private.add_church_owner();

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.churches enable row level security;
alter table public.memberships enable row level security;
alter table public.ministry_roles enable row level security;
alter table public.fellowships enable row level security;
alter table public.assignments enable row level security;
alter table public.recaps enable row level security;
alter table public.bible_references enable row level security;
alter table public.songs enable row level security;
alter table public.recap_items enable row level security;
alter table public.attendance enable row level security;
alter table public.song_favorites enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.shares_church(id)));
create policy profiles_insert on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy profile_private_select on public.profile_private for select to authenticated
using ((select auth.uid()) = id);
create policy profile_private_insert on public.profile_private for insert to authenticated
with check ((select auth.uid()) = id);
create policy profile_private_update on public.profile_private for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy churches_select on public.churches for select to authenticated
using ((select private.is_church_member(id)));
create policy churches_insert on public.churches for insert to authenticated
with check ((select auth.uid()) = created_by);
create policy churches_update on public.churches for update to authenticated
using ((select private.is_church_admin(id)))
with check ((select private.is_church_admin(id)));
create policy churches_delete on public.churches for delete to authenticated
using ((select private.is_church_admin(id)));

create policy memberships_select on public.memberships for select to authenticated
using ((select private.is_church_member(church_id)));
create policy memberships_insert on public.memberships for insert to authenticated
with check ((select private.is_church_admin(church_id)));
create policy memberships_update on public.memberships for update to authenticated
using ((select private.is_church_admin(church_id)))
with check ((select private.is_church_admin(church_id)));
create policy memberships_delete on public.memberships for delete to authenticated
using ((select private.is_church_admin(church_id)));

create policy ministry_roles_select on public.ministry_roles for select to authenticated
using (true);

create policy fellowships_select on public.fellowships for select to authenticated
using ((select private.is_church_member(church_id)));
create policy fellowships_insert on public.fellowships for insert to authenticated
with check ((select auth.uid()) = created_by and (select private.is_church_leader(church_id)));
create policy fellowships_update on public.fellowships for update to authenticated
using ((select private.is_church_leader(church_id)))
with check ((select private.is_church_leader(church_id)));
create policy fellowships_delete on public.fellowships for delete to authenticated
using ((select private.is_church_leader(church_id)));

create policy assignments_select on public.assignments for select to authenticated
using (exists (
  select 1 from public.fellowships f
  where f.id = assignments.fellowship_id
    and (select private.is_church_member(f.church_id))
));
create policy assignments_insert on public.assignments for insert to authenticated
with check (exists (
  select 1 from public.fellowships f
  where f.id = assignments.fellowship_id
    and (select private.is_church_leader(f.church_id))
));
create policy assignments_update on public.assignments for update to authenticated
using (exists (
  select 1 from public.fellowships f
  where f.id = assignments.fellowship_id
    and (select private.is_church_leader(f.church_id))
))
with check (exists (
  select 1 from public.fellowships f
  where f.id = assignments.fellowship_id
    and (select private.is_church_leader(f.church_id))
));
create policy assignments_delete on public.assignments for delete to authenticated
using (exists (
  select 1 from public.fellowships f
  where f.id = assignments.fellowship_id
    and (select private.is_church_leader(f.church_id))
));

create policy recaps_select on public.recaps for select to authenticated
using ((select private.can_read_recap(id)));
create policy recaps_insert on public.recaps for insert to authenticated
with check (
  (select auth.uid()) = author_id
  and exists (
    select 1 from public.fellowships f
    where f.id = recaps.fellowship_id
      and (select private.is_church_member(f.church_id))
  )
);
create policy recaps_update on public.recaps for update to authenticated
using ((select private.can_edit_recap(id)))
with check ((select private.can_edit_recap(id)));
create policy recaps_delete on public.recaps for delete to authenticated
using ((select private.can_edit_recap(id)));

create policy bible_references_select on public.bible_references for select to authenticated
using (true);
create policy bible_references_insert on public.bible_references for insert to authenticated
with check ((select auth.uid()) = created_by);
create policy bible_references_update on public.bible_references for update to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);
create policy bible_references_delete on public.bible_references for delete to authenticated
using ((select auth.uid()) = created_by);

create policy songs_select on public.songs for select to authenticated
using (is_published or (church_id is not null and (select private.is_church_member(church_id))));
create policy songs_insert on public.songs for insert to authenticated
with check (
  church_id is not null
  and (select auth.uid()) = created_by
  and (select private.is_church_leader(church_id))
);
create policy songs_update on public.songs for update to authenticated
using (church_id is not null and (select private.is_church_leader(church_id)))
with check (church_id is not null and (select private.is_church_leader(church_id)));
create policy songs_delete on public.songs for delete to authenticated
using (church_id is not null and (select private.is_church_leader(church_id)));

create policy recap_items_select on public.recap_items for select to authenticated
using ((select private.can_read_recap(recap_id)));
create policy recap_items_insert on public.recap_items for insert to authenticated
with check ((select private.can_edit_recap(recap_id)));
create policy recap_items_update on public.recap_items for update to authenticated
using ((select private.can_edit_recap(recap_id)))
with check ((select private.can_edit_recap(recap_id)));
create policy recap_items_delete on public.recap_items for delete to authenticated
using ((select private.can_edit_recap(recap_id)));

create policy attendance_select on public.attendance for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.fellowships f
    where f.id = attendance.fellowship_id
      and (select private.is_church_leader(f.church_id))
  )
);
create policy attendance_insert on public.attendance for insert to authenticated
with check (
  ((select auth.uid()) = user_id and exists (
    select 1 from public.fellowships f
    where f.id = attendance.fellowship_id
      and (select private.is_church_member(f.church_id))
  ))
  or exists (
    select 1 from public.fellowships f
    where f.id = attendance.fellowship_id
      and (select private.is_church_leader(f.church_id))
  )
);
create policy attendance_update on public.attendance for update to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.fellowships f
    where f.id = attendance.fellowship_id
      and (select private.is_church_leader(f.church_id))
  )
)
with check (
  ((select auth.uid()) = user_id and exists (
    select 1 from public.fellowships f
    where f.id = attendance.fellowship_id
      and (select private.is_church_member(f.church_id))
  ))
  or exists (
    select 1 from public.fellowships f
    where f.id = attendance.fellowship_id
      and (select private.is_church_leader(f.church_id))
  )
);
create policy attendance_delete on public.attendance for delete to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.fellowships f
    where f.id = attendance.fellowship_id
      and (select private.is_church_leader(f.church_id))
  )
);

create policy song_favorites_select on public.song_favorites for select to authenticated
using ((select auth.uid()) = user_id);
create policy song_favorites_insert on public.song_favorites for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy song_favorites_delete on public.song_favorites for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profile_private to authenticated;
grant select, insert, update, delete on public.churches to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select on public.ministry_roles to authenticated;
grant select, insert, update, delete on public.fellowships to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.recaps to authenticated;
grant select, insert, update, delete on public.bible_references to authenticated;
grant select, insert, update, delete on public.songs to authenticated;
grant select, insert, update, delete on public.recap_items to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, delete on public.song_favorites to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.ministry_roles (code, name_en, name_ne, sort_order)
values
  ('lead', 'Lead', 'अगुवाइ', 10),
  ('worship', 'Worship', 'आराधना', 20),
  ('preach', 'Preaching', 'वचन बाँड्ने', 30),
  ('prayer', 'Prayer', 'प्रार्थना', 40),
  ('host', 'Host', 'आतिथ्य', 50);

comment on table public.profile_private is 'Private profile attributes; never expose these fields in the member directory.';
comment on column public.songs.license_note is 'Required licensing or permission note for imported Nepali worship lyrics.';
comment on column public.bible_references.source_code is 'Versioned identifier for the approved Nepali Bible source used by the app.';
