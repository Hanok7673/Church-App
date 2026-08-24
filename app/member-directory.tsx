"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";

type DirectoryMember = {
  membership_id: number;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "leader" | "member";
  joined_at: string;
};

const ROLE_LABELS: Record<DirectoryMember["role"], string> = {
  owner: "मुख्य प्रशासक",
  admin: "मण्डली प्रशासक",
  leader: "अगुवा",
  member: "सदस्य",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "स";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function MemberDirectory({ userId, memberships, currentName, onNavigate }: {
  userId: string | null;
  memberships: AccountMembership[];
  currentName: string;
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const [selectedChurchId, setSelectedChurchId] = useState<number | null>(memberships[0]?.churchId ?? null);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const effectiveChurchId = memberships.some((membership) => membership.churchId === selectedChurchId) ? selectedChurchId : memberships[0]?.churchId ?? null;
  const selectedMembership = memberships.find((membership) => membership.churchId === effectiveChurchId) ?? null;
  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? members.filter((member) => member.full_name.toLocaleLowerCase().includes(normalized) || ROLE_LABELS[member.role].includes(query.trim())) : members;
  }, [members, query]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client || !userId || !effectiveChurchId) {
      const timer = window.setTimeout(() => {
        if (!active) return;
        setMembers([]);
        setLoading(false);
      }, 0);
      return () => { active = false; window.clearTimeout(timer); };
    }

    const loadingTimer = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setError("");
    }, 0);
    void client.rpc("list_church_members", {
      p_church_id: effectiveChurchId,
      p_search_text: "",
      p_page_size: 200,
      p_page_offset: 0,
    }).then(({ data, error: requestError }) => {
      if (!active) return;
      setMembers((data ?? []) as DirectoryMember[]);
      setError(requestError ? "सदस्य सूची लोड गर्न सकिएन। आफ्नो मण्डली सदस्यता फेरि जाँच्नुहोस्।" : "");
      setLoading(false);
    });
    return () => { active = false; window.clearTimeout(loadingTimer); };
  }, [effectiveChurchId, userId]);

  return (
    <div className="app-screen screen-enter members-screen">
      <header className="detail-header membership-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button>
        <div><p className="eyebrow">मण्डलीभित्र मात्र</p><strong>विश्वासी सदस्य</strong></div>
        <span className="header-spacer" />
      </header>

      <div className="app-scroll member-directory-content">
        {!userId ? (
          <section className="membership-empty-card"><span aria-hidden="true">🔒</span><h1>सुरक्षित खाता चाहिन्छ</h1><p>वास्तविक सदस्य सूची हेर्न Supabase खाताबाट प्रवेश गर्नुहोस्। स्थानीय पूर्वावलोकनले सदस्य डेटा खोल्दैन।</p></section>
        ) : memberships.length === 0 ? (
          <section className="membership-empty-card"><span aria-hidden="true">⌂</span><h1>पहिले मण्डलीमा जोडिनुहोस्</h1><p>{currentName ? `${currentName}, ` : ""}मण्डली छानेर पठाएको अनुरोध प्रशासकले स्वीकृत गरेपछि सदस्य सूची देखिन्छ।</p><button type="button" onClick={() => onNavigate("membership")}>मण्डली सदस्यता खोल्नुहोस्</button></section>
        ) : (
          <>
            <section className="directory-summary-card"><span aria-hidden="true">◎</span><div><p>सक्रिय सदस्य सूची</p><h1>{selectedMembership?.churchNameNe || selectedMembership?.churchName}</h1><small>फोन, जन्ममिति, लिङ्ग र ठेगाना यहाँ कहिल्यै देखाइँदैन।</small></div><strong>{members.length.toLocaleString("ne-NP")}</strong></section>

            {memberships.length > 1 && <label className="directory-church-picker">मण्डली<select value={selectedMembership?.churchId ?? ""} onChange={(event) => setSelectedChurchId(Number(event.target.value))}>{memberships.map((membership) => <option key={membership.id} value={membership.churchId}>{membership.churchNameNe || membership.churchName}</option>)}</select></label>}

            <label className="directory-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="नाम वा भूमिका खोज्नुहोस्…" aria-label="सदस्य खोज्नुहोस्" /></label>

            {loading ? <section className="membership-empty-card" role="status"><span aria-hidden="true">⌛</span><h1>सदस्य लोड हुँदैछन्…</h1></section> : error ? <p className="membership-notice error" role="alert">{error}</p> : visibleMembers.length === 0 ? <section className="membership-empty-card"><span aria-hidden="true">◎</span><h1>सदस्य भेटिएन</h1><p>खोजी शब्द परिवर्तन गरेर फेरि हेर्नुहोस्।</p></section> : <section className="real-member-list" aria-label="सक्रिय सदस्यहरू">{visibleMembers.map((member) => <article key={member.membership_id}><div className={`member-avatar role-${member.role}`}>{member.avatar_url ? <img src={member.avatar_url} alt="" /> : initials(member.full_name)}</div><p><strong>{member.full_name}</strong><small>{ROLE_LABELS[member.role]} · {formatDate(member.joined_at)} देखि</small></p>{member.user_id === userId && <span className="current-member-pill">तपाईं</span>}</article>)}</section>}
          </>
        )}
      </div>

      <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन">
        <button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button>
        <button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button>
        <button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button>
        <button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button>
        <button type="button" className="active" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button>
      </nav>
    </div>
  );
}
