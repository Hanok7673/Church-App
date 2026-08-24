"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";
import { LiveFellowshipRecaps } from "./live-fellowship-recaps";

type SongReference = Database["public"]["Functions"]["search_worship_songs"]["Returns"][number];
type BibleReference = { label: string; hash: string };
type RecapDraft = {
  title: string;
  fellowship: string;
  meetingDate: string;
  summary: string;
  testimony: string;
  prayerPoints: string;
  references: BibleReference[];
  updatedAt: string;
};

const DRAFT_KEY = "church-app-preview-recap-draft-v1";
const SONG_SELECTION_KEY = "church-app-preview-recap-song-selection-v1";
const COMMON_REFERENCES: BibleReference[] = [
  { label: "फिलिप्पी ४:६–७", hash: "PHP/4/6" },
  { label: "हिब्रू १०:२४–२५", hash: "HEB/10/24" },
  { label: "भजनसंग्रह १३३:१", hash: "PSA/133/1" },
  { label: "कलस्सी ३:१६", hash: "COL/3/16" },
  { label: "याकूब ५:१६", hash: "JAS/5/16" },
];

function createDefaultDraft(): RecapDraft {
  return {
    title: "सानेपा घर संगति पुनरावलोकन",
    fellowship: "सानेपा घर संगति",
    meetingDate: "2026-08-26",
    summary: "आजको संगतिमा हामीले विश्वासमा दृढ रहने विषयमा छलफल गर्‍यौँ। सबैले आफ्नो हप्ताका अनुभव बाँडे र एक-अर्काका लागि प्रार्थना गरे।",
    testimony: "एक सदस्यले कठिन समयमा मण्डलीको प्रार्थना र सहयोगबाट आशा पाएको अनुभव बाँड्नुभयो।",
    prayerPoints: "परिवारहरूको स्वास्थ्य र सुरक्षा\nयुवाहरूको अध्ययन र निर्णय\nनयाँ सदस्यहरू संगतिमा जोडिन",
    references: [COMMON_REFERENCES[0], COMMON_REFERENCES[1]],
    updatedAt: new Date().toISOString(),
  };
}

function loadDraft() {
  if (typeof window === "undefined") return createDefaultDraft();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null") as RecapDraft | null;
    return parsed?.title && Array.isArray(parsed.references) ? parsed : createDefaultDraft();
  } catch {
    return createDefaultDraft();
  }
}

function loadSongIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SONG_SELECTION_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [] as string[];
  }
}

function formatDraftTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "अहिले" : new Intl.DateTimeFormat("ne-NP", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function PreviewFellowshipRecap({ name, onNavigate }: { name: string; onNavigate: (screen: DashboardScreen) => void }) {
  const [draft, setDraft] = useState<RecapDraft>(loadDraft);
  const [songIds, setSongIds] = useState<string[]>(loadSongIds);
  const [songs, setSongs] = useState<SongReference[]>([]);
  const [songLoading, setSongLoading] = useState(false);
  const [songError, setSongError] = useState("");
  const [preview, setPreview] = useState(() => typeof window !== "undefined" && window.location.hash === "#recaps/preview");
  const [notice, setNotice] = useState("");
  const prayerItems = useMemo(() => draft.prayerPoints.split("\n").map((item) => item.trim()).filter(Boolean), [draft.prayerPoints]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (songIds.length === 0) {
      setSongs([]);
      setSongLoading(false);
      return;
    }
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) {
      setSongError("गीत विवरण खोल्न सार्वजनिक Supabase सेटिङ आवश्यक छ।");
      return;
    }
    setSongLoading(true);
    setSongError("");
    client.rpc("search_worship_songs", {
      p_search_text: null,
      p_song_type: null,
      p_page_size: 50,
      p_page_offset: 0,
      p_external_ids: songIds,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) setSongError("छानिएका गीतको विवरण खोल्न सकिएन।");
      else setSongs(data ?? []);
      setSongLoading(false);
    });
    return () => { active = false; };
  }, [songIds]);

  function updateDraft<K extends keyof RecapDraft>(key: K, value: RecapDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function saveNow(message = "मस्यौदा यस उपकरणमा सुरक्षित भयो।") {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    setDraft(next);
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2300);
  }

  function toggleReference(reference: BibleReference) {
    const exists = draft.references.some((item) => item.hash === reference.hash);
    updateDraft("references", exists ? draft.references.filter((item) => item.hash !== reference.hash) : [...draft.references, reference]);
  }

  function removeSong(id: string) {
    const next = songIds.filter((songId) => songId !== id);
    setSongIds(next);
    window.localStorage.setItem(SONG_SELECTION_KEY, JSON.stringify(next));
    setNotice("गीत पुनरावलोकन छनोटबाट हटाइयो।");
    window.setTimeout(() => setNotice(""), 2200);
  }

  function openPreview() {
    saveNow("पूर्वावलोकन तयार भयो।");
    setPreview(true);
    window.history.replaceState(null, "", "#recaps/preview");
  }

  function closePreview() {
    setPreview(false);
    window.history.replaceState(null, "", "#recaps");
  }

  function openBible(hash: string) {
    saveNow();
    window.history.replaceState(null, "", `#bible/${hash}`);
    onNavigate("bible");
  }

  function openSongs() {
    saveNow();
    window.history.replaceState(null, "", "#songs");
    onNavigate("songs");
  }

  function showProtected(label: string) {
    setNotice(`${label} वास्तविक प्रमाणीकरण र अगुवा अनुमति भएपछि मात्र उपलब्ध हुनेछ।`);
    window.setTimeout(() => setNotice(""), 2800);
  }

  if (preview) {
    return (
      <div className="app-screen screen-enter">
        <header className="detail-header recap-preview-header"><button className="icon-button" type="button" onClick={closePreview} aria-label="मस्यौदामा फर्कनुहोस्">←</button><div><strong>पुनरावलोकन पूर्वावलोकन</strong><small>प्रकाशित भएको छैन</small></div><span className="recap-draft-pill">मस्यौदा</span></header>
        <div className="app-scroll recap-preview-content">
          <section className="recap-preview-hero"><span>संगति पुनरावलोकन</span><h1>{draft.title || "शीर्षक नभएको मस्यौदा"}</h1><p>{draft.fellowship} · {draft.meetingDate || "मिति नछानिएको"}</p></section>
          <div className="recap-preview-note" role="note"><span aria-hidden="true">ⓘ</span><p><strong>यस्तो देखिनेछ</strong> यो पूर्वावलोकन यस उपकरणमा मात्र छ; सदस्यलाई पठाइएको वा Supabase मा सुरक्षित गरिएको छैन।</p></div>
          <section className="recap-reading-section"><p className="eyebrow">संगतिको सार</p><p>{draft.summary || "सार लेखिएको छैन।"}</p></section>
          {draft.testimony && <section className="recap-testimony"><span aria-hidden="true">✦</span><div><p className="eyebrow">गवाही र उत्साह</p><p>{draft.testimony}</p></div></section>}
          <section className="recap-reading-section"><p className="eyebrow">धर्मशास्त्र</p><div className="recap-reference-list">{draft.references.length > 0 ? draft.references.map((reference) => <button type="button" onClick={() => openBible(reference.hash)} key={reference.hash}>▤ {reference.label}<span aria-hidden="true">›</span></button>) : <p>कुनै बाइबल खण्ड छानिएको छैन।</p>}</div></section>
          <section className="recap-reading-section"><p className="eyebrow">आराधना गीत</p>{songLoading && <p>गीत खोलिँदैछ…</p>}{songs.length > 0 ? <div className="recap-preview-song-list">{songs.map((song) => <div key={song.external_id}><span aria-hidden="true">♪</span><p><strong>{song.title_ne}</strong><small>{song.song_type === "bhajan" ? "भजन" : song.song_type === "chorus" ? "कोरस" : "आराधना गीत"}{song.song_number ? ` नं. ${song.song_number}` : ""}</small></p></div>)}</div> : !songLoading && <p>कुनै गीत छानिएको छैन।</p>}</section>
          <section className="recap-reading-section"><p className="eyebrow">प्रार्थनाका विषय</p>{prayerItems.length > 0 ? <ul>{prayerItems.map((item) => <li key={item}>{item}</li>)}</ul> : <p>प्रार्थनाका विषय लेखिएका छैनन्।</p>}</section>
          <footer className="recap-author-note"><span>{name.trim().charAt(0) || "स"}</span><p><small>मस्यौदा तयार गर्ने स्थानीय प्रोफाइल</small><strong>{name || "Church App सदस्य"}</strong></p></footer>
          <section className="recap-publish-lock"><div><span aria-hidden="true">🔒</span><p><strong>प्रकाशन बन्द छ</strong><small>अगुवा प्रमाणीकरण, fellowship अनुमति र वास्तविक सदस्य सूचना आवश्यक छ।</small></p></div><button type="button" onClick={() => showProtected("प्रकाशन र सूचना")}>प्रकाशित गरी सूचना पठाउनुहोस्</button></section>
        </div>
        <RecapBottomNav onNavigate={onNavigate} />
        {notice && <p className="app-toast" role="status">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header recaps-header"><button className="icon-button" type="button" onClick={() => { saveNow(); onNavigate("more"); }} aria-label="थपमा फर्कनुहोस्">←</button><div><p className="eyebrow">स्थानीय मस्यौदा</p><strong>संगति पुनरावलोकन</strong></div><span className="recap-draft-pill">मस्यौदा</span></header>
      <div className="app-scroll recaps-content">
        <section className="recap-builder-hero"><div><span>लेख्नुहोस् · जाँच्नुहोस् · सुरक्षित राख्नुहोस्</span><h1>संगतिको सम्झना तयार गर्नुहोस्</h1><p>वचन, गीत, गवाही र प्रार्थनाका विषय एउटै स्थानीय मस्यौदामा।</p></div><span aria-hidden="true">✎</span></section>
        <div className="recap-preview-note" role="note"><span aria-hidden="true">ⓘ</span><p><strong>यो मस्यौदा यस उपकरणमा मात्र रहन्छ</strong> वास्तविक recap, attendance वा notification तालिकामा केही लेखिँदैन।</p></div>

        <section className="recap-form-section" aria-labelledby="recap-details-heading"><div className="recap-form-heading"><span>१</span><div><p className="eyebrow">आधारभूत विवरण</p><h2 id="recap-details-heading">कुन संगतिको पुनरावलोकन?</h2></div></div><label>शीर्षक<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="पुनरावलोकन शीर्षक" /></label><div className="recap-field-grid"><label>संगति<select value={draft.fellowship} onChange={(event) => updateDraft("fellowship", event.target.value)}><option>सानेपा घर संगति</option><option>कोटेश्वर युवा संगति</option><option>संयुक्त आराधना संगति</option></select></label><label>मिति<input type="date" value={draft.meetingDate} onChange={(event) => updateDraft("meetingDate", event.target.value)} /></label></div></section>

        <section className="recap-form-section" aria-labelledby="recap-writing-heading"><div className="recap-form-heading"><span>२</span><div><p className="eyebrow">सार र गवाही</p><h2 id="recap-writing-heading">के भयो र के सिक्यौँ?</h2></div></div><label>संगतिको सार<textarea rows={5} value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} placeholder="मुख्य छलफल, सिकाइ र सहभागिता…" /></label><label>गवाही वा उत्साह<textarea rows={3} value={draft.testimony} onChange={(event) => updateDraft("testimony", event.target.value)} placeholder="साझा गरिएको गवाही वा उत्साह…" /></label></section>

        <section className="recap-form-section" aria-labelledby="recap-scripture-heading"><div className="recap-form-heading"><span>३</span><div><p className="eyebrow">धर्मशास्त्र</p><h2 id="recap-scripture-heading">बाइबल खण्ड छान्नुहोस्</h2></div></div><div className="recap-reference-picker">{COMMON_REFERENCES.map((reference) => { const selected = draft.references.some((item) => item.hash === reference.hash); return <button type="button" className={selected ? "selected" : ""} onClick={() => toggleReference(reference)} key={reference.hash}><span aria-hidden="true">{selected ? "✓" : "+"}</span>{reference.label}</button>; })}</div><p className="recap-field-help">छानिएका खण्डहरू पाठ नक्कल नगरी बाइबल पाठकमा लिंक हुन्छन्।</p></section>

        <section className="recap-form-section" aria-labelledby="recap-songs-heading"><div className="recap-form-heading"><span>४</span><div><p className="eyebrow">आराधना गीत</p><h2 id="recap-songs-heading">गाइएका गीतहरू</h2></div></div>{songLoading && <p className="recap-field-help">छानिएका गीत खोलिँदैछ…</p>}{songError && <p className="form-message form-message--error">{songError}</p>}{songs.length > 0 ? <div className="recap-selected-songs">{songs.map((song) => <div key={song.external_id}><span aria-hidden="true">♪</span><p><strong>{song.title_ne}</strong><small>{song.song_type === "bhajan" ? "भजन" : song.song_type === "chorus" ? "कोरस" : "आराधना गीत"}{song.song_number ? ` नं. ${song.song_number}` : ""}</small></p><button type="button" onClick={() => removeSong(song.external_id)} aria-label={`${song.title_ne} हटाउनुहोस्`}>×</button></div>)}</div> : !songLoading && <div className="recap-song-empty"><span aria-hidden="true">♪</span><p><strong>गीत छानिएको छैन</strong><small>गीत खोल्नुहोस् र “पुनरावलोकनका लागि छान्नुहोस्” थिच्नुहोस्।</small></p></div>}<button className="recap-open-songs" type="button" onClick={openSongs}>आराधना गीत सूची खोल्नुहोस् <span aria-hidden="true">›</span></button></section>

        <section className="recap-form-section" aria-labelledby="recap-prayer-heading"><div className="recap-form-heading"><span>५</span><div><p className="eyebrow">प्रार्थना</p><h2 id="recap-prayer-heading">आगामी प्रार्थनाका विषय</h2></div></div><label>प्रत्येक विषय नयाँ लाइनमा<textarea rows={4} value={draft.prayerPoints} onChange={(event) => updateDraft("prayerPoints", event.target.value)} placeholder="परिवारको स्वास्थ्य\nयुवाहरूको अध्ययन" /></label></section>

        <div className="recap-save-status"><span aria-hidden="true">✓</span><p><strong>स्वतः स्थानीय रूपमा सुरक्षित</strong><small>अन्तिम परिवर्तन: {formatDraftTime(draft.updatedAt)}</small></p></div>
        <div className="recap-builder-actions"><button type="button" onClick={() => saveNow()}>मस्यौदा सुरक्षित गर्नुहोस्</button><button className="primary" type="button" onClick={openPreview}>पूर्वावलोकन हेर्नुहोस् <span aria-hidden="true">→</span></button></div>
      </div>
      <RecapBottomNav onNavigate={onNavigate} />
      {notice && <p className="app-toast" role="status">{notice}</p>}
    </div>
  );
}

export function FellowshipRecap({ name, userId, memberships, onNavigate }: {
  name: string;
  userId: string | null;
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  if (userId) return <LiveFellowshipRecaps memberships={memberships} onNavigate={onNavigate} />;
  return <PreviewFellowshipRecap name={name} onNavigate={onNavigate} />;
}

function RecapBottomNav({ onNavigate }: { onNavigate: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन"><button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button><button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button><button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button><button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button><button type="button" className="active" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button></nav>;
}
