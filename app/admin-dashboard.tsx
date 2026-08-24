"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { AdminAssignmentManager } from "./admin-assignment-manager";
import { AdminAttendanceManager } from "./admin-attendance-manager";
import { AdminRecapPublisher } from "./admin-recap-publisher";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";
import { SuperAdminChurchProvisioner } from "./super-admin-church-provisioner";

type AdminChurch = {
  church_id: number;
  church_name: string;
  church_name_ne: string | null;
  address: string | null;
  status: string;
  my_role: string;
  member_count: number;
  fellowship_count: number;
  created_at: string;
  updated_at: string;
};

type InviteSummary = {
  id: number;
  role: string;
  max_uses: number;
  use_count: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

type AdminFellowship = {
  id: number;
  title: string;
  location_name: string | null;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "draft" | "scheduled" | "completed" | "cancelled";
};

type PendingPreparation = {
  id: number;
  fellowship_id: number;
  fellowship_title: string;
  preparation_type: string;
  title: string;
  body: string;
  author_name: string;
  submitted_at: string;
};

type AdminNotice = { tone: "success" | "error" | "info"; text: string } | null;

const STATUS_LABELS: Record<string, string> = {
  active: "सक्रिय",
  suspended: "निलम्बित",
  archived: "अभिलेख",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "प्लेटफर्म सुपर एडमिन",
  owner: "मुख्य मण्डली प्रशासक",
  admin: "मण्डली प्रशासक",
};

const PREPARATION_TYPE_LABELS: Record<string, string> = {
  program_note: "कार्यक्रम तयारी",
  testimony: "गवाही",
  prayer: "प्रार्थना",
  song: "आराधना तयारी",
  scripture: "वचन तयारी",
};

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/^CH-?/, "").replace(/[^A-F0-9]/g, "");
}

async function sha256(value: string) {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createInviteCode() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const compact = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `CH-${compact.match(/.{1,4}/g)?.join("-") ?? compact}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function AdminDashboard({ userId, memberships, isSuperAdmin, onNavigate }: {
  userId: string | null;
  memberships: AccountMembership[];
  isSuperAdmin: boolean;
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const [churches, setChurches] = useState<AdminChurch[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<AdminNotice>(null);
  const [inviteRole, setInviteRole] = useState<"member" | "leader">("member");
  const [inviteDays, setInviteDays] = useState<7 | 30>(7);
  const [inviteUses, setInviteUses] = useState<1 | 10>(1);
  const [generatedCode, setGeneratedCode] = useState("");
  const [inviteList, setInviteList] = useState<InviteSummary[]>([]);
  const [fellowships, setFellowships] = useState<AdminFellowship[]>([]);
  const [pendingPreparations, setPendingPreparations] = useState<PendingPreparation[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [fellowshipTitle, setFellowshipTitle] = useState("");
  const [fellowshipLocation, setFellowshipLocation] = useState("");
  const [fellowshipAddress, setFellowshipAddress] = useState("");
  const [fellowshipStartsAt, setFellowshipStartsAt] = useState("");
  const [fellowshipEndsAt, setFellowshipEndsAt] = useState("");

  const hasChurchAdminRole = memberships.some((membership) => membership.role === "owner" || membership.role === "admin");
  const hasAdminAccess = Boolean(userId) && (isSuperAdmin || hasChurchAdminRole);
  const selectedChurch = churches.find((church) => church.church_id === selectedChurchId) ?? churches[0] ?? null;
  const canManageSelectedChurch = Boolean(selectedChurch && selectedChurch.my_role !== "super_admin");
  const activeInviteCount = useMemo(
    () => inviteList.filter((invite) => !invite.revoked_at && new Date(invite.expires_at) > new Date() && invite.use_count < invite.max_uses).length,
    [inviteList],
  );

  async function refreshChurches(preferredChurchId?: number | null) {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !hasAdminAccess) {
      setChurches([]);
      setLoading(false);
      return;
    }

    const { data, error } = await client.rpc("list_admin_churches");
    if (error) {
      setChurches([]);
      setNotice({ tone: "error", text: "प्रशासनका मण्डली विवरण लोड गर्न सकिएन।" });
    } else {
      const nextChurches = (data ?? []) as AdminChurch[];
      setChurches(nextChurches);
      const requestedId = preferredChurchId ?? selectedChurchId;
      setSelectedChurchId(nextChurches.some((church) => church.church_id === requestedId) ? requestedId : nextChurches[0]?.church_id ?? null);
    }
    setLoading(false);
  }

  async function refreshInvites(churchId: number) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data } = await client
      .from("church_invites")
      .select("id, role, max_uses, use_count, expires_at, revoked_at, created_at")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false })
      .limit(10);
    setInviteList(data ?? []);
  }

  async function refreshChurchWorkflows(churchId: number) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const [fellowshipsResult, queueResult] = await Promise.all([
      client.from("fellowships")
        .select("id, title, location_name, address, starts_at, ends_at, status")
        .eq("church_id", churchId)
        .order("starts_at", { ascending: true })
        .limit(100),
      client.rpc("list_preparation_queue", { p_church_id: churchId, p_limit: 100 }),
    ]);
    setFellowships((fellowshipsResult.data ?? []) as AdminFellowship[]);
    setPendingPreparations((queueResult.data ?? []) as PendingPreparation[]);
    if (fellowshipsResult.error || queueResult.error) {
      setNotice({ tone: "error", text: "फेलोशिप तालिका वा सदस्य तयारीको समीक्षा सूची लोड गर्न सकिएन।" });
    }
  }

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();

    if (!client || !userId || !hasAdminAccess) {
      const timer = window.setTimeout(() => {
        if (!active) return;
        setChurches([]);
        setLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    void client.rpc("list_admin_churches").then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setChurches([]);
        setNotice({ tone: "error", text: "प्रशासनका मण्डली विवरण लोड गर्न सकिएन।" });
      } else {
        const nextChurches = (data ?? []) as AdminChurch[];
        setChurches(nextChurches);
        setSelectedChurchId(nextChurches[0]?.church_id ?? null);
      }
      setLoading(false);
    });

    return () => { active = false; };
  }, [hasAdminAccess, userId]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client || !selectedChurch || selectedChurch.my_role === "super_admin") {
      const timer = window.setTimeout(() => {
        if (!active) return;
        setInviteList([]);
        setFellowships([]);
        setPendingPreparations([]);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(timer);
      };
    }

    void Promise.all([
      client.from("church_invites")
        .select("id, role, max_uses, use_count, expires_at, revoked_at, created_at")
        .eq("church_id", selectedChurch.church_id)
        .order("created_at", { ascending: false })
        .limit(10),
      client.from("fellowships")
        .select("id, title, location_name, address, starts_at, ends_at, status")
        .eq("church_id", selectedChurch.church_id)
        .order("starts_at", { ascending: true })
        .limit(100),
      client.rpc("list_preparation_queue", { p_church_id: selectedChurch.church_id, p_limit: 100 }),
    ]).then(([invitesResult, fellowshipsResult, queueResult]) => {
      if (!active) return;
      setInviteList(invitesResult.data ?? []);
      setFellowships((fellowshipsResult.data ?? []) as AdminFellowship[]);
      setPendingPreparations((queueResult.data ?? []) as PendingPreparation[]);
      if (fellowshipsResult.error || queueResult.error) setNotice({ tone: "error", text: "फेलोशिप तालिका वा समीक्षा सूची लोड गर्न सकिएन।" });
    });

    return () => { active = false; };
  }, [selectedChurch]);

  async function changeChurchStatus(status: "active" | "suspended" | "archived") {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedChurch || !isSuperAdmin) return;
    setBusy(true);
    setNotice(null);
    const { error } = await client.from("churches").update({ status }).eq("id", selectedChurch.church_id);
    if (error) {
      setNotice({ tone: "error", text: "मण्डलीको अवस्था परिवर्तन गर्न सकिएन। सुपर एडमिन अधिकार जाँच्नुहोस्।" });
    } else {
      setNotice({ tone: "success", text: `मण्डलीको अवस्था “${STATUS_LABELS[status]}” बनाइयो।` });
      await refreshChurches(selectedChurch.church_id);
    }
    setBusy(false);
  }

  async function generateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !selectedChurch || !canManageSelectedChurch) return;
    setBusy(true);
    setNotice(null);
    const code = createInviteCode();
    const codeHash = await sha256(normalizeInviteCode(code));
    const expiresAt = new Date(Date.now() + inviteDays * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await client.from("church_invites").insert({
      church_id: selectedChurch.church_id,
      code_hash: codeHash,
      role: inviteRole,
      max_uses: inviteUses,
      expires_at: expiresAt,
      created_by: userId,
    });

    if (error) {
      setNotice({ tone: "error", text: "निमन्त्रणा बनाउन सकिएन। मण्डली प्रशासक अधिकार फेरि जाँच्नुहोस्।" });
    } else {
      setGeneratedCode(code);
      setNotice({ tone: "success", text: "सुरक्षित निमन्त्रणा तयार भयो। यो कोड अहिले मात्र देखाइन्छ।" });
      await refreshInvites(selectedChurch.church_id);
    }
    setBusy(false);
  }

  async function copyGeneratedCode() {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setNotice({ tone: "info", text: "निमन्त्रणा कोड प्रतिलिपि भयो।" });
  }

  async function revokeInvite(inviteId: number) {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedChurch || !canManageSelectedChurch) return;
    const revokedAt = new Date().toISOString();
    const { error } = await client.from("church_invites").update({ revoked_at: revokedAt }).eq("id", inviteId).eq("church_id", selectedChurch.church_id);
    if (error) setNotice({ tone: "error", text: "निमन्त्रणा रद्द गर्न सकिएन।" });
    else {
      setInviteList((current) => current.map((invite) => invite.id === inviteId ? { ...invite, revoked_at: revokedAt } : invite));
      setNotice({ tone: "success", text: "निमन्त्रणा रद्द भयो।" });
    }
  }

  async function createFellowship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !selectedChurch || !canManageSelectedChurch) return;
    const startsAt = new Date(fellowshipStartsAt);
    const endsAt = fellowshipEndsAt ? new Date(fellowshipEndsAt) : null;
    if (fellowshipTitle.trim().length < 2 || Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()))) {
      setNotice({ tone: "error", text: "फेलोशिपको शीर्षक, सुरु समय र आवश्यक भए सही अन्त्य समय राख्नुहोस्।" });
      return;
    }

    setBusy(true);
    setNotice(null);
    const { error } = await client.from("fellowships").insert({
      church_id: selectedChurch.church_id,
      title: fellowshipTitle.trim(),
      location_name: fellowshipLocation.trim() || null,
      address: fellowshipAddress.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      status: "scheduled",
      created_by: userId,
    });
    if (error) {
      setNotice({ tone: "error", text: "फेलोशिप तालिका बनाउन सकिएन। मण्डली प्रशासन अधिकार फेरि जाँच्नुहोस्।" });
    } else {
      setFellowshipTitle("");
      setFellowshipLocation("");
      setFellowshipAddress("");
      setFellowshipStartsAt("");
      setFellowshipEndsAt("");
      setNotice({ tone: "success", text: "नयाँ फेलोशिप तालिका मण्डलीका सदस्यका लागि तयार भयो।" });
      await refreshChurchWorkflows(selectedChurch.church_id);
      await refreshChurches(selectedChurch.church_id);
    }
    setBusy(false);
  }

  async function changeFellowshipStatus(fellowshipId: number, status: "completed" | "cancelled") {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedChurch || !canManageSelectedChurch) return;
    setBusy(true);
    const { error } = await client.from("fellowships").update({ status }).eq("id", fellowshipId).eq("church_id", selectedChurch.church_id);
    if (error) setNotice({ tone: "error", text: "फेलोशिपको अवस्था परिवर्तन गर्न सकिएन।" });
    else {
      setNotice({ tone: "success", text: status === "completed" ? "फेलोशिप पूरा भएको चिन्ह लगाइयो।" : "फेलोशिप रद्द गरिएको चिन्ह लगाइयो।" });
      await refreshChurchWorkflows(selectedChurch.church_id);
    }
    setBusy(false);
  }

  async function reviewPreparation(preparationId: number, decision: "approved" | "rejected") {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedChurch || !canManageSelectedChurch) return;
    setBusy(true);
    setNotice(null);
    const { error } = await client.from("fellowship_preparations")
      .update({ status: decision, review_note: reviewNotes[preparationId]?.trim() || null })
      .eq("id", preparationId)
      .eq("church_id", selectedChurch.church_id)
      .eq("status", "submitted");
    if (error) {
      setNotice({ tone: "error", text: "सदस्यको तयारी समीक्षा गर्न सकिएन। अर्को प्रशासकले अवस्था परिवर्तन गरेको हुन सक्छ।" });
    } else {
      setReviewNotes((current) => { const next = { ...current }; delete next[preparationId]; return next; });
      setNotice({ tone: "success", text: decision === "approved" ? "तयारी स्वीकृत भयो र यही मण्डलीको फिडमा प्रकाशित भयो।" : "तयारी सुधारका लागि सदस्यलाई फिर्ता पठाइयो।" });
      await refreshChurchWorkflows(selectedChurch.church_id);
    }
    setBusy(false);
  }

  return (
    <div className="app-screen screen-enter admin-screen">
      <header className="detail-header membership-header admin-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button>
        <div><p className="eyebrow">भूमिकाअनुसार सुरक्षित</p><strong>प्रशासन प्यानल</strong></div>
        <span className="header-spacer" />
      </header>

      <div className="app-scroll membership-content admin-content">
        {userId && hasAdminAccess && !loading && isSuperAdmin && <SuperAdminChurchProvisioner onCreated={refreshChurches} />}
        {!userId ? (
          <section className="membership-empty-card"><span aria-hidden="true">🔒</span><h1>सुरक्षित खाता चाहिन्छ</h1><p>प्रशासन प्यानल खोल्न वास्तविक Supabase खाताबाट प्रवेश गर्नुहोस्। पूर्वावलोकन खातालाई प्रशासन अधिकार हुँदैन।</p><button type="button" onClick={() => onNavigate("more")}>खाता विकल्पमा फर्कनुहोस्</button></section>
        ) : !hasAdminAccess ? (
          <section className="membership-empty-card"><span aria-hidden="true">🛡️</span><h1>प्रशासन अनुमति छैन</h1><p>यो मार्ग प्लेटफर्म सुपर एडमिन वा मण्डली प्रशासकका लागि मात्र हो। सदस्य र अगुवाका व्यक्तिगत काम छुट्टै सदस्य स्क्रिनमा रहन्छन्।</p><button type="button" onClick={() => onNavigate("membership")}>मेरो मण्डली हेर्नुहोस्</button></section>
        ) : loading ? (
          <section className="membership-empty-card" role="status"><span aria-hidden="true">⌛</span><h1>प्रशासन डेटा जाँच्दै…</h1><p>तपाईंको वास्तविक भूमिका र मण्डली सीमा Supabase बाट जाँचिँदैछ।</p></section>
        ) : churches.length === 0 ? (
          <section className="membership-empty-card"><span aria-hidden="true">⌂</span><h1>व्यवस्थापनका लागि मण्डली छैन</h1><p>{isSuperAdmin ? "प्लेटफर्ममा मण्डली दर्ता भएपछि यहाँ देखिन्छन्।" : "पहिले आफ्नो मण्डली सदस्यता सक्रिय गर्नुहोस्।"}</p></section>
        ) : selectedChurch ? (
          <>
            <section className={`admin-role-banner ${isSuperAdmin ? "platform" : "church"}`}>
              <span aria-hidden="true">{isSuperAdmin ? "◆" : "⌂"}</span>
              <div><p>{isSuperAdmin ? "प्लेटफर्म तह" : "मण्डली तह"}</p><h1>{ROLE_LABELS[selectedChurch.my_role] ?? selectedChurch.my_role}</h1><small>{isSuperAdmin ? "सबै मण्डलीको अवस्था र प्लेटफर्म निरीक्षण" : "यो मण्डलीभित्रका सदस्य, निमन्त्रणा र सेवकाइ व्यवस्थापन"}</small></div>
            </section>

            {churches.length > 1 && <label className="admin-church-picker">व्यवस्थापन गर्ने मण्डली<select value={selectedChurch.church_id} onChange={(event) => { setGeneratedCode(""); setNotice(null); setSelectedChurchId(Number(event.target.value)); }}>{churches.map((church) => <option key={church.church_id} value={church.church_id}>{church.church_name_ne || church.church_name}</option>)}</select></label>}

            <section className="admin-church-card">
              <div><span className={`admin-status ${selectedChurch.status}`}>{STATUS_LABELS[selectedChurch.status] ?? selectedChurch.status}</span><small>{isSuperAdmin ? "प्लेटफर्ममा दर्ता" : ROLE_LABELS[selectedChurch.my_role]}</small></div>
              <h2>{selectedChurch.church_name_ne || selectedChurch.church_name}</h2>
              <p>{selectedChurch.address || "ठेगाना राखिएको छैन"}</p>
              <div className="admin-stat-grid"><div><strong>{selectedChurch.member_count.toLocaleString("ne-NP")}</strong><small>सक्रिय सदस्य</small></div><div><strong>{selectedChurch.fellowship_count.toLocaleString("ne-NP")}</strong><small>फेलोशिप</small></div><div><strong>{churches.length.toLocaleString("ne-NP")}</strong><small>{isSuperAdmin ? "कुल मण्डली" : "व्यवस्थापन पहुँच"}</small></div></div>
            </section>

            {isSuperAdmin && (
              <section className="admin-section-card">
                <div className="membership-section-heading"><span>◆</span><div><p>सुपर एडमिन मात्र</p><h2>मण्डलीको प्लेटफर्म अवस्था</h2></div></div>
                <div className="admin-status-actions">
                  <button type="button" className={selectedChurch.status === "active" ? "selected" : ""} disabled={busy} onClick={() => { void changeChurchStatus("active"); }}>सक्रिय</button>
                  <button type="button" className={selectedChurch.status === "suspended" ? "selected warning" : "warning"} disabled={busy} onClick={() => { void changeChurchStatus("suspended"); }}>निलम्बन</button>
                  <button type="button" className={selectedChurch.status === "archived" ? "selected muted" : "muted"} disabled={busy} onClick={() => { void changeChurchStatus("archived"); }}>अभिलेख</button>
                </div>
                <p className="membership-form-help">हरेक अवस्था परिवर्तन डेटाबेस audit log मा सुरक्षित हुन्छ। मण्डली प्रशासकले यो नियन्त्रण प्रयोग गर्न सक्दैन।</p>
              </section>
            )}

            {canManageSelectedChurch && <section className="admin-module-grid" aria-label="मण्डली प्रशासन मोड्युलहरू">
              <button type="button" onClick={() => onNavigate("members")}><span>◎</span><strong>सदस्य</strong><small>सूची र भूमिका</small></button>
              <button type="button" onClick={() => onNavigate("preparations")}><span>✎</span><strong>सदस्य पोस्ट</strong><small>स्वीकृत फिड हेर्नुहोस्</small></button>
            </section>}

            {canManageSelectedChurch && (
              <section className="membership-form-card admin-section-card admin-schedule-section">
                <div className="membership-section-heading"><span>▣</span><div><p>मण्डली मालिक / प्रशासक</p><h2>फेलोशिप तालिका व्यवस्थापन</h2></div></div>
                <form onSubmit={createFellowship}>
                  <label htmlFor="admin-fellowship-title">फेलोशिपको नाम</label>
                  <input id="admin-fellowship-title" maxLength={120} value={fellowshipTitle} onChange={(event) => setFellowshipTitle(event.target.value)} placeholder="जस्तै: सानेपा घर संगति" />
                  <div className="admin-form-two-column"><label htmlFor="admin-fellowship-start">सुरु हुने मिति र समय<input id="admin-fellowship-start" type="datetime-local" value={fellowshipStartsAt} onChange={(event) => setFellowshipStartsAt(event.target.value)} /></label><label htmlFor="admin-fellowship-end">अन्त्य समय (ऐच्छिक)<input id="admin-fellowship-end" type="datetime-local" value={fellowshipEndsAt} onChange={(event) => setFellowshipEndsAt(event.target.value)} /></label></div>
                  <label htmlFor="admin-fellowship-location">स्थानको नाम</label>
                  <input id="admin-fellowship-location" maxLength={160} value={fellowshipLocation} onChange={(event) => setFellowshipLocation(event.target.value)} placeholder="घर, हल वा मण्डली भवन" />
                  <label htmlFor="admin-fellowship-address">ठेगाना</label>
                  <input id="admin-fellowship-address" maxLength={300} value={fellowshipAddress} onChange={(event) => setFellowshipAddress(event.target.value)} placeholder="पूरा ठेगाना" />
                  <button className="membership-primary-action" type="submit" disabled={busy}>{busy ? "सुरक्षित गर्दै…" : "फेलोशिप तालिका बनाउनुहोस्"}</button>
                </form>
                <div className="admin-fellowship-list">
                  <div><h3>हालका फेलोशिप</h3><span>{fellowships.length.toLocaleString("ne-NP")}</span></div>
                  {fellowships.length === 0 ? <p>अहिलेसम्म फेलोशिप तालिका बनाइएको छैन।</p> : fellowships.map((fellowship) => <article key={fellowship.id}><span className={`admin-status ${fellowship.status}`}>{fellowship.status === "scheduled" ? "तालिकाबद्ध" : fellowship.status === "completed" ? "पूरा" : fellowship.status === "cancelled" ? "रद्द" : "मस्यौदा"}</span><div><strong>{fellowship.title}</strong><small>{formatDateTime(fellowship.starts_at)}{fellowship.location_name ? ` · ${fellowship.location_name}` : ""}</small></div><div className="admin-row-actions"><button type="button" onClick={() => { window.history.replaceState(null, "", `#service/${fellowship.id}`); onNavigate("service"); }}>कार्यक्रम</button>{fellowship.status === "scheduled" && <><button type="button" disabled={busy} onClick={() => { void changeFellowshipStatus(fellowship.id, "completed"); }}>पूरा</button><button type="button" className="warning" disabled={busy} onClick={() => { void changeFellowshipStatus(fellowship.id, "cancelled"); }}>रद्द</button></>}</div></article>)}
                </div>
              </section>
            )}

            {canManageSelectedChurch && userId && <AdminAssignmentManager churchId={selectedChurch.church_id} userId={userId} fellowships={fellowships} />}
            {canManageSelectedChurch && userId && <AdminRecapPublisher churchId={selectedChurch.church_id} userId={userId} fellowships={fellowships} onNavigate={onNavigate} />}
            {canManageSelectedChurch && userId && <AdminAttendanceManager churchId={selectedChurch.church_id} userId={userId} fellowships={fellowships} />}

            {canManageSelectedChurch && (
              <section className="admin-section-card moderation-section">
                <div className="membership-section-heading"><span>✓</span><div><p>प्रकाशनअघि समीक्षा</p><h2>सदस्य तयारी स्वीकृति</h2></div></div>
                <p className="membership-form-help">यहाँ स्वीकृत गरिएको सामग्री मात्र यस मण्डलीका सदस्यको फिडमा प्रकाशित हुन्छ। सुपर एडमिनले यो सामग्री देख्न वा समीक्षा गर्न सक्दैन।</p>
                {pendingPreparations.length === 0 ? <div className="moderation-empty"><span aria-hidden="true">✓</span><p><strong>समीक्षा बाँकी छैन</strong><small>सदस्यले नयाँ तयारी पठाएपछि यहाँ देखिन्छ।</small></p></div> : pendingPreparations.map((preparation) => <article className="moderation-card" key={preparation.id}><div><span>{PREPARATION_TYPE_LABELS[preparation.preparation_type] ?? preparation.preparation_type}</span><small>{formatDateTime(preparation.submitted_at)}</small></div><h3>{preparation.title}</h3><p>{preparation.body}</p><footer><strong>{preparation.author_name}</strong><small>{preparation.fellowship_title}</small></footer><label htmlFor={`review-note-${preparation.id}`}>सदस्यका लागि टिप्पणी (ऐच्छिक)</label><textarea id={`review-note-${preparation.id}`} rows={2} maxLength={1000} value={reviewNotes[preparation.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [preparation.id]: event.target.value }))} placeholder="स्वीकृति वा सुधारको छोटो टिप्पणी" /><div className="moderation-actions"><button type="button" disabled={busy} onClick={() => { void reviewPreparation(preparation.id, "rejected"); }}>सुधारका लागि फर्काउनुहोस्</button><button type="button" className="approve" disabled={busy} onClick={() => { void reviewPreparation(preparation.id, "approved"); }}>स्वीकृत गरी प्रकाशित गर्नुहोस्</button></div></article>)}
              </section>
            )}

            {canManageSelectedChurch && (
              <section className="membership-form-card admin-section-card">
                <div className="membership-section-heading"><span>＋</span><div><p>मण्डली मालिक / प्रशासक</p><h2>नयाँ सदस्य निमन्त्रणा</h2></div></div>
                <form onSubmit={generateInvite}>
                  <label>दिइने भूमिका</label>
                  <div className="membership-choice-row"><button type="button" className={inviteRole === "member" ? "selected" : ""} onClick={() => setInviteRole("member")}>सदस्य</button><button type="button" className={inviteRole === "leader" ? "selected" : ""} onClick={() => setInviteRole("leader")}>अगुवा</button></div>
                  <label>म्याद</label>
                  <div className="membership-choice-row"><button type="button" className={inviteDays === 7 ? "selected" : ""} onClick={() => setInviteDays(7)}>७ दिन</button><button type="button" className={inviteDays === 30 ? "selected" : ""} onClick={() => setInviteDays(30)}>३० दिन</button></div>
                  <label>प्रयोग सीमा</label>
                  <div className="membership-choice-row"><button type="button" className={inviteUses === 1 ? "selected" : ""} onClick={() => setInviteUses(1)}>१ जना</button><button type="button" className={inviteUses === 10 ? "selected" : ""} onClick={() => setInviteUses(10)}>१० जना</button></div>
                  <button className="membership-primary-action" type="submit" disabled={busy}>{busy ? "तयार हुँदैछ…" : "सुरक्षित कोड बनाउनुहोस्"}</button>
                </form>
                {generatedCode && <div className="generated-invite" role="status"><small>यो कोड अहिले मात्र देखाइन्छ</small><strong>{generatedCode}</strong><button type="button" onClick={() => { void copyGeneratedCode(); }}>कोड प्रतिलिपि गर्नुहोस्</button></div>}
              </section>
            )}

            {canManageSelectedChurch && inviteList.length > 0 && <section className="membership-invite-list"><div><h2>हालका निमन्त्रणा</h2><span>{activeInviteCount.toLocaleString("ne-NP")} सक्रिय</span></div>{inviteList.map((invite) => { const inactive = Boolean(invite.revoked_at) || new Date(invite.expires_at) <= new Date() || invite.use_count >= invite.max_uses; return <article key={invite.id}><span className={inactive ? "inactive" : ""}>{inactive ? "बन्द" : invite.role === "leader" ? "अगुवा" : "सदस्य"}</span><p><strong>{invite.use_count.toLocaleString("ne-NP")} / {invite.max_uses.toLocaleString("ne-NP")} प्रयोग</strong><small>{formatDate(invite.expires_at)} सम्म</small></p>{!inactive && <button type="button" onClick={() => { void revokeInvite(invite.id); }}>रद्द</button>}</article>; })}</section>}

            {isSuperAdmin ? <section className="admin-scope-note"><span aria-hidden="true">◆</span><div><strong>प्लेटफर्म सीमा लागू छ</strong><p>सुपर एडमिनले मण्डलीको नाम, अवस्था र कुल संख्या मात्र हेर्छ। सदस्यको परिचय, फेलोशिप तालिका वा तयारी सामग्रीमा पहुँच हुँदैन।</p></div></section> : <section className="admin-scope-note"><span aria-hidden="true">◎</span><div><strong>मण्डली सीमा लागू छ</strong><p>तालिका, समीक्षा सूची र प्रकाशित सामग्री यही मण्डलीभित्र मात्र रहन्छन्। सदस्य पोस्ट स्वीकृत नहुँदासम्म मण्डली फिडमा देखिँदैन।</p></div></section>}
          </>
        ) : null}

        {notice && <p className={`membership-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
      </div>
    </div>
  );
}
