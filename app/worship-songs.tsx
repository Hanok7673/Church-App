"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { Database } from "../types/supabase";

type SongListItem = Database["public"]["Functions"]["search_worship_songs"]["Returns"][number];
type SongDetail = Pick<Database["public"]["Tables"]["songs"]["Row"],
  | "id"
  | "external_id"
  | "title_ne"
  | "title_romanized"
  | "description"
  | "category"
  | "song_type"
  | "song_language"
  | "song_number"
  | "lyrics_ne"
  | "lyrics_romanized"
  | "lyrics_transliterated"
  | "chords"
  | "beat"
  | "audio_url"
  | "video_url"
  | "artist_credit"
  | "source_name"
  | "source_url"
  | "license_note"
>;

type SongTypeFilter = "all" | "bhajan" | "chorus" | "kids" | "others" | "favourites";
type LyricBlock = { label: string; lines: string[] };

const PAGE_SIZE = 30;
const FAVOURITES_KEY = "church-app-preview-song-favourites-v1";
const RECAP_SELECTION_KEY = "church-app-preview-recap-song-selection-v1";
const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const CHORD_MARKER = /\[([A-G][^\]\n]{0,47})\]/g;
const SONG_FILTERS: { value: SongTypeFilter; label: string }[] = [
  { value: "all", label: "सबै" },
  { value: "bhajan", label: "भजन" },
  { value: "chorus", label: "कोरस" },
  { value: "kids", label: "बाल कोरस" },
  { value: "others", label: "अन्य गीत" },
  { value: "favourites", label: "मनपर्ने" },
];

export function transposeChord(chord: string, steps: number) {
  if (!steps) return chord;
  const preferFlats = chord.includes("b") || chord.includes("♭");
  return chord.replace(/(^|[\s,/])([A-G])([#b♭]?)(?=(?:m|M|maj|min|dim|aug|sus|add|\d|\(|[\s,/]|$))/g, (_match, prefix: string, letter: string, accidental: string) => {
    const note = `${letter}${accidental === "♭" ? "b" : accidental}`;
    let index = SHARP_NOTES.indexOf(note);
    if (index < 0) index = FLAT_NOTES.indexOf(note);
    if (index < 0) return `${prefix}${note}`;
    const nextIndex = (index + steps + 120) % 12;
    return `${prefix}${preferFlats ? FLAT_NOTES[nextIndex] : SHARP_NOTES[nextIndex]}`;
  });
}

function readStoredIds(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function readSelectedSongId() {
  if (typeof window === "undefined") return "";
  const match = window.location.hash.match(/^#songs\/([^/?#]+)$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function songTypeLabel(songType: string | null) {
  return SONG_FILTERS.find((item) => item.value === songType)?.label ?? "अन्य गीत";
}

function songNumberLabel(songNumber: number | null) {
  return songNumber === null ? "♪" : String(songNumber).padStart(2, "0");
}

function parseLyrics(lyrics: string): LyricBlock[] {
  const normalized = lyrics.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  return normalized.split(/\n{2,}/).map((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trimEnd()).filter(Boolean);
    const firstLine = lines[0] ?? "";
    const marker = firstLine.match(/^((?:को(?:रस)?|chorus|verse|bridge|[०-९0-9]+)\s*[:.)-])\s*/i);
    const label = marker?.[1] ?? (blockIndex === 0 ? "गीत" : `अन्तरा ${blockIndex + 1}`);
    if (marker) lines[0] = firstLine.slice(marker[0].length);
    return { label, lines: lines.filter(Boolean) };
  }).filter((block) => block.lines.length > 0);
}

export function lyricLineWithoutChords(line: string) {
  return line.replace(CHORD_MARKER, "");
}

export function hasInlineChordMarkers(lyrics: string) {
  return new RegExp(CHORD_MARKER.source).test(lyrics);
}

export function renderChordedLine(line: string, transpose: number): ReactNode {
  const fragments: ReactNode[] = [];
  const matches = Array.from(line.matchAll(new RegExp(CHORD_MARKER.source, "g")));
  if (matches.length === 0) return <span>{line}</span>;
  const firstIndex = matches[0].index ?? 0;
  if (firstIndex > 0) fragments.push(<span className="song-plain-lyric" key="leading">{line.slice(0, firstIndex)}</span>);

  matches.forEach((match, index) => {
    const markerStart = match.index ?? 0;
    const lyricStart = markerStart + match[0].length;
    const lyricEnd = matches[index + 1]?.index ?? line.length;
    fragments.push(
      <span className="song-chord-segment" key={`chord-${markerStart}`}>
        <b>{transposeChord(match[1], transpose)}</b>
        <span>{line.slice(lyricStart, lyricEnd) || "\u00a0"}</span>
      </span>,
    );
  });
  return fragments;
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function SongMark() {
  return <span className="song-mark" aria-hidden="true">♪</span>;
}

export function WorshipSongs({ onHome, onSchedule, onBible, onMore }: {
  onHome: () => void;
  onSchedule: () => void;
  onBible: (hash?: string) => void;
  onMore: () => void;
}) {
  const [selectedId, setSelectedId] = useState(readSelectedSongId);
  const [selectedSong, setSelectedSong] = useState<SongDetail | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<SongTypeFilter>("all");
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [showChords, setShowChords] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [favourites, setFavourites] = useState<string[]>(() => readStoredIds(FAVOURITES_KEY));
  const [recapSelection, setRecapSelection] = useState<string[]>(() => readStoredIds(RECAP_SELECTION_KEY));
  const [notice, setNotice] = useState("");

  const favouriteFilterKey = filter === "favourites" ? favourites.join("|") : "";
  const selectedLyrics = useMemo(() => selectedSong ? parseLyrics(selectedSong.lyrics_ne) : [], [selectedSong]);
  const selectedHasInlineChords = Boolean(selectedSong && hasInlineChordMarkers(selectedSong.lyrics_ne));
  const selectedHasChords = Boolean(selectedSong?.chords) || selectedHasInlineChords;
  const selectedSourceUrl = safeHttpUrl(selectedSong?.source_url ?? null);
  const hasMore = songs.length < totalCount;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
      setSongs([]);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) {
      setListLoading(false);
      setListError("Supabase सार्वजनिक सेटिङ भेटिएन। .env.local जाँच गर्नुहोस्।");
      return;
    }

    setListLoading(true);
    setListError("");
    const favouriteIds = filter === "favourites" ? favourites : null;
    if (filter === "favourites" && favouriteIds.length === 0) {
      setSongs([]);
      setTotalCount(0);
      setListLoading(false);
      return;
    }

    client.rpc("search_worship_songs", {
      p_search_text: debouncedQuery || null,
      p_song_type: filter === "all" || filter === "favourites" ? null : filter,
      p_page_size: PAGE_SIZE,
      p_page_offset: page * PAGE_SIZE,
      p_external_ids: favouriteIds,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setListError("गीत सूची खोल्न सकिएन। इन्टरनेट जाँच गरी पुनः प्रयास गर्नुहोस्।");
        setListLoading(false);
        return;
      }
      const nextSongs = data ?? [];
      setSongs((current) => page === 0 ? nextSongs : [
        ...current,
        ...nextSongs.filter((song) => !current.some((item) => item.external_id === song.external_id)),
      ]);
      setTotalCount(nextSongs.length > 0 ? Number(nextSongs[0].total_count) : 0);
      setListLoading(false);
    });

    return () => { active = false; };
  }, [debouncedQuery, filter, page, favouriteFilterKey, retryToken]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSong(null);
      setDetailError("");
      return;
    }

    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) {
      setDetailError("गीत खोल्न Supabase सार्वजनिक सेटिङ आवश्यक छ।");
      return;
    }

    setSelectedSong(null);
    setDetailLoading(true);
    setDetailError("");
    client.from("songs").select("id, external_id, title_ne, title_romanized, description, category, song_type, song_language, song_number, lyrics_ne, lyrics_romanized, lyrics_transliterated, chords, beat, audio_url, video_url, artist_credit, source_name, source_url, license_note")
      .eq("external_id", selectedId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setDetailError("यो गीत भेटिएन वा अहिले खोल्न सकिएन।");
        else {
          setSelectedSong(data);
          setShowChords(hasInlineChordMarkers(data.lyrics_ne));
        }
        setDetailLoading(false);
      });

    return () => { active = false; };
  }, [selectedId, retryToken]);

  function openSong(song: SongListItem) {
    setSelectedId(song.external_id);
    setShowChords(song.has_chords);
    setTranspose(0);
    setFontScale(1);
    window.history.replaceState(null, "", `#songs/${encodeURIComponent(song.external_id)}`);
  }

  function closeSong() {
    setSelectedId("");
    setSelectedSong(null);
    setDetailError("");
    window.history.replaceState(null, "", "#songs");
  }

  function chooseFilter(nextFilter: SongTypeFilter) {
    setFilter(nextFilter);
    setPage(0);
    setSongs([]);
  }

  function updateStoredList(key: string, current: string[], id: string, message: [string, string], setter: (ids: string[]) => void) {
    const exists = current.includes(id);
    const next = exists ? current.filter((item) => item !== id) : [...current, id];
    setter(next);
    window.localStorage.setItem(key, JSON.stringify(next));
    setNotice(exists ? message[0] : message[1]);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function toggleFavourite(id: string) {
    if (filter === "favourites") {
      setPage(0);
      setSongs([]);
    }
    updateStoredList(FAVOURITES_KEY, favourites, id, ["मनपर्नेबाट हटाइयो।", "यस उपकरणमा मनपर्नेमा राखियो।"], setFavourites);
  }

  function toggleRecapSelection(id: string) {
    updateStoredList(RECAP_SELECTION_KEY, recapSelection, id, ["पुनरावलोकन छनोटबाट हटाइयो।", "पुनरावलोकनका लागि छानियो।"], setRecapSelection);
  }

  if (selectedId) {
    return (
      <div className="app-screen screen-enter">
        <header className="detail-header song-detail-header">
          <button className="icon-button" type="button" onClick={closeSong} aria-label="गीत सूचीमा फर्कनुहोस्">←</button>
          <div className="song-header-title"><strong>{selectedSong?.title_ne ?? "गीत खोलिँदैछ"}</strong><small>{selectedSong ? songTypeLabel(selectedSong.song_type) : "कृपया पर्खनुहोस्"}</small></div>
          <button className="song-favourite-button" type="button" disabled={!selectedSong?.external_id} onClick={() => selectedSong?.external_id && toggleFavourite(selectedSong.external_id)} aria-label="मनपर्नेमा राख्नुहोस्">{selectedSong?.external_id && favourites.includes(selectedSong.external_id) ? "★" : "☆"}</button>
        </header>

        <div className="app-scroll song-detail-content">
          {detailLoading && <div className="bible-loading" role="status"><span /><span /><span /><p>गीत खोलिँदैछ…</p></div>}
          {detailError && <div className="song-empty" role="alert"><span aria-hidden="true">!</span><strong>{detailError}</strong><button className="song-retry-button" type="button" onClick={() => setRetryToken((value) => value + 1)}>फेरि प्रयास गर्नुहोस्</button></div>}

          {selectedSong && (
            <>
              <section className="song-detail-hero">
                <div>
                  <span className="song-category-pill">{songTypeLabel(selectedSong.song_type)}{selectedSong.song_number !== null ? ` नं. ${selectedSong.song_number}` : ""}</span>
                  <h1>{selectedSong.title_ne}</h1>
                  <p>{selectedSong.artist_credit || selectedSong.title_romanized || "नेपाली ख्रीष्टियन आराधना गीत"}</p>
                </div>
                <SongMark />
              </section>

              <div className="song-detail-meta" aria-label="गीत विवरण">
                {selectedSong.chords && <span><small>मूल की</small><strong>{transposeChord(selectedSong.chords, transpose)}</strong></span>}
                {selectedSong.beat && <span><small>ताल</small><strong>{selectedSong.beat}</strong></span>}
                <span><small>भाषा</small><strong>{selectedSong.song_language === "ne" ? "नेपाली" : selectedSong.song_language || "नेपाली"}</strong></span>
              </div>

              <section className="song-detail-tools" aria-label="गीत पढ्ने सेटिङ">
                <label className="song-chord-toggle"><span><strong>कर्ड देखाउनुहोस्</strong><small>{selectedHasInlineChords ? "कर्डहरू शब्दको ठीक माथि देखाइएका छन्" : selectedSong.chords ? "मूल की उपलब्ध छ; शब्दमाथिको कर्ड स्थान उपलब्ध छैन" : "यस गीतमा कर्ड उपलब्ध छैन"}</small></span><input type="checkbox" checked={showChords} disabled={!selectedHasInlineChords} onChange={(event) => setShowChords(event.target.checked)} /></label>
                <div className="song-font-tools"><button type="button" onClick={() => setFontScale((value) => Math.max(0.9, value - 0.1))} aria-label="अक्षर सानो बनाउनुहोस्">अ−</button><span>{Math.round(fontScale * 100)}%</span><button type="button" onClick={() => setFontScale((value) => Math.min(1.4, value + 0.1))} aria-label="अक्षर ठूलो बनाउनुहोस्">अ+</button></div>
              </section>

              {selectedHasChords && (
                <section className="song-transpose" aria-label="कर्डको की परिवर्तन">
                  <div><strong>की / स्वर उचाइ</strong><small>हरेक पटक १ सेमिटोन · १२ सेमिटोन = १ अक्टेभ</small></div>
                  <div className="song-transpose-controls">
                    <button type="button" onClick={() => setTranspose((value) => Math.max(-12, value - 1))} disabled={transpose <= -12} aria-label="कर्ड एक सेमिटोन घटाउनुहोस्">−</button>
                    <span><b>{selectedSong.chords ? transposeChord(selectedSong.chords, transpose) : "±"}</b><small>{transpose > 0 ? `+${transpose}` : transpose}</small></span>
                    <button type="button" onClick={() => setTranspose((value) => Math.min(12, value + 1))} disabled={transpose >= 12} aria-label="कर्ड एक सेमिटोन बढाउनुहोस्">+</button>
                    <button className="song-transpose-reset" type="button" onClick={() => setTranspose(0)} disabled={transpose === 0} aria-label="मूल कीमा फर्काउनुहोस्">↺</button>
                  </div>
                </section>
              )}

              <article className="song-lyrics" style={{ "--song-text-scale": fontScale } as CSSProperties}>
                {selectedLyrics.map((block, blockIndex) => (
                  <section key={`${block.label}-${blockIndex}`}>
                    <p className="song-section-label">{block.label}</p>
                    {block.lines.map((line, lineIndex) => (
                      <p className={showChords ? "song-line song-line--chords" : "song-line"} key={`${blockIndex}-${lineIndex}`}>
                        {showChords ? renderChordedLine(line, transpose) : lyricLineWithoutChords(line)}
                      </p>
                    ))}
                  </section>
                ))}
              </article>

              <button className={`recap-select-button${selectedSong.external_id && recapSelection.includes(selectedSong.external_id) ? " selected" : ""}`} type="button" disabled={!selectedSong.external_id} onClick={() => selectedSong.external_id && toggleRecapSelection(selectedSong.external_id)}><span aria-hidden="true">{selectedSong.external_id && recapSelection.includes(selectedSong.external_id) ? "✓" : "+"}</span>{selectedSong.external_id && recapSelection.includes(selectedSong.external_id) ? "पुनरावलोकनका लागि छानिएको" : "पुनरावलोकनका लागि छान्नुहोस्"}</button>

              <footer className="song-license-note"><strong>{selectedSong.source_name || "अनुमतिप्राप्त आराधना संग्रह"}</strong><p>{selectedSong.license_note || "सामग्री मालिकबाट Church App मा प्रयोग गर्ने अनुमति प्राप्त।"}</p>{selectedSourceUrl && <a href={selectedSourceUrl} target="_blank" rel="noreferrer">मूल स्रोत हेर्नुहोस्</a>}</footer>
            </>
          )}
        </div>

        <SongBottomNav onHome={onHome} onSchedule={onSchedule} onBible={() => onBible()} onMore={onMore} />
        {notice && <p className="app-toast" role="status">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header songs-header">
        <button className="icon-button" type="button" onClick={onHome} aria-label="होममा फर्कनुहोस्">←</button>
        <div className="dashboard-brand"><SongMark /><span>आराधना गीतहरू</span></div>
        <span className="header-spacer" />
      </header>

      <div className="app-scroll songs-content">
        <section className="songs-intro">
          <div><span className="demo-tag">सम्पूर्ण गीत संग्रह</span><h1>नेपाली ख्रीष्टियन गीत</h1><p>भजन, कोरस, बाल गीत र कर्डसहितका आराधना गीतहरू।</p></div>
          <span aria-hidden="true">♫</span>
        </section>

        <div className="song-source-note" role="note"><span aria-hidden="true">✓</span><p><strong>मालिकबाट उपलब्ध सामग्री</strong> Church App का लागि प्रयोग अनुमति पुष्टि भएको १,९६८ गीतको संग्रह। सूची पढ्न मात्र मिल्छ; मनपर्ने र पुनरावलोकन छनोट यस उपकरणमै सुरक्षित हुन्छ।</p></div>

        <label className="song-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="शीर्षक, गीत नं., कलाकार वा शब्द खोज्नुहोस्…" aria-label="गीत खोज्नुहोस्" /></label>

        <div className="song-category-tabs" aria-label="गीतका प्रकारहरू">
          {SONG_FILTERS.map((item) => <button type="button" className={filter === item.value ? "selected" : ""} onClick={() => chooseFilter(item.value)} key={item.value}>{item.label}{item.value === "favourites" && favourites.length > 0 ? ` ${favourites.length}` : ""}</button>)}
        </div>

        {recapSelection.length > 0 && <div className="recap-selection-summary"><span aria-hidden="true">✓</span><p><strong>{recapSelection.length} गीत छानिएको</strong><small>भविष्यको संगति पुनरावलोकनमा जोड्न तयार</small></p></div>}
        {listError && <div className="form-message form-message--error" role="alert">{listError} <button className="inline-retry-button" type="button" onClick={() => setRetryToken((value) => value + 1)}>फेरि प्रयास</button></div>}

        <section className="song-list" aria-labelledby="song-list-heading" aria-busy={listLoading}>
          <div className="song-list-heading"><div><p className="eyebrow">{SONG_FILTERS.find((item) => item.value === filter)?.label}</p><h2 id="song-list-heading">गीत सूची</h2></div><span>{totalCount} गीत</span></div>
          {listLoading && songs.length === 0 && <div className="bible-loading" role="status"><span /><span /><span /><p>गीत सूची खोलिँदैछ…</p></div>}
          {!listLoading && !listError && songs.length === 0 && <div className="song-empty"><span aria-hidden="true">♪</span><strong>{filter === "favourites" ? "मनपर्ने गीत छैन" : "गीत भेटिएन"}</strong><p>{filter === "favourites" ? "गीतको तारामा थिचेर यहाँ राख्नुहोस्।" : "अर्को खोज शब्द वा प्रकार छान्नुहोस्।"}</p></div>}

          {songs.map((song) => (
            <article className="song-card" key={song.external_id}>
              <button className="song-card-main" type="button" onClick={() => openSong(song)}>
                <span className="song-number"><small>{songTypeLabel(song.song_type)}</small>{songNumberLabel(song.song_number)}</span>
                <span className="song-card-copy"><strong>{song.title_ne}</strong><small>{song.artist_credit || [songTypeLabel(song.song_type), song.song_key && `Key ${song.song_key}`, song.beat].filter(Boolean).join(" · ")}</small>{song.has_chords && <em>कर्ड उपलब्ध</em>}</span>
                <span aria-hidden="true">›</span>
              </button>
              <button className="song-card-favourite" type="button" onClick={() => toggleFavourite(song.external_id)} aria-label={`${song.title_ne} ${favourites.includes(song.external_id) ? "मनपर्नेबाट हटाउनुहोस्" : "मनपर्नेमा राख्नुहोस्"}`}>{favourites.includes(song.external_id) ? "★" : "☆"}</button>
            </article>
          ))}

          {hasMore && <button className="song-load-more" type="button" disabled={listLoading} onClick={() => setPage((value) => value + 1)}>{listLoading ? "थप गीत खोलिँदैछ…" : `थप गीत देखाउनुहोस् (${songs.length}/${totalCount})`}</button>}
        </section>

        <footer className="songs-library-note"><strong>सुरक्षित पूर्वावलोकन</strong><p>यस सार्वजनिक सूचीबाट अनुमतिप्राप्त प्रकाशित गीत मात्र पढ्न सकिन्छ। सदस्य, मण्डली र व्यवस्थापन डेटा बन्द छन्; गीत थप्ने वा परिवर्तन गर्ने अधिकार ब्राउजरलाई दिइएको छैन।</p></footer>
      </div>

      <SongBottomNav onHome={onHome} onSchedule={onSchedule} onBible={() => onBible()} onMore={onMore} />
      {notice && <p className="app-toast" role="status">{notice}</p>}
    </div>
  );
}

function SongBottomNav({ onHome, onSchedule, onBible, onMore }: { onHome: () => void; onSchedule: () => void; onBible: () => void; onMore: () => void }) {
  return (
    <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन">
      <button type="button" onClick={onHome}><span aria-hidden="true">⌂</span><small>होम</small></button>
      <button type="button" onClick={onSchedule}><span aria-hidden="true">▣</span><small>तालिका</small></button>
      <button type="button" onClick={onBible}><span aria-hidden="true">▤</span><small>बाइबल</small></button>
      <button type="button" className="active"><span aria-hidden="true">♪</span><small>गीत</small></button>
      <button type="button" onClick={onMore}><span aria-hidden="true">•••</span><small>थप</small></button>
    </nav>
  );
}
