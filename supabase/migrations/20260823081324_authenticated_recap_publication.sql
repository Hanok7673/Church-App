-- Authenticated fellowship recap publication.
-- Church content remains tenant-scoped: platform-only super admins receive no
-- implicit recap, fellowship, member, or audit access.

alter table public.recaps
  add column church_id bigint,
  add column testimony text,
  add column prayer_points text[] not null default '{}'::text[],
  add column scripture_references jsonb not null default '[]'::jsonb,
  add column song_external_ids text[] not null default '{}'::text[],
  add column published_by uuid references public.profiles (id) on delete set null,
  add column archived_at timestamptz;

update public.recaps recap
set church_id = fellowship.church_id,
    title = coalesce(nullif(btrim(recap.title), ''), fellowship.title || ' recap'),
    message_notes = coalesce(nullif(btrim(recap.message_notes), ''), 'Recap summary pending'),
    published_by = case when recap.status = 'published' then recap.author_id else null end
from public.fellowships fellowship
where fellowship.id = recap.fellowship_id;

alter table public.recaps
  alter column church_id set not null,
  alter column title set not null,
  alter column message_notes set not null;

alter table public.recaps drop constraint recaps_check;
alter table public.recaps drop constraint recaps_status_check;

alter table public.recaps
  add constraint recaps_status_check
    check (status in ('draft', 'published', 'archived')),
  add constraint recaps_publication_state_check
    check (
      (status = 'draft' and published_at is null and published_by is null and archived_at is null)
      or (status = 'published' and published_at is not null and published_by is not null and archived_at is null)
      or (status = 'archived' and published_at is not null and published_by is not null and archived_at is not null)
    ),
  add constraint recaps_title_length_check
    check (char_length(btrim(title)) between 2 and 200),
  add constraint recaps_summary_length_check
    check (char_length(btrim(message_notes)) between 2 and 12000),
  add constraint recaps_testimony_length_check
    check (testimony is null or char_length(testimony) <= 8000),
  add constraint recaps_prayer_points_count_check
    check (cardinality(prayer_points) <= 50),
  add constraint recaps_scripture_references_check
    check (jsonb_typeof(scripture_references) = 'array' and jsonb_array_length(scripture_references) <= 20),
  add constraint recaps_song_external_ids_count_check
    check (cardinality(song_external_ids) <= 50),
  add constraint recaps_fellowship_church_fkey
    foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade;

create index recaps_church_status_published_idx
  on public.recaps (church_id, status, published_at desc);
create index recaps_published_by_idx
  on public.recaps (published_by)
  where published_by is not null;

create table public.recap_publication_audit (
  id bigint generated always as identity primary key,
  recap_id bigint,
  church_id bigint not null references public.churches (id) on delete cascade,
  fellowship_id bigint not null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('created', 'updated', 'published', 'archived', 'deleted')),
  previous_status text,
  new_status text,
  occurred_at timestamptz not null default now(),
  foreign key (fellowship_id, church_id)
    references public.fellowships (id, church_id) on delete cascade
);

create index recap_publication_audit_recap_time_idx
  on public.recap_publication_audit (recap_id, occurred_at desc);
create index recap_publication_audit_church_time_idx
  on public.recap_publication_audit (church_id, occurred_at desc);
create index recap_publication_audit_fellowship_church_idx
  on public.recap_publication_audit (fellowship_id, church_id);
create index recap_publication_audit_actor_idx
  on public.recap_publication_audit (actor_id)
  where actor_id is not null;

alter table public.recap_publication_audit enable row level security;

create or replace function private.can_manage_recap(target_recap_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recaps recap
    where recap.id = target_recap_id
      and (select private.can_manage_fellowship(recap.fellowship_id, 'program'))
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
    from public.recaps recap
    where recap.id = target_recap_id
      and (
        (
          recap.status = 'published'
          and (select private.is_church_member(recap.church_id))
        )
        or (select private.can_manage_fellowship(recap.fellowship_id, 'program'))
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
    from public.recaps recap
    where recap.id = target_recap_id
      and recap.status = 'draft'
      and (select private.can_manage_fellowship(recap.fellowship_id, 'program'))
  );
$$;

create or replace function private.enforce_recap_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reference_item jsonb;
begin
  if new.author_id <> (select auth.uid()) and tg_op = 'INSERT' then
    raise exception 'Recap author must be the authenticated user';
  end if;

  if not (select private.can_manage_fellowship(new.fellowship_id, 'program')) then
    raise exception 'Only an authorized church or fellowship publisher can manage a recap';
  end if;

  if not exists (
    select 1 from public.fellowships fellowship
    where fellowship.id = new.fellowship_id
      and fellowship.church_id = new.church_id
  ) then
    raise exception 'Recap fellowship must belong to the selected church';
  end if;

  if exists (
    select 1 from unnest(new.prayer_points) point
    where nullif(btrim(point), '') is null or char_length(point) > 500
  ) then
    raise exception 'Prayer points must contain 1 to 500 characters';
  end if;

  for reference_item in select value from jsonb_array_elements(new.scripture_references)
  loop
    if jsonb_typeof(reference_item) <> 'object'
      or nullif(btrim(reference_item ->> 'hash'), '') is null
      or nullif(btrim(reference_item ->> 'label'), '') is null
      or char_length(reference_item ->> 'hash') > 40
      or char_length(reference_item ->> 'label') > 160
      or (reference_item ->> 'hash') !~ '^[A-Z0-9]{2,8}/[0-9]{1,3}(/[0-9]{1,3})?$' then
      raise exception 'Each Scripture reference requires a valid label and Bible route hash';
    end if;
  end loop;

  if cardinality(new.song_external_ids) <> (
    select count(distinct song_id)::integer from unnest(new.song_external_ids) song_id
  ) or exists (
    select 1 from unnest(new.song_external_ids) song_id
    where nullif(btrim(song_id), '') is null or char_length(song_id) > 100
  ) then
    raise exception 'Song references must be unique, non-empty catalog identifiers';
  end if;

  if exists (
    select 1
    from unnest(new.song_external_ids) requested_id
    where not exists (
      select 1 from public.songs song
      where song.external_id = requested_id
        and song.external_source = 'paurakh_owner_export_2026_08_22'
        and song.is_published
        and song.church_id is null
    )
  ) then
    raise exception 'Every recap song must exist in the authorized published worship catalog';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A new recap must begin as a draft';
    end if;
    new.published_at := null;
    new.published_by := null;
    new.archived_at := null;
    return new;
  end if;

  if new.id <> old.id
    or new.fellowship_id <> old.fellowship_id
    or new.church_id <> old.church_id
    or new.author_id <> old.author_id
    or new.created_at <> old.created_at then
    raise exception 'Recap church, fellowship, author, and identity fields cannot be changed';
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'published') then
      raise exception 'A draft recap can only remain a draft or be published';
    end if;
    if new.status = 'published' then
      new.published_at := now();
      new.published_by := (select auth.uid());
      new.archived_at := null;
    else
      new.published_at := null;
      new.published_by := null;
      new.archived_at := null;
    end if;
    return new;
  end if;

  if old.status = 'published' then
    if new.title is distinct from old.title
      or new.message_notes is distinct from old.message_notes
      or new.testimony is distinct from old.testimony
      or new.prayer_points is distinct from old.prayer_points
      or new.scripture_references is distinct from old.scripture_references
      or new.song_external_ids is distinct from old.song_external_ids then
      raise exception 'Published recap content is immutable; archive it instead';
    end if;
    if new.status not in ('published', 'archived') then
      raise exception 'A published recap can only remain published or be archived';
    end if;
    new.published_at := old.published_at;
    new.published_by := old.published_by;
    new.archived_at := case when new.status = 'archived' then now() else null end;
    return new;
  end if;

  raise exception 'An archived recap is immutable';
end;
$$;

drop trigger if exists recaps_enforce_publication on public.recaps;
create trigger recaps_enforce_publication
before insert or update on public.recaps
for each row execute function private.enforce_recap_publication();

create or replace function private.audit_recap_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
begin
  audit_action := case
    when tg_op = 'INSERT' then 'created'
    when tg_op = 'DELETE' then 'deleted'
    when new.status = 'published' and old.status = 'draft' then 'published'
    when new.status = 'archived' and old.status = 'published' then 'archived'
    else 'updated'
  end;

  insert into public.recap_publication_audit (
    recap_id, church_id, fellowship_id, actor_id, action, previous_status, new_status
  ) values (
    case when tg_op = 'DELETE' then old.id else new.id end,
    case when tg_op = 'DELETE' then old.church_id else new.church_id end,
    case when tg_op = 'DELETE' then old.fellowship_id else new.fellowship_id end,
    (select auth.uid()),
    audit_action,
    case when tg_op = 'INSERT' then null else old.status end,
    case when tg_op = 'DELETE' then null else new.status end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists recaps_audit_publication on public.recaps;
create trigger recaps_audit_publication
after insert or update or delete on public.recaps
for each row execute function private.audit_recap_publication();

drop policy recaps_select on public.recaps;
drop policy recaps_insert on public.recaps;
drop policy recaps_update on public.recaps;
drop policy recaps_delete on public.recaps;

create policy recaps_select
on public.recaps for select to authenticated
using ((select private.can_read_recap(id)));

create policy recaps_insert
on public.recaps for insert to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'draft'
  and (select private.can_manage_fellowship(fellowship_id, 'program'))
);

create policy recaps_update
on public.recaps for update to authenticated
using ((select private.can_manage_recap(id)))
with check ((select private.can_manage_recap(id)));

create policy recaps_delete
on public.recaps for delete to authenticated
using (
  status in ('draft', 'archived')
  and (select private.can_manage_recap(id))
);

drop policy recap_items_select on public.recap_items;
drop policy recap_items_insert on public.recap_items;
drop policy recap_items_update on public.recap_items;
drop policy recap_items_delete on public.recap_items;

create policy recap_items_select
on public.recap_items for select to authenticated
using ((select private.can_read_recap(recap_id)));
create policy recap_items_insert
on public.recap_items for insert to authenticated
with check ((select private.can_edit_recap(recap_id)));
create policy recap_items_update
on public.recap_items for update to authenticated
using ((select private.can_edit_recap(recap_id)))
with check ((select private.can_edit_recap(recap_id)));
create policy recap_items_delete
on public.recap_items for delete to authenticated
using ((select private.can_edit_recap(recap_id)));

create policy recap_publication_audit_select
on public.recap_publication_audit for select to authenticated
using ((select private.can_manage_fellowship(fellowship_id, 'program')));

revoke all on function private.can_manage_recap(bigint) from public, anon, authenticated, service_role;
revoke all on function private.can_read_recap(bigint) from public, anon, authenticated, service_role;
revoke all on function private.can_edit_recap(bigint) from public, anon, authenticated, service_role;
revoke all on function private.enforce_recap_publication() from public, anon, authenticated, service_role;
revoke all on function private.audit_recap_publication() from public, anon, authenticated, service_role;
grant execute on function private.can_manage_recap(bigint) to authenticated;
grant execute on function private.can_read_recap(bigint) to authenticated;
grant execute on function private.can_edit_recap(bigint) to authenticated;

revoke all on public.recap_publication_audit from anon, authenticated;
grant select on public.recap_publication_audit to authenticated;
grant select on public.recap_publication_audit to service_role;

create or replace function public.list_published_recaps(
  p_church_id bigint,
  p_limit integer default 50
)
returns table (
  id bigint,
  church_id bigint,
  fellowship_id bigint,
  fellowship_title text,
  fellowship_starts_at timestamptz,
  author_name text,
  title text,
  summary text,
  testimony text,
  prayer_points text[],
  scripture_references jsonb,
  song_external_ids text[],
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    recap.id,
    recap.church_id,
    recap.fellowship_id,
    fellowship.title,
    fellowship.starts_at,
    profile.full_name,
    recap.title,
    recap.message_notes,
    recap.testimony,
    recap.prayer_points,
    recap.scripture_references,
    recap.song_external_ids,
    recap.published_at
  from public.recaps recap
  join public.fellowships fellowship on fellowship.id = recap.fellowship_id
  join public.profiles profile on profile.id = recap.author_id
  where recap.church_id = p_church_id
    and recap.status = 'published'
    and (select private.is_church_member(p_church_id))
  order by recap.published_at desc, recap.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.list_manageable_recaps(
  p_church_id bigint
)
returns table (
  id bigint,
  church_id bigint,
  fellowship_id bigint,
  fellowship_title text,
  title text,
  summary text,
  testimony text,
  prayer_points text[],
  scripture_references jsonb,
  song_external_ids text[],
  status text,
  published_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    recap.id,
    recap.church_id,
    recap.fellowship_id,
    fellowship.title,
    recap.title,
    recap.message_notes,
    recap.testimony,
    recap.prayer_points,
    recap.scripture_references,
    recap.song_external_ids,
    recap.status,
    recap.published_at,
    recap.archived_at,
    recap.updated_at
  from public.recaps recap
  join public.fellowships fellowship on fellowship.id = recap.fellowship_id
  where recap.church_id = p_church_id
    and (select private.can_manage_fellowship(recap.fellowship_id, 'program'))
  order by fellowship.starts_at desc, recap.id desc;
$$;

revoke all on function public.list_published_recaps(bigint, integer) from public, anon;
revoke all on function public.list_manageable_recaps(bigint) from public, anon;
grant execute on function public.list_published_recaps(bigint, integer) to authenticated;
grant execute on function public.list_manageable_recaps(bigint) to authenticated;

comment on table public.recap_publication_audit is
  'Immutable audit history for tenant-scoped fellowship recap publication.';
comment on function public.list_published_recaps(bigint, integer) is
  'Returns published fellowship recaps only to active members of the selected church.';
comment on function public.list_manageable_recaps(bigint) is
  'Returns recap drafts and history only to authorized church or fellowship publishers.';

notify pgrst, 'reload schema';
