"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";

type PublishedRecap = Database["public"]["Functions"]["list_published_recaps"]["Returns"][number];
type SongReference = Database["public"]["Functions"]["search_worship_songs"]["Returns"][number];
type ScriptureReference = { label: string; hash: string };

function parseReferences(value: unknown): ScriptureReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = "label" in item && typeof item.label === "string" ? item.label : "";
    const hash = "hash" in item && typeof item.hash === "string" ? item.hash : "";
    return label && hash ? [{ label, hash }] : [];
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export function LiveFellowshipRecaps({ memberships, onNavigate }: {
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const activeMemberships = useMemo(() => memberships.filter((membership) => membership.status === "active"), [memberships]);
  const [churchId, setChurchId] = useState<number | null>(() => activeMemberships[0]?.churchId ?? null);
  const [recaps, setRecaps] = useState<PublishedRecap[]>([]);
  const [selectedRecapId, setSelectedRecapId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const match = window.location.hash.match(/^#recaps\/(\d+)$/);
    return match ? Number(match[1]) : null;
  });
  const [songs, setSongs] = useState<SongReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [songLoading, setSongLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMembership = activeMemberships.find((membership) => membership.churchId === churchId) ?? activeMemberships[0] ?? null;
  const selectedRecap = recaps.find((recap) => recap.id === selectedRecapId) ?? null;
  const references = selectedRecap ? parseReferences(selectedRecap.scripture_references) : [];

  useEffect(() => {
    if (!selectedMembership) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError("Supabase सेटिङ उपलब्ध छैन।");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      client.rpc("list_published_recaps", { p_church_id: selectedMembership.churchId, p_limit: 100 }).then(({ data, error: recapError }) => {
        if (!active) return;
        if (recapError) {
          setRecaps([]);
          setError("प्रकाशित पुनरावलोकन लोड गर्न सकिएन। मण्डली सदस्यता फेरि जाँच्नुहोस्।");
        } else {
          setRecaps((data ?? []) as PublishedRecap[]);
        }
        setLoading(false);
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedMembership]);

  useEffect(() => {
    const externalIds = selectedRecap?.song_external_ids ?? [];
    if (externalIds.length === 0) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const client = getSupabaseBrowserClient();
      if (!client) return;
      setSongs([]);
      setSongLoading(true);
      client.rpc("search_worship_songs", {
        p_search_text: null,
        p_song_type: null,
        p_page_size: 50,
        p_page_offset: 0,
        p_external_ids: externalIds,
      }).then(({ data }) => {
        if (!active) return;
        setSongs(data ?? []);
        setSongLoading(false);
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedRecap]);

  function openRecap(recapId: number) {
    setSelectedRecapId(recapId);
    window.history.replaceState(null, "", `#recaps/${recapId}`);
  }

  function closeRecap() {
    setSelectedRecapId(null);
    setSongs([]);
    window.history.replaceState(null, "", "#recaps");
  }

  function openBible(hash: string) {
    window.history.replaceState(null, "", `#bible/${hash}`);
    onNavigate("bible");
  }

  function openSong(externalId: string) {
    window.history.replaceState(null, "", `#songs/${externalId}`);
    onNavigate("songs");
  }

  if (selectedRecap) {
    return (
      <div className="app-screen screen-enter">
        <header className="detail-header recap-preview-header"><button className="icon-button" type="button" onClick={closeRecap} aria-label="पुनरावलोकन सूचीमा फर्कनुहोस्">←</button><div><strong>संगति पुनरावलोकन</strong><small>मण्डलीमा प्रकाशित</small></div><span className="live-recap-published-pill">प्रकाशित</span></header>
        <div className="app-scroll recap-preview-content live-recap-reading">
          <section className="recap-preview-hero"><span>{selectedRecap.fellowship_title}</span><h1>{selectedRecap.title}</h1><p>{formatDate(selectedRecap.fellowship_starts_at)} · {selectedRecap.author_name}</p></section>
          <div className="live-recap-security-note" role="note"><span aria-hidden="true">✓</span><p><strong>मण्डली सदस्यका लागि</strong><small>यो पुनरावलोकन तपाईंको सक्रिय मण्डली सदस्यताबाट सुरक्षित रूपमा खोलिएको हो।</small></p></div>
          <section className="recap-reading-section"><p className="eyebrow">संगतिको सार</p><p>{selectedRecap.summary}</p></section>
          {selectedRecap.testimony && <section className="recap-testimony"><span aria-hidden="true">✦</span><div><p className="eyebrow">गवाही र उत्साह</p><p>{selectedRecap.testimony}</p></div></section>}
          {references.length > 0 && <section className="recap-reading-section"><p className="eyebrow">धर्मशास्त्र</p><div className="recap-reference-list">{references.map((reference) => <button type="button" onClick={() => openBible(reference.hash)} key={reference.hash}>▤ {reference.label}<span aria-hidden="true">›</span></button>)}</div></section>}
          {(songLoading || songs.length > 0) && <section className="recap-reading-section"><p className="eyebrow">आराधना गीत</p>{songLoading ? <p>गीत खोलिँदैछ…</p> : <div className="recap-preview-song-list">{songs.map((song) => <button type="button" key={song.external_id} onClick={() => openSong(song.external_id)}><span aria-hidden="true">♪</span><p><strong>{song.title_ne}</strong><small>{song.song_type === "bhajan" ? "भजन" : song.song_type === "chorus" ? "कोरस" : "आराधना गीत"}{song.song_number ? ` नं. ${song.song_number}` : ""}</small></p></button>)}</div>}</section>}
          {selectedRecap.prayer_points.length > 0 && <section className="recap-reading-section"><p className="eyebrow">प्रार्थनाका विषय</p><ul>{selectedRecap.prayer_points.map((point) => <li key={point}>{point}</li>)}</ul></section>}
          <footer className="recap-author-note"><span>{selectedRecap.author_name.trim().charAt(0) || "स"}</span><p><small>प्रकाशित गर्ने मण्डली सेवक</small><strong>{selectedRecap.author_name}</strong></p></footer>
        </div>
        <LiveRecapBottomNav onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header recaps-header"><button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button><div><p className="eyebrow">मण्डली अभिलेख</p><strong>संगति पुनरावलोकन</strong></div><span className="live-recap-count">{recaps.length.toLocaleString("ne-NP")}</span></header>
      <div className="app-scroll recaps-content live-recap-feed">
        <section className="recap-builder-hero"><div><span>वचन · गवाही · प्रार्थना</span><h1>हाम्रा संगतिका सम्झनाहरू</h1><p>मण्डली प्रशासकले स्वीकृत गरी प्रकाशित गरेका सुरक्षित पुनरावलोकनहरू।</p></div><span aria-hidden="true">▤</span></section>
        {activeMemberships.length > 1 && <label className="live-recap-church-picker">मण्डली<select value={selectedMembership?.churchId ?? ""} onChange={(event) => { setChurchId(Number(event.target.value)); setSelectedRecapId(null); window.history.replaceState(null, "", "#recaps"); }}>{activeMemberships.map((membership) => <option value={membership.churchId} key={membership.id}>{membership.churchNameNe || membership.churchName}</option>)}</select></label>}
        {!selectedMembership ? <div className="live-recap-empty"><span aria-hidden="true">⌂</span><h2>सक्रिय मण्डली सदस्यता आवश्यक छ</h2><p>पहिले मण्डलीमा जोडिनुहोस्, त्यसपछि प्रकाशित पुनरावलोकन यहाँ देखिनेछन्।</p><button type="button" onClick={() => onNavigate("membership")}>मण्डली सदस्यता खोल्नुहोस्</button></div> : loading ? <div className="live-recap-empty"><span className="tiny-spinner" aria-hidden="true" /><h2>पुनरावलोकन खोलिँदैछ…</h2></div> : error ? <p className="form-message form-message--error">{error}</p> : recaps.length === 0 ? <div className="live-recap-empty"><span aria-hidden="true">▤</span><h2>अहिलेसम्म प्रकाशित पुनरावलोकन छैन</h2><p>मण्डली प्रशासकले संगति पुनरावलोकन प्रकाशित गरेपछि यहाँ देखिनेछ।</p></div> : <div className="live-recap-list">{recaps.map((recap) => <button type="button" key={recap.id} onClick={() => openRecap(recap.id)}><span className="live-recap-date">{new Intl.DateTimeFormat("ne-NP", { month: "short", day: "numeric" }).format(new Date(recap.fellowship_starts_at))}</span><span><small>{recap.fellowship_title}</small><strong>{recap.title}</strong><em>{recap.summary}</em></span><b aria-hidden="true">›</b></button>)}</div>}
      </div>
      <LiveRecapBottomNav onNavigate={onNavigate} />
    </div>
  );
}

function LiveRecapBottomNav({ onNavigate }: { onNavigate: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन"><button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button><button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button><button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button><button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button><button type="button" className="active" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button></nav>;
}
