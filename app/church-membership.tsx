"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { DashboardScreen } from "./dashboard";

export type AccountMembership = {
  id: number;
  churchId: number;
  churchName: string;
  churchNameNe: string | null;
  address: string | null;
  role: "owner" | "admin" | "leader" | "member";
  status: string;
  joinedAt: string;
};

type MembershipNotice = { tone: "success" | "error" | "info"; text: string } | null;

const ROLE_LABELS: Record<AccountMembership["role"], string> = {
  owner: "मुख्य मण्डली प्रशासक",
  admin: "मण्डली प्रशासक",
  leader: "अगुवा",
  member: "सदस्य",
};

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/^CH-?/, "").replace(/[^A-F0-9]/g, "");
}

async function sha256(value: string) {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function ChurchMembership({ userId, memberships, loading, onRefresh, onNavigate }: {
  userId: string | null;
  memberships: AccountMembership[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState<MembershipNotice>(null);
  const [busy, setBusy] = useState(false);
  const primaryMembership = memberships[0] ?? null;
  const canOpenAdmin = primaryMembership?.role === "owner" || primaryMembership?.role === "admin";

  async function joinChurch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    const compactCode = normalizeInviteCode(inviteCode);
    if (!client || !userId) return;
    if (!/^[A-F0-9]{32}$/.test(compactCode)) {
      setNotice({ tone: "error", text: "निमन्त्रणा कोड सही छैन। CH- पछि ३२ अक्षर भएको कोड फेरि जाँच्नुहोस्।" });
      return;
    }

    setBusy(true);
    setNotice(null);
    const codeHash = await sha256(compactCode);
    const { error } = await client.from("membership_join_requests").insert({ user_id: userId, submitted_code_hash: codeHash });
    if (error) {
      const alreadyMember = error.message.toLowerCase().includes("already have an active membership");
      setNotice({ tone: "error", text: alreadyMember ? "यो मण्डलीमा तपाईंको सदस्यता पहिल्यै सक्रिय छ।" : "कोड अमान्य, म्याद सकिएको वा प्रयोग भइसकेको हुन सक्छ।" });
    } else {
      setInviteCode("");
      setNotice({ tone: "success", text: "मण्डली सदस्यता सुरक्षित रूपमा जोडियो।" });
      await onRefresh();
    }
    setBusy(false);
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header membership-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button>
        <div><p className="eyebrow">सुरक्षित सदस्यता</p><strong>मेरो मण्डली</strong></div>
        <span className="header-spacer" />
      </header>

      <div className="app-scroll membership-content">
        {!userId ? (
          <section className="membership-empty-card"><span aria-hidden="true">🔒</span><h1>सुरक्षित खाता चाहिन्छ</h1><p>मण्डली सदस्यता जोड्न पहिले इमेल र पासवर्डबाट प्रवेश गर्नुहोस्। पूर्वावलोकन पहिचानले सदस्यता बनाउन सक्दैन।</p><button type="button" onClick={() => onNavigate("more")}>खाता विकल्पमा फर्कनुहोस्</button></section>
        ) : loading ? (
          <section className="membership-empty-card" role="status"><span aria-hidden="true">⌛</span><h1>सदस्यता जाँच्दै…</h1><p>तपाईंलाई जोडिएको मण्डली र भूमिका सुरक्षित रूपमा खोजिँदैछ।</p></section>
        ) : (
          <>
            {memberships.length > 0 ? (
              <>
                <section className="membership-hero">
                  <span className="membership-verified">✓ सक्रिय सदस्यता</span>
                  <h1>{primaryMembership?.churchNameNe || primaryMembership?.churchName}</h1>
                  <p>{primaryMembership?.address || "ठेगाना पछि थप्न सकिन्छ"}</p>
                  <div><strong>{primaryMembership ? ROLE_LABELS[primaryMembership.role] : "सदस्य"}</strong><small>{primaryMembership ? `${formatDate(primaryMembership.joinedAt)} देखि` : ""}</small></div>
                </section>

                {memberships.length > 1 && <section className="membership-list"><h2>अन्य सदस्यता</h2>{memberships.slice(1).map((membership) => <div key={membership.id}><span>⌂</span><p><strong>{membership.churchNameNe || membership.churchName}</strong><small>{ROLE_LABELS[membership.role]}</small></p></div>)}</section>}

                <section className="membership-permission-card">
                  <span aria-hidden="true">🛡️</span><div><p>तपाईंको पहुँच</p><h2>{canOpenAdmin ? "छुट्टै प्रशासन प्यानल उपलब्ध" : primaryMembership?.role === "leader" ? "अगुवा सामग्री र सदस्य अनुभव" : "सदस्य सामग्री र व्यक्तिगत जिम्मेवारी"}</h2><small>अधिकार account metadata बाट होइन, Supabase membership row बाट आउँछ।</small></div>
                </section>

                {canOpenAdmin && <button className="admin-route-link" type="button" onClick={() => onNavigate("admin")}><span aria-hidden="true">⚙</span><span><small>मालिक / प्रशासक मात्र</small><strong>प्रशासन प्यानल खोल्नुहोस्</strong><em>सदस्य निमन्त्रणा, मण्डली र आगामी व्यवस्थापन</em></span><b aria-hidden="true">›</b></button>}

                <section className="membership-form-card compact-join-card">
                  <div className="membership-section-heading"><span>⌁</span><div><p>अर्को मण्डली</p><h2>अर्को निमन्त्रणा प्रयोग गर्नुहोस्</h2></div></div>
                  <JoinCodeForm inviteCode={inviteCode} setInviteCode={setInviteCode} busy={busy} onSubmit={joinChurch} />
                </section>
              </>
            ) : (
              <>
                <section className="membership-empty-card"><span aria-hidden="true">⌂</span><h1>अहिलेसम्म मण्डली जोडिएको छैन</h1><p>सामान्य खाता खोल्दा कुनै प्रशासन भूमिका पाइँदैन। आफ्नो मण्डली प्रशासकबाट सुरक्षित सदस्य निमन्त्रणा कोड माग्नुहोस्।</p></section>
                <section className="membership-form-card"><div className="membership-section-heading"><span>⌁</span><div><p>सदस्य पहुँच</p><h2>सुरक्षित कोड लेख्नुहोस्</h2></div></div><JoinCodeForm inviteCode={inviteCode} setInviteCode={setInviteCode} busy={busy} onSubmit={joinChurch} /><p className="membership-form-help role-boundary-help">नयाँ मण्डली प्लेटफर्म सुपर एडमिनले मात्र दर्ता गर्छ र छुट्टै मण्डली प्रशासक खाता तोक्छ।</p></section>
              </>
            )}
            {notice && <p className={`membership-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
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

function JoinCodeForm({ inviteCode, setInviteCode, busy, onSubmit }: {
  inviteCode: string;
  setInviteCode: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <form onSubmit={onSubmit}><label htmlFor="membership-invite-code">निमन्त्रणा कोड</label><input id="membership-invite-code" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="CH-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" spellCheck={false} /><button className="membership-primary-action" type="submit" disabled={busy}>{busy ? "जाँच्दैछ…" : "मण्डलीमा जोडिनुहोस्"}</button><p className="membership-form-help">कोडको hash मात्र Supabase मा पठाइन्छ। म्याद सकिएको वा प्रयोग भइसकेको कोड स्वीकार हुँदैन।</p></form>;
}
