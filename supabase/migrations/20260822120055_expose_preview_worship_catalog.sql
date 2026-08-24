-- Batch 5 preview catalog access.
-- Only the owner-authorized, published, global worship catalog is readable by
-- the temporary anonymous preview. Member/church songs and all writes remain
-- protected by the existing grants and RLS policies.

revoke select on table public.songs from anon;

grant select (
  id,
  external_id,
  title_ne,
  title_romanized,
  description,
  category,
  song_type,
  song_language,
  song_number,
  lyrics_ne,
  lyrics_romanized,
  lyrics_transliterated,
  chords,
  beat,
  audio_url,
  video_url,
  artist_credit,
  source_name,
  source_url,
  license_note,
  is_published,
  church_id,
  external_source
) on table public.songs to anon;

drop policy if exists "Anonymous preview reads authorized worship catalog"
  on public.songs;

create policy "Anonymous preview reads authorized worship catalog"
on public.songs
for select
to anon
using (
  is_published
  and church_id is null
  and external_source = 'paurakh_owner_export_2026_08_22'
);

create or replace function public.search_worship_songs(
  p_search_text text default null,
  p_song_type text default null,
  p_page_size integer default 30,
  p_page_offset integer default 0,
  p_external_ids text[] default null
)
returns table (
  id bigint,
  external_id text,
  title_ne text,
  title_romanized text,
  category text,
  song_type text,
  song_number integer,
  song_language text,
  artist_credit text,
  song_key text,
  beat text,
  has_chords boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.external_id,
    s.title_ne,
    s.title_romanized,
    s.category,
    s.song_type,
    s.song_number,
    s.song_language,
    s.artist_credit,
    s.chords as song_key,
    s.beat,
    nullif(btrim(s.chords), '') is not null as has_chords,
    count(*) over () as total_count
  from public.songs as s
  where s.is_published
    and s.church_id is null
    and s.external_source = 'paurakh_owner_export_2026_08_22'
    and (
      nullif(btrim(p_song_type), '') is null
      or s.song_type = btrim(p_song_type)
    )
    and (
      p_external_ids is null
      or s.external_id = any(p_external_ids)
    )
    and (
      nullif(btrim(p_search_text), '') is null
      or strpos(
        lower(concat_ws(
          ' ',
          s.song_number::text,
          s.title_ne,
          s.title_romanized,
          s.artist_credit,
          s.lyrics_ne,
          s.lyrics_romanized,
          s.lyrics_transliterated
        )),
        lower(btrim(p_search_text))
      ) > 0
    )
  order by
    case s.song_type
      when 'bhajan' then 1
      when 'chorus' then 2
      when 'kids' then 3
      else 4
    end,
    s.song_number nulls last,
    s.title_ne,
    s.external_id
  limit greatest(1, least(coalesce(p_page_size, 30), 50))
  offset greatest(coalesce(p_page_offset, 0), 0);
$$;

revoke all on function public.search_worship_songs(text, text, integer, integer, text[])
  from public, anon, authenticated;
grant execute on function public.search_worship_songs(text, text, integer, integer, text[])
  to anon, authenticated, service_role;

comment on function public.search_worship_songs(text, text, integer, integer, text[])
is 'Paginated metadata search for the published owner-authorized worship catalog. SECURITY INVOKER preserves caller RLS.';

notify pgrst, 'reload schema';
