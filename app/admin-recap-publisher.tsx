"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { DashboardScreen } from "./dashboard";

type ManageableRecap = Database["public"]["Functions"]["list_manageable_recaps"]["Returns"][number];
type AdminFellowship = { id: number; title: string; starts_at: string; status: string };
type Notice = { tone: "success" | "error" | "info"; text: string } | null;
type ScriptureReference = { label: string; hash: string };

const SONG_SELECTION_KEY = "church-app-preview-recap-song-selection-v1";

function loadSelectedSongs() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SONG_SELECTION_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function referencesToText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = "label" in item && typeof item.label === "string" ? item.label : "";
    const hash = "hash" in item && typeof item.hash === "string" ? item.hash : "";
    return label && hash ? [`${label} | ${hash}`] : [];
  }).join("\n");
}

function parseReferences(value: string): ScriptureReference[] | null {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  const references: ScriptureReference[] = [];
  for (const line of lines) {
    const separator = line.lastIndexOf("|");
    if (separator < 1) return null;
    const label = line.slice(0, separator).trim();
    const hash = line.slice(separator + 1).trim().toUpperCase();
    if (!label || !/^[A-Z0-9]{2,8}\/\d{1,3}(\/\d{1,3})?$/.test(hash)) return null;
    references.push({ label, hash });
  }
  return references;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function AdminRecapPublisher({ churchId, userId, fellowships, onNavigate }: {
  churchId: number;
  userId: string;
  fellowships: AdminFellowship[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const usableFellowships = useMemo(() => fellowships.filter((fellowship) => fellowship.status !== "cancelled"), [fellowships]);
  const [recaps, setRecaps] = useState<ManageableRecap[]>([]);
  const [fellowshipId, setFellowshipId] = useState<number | null>(() => usableFellowships[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [testimony, setTestimony] = useState("");
  const [prayerPoints, setPrayerPoints] = useState("");
  const [scriptureText, setScriptureText] = useState("");
  const [songIds, setSongIds] = useState<string[]>(loadSelectedSongs);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const selectedFellowship = usableFellowships.find((fellowship) => fellowship.id === fellowshipId) ?? usableFellowships[0] ?? null;
  const selectedRecap = recaps.find((recap) => recap.fellowship_id === selectedFellowship?.id) ?? null;

  const refreshRecaps = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true);
    const { data, error } = await client.rpc("list_manageable_recaps", { p_church_id: churchId });
    if (error) {
      setRecaps([]);
      setNotice({ tone: "error", text: "पुनरावलोकन व्यवस्थापन सूची लोड गर्न सकिएन।" });
    } else {
      setRecaps((data ?? []) as ManageableRecap[]);
    }
    setLoading(false);
  }, [churchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshRecaps(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshRecaps]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedRecap) {
        setTitle(selectedRecap.title);
        setSummary(selectedRecap.summary);
        setTestimony(selectedRecap.testimony ?? "");
        setPrayerPoints(selectedRecap.prayer_points.join("\n"));
        setScriptureText(referencesToText(selectedRecap.scripture_references));
        setSongIds(selectedRecap.song_external_ids);
        return;
      }
      setTitle(selectedFellowship ? `${selectedFellowship.title} पुनरावलोकन` : "");
      setSummary("");
      setTestimony("");
      setPrayerPoints("");
      setScriptureText("");
      setSongIds(loadSelectedSongs());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedFellowship, selectedRecap]);

  function normalizedPayload() {
    const references = parseReferences(scriptureText);
    const points = prayerPoints.split("\n").map((point) => point.trim()).filter(Boolean);
    if (title.trim().length < 2 || summary.trim().length < 2) {
      setNotice({ tone: "error", text: "शीर्षक र संगतिको सार कम्तीमा २ अक्षरको राख्नुहोस्।" });
      return null;
    }
    if (!references) {
      setNotice({ tone: "error", text: "हरेक बाइबल सन्दर्भ “नाम | BOOK/CHAPTER/VERSE” ढाँचामा राख्नुहोस्।" });
      return null;
    }
    return {
      title: title.trim(),
      message_notes: summary.trim(),
      testimony: testimony.trim() || null,
      prayer_points: points,
      scripture_references: references,
      song_external_ids: [...new Set(songIds)],
    };
  }

  async function persistDraft() {
    const client = getSupabaseBrowserClient();
    const payload = normalizedPayload();
    if (!client || !selectedFellowship || !payload) return null;

    if (selectedRecap) {
      if (selectedRecap.status !== "draft") return null;
      const { data, error } = await client.from("recaps").update(payload).eq("id", selectedRecap.id).eq("church_id", churchId).eq("status", "draft").select("id").single();
      if (error) {
        setNotice({ tone: "error", text: "मस्यौदा सुरक्षित गर्न सकिएन। प्रकाशक अधिकार वा सामग्री फेरि जाँच्नुहोस्।" });
        return null;
      }
      return data.id;
    }

    const { data, error } = await client.from("recaps").insert({
      ...payload,
      church_id: churchId,
      fellowship_id: selectedFellowship.id,
      author_id: userId,
      status: "draft",
    }).select("id").single();
    if (error) {
      setNotice({ tone: "error", text: "पुनरावलोकन मस्यौदा बनाउन सकिएन। एउटै संगतिको मस्यौदा पहिले नै हुन सक्छ।" });
      return null;
    }
    return data.id;
  }

  async function saveDraft() {
    setBusy(true);
    setNotice(null);
    const recapId = await persistDraft();
    if (recapId) {
      setNotice({ tone: "success", text: "पुनरावलोकन मस्यौदा Supabase मा सुरक्षित भयो।" });
      await refreshRecaps();
    }
    setBusy(false);
  }

  async function publishRecap() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    setNotice(null);
    const recapId = await persistDraft();
    if (!recapId) {
      setBusy(false);
      return;
    }
    const { error } = await client.from("recaps").update({ status: "published" }).eq("id", recapId).eq("church_id", churchId).eq("status", "draft");
    if (error) setNotice({ tone: "error", text: "पुनरावलोकन प्रकाशित गर्न सकिएन। प्रकाशक अधिकार फेरि जाँच्नुहोस्।" });
    else {
      setNotice({ tone: "success", text: "पुनरावलोकन प्रकाशित भयो र अब मण्डली सदस्यलाई देखिन्छ।" });
      await refreshRecaps();
    }
    setBusy(false);
  }

  async function archiveRecap() {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedRecap || selectedRecap.status !== "published") return;
    setBusy(true);
    const { error } = await client.from("recaps").update({ status: "archived" }).eq("id", selectedRecap.id).eq("church_id", churchId).eq("status", "published");
    if (error) setNotice({ tone: "error", text: "प्रकाशित पुनरावलोकन अभिलेखमा राख्न सकिएन।" });
    else {
      setNotice({ tone: "success", text: "पुनरावलोकन अभिलेखमा राखियो र सदस्य फिडबाट हट्यो।" });
      await refreshRecaps();
    }
    setBusy(false);
  }

  async function deleteDraft() {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedRecap || selectedRecap.status !== "draft") return;
    setBusy(true);
    const { error } = await client.from("recaps").delete().eq("id", selectedRecap.id).eq("church_id", churchId).eq("status", "draft");
    if (error) setNotice({ tone: "error", text: "मस्यौदा हटाउन सकिएन।" });
    else {
      setNotice({ tone: "success", text: "मस्यौदा हटाइयो।" });
      await refreshRecaps();
    }
    setBusy(false);
  }

  const locked = Boolean(selectedRecap && selectedRecap.status !== "draft");

  return (
    <section className="admin-recap-panel" aria-labelledby="admin-recap-heading">
      <div className="admin-section-heading"><div><p className="eyebrow">प्रकाशन कार्यप्रवाह</p><h2 id="admin-recap-heading">संगति पुनरावलोकन</h2></div><span>{recaps.length.toLocaleString("ne-NP")}</span></div>
      <p className="admin-section-copy">मस्यौदा तयार गर्नुहोस्, जाँच्नुहोस् र मण्डली सदस्यका लागि प्रकाशित गर्नुहोस्। प्रकाशित सामग्री परिवर्तन हुँदैन; आवश्यक भए अभिलेखमा राख्नुहोस्।</p>
      {notice && <p className={`admin-inline-notice ${notice.tone}`} role="status">{notice.text}</p>}
      {usableFellowships.length === 0 ? <div className="admin-recap-empty"><strong>पहिले फेलोशिप बनाउनुहोस्</strong><small>पुनरावलोकन सधैँ एउटै वास्तविक फेलोशिपसँग जोडिन्छ।</small></div> : <>
        <label className="admin-recap-fellowship">फेलोशिप<select value={selectedFellowship?.id ?? ""} onChange={(event) => setFellowshipId(Number(event.target.value))}>{usableFellowships.map((fellowship) => <option value={fellowship.id} key={fellowship.id}>{fellowship.title} · {formatDate(fellowship.starts_at)}</option>)}</select></label>
        {loading ? <p className="admin-section-copy">पुनरावलोकन अवस्था खोलिँदैछ…</p> : <form className="admin-recap-form" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}>
          {selectedRecap && <div className={`admin-recap-status ${selectedRecap.status}`}><span>{selectedRecap.status === "draft" ? "मस्यौदा" : selectedRecap.status === "published" ? "प्रकाशित" : "अभिलेख"}</span><small>{selectedRecap.published_at ? `प्रकाशित: ${formatDate(selectedRecap.published_at)}` : `अन्तिम परिवर्तन: ${formatDate(selectedRecap.updated_at)}`}</small></div>}
          <label>शीर्षक<input maxLength={200} disabled={locked || busy} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>संगतिको सार<textarea rows={5} maxLength={12000} disabled={locked || busy} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="मुख्य वचन, सिकाइ र सहभागिताको सार…" /></label>
          <label>गवाही वा उत्साह<textarea rows={3} maxLength={8000} disabled={locked || busy} value={testimony} onChange={(event) => setTestimony(event.target.value)} placeholder="साझा गरिएको गवाही वा उत्साह…" /></label>
          <label>बाइबल सन्दर्भ<small>प्रत्येक नयाँ लाइनमा: नाम | BOOK/CHAPTER/VERSE</small><textarea rows={3} disabled={locked || busy} value={scriptureText} onChange={(event) => setScriptureText(event.target.value)} placeholder="यूहन्ना ३:१६ | JHN/3/16" /></label>
          <label>प्रार्थनाका विषय<small>प्रत्येक विषय नयाँ लाइनमा</small><textarea rows={4} disabled={locked || busy} value={prayerPoints} onChange={(event) => setPrayerPoints(event.target.value)} /></label>
          <div className="admin-recap-song-row"><div><strong>{songIds.length.toLocaleString("ne-NP")} गीत जोडिएको</strong><small>गीत सूचीमा “पुनरावलोकनका लागि छान्नुहोस्” प्रयोग गर्नुहोस्।</small></div>{!locked && <button type="button" onClick={() => onNavigate("songs")}>गीत छान्नुहोस्</button>}</div>
          <div className="admin-recap-actions">{!locked && <><button type="submit" disabled={busy}>मस्यौदा सुरक्षित</button><button className="primary" type="button" disabled={busy} onClick={() => { void publishRecap(); }}>प्रकाशित गर्नुहोस्</button></>}{selectedRecap?.status === "published" && <button className="warning" type="button" disabled={busy} onClick={() => { void archiveRecap(); }}>अभिलेखमा राख्नुहोस्</button>}{selectedRecap?.status === "draft" && <button className="danger" type="button" disabled={busy} onClick={() => { void deleteDraft(); }}>मस्यौदा हटाउनुहोस्</button>}</div>
        </form>}
      </>}
    </section>
  );
}
