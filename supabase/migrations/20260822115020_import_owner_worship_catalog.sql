create table public.worship_artists (
  id bigint generated always as identity primary key,
  external_source text not null,
  external_id text not null,
  name text not null,
  description text,
  photo_url text,
  source_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_payload) = 'object'),
  original_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_source, external_id)
);

comment on table public.worship_artists is
  'Artists from owner-authorized worship catalog imports.';

alter table public.songs
  add column external_source text,
  add column external_id text,
  add column description text,
  add column song_number integer check (song_number is null or song_number > 0),
  add column song_type text,
  add column song_language text,
  add column lyrics_romanized text,
  add column lyrics_transliterated text,
  add column beat text,
  add column audio_url text,
  add column video_url text,
  add column artist_id bigint references public.worship_artists (id) on delete set null,
  add column artist_credit text,
  add column source_payload jsonb
    check (source_payload is null or jsonb_typeof(source_payload) = 'object'),
  add column original_created_at timestamptz,
  add column original_updated_at timestamptz,
  add constraint songs_external_source_id_key unique (external_source, external_id);

create index songs_catalog_type_number_idx
  on public.songs (song_type, song_number)
  where is_published;
create index songs_artist_id_idx on public.songs (artist_id);
create index songs_language_idx on public.songs (song_language)
  where is_published;

alter table public.worship_artists enable row level security;

revoke all on table public.worship_artists from public, anon;
revoke insert, update, delete on table public.worship_artists from authenticated;
grant select on table public.worship_artists to authenticated;
grant select, insert, update, delete on table public.worship_artists to service_role;
grant usage, select on sequence public.worship_artists_id_seq to service_role;

create policy "Authenticated users read worship artists"
on public.worship_artists for select
to authenticated
using (true);

create policy "Service role manages worship artists"
on public.worship_artists for all
to service_role
using (true)
with check (true);

create trigger worship_artists_set_updated_at
before update on public.worship_artists
for each row execute function private.set_updated_at();

