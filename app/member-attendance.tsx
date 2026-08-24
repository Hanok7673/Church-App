"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";

type AttendanceHistoryRow = Database["public"]["Functions"]["list_my_attendance"]["Returns"][number];

const STATUS_LABELS: Record<string, string> = {
  attended: "उपस्थित",
  missed: "अनुपस्थित",
  excused: "कारणसहित",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export function MemberAttendance({ memberships, onNavigate }: {
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const activeMemberships = useMemo(() => memberships.filter((membership) => membership.status === "active"), [memberships]);
  const [churchId, setChurchId] = useState<number | null>(() => activeMemberships[0]?.churchId ?? null);
  const selectedMembership = activeMemberships.find((membership) => membership.churchId === churchId) ?? activeMemberships[0] ?? null;
  const [history, setHistory] = useState<AttendanceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totals = useMemo(() => ({
    attended: history.filter((row) => row.attendance_status === "attended").length,
    missed: history.filter((row) => row.attendance_status === "missed").length,
    excused: history.filter((row) => row.attendance_status === "excused").length,
  }), [history]);

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
      client.rpc("list_my_attendance", { p_church_id: selectedMembership.churchId, p_limit: 200 }).then(({ data, error: attendanceError }) => {
        if (!active) return;
        if (attendanceError) {
          setHistory([]);
          setError("तपाईंको उपस्थिति इतिहास लोड गर्न सकिएन। सदस्यता फेरि जाँच्नुहोस्।");
        } else {
          setHistory((data ?? []) as AttendanceHistoryRow[]);
        }
        setLoading(false);
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedMembership]);

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header attendance-header"><button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button><div><p className="eyebrow">निजी सदस्य इतिहास</p><strong>मेरो उपस्थिति</strong></div><span className="secure-data-tag">सुरक्षित</span></header>
      <div className="app-scroll attendance-content">
        <section className="attendance-hero"><div><span>फेलोशिप सहभागिता</span><h1>तपाईंको उपस्थिति इतिहास</h1><p>यो सूची तपाईंले मात्र देख्न सक्नुहुन्छ। उपस्थिति मण्डली प्रशासक वा अधिकृत संयोजकले तोक्छन्।</p></div><span aria-hidden="true">✓</span></section>
        {activeMemberships.length > 1 && <label className="attendance-church-picker">मण्डली<select value={selectedMembership?.churchId ?? ""} onChange={(event) => setChurchId(Number(event.target.value))}>{activeMemberships.map((membership) => <option value={membership.churchId} key={membership.id}>{membership.churchNameNe || membership.churchName}</option>)}</select></label>}
        {!selectedMembership ? <div className="attendance-empty"><span aria-hidden="true">⌂</span><h2>सक्रिय मण्डली सदस्यता आवश्यक छ</h2><p>उपस्थिति इतिहास हेर्न पहिले मण्डलीमा जोडिनुहोस्।</p><button type="button" onClick={() => onNavigate("membership")}>मण्डली सदस्यता खोल्नुहोस्</button></div> : <>
          <div className="attendance-stat-grid"><div className="attended"><strong>{totals.attended.toLocaleString("ne-NP")}</strong><small>उपस्थित</small></div><div className="missed"><strong>{totals.missed.toLocaleString("ne-NP")}</strong><small>अनुपस्थित</small></div><div className="excused"><strong>{totals.excused.toLocaleString("ne-NP")}</strong><small>कारणसहित</small></div></div>
          <div className="attendance-security-note" role="note"><span aria-hidden="true">⌾</span><p><strong>तपाईंको निजी पङ्क्तिहरू मात्र</strong><small>अन्य सदस्यको उपस्थिति यो स्क्रिन वा सदस्य API बाट खोल्न सकिँदैन।</small></p></div>
          {loading ? <div className="attendance-empty"><span className="tiny-spinner" aria-hidden="true" /><h2>इतिहास खोलिँदैछ…</h2></div> : error ? <p className="form-message form-message--error">{error}</p> : history.length === 0 ? <div className="attendance-empty"><span aria-hidden="true">✓</span><h2>अहिलेसम्म उपस्थिति तोकिएको छैन</h2><p>मण्डली प्रशासकले फेलोशिप उपस्थिति सुरक्षित गरेपछि यहाँ देखिनेछ।</p></div> : <section className="attendance-history" aria-labelledby="attendance-history-heading"><div><p className="eyebrow">अभिलेख</p><h2 id="attendance-history-heading">फेलोशिप अनुसार</h2></div>{history.map((row) => <article key={row.attendance_id}><span className={row.attendance_status}>{row.attendance_status === "attended" ? "✓" : row.attendance_status === "missed" ? "×" : "!"}</span><div><small>{formatDate(row.fellowship_starts_at)}</small><strong>{row.fellowship_title}</strong>{row.attendance_notes && <em>{row.attendance_notes}</em>}</div><b className={row.attendance_status}>{STATUS_LABELS[row.attendance_status] ?? row.attendance_status}</b></article>)}</section>}
        </>}
      </div>
      <AttendanceBottomNav onNavigate={onNavigate} />
    </div>
  );
}

function AttendanceBottomNav({ onNavigate }: { onNavigate: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन"><button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button><button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button><button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button><button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button><button type="button" className="active" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button></nav>;
}
