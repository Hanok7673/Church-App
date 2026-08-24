"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";
import { VoiceNoteRecorder } from "./voice-note-recorder";
import { hasInlineChordMarkers, lyricLineWithoutChords, renderChordedLine, transposeChord } from "./worship-songs";

type SongSearchResult = Database["public"]["Functions"]["search_worship_songs"]["Returns"][number];
type FellowshipSummary = { id: number; church_id: number; title: string; starts_at: string; status: string };
type ServiceCapabilities = { can_view: boolean; can_manage_program: boolean; can_prepare_worship: boolean; can_prepare_sermon: boolean };
type ServiceSlide = {
  plan_id: number;
  church_id: number;
  fellowship_id: number;
  fellowship_title: string;
  fellowship_starts_at: string;
  plan_title: string;
  plan_status: "draft" | "published";
  sermon_topic: string | null;
  sermon_summary: string | null;
  preacher_name: string | null;
  item_id: number | null;
  item_kind: "song" | "scripture" | null;
  section: "opening" | "worship" | "sermon" | "response" | "closing" | null;
  slide_position: number | null;
  song_id: number | null;
  song_external_id: string | null;
  song_type: string | null;
  song_number: number | null;
  song_title: string | null;
  song_key: string | null;
  song_lyrics: string | null;
  song_chords: string | null;
  book_code: string | null;
  book_name_ne: string | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  item_label: string | null;
  item_note: string | null;
};
type MemberNote = { id: number; body: string; updated_at: string };
type MemberHighlight = {
  id: number;
  book_code: string;
  book_name_ne: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  selected_text: string;
  reflection: string | null;
  color: string;
  created_at: string;
};
type VoiceNote = { id: number; storage_path: string; caption: string | null; duration_seconds: number; size_bytes: number; created_at: string; signed_url: string };
type BibleVerse = { number: string; text: string };
type BibleBookFile = { chapters: Record<string, BibleVerse[]> };

const EMPTY_CAPABILITIES: ServiceCapabilities = { can_view: false, can_manage_program: false, can_prepare_worship: false, can_prepare_sermon: false };
const SECTION_LABELS: Record<string, string> = { opening: "सुरुवात", worship: "आराधना", sermon: "वचन", response: "प्रतिक्रिया", closing: "समापन" };

function selectedFellowshipId() {
  if (typeof window === "undefined") return null;
  const value = window.location.hash.match(/^#service\/(\d+)$/)?.[1];
  return value ? Number(value) : null;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function songLabel(slide: ServiceSlide) {
  const type = slide.song_type === "bhajan" ? "भजन" : slide.song_type === "chorus" ? "कोरस" : "गीत";
  return slide.song_number === null ? type : `${type} ${new Intl.NumberFormat("ne-NP").format(slide.song_number)}`;
}

function scriptureLabel(slide: ServiceSlide) {
  if (!slide.book_name_ne || !slide.chapter || !slide.verse_start) return "बाइबल खण्ड";
  const end = slide.verse_end && slide.verse_end !== slide.verse_start ? `-${slide.verse_end}` : "";
  return `${slide.book_name_ne} ${slide.chapter}:${slide.verse_start}${end}`;
}

export function FellowshipService({ userId, memberships, onNavigate }: {
  userId: string | null;
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const fellowshipId = useMemo(() => selectedFellowshipId(), []);
  const [fellowship, setFellowship] = useState<FellowshipSummary | null>(null);
  const [capabilities, setCapabilities] = useState<ServiceCapabilities>(EMPTY_CAPABILITIES);
  const [rows, setRows] = useState<ServiceSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generatingPresentation, setGeneratingPresentation] = useState(false);
  const [presentationProgress, setPresentationProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"slides" | "notebook" | "prepare">("slides");
  const [slideIndex, setSlideIndex] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [sermonTopic, setSermonTopic] = useState("");
  const [sermonSummary, setSermonSummary] = useState("");
  const [songQuery, setSongQuery] = useState("");
  const [songType, setSongType] = useState<"bhajan" | "chorus" | "all">("bhajan");
  const [songSection, setSongSection] = useState<"opening" | "worship" | "response" | "closing">("opening");
  const [songResults, setSongResults] = useState<SongSearchResult[]>([]);
  const [bookCode, setBookCode] = useState("JHN");
  const [bookName, setBookName] = useState("यूहन्ना");
  const [chapter, setChapter] = useState("3");
  const [verseStart, setVerseStart] = useState("16");
  const [verseEnd, setVerseEnd] = useState("16");
  const [passageLabel, setPassageLabel] = useState("");
  const [bibleBooks, setBibleBooks] = useState<Record<string, BibleBookFile>>({});
  const [noteBody, setNoteBody] = useState("");
  const [highlights, setHighlights] = useState<MemberHighlight[]>([]);
  const [highlightText, setHighlightText] = useState("");
  const [highlightReflection, setHighlightReflection] = useState("");
  const [highlightColor, setHighlightColor] = useState("gold");
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);

  const plan = rows[0] ?? null;
  const slides = useMemo(() => rows.filter((row) => row.item_id !== null), [rows]);
  const activeSlide = slides[Math.min(slideIndex, Math.max(slides.length - 1, 0))] ?? null;
  const hasPreparationAccess = capabilities.can_manage_program || capabilities.can_prepare_worship || capabilities.can_prepare_sermon;
  const activeMembership = fellowship ? memberships.find((membership) => membership.churchId === fellowship.church_id && membership.status === "active") : null;

  const refreshPlan = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !fellowshipId) {
      setLoading(false);
      return;
    }
    const [fellowshipResult, capabilityResult, planResult] = await Promise.all([
      client.from("fellowships").select("id, church_id, title, starts_at, status").eq("id", fellowshipId).maybeSingle(),
      client.rpc("fellowship_service_capabilities", { p_fellowship_id: fellowshipId }).maybeSingle(),
      client.rpc("list_fellowship_service_slides", { p_fellowship_id: fellowshipId }),
    ]);
    setFellowship(fellowshipResult.data as FellowshipSummary | null);
    setCapabilities((capabilityResult.data as ServiceCapabilities | null) ?? EMPTY_CAPABILITIES);
    const nextRows = (planResult.data ?? []) as ServiceSlide[];
    setRows(nextRows);
    if (nextRows[0]) {
      setSermonTopic(nextRows[0].sermon_topic ?? "");
      setSermonSummary(nextRows[0].sermon_summary ?? "");
    }
    if (fellowshipResult.error || capabilityResult.error || planResult.error) setNotice("फेलोशिप कार्यक्रम लोड गर्न सकिएन।");
    setLoading(false);
  }, [fellowshipId, userId]);

  const refreshNotebook = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !fellowshipId || plan?.plan_status !== "published") return;
    const [noteResult, highlightResult, voiceResult] = await Promise.all([
      client.from("member_fellowship_notes").select("id, body, updated_at").eq("fellowship_id", fellowshipId).eq("user_id", userId).maybeSingle(),
      client.from("member_verse_highlights").select("id, book_code, book_name_ne, chapter, verse_start, verse_end, selected_text, reflection, color, created_at").eq("fellowship_id", fellowshipId).eq("user_id", userId).order("created_at", { ascending: false }),
      client.from("member_voice_notes").select("id, storage_path, caption, duration_seconds, size_bytes, created_at").eq("fellowship_id", fellowshipId).eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    const nextNote = noteResult.data as MemberNote | null;
    setNoteBody(nextNote?.body ?? "");
    setHighlights((highlightResult.data ?? []) as MemberHighlight[]);
    const rawVoiceNotes = (voiceResult.data ?? []) as Omit<VoiceNote, "signed_url">[];
    const signed = await Promise.all(rawVoiceNotes.map(async (voice) => {
      const { data } = await client.storage.from("member-voice-notes").createSignedUrl(voice.storage_path, 3600);
      return { ...voice, signed_url: data?.signedUrl ?? "" };
    }));
    setVoiceNotes(signed);
  }, [fellowshipId, plan?.plan_status, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshPlan(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshPlan]);

  useEffect(() => {
    if (plan?.plan_status !== "published") return;
    const timer = window.setTimeout(() => { void refreshNotebook(); }, 0);
    return () => window.clearTimeout(timer);
  }, [plan?.plan_id, plan?.plan_status, refreshNotebook]);

  useEffect(() => {
    const codes = Array.from(new Set(slides.filter((slide) => slide.item_kind === "scripture" && slide.book_code).map((slide) => slide.book_code!)));
    const missing = codes.filter((code) => !bibleBooks[code]);
    if (missing.length === 0) return;
    let active = true;
    void Promise.all(missing.map(async (code) => {
      const response = await fetch(`/bible/npiulb/${code}.json`);
      if (!response.ok) throw new Error("Bible passage unavailable");
      return [code, await response.json() as BibleBookFile] as const;
    })).then((entries) => {
      if (active) setBibleBooks((current) => ({ ...current, ...Object.fromEntries(entries) }));
    }).catch(() => setNotice("तयार गरिएको बाइबल पाठ खोल्न सकिएन।"));
    return () => { active = false; };
  }, [bibleBooks, slides]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !capabilities.can_prepare_worship) return;
    const timer = window.setTimeout(() => {
      void client.rpc("search_worship_songs", {
        p_search_text: songQuery.trim() || null,
        p_song_type: songType === "all" ? null : songType,
        p_page_size: 20,
        p_page_offset: 0,
        p_external_ids: null,
      }).then(({ data }) => setSongResults((data ?? []) as SongSearchResult[]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [capabilities.can_prepare_worship, songQuery, songType]);

  const createPlan = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !fellowship || !activeMembership) return;
    setBusy(true);
    const { error } = await client.from("fellowship_service_plans").insert({
      church_id: fellowship.church_id,
      fellowship_id: fellowship.id,
      title: `${fellowship.title} कार्यक्रम`,
      created_by: userId,
    });
    setNotice(error ? "कार्यक्रम मस्यौदा बनाउन सकिएन।" : "कार्यक्रम मस्यौदा तयार भयो।");
    if (!error) await refreshPlan();
    setBusy(false);
  };

  const nextPosition = () => Math.max(0, ...slides.map((slide) => slide.slide_position ?? 0)) + 1;

  const addSong = async (song: SongSearchResult) => {
    const client = getSupabaseBrowserClient();
    if (!client || !plan || !capabilities.can_prepare_worship) return;
    setBusy(true);
    const { error } = await client.from("fellowship_service_items").insert({
      plan_id: plan.plan_id,
      church_id: plan.church_id,
      item_kind: "song",
      section: songSection,
      position: nextPosition(),
      song_id: song.id,
      created_by: userId!,
    });
    setNotice(error ? "गीत स्लाइड थप्न सकिएन।" : `${song.title_ne} कार्यक्रमको अन्त्यमा थपियो।`);
    if (!error) await refreshPlan();
    setBusy(false);
  };

  const addScripture = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !plan || !capabilities.can_prepare_sermon) return;
    const chapterNumber = Number(chapter);
    const firstVerse = Number(verseStart);
    const lastVerse = Number(verseEnd || verseStart);
    if (!bookCode.trim() || !bookName.trim() || chapterNumber < 1 || firstVerse < 1 || lastVerse < firstVerse) {
      setNotice("बाइबल पुस्तक, अध्याय र पद दायरा ठीकसँग राख्नुहोस्।");
      return;
    }
    setBusy(true);
    const { error } = await client.from("fellowship_service_items").insert({
      plan_id: plan.plan_id,
      church_id: plan.church_id,
      item_kind: "scripture",
      section: "sermon",
      position: nextPosition(),
      song_id: null,
      book_code: bookCode.trim().toUpperCase(),
      book_name_ne: bookName.trim(),
      chapter: chapterNumber,
      verse_start: firstVerse,
      verse_end: lastVerse,
      label: passageLabel.trim() || null,
      created_by: userId!,
    });
    setNotice(error ? "बाइबल खण्ड थप्न सकिएन।" : "बाइबल खण्ड स्लाइड थपियो।");
    if (!error) await refreshPlan();
    setBusy(false);
  };

  const saveSermon = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !plan || !capabilities.can_prepare_sermon) return;
    setBusy(true);
    const { error } = await client.from("fellowship_service_plans").update({ sermon_topic: sermonTopic.trim() || null, sermon_summary: sermonSummary.trim() || null }).eq("id", plan.plan_id);
    setNotice(error ? "वचन तयारी सुरक्षित गर्न सकिएन।" : "वचनको विषय र तयारी सुरक्षित भयो।");
    if (!error) await refreshPlan();
    setBusy(false);
  };

  const changePlanStatus = async (status: "draft" | "published") => {
    const client = getSupabaseBrowserClient();
    if (!client || !plan || !capabilities.can_manage_program) return;
    setBusy(true);
    const { error } = await client.from("fellowship_service_plans").update({ status }).eq("id", plan.plan_id);
    setNotice(error ? (error.message.includes("required") ? "प्रकाशनअघि कम्तीमा एउटा गीत, एउटा बाइबल खण्ड र वचनको विषय चाहिन्छ।" : "कार्यक्रमको अवस्था परिवर्तन गर्न सकिएन।") : status === "published" ? "कार्यक्रम सबै सक्रिय सदस्यका लागि प्रकाशित भयो।" : "सम्पादनका लागि कार्यक्रम फेरि मस्यौदा बनाइयो।");
    if (!error) await refreshPlan();
    setBusy(false);
  };

  const removeSlide = async (slide: ServiceSlide) => {
    const client = getSupabaseBrowserClient();
    if (!client || !slide.item_id) return;
    setBusy(true);
    const { error } = await client.from("fellowship_service_items").delete().eq("id", slide.item_id);
    setNotice(error ? "स्लाइड हटाउन सकिएन।" : "स्लाइड हटाइयो।");
    if (!error) await refreshPlan();
    setBusy(false);
  };

  const saveMemberNote = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !plan || !fellowshipId) return;
    setBusy(true);
    const { error } = await client.from("member_fellowship_notes").upsert({
      church_id: plan.church_id,
      fellowship_id: fellowshipId,
      user_id: userId,
      body: noteBody,
    }, { onConflict: "fellowship_id,user_id" });
    setNotice(error ? "व्यक्तिगत टिप्पणी सुरक्षित गर्न सकिएन।" : "व्यक्तिगत टिप्पणी सुरक्षित भयो।");
    if (!error) await refreshNotebook();
    setBusy(false);
  };

  const addHighlight = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !plan || !activeSlide || activeSlide.item_kind !== "scripture" || !activeSlide.book_code || !activeSlide.book_name_ne || !activeSlide.chapter || !activeSlide.verse_start || !activeSlide.verse_end || !highlightText.trim()) return;
    setBusy(true);
    const { error } = await client.from("member_verse_highlights").insert({
      church_id: plan.church_id,
      fellowship_id: plan.fellowship_id,
      user_id: userId,
      book_code: activeSlide.book_code,
      book_name_ne: activeSlide.book_name_ne,
      chapter: activeSlide.chapter,
      verse_start: activeSlide.verse_start,
      verse_end: activeSlide.verse_end,
      selected_text: highlightText.trim(),
      reflection: highlightReflection.trim() || null,
      color: highlightColor,
    });
    setNotice(error ? "हाइलाइट सुरक्षित गर्न सकिएन।" : "पदको हाइलाइट निजी रूपमा सुरक्षित भयो।");
    if (!error) {
      setHighlightText("");
      setHighlightReflection("");
      await refreshNotebook();
    }
    setBusy(false);
  };

  const deleteHighlight = async (id: number) => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.from("member_verse_highlights").delete().eq("id", id);
    if (!error) await refreshNotebook();
  };

  const deleteVoiceNote = async (voice: VoiceNote) => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    const { error: storageError } = await client.storage.from("member-voice-notes").remove([voice.storage_path]);
    if (!storageError) {
      const { error } = await client.from("member_voice_notes").delete().eq("id", voice.id);
      setNotice(error ? "आवाज अभिलेख हटाउन सकिएन।" : "आवाज टिप्पणी हटाइयो।");
      if (!error) await refreshNotebook();
    } else setNotice("Storage बाट आवाज फाइल हटाउन सकिएन।");
    setBusy(false);
  };

  const openBible = (slide: ServiceSlide) => {
    if (!slide.book_code || !slide.chapter || !slide.verse_start) return;
    window.history.replaceState(null, "", `#bible/${slide.book_code}/${slide.chapter}/${slide.verse_start}`);
    onNavigate("bible");
  };

  const captureSelectedText = () => {
    const selection = window.getSelection()?.toString().trim() ?? "";
    if (selection) setHighlightText(selection.slice(0, 1000));
  };

  const scriptureVerses = (slide: ServiceSlide) => {
    if (!slide.book_code || !slide.chapter || !slide.verse_start || !slide.verse_end) return [];
    return (bibleBooks[slide.book_code]?.chapters[String(slide.chapter)] ?? []).filter((verse) => {
      const number = Number.parseInt(verse.number, 10);
      return number >= slide.verse_start! && number <= slide.verse_end!;
    });
  };

  const downloadProjectorSlides = async () => {
    if (!plan || slides.length === 0) return;
    const scriptureSlides = slides.filter((slide) => slide.item_kind === "scripture");
    if (scriptureSlides.some((slide) => scriptureVerses(slide).length === 0)) {
      setNotice("तयार गरिएको बाइबल पाठ अझै लोड हुँदैछ। केही क्षणपछि फेरि प्रयास गर्नुहोस्।");
      return;
    }
    setGeneratingPresentation(true);
    setPresentationProgress("स्लाइड सामग्री तयार हुँदैछ…");
    setNotice("");
    try {
      const { generateFellowshipPowerPoint } = await import("./fellowship-presentation-export");
      await generateFellowshipPowerPoint({
        fellowshipTitle: plan.fellowship_title,
        startsAt: plan.fellowship_starts_at,
        sermonTopic: plan.sermon_topic ?? "",
        preacherName: plan.preacher_name ?? "",
        items: slides.map((slide) => ({
          id: slide.item_id!,
          kind: slide.item_kind!,
          section: slide.section ?? "worship",
          label: slide.item_kind === "song" ? songLabel(slide) : slide.item_label || "तयार गरिएको वचन",
          title: slide.item_kind === "song" ? slide.song_title || songLabel(slide) : slide.item_label || scriptureLabel(slide),
          lyrics: slide.item_kind === "song" ? slide.song_lyrics ?? "" : undefined,
          reference: slide.item_kind === "scripture" ? scriptureLabel(slide) : undefined,
          scriptureText: slide.item_kind === "scripture" ? scriptureVerses(slide).map((verse) => `${verse.number}  ${verse.text}`) : undefined,
        })),
      }, setPresentationProgress);
      setNotice("Projector PowerPoint डाउनलोड भयो। डाउनलोड फोल्डरमा .pptx फाइल खोल्नुहोस्।");
    } catch {
      setNotice("PowerPoint बनाउन सकिएन। इन्टरनेट जाँच गरी फेरि प्रयास गर्नुहोस्।");
    } finally {
      setGeneratingPresentation(false);
      window.setTimeout(() => setPresentationProgress(""), 2500);
    }
  };

  if (!userId) return <div className="app-screen screen-enter"><header className="detail-header"><button className="icon-button" type="button" onClick={() => onNavigate("schedule")}>←</button><div className="dashboard-brand"><span>फेलोशिप कार्यक्रम</span></div><span className="header-spacer" /></header><div className="app-scroll service-content"><div className="service-empty"><span>▤</span><h1>सदस्य साइन इन आवश्यक छ</h1><p>प्रकाशित गीत, वचन स्लाइड र निजी टिप्पणी मण्डली सदस्यका लागि सुरक्षित छन्।</p></div></div></div>;
  if (!fellowshipId) return <div className="app-screen screen-enter"><div className="service-empty"><h1>फेलोशिप चयन भएको छैन</h1><button type="button" onClick={() => onNavigate("schedule")}>तालिकामा फर्कनुहोस्</button></div></div>;

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header service-header"><button className="icon-button" type="button" onClick={() => onNavigate("schedule")} aria-label="तालिकामा फर्कनुहोस्">←</button><div><strong>फेलोशिप कार्यक्रम</strong><small>{fellowship?.title ?? "कार्यक्रम"}</small></div><span className="secure-data-tag">मण्डली सुरक्षित</span></header>
      <div className="app-scroll service-content">
        {loading ? <div className="service-empty" role="status"><span>⌛</span><h1>कार्यक्रम लोड हुँदैछ…</h1></div> : !fellowship || !activeMembership ? <div className="service-empty"><span>⌂</span><h1>यो फेलोशिप खोल्न अनुमति छैन</h1><p>सक्रिय मण्डली सदस्यता वा तोकिएको तयारी जिम्मेवारी आवश्यक छ।</p></div> : !plan ? <div className="service-empty"><span>▤</span><h1>कार्यक्रम अझै प्रकाशित भएको छैन</h1><p>{hasPreparationAccess ? "तपाईंको जिम्मेवारीअनुसार पहिलो कार्यक्रम मस्यौदा बनाउन सक्नुहुन्छ।" : "आराधना र वचन टोलीले तयार गरी प्रकाशन गरेपछि यहाँ देखिन्छ।"}</p>{hasPreparationAccess && <button type="button" disabled={busy} onClick={() => void createPlan()}>कार्यक्रम मस्यौदा बनाउनुहोस्</button>}</div> : <>
          <section className="service-hero"><p>{formatDateTime(plan.fellowship_starts_at)}</p><h1>{plan.plan_title}</h1><div><span>{plan.plan_status === "published" ? "प्रकाशित" : "मस्यौदा"}</span><span>{slides.length.toLocaleString("ne-NP")} स्लाइड</span></div></section>
          <div className="service-mode-tabs" role="tablist"><button type="button" className={mode === "slides" ? "active" : ""} onClick={() => setMode("slides")}>कार्यक्रम स्लाइड</button>{plan.plan_status === "published" && <button type="button" className={mode === "notebook" ? "active" : ""} onClick={() => setMode("notebook")}>मेरो नोटबुक</button>}{hasPreparationAccess && <button type="button" className={mode === "prepare" ? "active" : ""} onClick={() => setMode("prepare")}>तयारी</button>}</div>
          {slides.length > 0 && (plan.plan_status === "published" || hasPreparationAccess) && <section className="service-pptx-action"><span aria-hidden="true">▣</span><div><small>Projector-ready · 16:9 PowerPoint</small><strong>तयार गीत र वचनबाट स्लाइड बनाउनुहोस्</strong><p>ठूलो अक्षर, स्वचालित सामग्री विभाजन र विषयअनुसार Unsplash पृष्ठभूमि।</p></div><button type="button" disabled={generatingPresentation} onClick={() => void downloadProjectorSlides()}>{generatingPresentation ? "बनाउँदैछ…" : "PowerPoint डाउनलोड"}</button>{presentationProgress && <em role="status">{presentationProgress}</em>}</section>}

          {mode === "slides" && <>
            <section className="sermon-topic-card"><p>आजको वचन</p><h2>{plan.sermon_topic || "विषय प्रकाशन बाँकी"}</h2><small>{plan.preacher_name ? `वचन सेवक: ${plan.preacher_name}` : "वचन सेवक तोकिएको छैन"}</small>{plan.sermon_summary && <p>{plan.sermon_summary}</p>}</section>
            {slides.length === 0 ? <div className="service-empty service-empty--compact"><h2>स्लाइड तयार भएको छैन</h2></div> : <section className="service-slide-deck" aria-label="फेलोशिप कार्यक्रम स्लाइड">
              <div className="service-slide-progress"><span>{(slideIndex + 1).toLocaleString("ne-NP")} / {slides.length.toLocaleString("ne-NP")}</span><strong>{SECTION_LABELS[activeSlide?.section ?? ""]}</strong></div>
              {activeSlide?.item_kind === "song" ? <article className="service-slide song-slide"><div><span>{songLabel(activeSlide)}</span>{(activeSlide.song_key || activeSlide.song_chords) && <small>Key {transposeChord(activeSlide.song_key || activeSlide.song_chords || "", transpose)}</small>}</div><h2>{activeSlide.song_title}</h2>{(activeSlide.song_chords || hasInlineChordMarkers(activeSlide.song_lyrics || "")) && <div className="service-song-transpose" aria-label="कर्डको की परिवर्तन"><button type="button" disabled={transpose <= -12} onClick={() => setTranspose((value) => Math.max(-12, value - 1))}>−</button><span><b>{transpose > 0 ? `+${transpose}` : transpose}</b><small>सेमिटोन</small></span><button type="button" disabled={transpose >= 12} onClick={() => setTranspose((value) => Math.min(12, value + 1))}>+</button><button type="button" disabled={transpose === 0} onClick={() => setTranspose(0)}>↺</button></div>}<div className="service-song-lyrics">{(activeSlide.song_lyrics || "").split(/\r?\n/).map((line, index) => line ? <p className={hasInlineChordMarkers(line) ? "song-line song-line--chords" : "song-line"} key={`${activeSlide.item_id}-${index}`}>{hasInlineChordMarkers(line) ? renderChordedLine(line, transpose) : lyricLineWithoutChords(line)}</p> : <br key={`${activeSlide.item_id}-${index}`} />)}</div>{activeSlide.song_chords && <details><summary>कर्ड जानकारी</summary><pre>{transposeChord(activeSlide.song_chords, transpose)}</pre></details>}</article> : activeSlide ? <article className="service-slide scripture-slide" onPointerUp={captureSelectedText}><div><span>{activeSlide.item_label || "तयार गरिएको वचन"}</span></div><h2>{scriptureLabel(activeSlide)}</h2><div className="prepared-scripture-text">{scriptureVerses(activeSlide).map((verse) => <p key={verse.number}><sup>{verse.number}</sup>{verse.text}</p>)}</div>{activeSlide.item_note && <blockquote>{activeSlide.item_note}</blockquote>}<button type="button" onClick={() => openBible(activeSlide)}>बाइबल रिडरमा खोल्नुहोस्</button></article> : null}
              <div className="service-slide-controls"><button type="button" disabled={slideIndex === 0} onClick={() => setSlideIndex((current) => Math.max(0, current - 1))}>‹ अघिल्लो</button><button type="button" disabled={slideIndex >= slides.length - 1} onClick={() => setSlideIndex((current) => Math.min(slides.length - 1, current + 1))}>अर्को ›</button></div>
              <div className="service-slide-strip">{slides.map((slide, index) => <button type="button" className={index === slideIndex ? "active" : ""} key={slide.item_id} onClick={() => setSlideIndex(index)}><span>{(index + 1).toLocaleString("ne-NP")}</span><small>{slide.item_kind === "song" ? songLabel(slide) : scriptureLabel(slide)}</small></button>)}</div>
            </section>}
          </>}

          {mode === "prepare" && hasPreparationAccess && <section className="service-preparation-panel">
            <div className="service-preparation-heading"><div><p>जिम्मेवारीअनुसार सम्पादन</p><h2>कार्यक्रम तयारी</h2></div>{capabilities.can_manage_program && <button type="button" disabled={busy} onClick={() => void changePlanStatus(plan.plan_status === "published" ? "draft" : "published")}>{plan.plan_status === "published" ? "सम्पादनका लागि खोल्नुहोस्" : "सदस्यलाई प्रकाशित गर्नुहोस्"}</button>}</div>
            {plan.plan_status === "published" ? <p className="service-inline-notice">प्रकाशित कार्यक्रम सुरक्षित छ। परिवर्तन गर्न कार्यक्रम व्यवस्थापकले पहिले मस्यौदा खोल्नुपर्छ।</p> : <>
              {capabilities.can_prepare_worship && <section className="service-builder-card"><div><span>♪</span><div><p>आराधना जिम्मेवारी</p><h3>क्रममा गीत स्लाइड थप्नुहोस्</h3></div></div><div className="service-builder-controls"><select value={songType} onChange={(event) => setSongType(event.target.value as typeof songType)}><option value="bhajan">भजन</option><option value="chorus">कोरस</option><option value="all">सबै गीत</option></select><select value={songSection} onChange={(event) => setSongSection(event.target.value as typeof songSection)}><option value="opening">सुरुवात</option><option value="worship">आराधना</option><option value="response">प्रतिक्रिया</option><option value="closing">समापन</option></select></div><input type="search" value={songQuery} onChange={(event) => setSongQuery(event.target.value)} placeholder="गीत नम्बर वा नाम खोज्नुहोस्…" /><div className="service-song-results">{songResults.map((song) => <button type="button" disabled={busy} key={song.id} onClick={() => void addSong(song)}><span>{song.song_type === "bhajan" ? "भजन" : song.song_type === "chorus" ? "कोरस" : "गीत"} {song.song_number?.toLocaleString("ne-NP")}</span><strong>{song.title_ne}</strong><b>＋</b></button>)}</div></section>}
              {capabilities.can_prepare_sermon && <><section className="service-builder-card"><div><span>▤</span><div><p>वचन जिम्मेवारी</p><h3>मुख्य विषय र सारांश</h3></div></div><label>वचनको मुख्य विषय<input maxLength={200} value={sermonTopic} onChange={(event) => setSermonTopic(event.target.value)} placeholder="जस्तै: विश्वासमा दृढ रहौँ" /></label><label>तयारी सारांश (ऐच्छिक)<textarea rows={4} maxLength={5000} value={sermonSummary} onChange={(event) => setSermonSummary(event.target.value)} placeholder="मुख्य शिक्षा र उद्देश्य…" /></label><button className="service-save-button" type="button" disabled={busy} onClick={() => void saveSermon()}>वचन तयारी सुरक्षित गर्नुहोस्</button></section>
              <section className="service-builder-card"><div><span>＋</span><div><p>स्लाइडमा बाइबल पाठ</p><h3>अध्याय र पद थप्नुहोस्</h3></div></div><div className="service-scripture-grid"><label>Book code<input maxLength={8} value={bookCode} onChange={(event) => setBookCode(event.target.value.toUpperCase())} /></label><label>नेपाली नाम<input maxLength={100} value={bookName} onChange={(event) => setBookName(event.target.value)} /></label><label>अध्याय<input type="number" min="1" max="200" value={chapter} onChange={(event) => setChapter(event.target.value)} /></label><label>सुरु पद<input type="number" min="1" max="300" value={verseStart} onChange={(event) => setVerseStart(event.target.value)} /></label><label>अन्तिम पद<input type="number" min="1" max="300" value={verseEnd} onChange={(event) => setVerseEnd(event.target.value)} /></label></div><label>स्लाइड शीर्षक (ऐच्छिक)<input maxLength={200} value={passageLabel} onChange={(event) => setPassageLabel(event.target.value)} placeholder="जस्तै: परमेश्वरको प्रेम" /></label><button className="service-save-button" type="button" disabled={busy} onClick={() => void addScripture()}>बाइबल स्लाइड थप्नुहोस्</button></section></>}
              <section className="service-order-list"><div><h3>हालको स्लाइड क्रम</h3><span>{slides.length.toLocaleString("ne-NP")}</span></div>{slides.map((slide) => <article key={slide.item_id}><span>{slide.slide_position?.toLocaleString("ne-NP")}</span><div><strong>{slide.item_kind === "song" ? `${songLabel(slide)} · ${slide.song_title}` : scriptureLabel(slide)}</strong><small>{SECTION_LABELS[slide.section ?? ""]}</small></div>{((slide.item_kind === "song" && capabilities.can_prepare_worship) || (slide.item_kind === "scripture" && capabilities.can_prepare_sermon)) && <button type="button" disabled={busy} onClick={() => void removeSlide(slide)}>हटाउनुहोस्</button>}</article>)}</section>
            </>}
          </section>}

          {mode === "notebook" && plan.plan_status === "published" && <section className="service-notebook">
            <div className="service-private-note"><span>🔒</span><p><strong>तपाईंको निजी नोटबुक</strong><small>मण्डली प्रशासक वा अन्य सदस्यले तपाईंका नोट, हाइलाइट र आवाज सुन्न सक्दैनन्।</small></p></div>
            <section className="service-note-card"><div><p>आज मैले के सिकेँ वा आशिष् पाएँ?</p><h2>लिखित टिप्पणी</h2></div><textarea rows={8} maxLength={20000} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="वचनबाट सिकेको कुरा, प्रार्थना, निर्णय वा आशिष् लेख्नुहोस्…" /><button type="button" disabled={busy} onClick={() => void saveMemberNote()}>{busy ? "सुरक्षित हुँदैछ…" : "टिप्पणी सुरक्षित गर्नुहोस्"}</button></section>
            {activeSlide?.item_kind === "scripture" && <section className="service-highlight-card"><div><p>{scriptureLabel(activeSlide)}</p><h2>शब्द वा वाक्य हाइलाइट</h2></div><p>माथिको पदबाट शब्द चयन गर्नुहोस् वा तल आफैँ लेख्नुहोस्।</p><textarea rows={3} maxLength={1000} value={highlightText} onChange={(event) => setHighlightText(event.target.value)} placeholder="मन छोएको शब्द वा वाक्य…" /><textarea rows={3} maxLength={5000} value={highlightReflection} onChange={(event) => setHighlightReflection(event.target.value)} placeholder="यसबाट मैले पाएको शिक्षा (ऐच्छिक)…" /><div><select value={highlightColor} onChange={(event) => setHighlightColor(event.target.value)}><option value="gold">सुनौलो</option><option value="green">हरियो</option><option value="blue">नीलो</option><option value="rose">गुलाबी</option></select><button type="button" disabled={busy || !highlightText.trim()} onClick={() => void addHighlight()}>हाइलाइट सुरक्षित</button></div></section>}
            <section className="service-highlight-list"><div><h2>सुरक्षित हाइलाइट</h2><span>{highlights.length.toLocaleString("ne-NP")}</span></div>{highlights.length === 0 ? <p>कुनै पद हाइलाइट गरिएको छैन। स्लाइडमा बाइबल खण्ड खोलेर शब्द चयन गर्नुहोस्।</p> : highlights.map((highlight) => <article className={`highlight-${highlight.color}`} key={highlight.id}><small>{highlight.book_name_ne} {highlight.chapter}:{highlight.verse_start}{highlight.verse_end !== highlight.verse_start ? `-${highlight.verse_end}` : ""}</small><blockquote>{highlight.selected_text}</blockquote>{highlight.reflection && <p>{highlight.reflection}</p>}<button type="button" onClick={() => void deleteHighlight(highlight.id)}>हटाउनुहोस्</button></article>)}</section>
            <VoiceNoteRecorder userId={userId} churchId={plan.church_id} fellowshipId={plan.fellowship_id} onSaved={refreshNotebook} />
            <section className="service-voice-list"><div><h2>मेरा आवाज टिप्पणी</h2><span>{voiceNotes.length.toLocaleString("ne-NP")}</span></div>{voiceNotes.length === 0 ? <p>अहिलेसम्म आवाज टिप्पणी छैन।</p> : voiceNotes.map((voice) => <article key={voice.id}><div><strong>{voice.caption || "आवाज टिप्पणी"}</strong><small>{voice.duration_seconds.toLocaleString("ne-NP")} सेकेन्ड · {(voice.size_bytes / 1024 / 1024).toFixed(2)} MB</small></div>{voice.signed_url && <audio controls preload="metadata" src={voice.signed_url} />}<button type="button" disabled={busy} onClick={() => void deleteVoiceNote(voice)}>हटाउनुहोस्</button></article>)}</section>
          </section>}
        </>}
        {notice && <p className="membership-notice info" role="status">{notice}</p>}
      </div>
    </div>
  );
}
