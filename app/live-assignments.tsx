"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";

type LiveAssignment = {
  assignment_id: number;
  fellowship_id: number;
  fellowship_title: string;
  location_name: string | null;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  fellowship_status: string;
  ministry_role_id: number;
  ministry_role_code: string;
  ministry_role_name_ne: string;
  notes: string | null;
  assignment_status: "assigned" | "accepted" | "declined" | "completed";
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type LiveFilter = "active" | "all" | "completed";
type LiveNotice = { tone: "success" | "error" | "info"; text: string } | null;

const STATUS_LABELS: Record<string, string> = {
  assigned: "जवाफ दिन बाँकी",
  accepted: "स्वीकार गरिएको",
  declined: "अस्वीकार गरिएको",
  completed: "सम्पन्न",
};

const ROLE_ICONS: Record<string, string> = {
  lead: "◖",
  worship: "♪",
  preach: "▤",
  prayer: "◇",
  host: "◎",
};

function readSelectedAssignmentId() {
  if (typeof window === "undefined") return null;
  const value = window.location.hash.match(/^#assignments\/(\d+)$/)?.[1];
  return value ? Number(value) : null;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function LiveAssignments({ name, userId, memberships, onNavigate }: {
  name: string;
  userId: string;
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const activeMemberships = useMemo(() => memberships.filter((membership) => membership.status === "active"), [memberships]);
  const [membershipId, setMembershipId] = useState<number | null>(activeMemberships[0]?.id ?? null);
  const selectedMembership = activeMemberships.find((membership) => membership.id === membershipId) ?? activeMemberships[0] ?? null;
  const [assignments, setAssignments] = useState<LiveAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(readSelectedAssignmentId);
  const [filter, setFilter] = useState<LiveFilter>("active");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<LiveNotice>(null);

  const selectedAssignment = assignments.find((assignment) => assignment.assignment_id === selectedId) ?? null;
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
    if (filter === "all") return true;
    if (filter === "completed") return assignment.assignment_status === "completed";
    return assignment.assignment_status !== "completed" && assignment.assignment_status !== "declined";
  }), [assignments, filter]);
  const uniqueRoles = useMemo(() => Array.from(new Map(assignments.map((assignment) => [assignment.ministry_role_id, assignment])).values()), [assignments]);
  const firstName = name.trim().split(" ")[0] || "सदस्य";

  async function refresh(targetMembershipId: number) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true);
    const { data, error } = await client.rpc("list_my_assignments", { p_membership_id: targetMembershipId, p_limit: 200 });
    if (error) {
      setAssignments([]);
      setNotice({ tone: "error", text: "तपाईंका वास्तविक जिम्मेवारी लोड गर्न सकिएन।" });
    } else {
      setAssignments((data ?? []) as LiveAssignment[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!selectedMembership) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => { void refresh(selectedMembership.id); }, 0);
    return () => window.clearTimeout(timer);
    // Membership id is the tenant boundary for this member-only RPC.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipId, selectedMembership?.id, userId]);

  function openAssignment(assignment: LiveAssignment) {
    setSelectedId(assignment.assignment_id);
    window.history.replaceState(null, "", `#assignments/${assignment.assignment_id}`);
  }

  function closeAssignment() {
    setSelectedId(null);
    window.history.replaceState(null, "", "#assignments");
  }

  async function respond(status: "accepted" | "declined") {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedAssignment || !selectedMembership) return;
    setBusy(true);
    setNotice(null);
    const { data, error } = await client.from("assignments")
      .update({ status })
      .eq("id", selectedAssignment.assignment_id)
      .eq("member_membership_id", selectedMembership.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setNotice({ tone: "error", text: "जिम्मेवारीको जवाफ सुरक्षित गर्न सकिएन। यसको अवस्था पहिले नै परिवर्तन भएको हुन सक्छ।" });
    } else {
      setNotice({ tone: "success", text: status === "accepted" ? "जिम्मेवारी स्वीकार गरियो। अब तयारी पोस्ट गर्न सक्नुहुन्छ।" : "जिम्मेवारी अस्वीकार गरिएको जानकारी प्रशासकलाई देखिनेछ।" });
      await refresh(selectedMembership.id);
    }
    setBusy(false);
  }

  if (!selectedMembership) {
    return <div className="app-screen screen-enter"><header className="detail-header assignments-header"><button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button><div><p className="eyebrow">सेवकाइ</p><strong>मेरो भूमिका</strong></div><span className="header-spacer" /></header><div className="app-scroll assignments-content"><section className="membership-empty-card"><span aria-hidden="true">⌂</span><h1>सक्रिय मण्डली सदस्यता छैन</h1><p>वास्तविक जिम्मेवारी हेर्न पहिले मण्डलीमा जोडिनुहोस्।</p><button type="button" onClick={() => onNavigate("membership")}>मेरो मण्डली खोल्नुहोस्</button></section></div></div>;
  }

  if (selectedAssignment) {
    return (
      <div className="app-screen screen-enter">
        <header className="detail-header assignment-detail-header"><button className="icon-button" type="button" onClick={closeAssignment} aria-label="जिम्मेवारी सूचीमा फर्कनुहोस्">←</button><div><strong>जिम्मेवारी विवरण</strong><small>Supabase सुरक्षित</small></div><span className="secure-data-tag">वास्तविक</span></header>
        <div className="app-scroll assignment-detail-content">
          <section className="assignment-detail-hero assignment-tone--teal"><span aria-hidden="true">{ROLE_ICONS[selectedAssignment.ministry_role_code] ?? "✓"}</span><div><small>{STATUS_LABELS[selectedAssignment.assignment_status]}</small><h1>{selectedAssignment.ministry_role_name_ne}</h1><p>{selectedAssignment.fellowship_title}</p></div></section>
          <div className="live-assignment-security-note"><span aria-hidden="true">🔒</span><p><strong>यो वास्तविक मण्डली जिम्मेवारी हो</strong><small>जवाफ डेटाबेसमा सुरक्षित हुन्छ र तपाईं तथा मण्डली प्रशासकले मात्र यो रेकर्ड हेर्न सक्नुहुन्छ।</small></p></div>
          <section className="assignment-info-grid" aria-label="जिम्मेवारीको समय र स्थान"><span><small>मिति र समय</small><strong>{formatDateTime(selectedAssignment.starts_at)}</strong></span><span><small>स्थान</small><strong>{selectedAssignment.location_name || "स्थान राखिएको छैन"}</strong></span><span><small>ठेगाना</small><strong>{selectedAssignment.address || "ठेगाना राखिएको छैन"}</strong></span><span><small>अवस्था</small><strong>{STATUS_LABELS[selectedAssignment.assignment_status]}</strong></span></section>
          {selectedAssignment.notes && <section className="assignment-theme-card"><p className="eyebrow">प्रशासकको तयारी निर्देशन</p><h2>{selectedAssignment.notes}</h2></section>}
          {selectedAssignment.ministry_role_code === "worship" && <button className="assignment-song-link" type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><span><small>अभ्यासका लागि</small><strong>आराधना गीत र कर्ड खोल्नुहोस्</strong></span><b aria-hidden="true">›</b></button>}
          {["worship", "preach"].includes(selectedAssignment.ministry_role_code) && selectedAssignment.assignment_status !== "declined" && <button className="assignment-preparation-link" type="button" onClick={() => { window.history.replaceState(null, "", `#service/${selectedAssignment.fellowship_id}`); onNavigate("service"); }}><span aria-hidden="true">▣</span><span><small>यस फेलोशिपका लागि</small><strong>{selectedAssignment.ministry_role_code === "worship" ? "गीत स्लाइड तयार गर्नुहोस्" : "वचन विषय र पद तयार गर्नुहोस्"}</strong></span><b aria-hidden="true">›</b></button>}
          {selectedAssignment.assignment_status === "assigned" && <section className="live-assignment-actions"><p>यो जिम्मेवारी स्वीकार गर्न सक्नुहुन्छ? तपाईंको जवाफ प्रशासकको roster मा तुरुन्त देखिन्छ।</p><div><button type="button" disabled={busy} onClick={() => { void respond("declined"); }}>अस्वीकार गर्नुहोस्</button><button type="button" className="accept" disabled={busy} onClick={() => { void respond("accepted"); }}>स्वीकार गर्नुहोस्</button></div></section>}
          {selectedAssignment.assignment_status === "accepted" && <button className="assignment-preparation-link" type="button" onClick={() => onNavigate("preparations")}><span aria-hidden="true">✎</span><span><small>अर्को चरण</small><strong>तयारी लेखेर स्वीकृतिका लागि पठाउनुहोस्</strong></span><b aria-hidden="true">›</b></button>}
          {selectedAssignment.assignment_status === "declined" && <div className="live-assignment-result declined">तपाईंले यो जिम्मेवारी अस्वीकार गर्नुभएको छ। प्रशासकले अर्को सदस्य तोक्न सक्छन्।</div>}
          {selectedAssignment.assignment_status === "completed" && <div className="live-assignment-result completed">यो जिम्मेवारी सम्पन्न भएको अभिलेख सुरक्षित छ।</div>}
          {notice && <p className={`membership-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
        </div>
        <AssignmentBottomNav onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header assignments-header"><button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button><div><p className="eyebrow">सेवकाइ</p><strong>मेरो भूमिका</strong></div><span className="secure-data-tag">वास्तविक</span></header>
      <div className="app-scroll assignments-content">
        {activeMemberships.length > 1 && <label className="live-assignment-church-picker">मण्डली<select value={selectedMembership.id} onChange={(event) => { setNotice(null); setMembershipId(Number(event.target.value)); }}>{activeMemberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.churchNameNe || membership.churchName}</option>)}</select></label>}
        <section className="assignments-hero"><div><span>जयमसीह, {firstName}</span><h1>सेवाका लागि तयार रहनुहोस्</h1><p>{selectedMembership.churchNameNe || selectedMembership.churchName} का वास्तविक भूमिका र जिम्मेवारी।</p></div><span aria-hidden="true">◖</span></section>
        <div className="live-assignment-security-note"><span aria-hidden="true">🔒</span><p><strong>तपाईंको आफ्नै जिम्मेवारी मात्र</strong><small>अरू सदस्य वा अर्को मण्डलीको assignment यहाँ पढिँदैन।</small></p></div>
        {loading ? <section className="membership-empty-card" role="status"><span aria-hidden="true">⌛</span><h1>जिम्मेवारी लोड हुँदैछ…</h1></section> : <>
          <section className="my-role-section" aria-labelledby="live-role-heading"><div className="assignment-section-heading"><div><p className="eyebrow">सेवकाइ क्षेत्र</p><h2 id="live-role-heading">मेरा वास्तविक भूमिका</h2></div><span>{uniqueRoles.length.toLocaleString("ne-NP")}</span></div>{uniqueRoles.length === 0 ? <p className="live-assignment-empty">प्रशासकले भूमिका तोकेपछि यहाँ देखिन्छ।</p> : <div className="my-role-grid">{uniqueRoles.map((assignment) => <article key={assignment.ministry_role_id} className="my-role-card assignment-tone--teal"><span aria-hidden="true">{ROLE_ICONS[assignment.ministry_role_code] ?? "✓"}</span><div><strong>{assignment.ministry_role_name_ne}</strong><small>{assignment.fellowship_title}</small></div></article>)}</div>}</section>
          <section className="assignment-list-section" aria-labelledby="live-assignment-list-heading"><div className="assignment-section-heading"><div><p className="eyebrow">तालिका</p><h2 id="live-assignment-list-heading">जिम्मेवारीहरू</h2></div><span>{visibleAssignments.length.toLocaleString("ne-NP")}</span></div><div className="assignment-filter-tabs" role="group" aria-label="जिम्मेवारी फिल्टर"><button type="button" className={filter === "active" ? "selected" : ""} onClick={() => setFilter("active")}>सक्रिय</button><button type="button" className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>सबै</button><button type="button" className={filter === "completed" ? "selected" : ""} onClick={() => setFilter("completed")}>सम्पन्न</button></div><div className="assignment-list">{visibleAssignments.length === 0 ? <p className="live-assignment-empty">यो समूहमा जिम्मेवारी छैन।</p> : visibleAssignments.map((assignment) => <button type="button" className="assignment-card" onClick={() => openAssignment(assignment)} key={assignment.assignment_id}><span className="assignment-card-icon assignment-tone--teal">{ROLE_ICONS[assignment.ministry_role_code] ?? "✓"}</span><span className="assignment-card-copy"><small>{STATUS_LABELS[assignment.assignment_status]} · {formatDateTime(assignment.starts_at)}</small><strong>{assignment.ministry_role_name_ne}</strong><em>{assignment.fellowship_title}</em></span><span aria-hidden="true">›</span></button>)}</div></section>
        </>}
        {notice && <p className={`membership-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
      </div>
      <AssignmentBottomNav onNavigate={onNavigate} />
    </div>
  );
}

function AssignmentBottomNav({ onNavigate }: { onNavigate: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन"><button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button><button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button><button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button><button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button><button type="button" className="active" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button></nav>;
}
