"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";

type FellowshipOption = {
  id: number;
  title: string;
  starts_at: string;
  status: string;
};

type MyPreparation = {
  id: number;
  fellowship_id: number;
  fellowship_title: string;
  preparation_type: string;
  title: string;
  body: string;
  status: string;
  review_note: string | null;
  submitted_at: string | null;
  published_at: string | null;
  updated_at: string;
};

type FeedPreparation = {
  id: number;
  fellowship_id: number;
  fellowship_title: string;
  preparation_type: string;
  title: string;
  body: string;
  author_name: string;
  published_at: string;
};

type PreparationNotice = { tone: "success" | "error" | "info"; text: string } | null;

const TYPE_LABELS: Record<string, string> = {
  program_note: "कार्यक्रम तयारी",
  testimony: "गवाही",
  prayer: "प्रार्थना",
  song: "आराधना तयारी",
  scripture: "वचन तयारी",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "मस्यौदा",
  submitted: "स्वीकृतिका लागि पठाइएको",
  approved: "स्वीकृत र प्रकाशित",
  rejected: "सुधार मागिएको",
  archived: "अभिलेख",
};

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ne-NP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MemberPreparations({ userId, memberships, onNavigate }: {
  userId: string | null;
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  const activeMemberships = useMemo(() => memberships.filter((membership) => membership.status === "active"), [memberships]);
  const [membershipId, setMembershipId] = useState<number | null>(activeMemberships[0]?.id ?? null);
  const [fellowships, setFellowships] = useState<FellowshipOption[]>([]);
  const [fellowshipId, setFellowshipId] = useState<number | null>(null);
  const [preparationType, setPreparationType] = useState("program_note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mine, setMine] = useState<MyPreparation[]>([]);
  const [feed, setFeed] = useState<FeedPreparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<PreparationNotice>(null);

  const selectedMembership = activeMemberships.find((membership) => membership.id === membershipId) ?? activeMemberships[0] ?? null;

  async function refresh(member: AccountMembership) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true);
    const [fellowshipsResult, mineResult, feedResult] = await Promise.all([
      client.rpc("list_preparation_posting_fellowships", { p_membership_id: member.id }),
      client.rpc("list_my_preparations", { p_membership_id: member.id, p_limit: 50 }),
      client.rpc("list_preparation_feed", { p_church_id: member.churchId, p_limit: 50 }),
    ]);

    if (fellowshipsResult.error || mineResult.error || feedResult.error) {
      setNotice({ tone: "error", text: "तयारी, जिम्मेवारी र फेलोशिप विवरण लोड गर्न सकिएन। केही समयपछि फेरि प्रयास गर्नुहोस्।" });
    }

    const nextFellowships = (fellowshipsResult.data ?? []) as FellowshipOption[];
    setFellowships(nextFellowships);
    setFellowshipId((current) => nextFellowships.some((item) => item.id === current) ? current : nextFellowships[0]?.id ?? null);
    setMine((mineResult.data ?? []) as MyPreparation[]);
    setFeed((feedResult.data ?? []) as FeedPreparation[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!userId || !selectedMembership) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => { void refresh(selectedMembership); }, 0);
    return () => window.clearTimeout(timer);
    // The selected membership is the tenant boundary for all three queries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipId, selectedMembership?.id, userId]);

  async function submitPreparation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !selectedMembership || !fellowshipId) return;
    if (title.trim().length < 2 || body.trim().length < 2) {
      setNotice({ tone: "error", text: "शीर्षक र तयारीको विवरण पूरा लेख्नुहोस्।" });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    const { error } = await client.from("fellowship_preparations").insert({
      church_id: selectedMembership.churchId,
      fellowship_id: fellowshipId,
      membership_id: selectedMembership.id,
      preparation_type: preparationType,
      title: title.trim(),
      body: body.trim(),
      status: "submitted",
    });

    if (error) {
      const lacksResponsibility = error.message.toLowerCase().includes("requires a church leadership role");
      setNotice({ tone: "error", text: lacksResponsibility ? "यो फेलोशिपमा पोस्ट गर्न सक्रिय जिम्मेवारी वा नेतृत्व भूमिका चाहिन्छ।" : "तयारी पठाउन सकिएन। सदस्यता र फेलोशिप फेरि जाँच्नुहोस्।" });
    } else {
      setTitle("");
      setBody("");
      setNotice({ tone: "success", text: "तयारी प्रशासकको स्वीकृतिका लागि पठाइयो। स्वीकृत नहुँदासम्म मण्डलीको फिडमा देखिँदैन।" });
      await refresh(selectedMembership);
    }
    setSubmitting(false);
  }

  return (
    <div className="app-screen screen-enter preparations-screen">
      <header className="detail-header preparations-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button>
        <div><p className="eyebrow">मण्डलीभित्र सुरक्षित</p><strong>मेरो तयारी</strong></div>
        <span className="header-spacer" />
      </header>

      <div className="app-scroll preparations-content">
        {!userId ? (
          <section className="membership-empty-card"><span aria-hidden="true">🔒</span><h1>सुरक्षित खाता चाहिन्छ</h1><p>तयारी पठाउन र स्वीकृत मण्डली सामग्री हेर्न वास्तविक इमेल खाताबाट प्रवेश गर्नुहोस्। स्थानीय पूर्वावलोकनले सुरक्षित डेटा खोल्दैन।</p><button type="button" onClick={() => onNavigate("more")}>खाता विकल्पमा फर्कनुहोस्</button></section>
        ) : !selectedMembership ? (
          <section className="membership-empty-card"><span aria-hidden="true">⌂</span><h1>पहिले मण्डली जोड्नुहोस्</h1><p>तयारी सधैँ एउटा सक्रिय मण्डली सदस्यता र त्यही मण्डलीको फेलोशिपसँग जोडिन्छ।</p><button type="button" onClick={() => onNavigate("membership")}>मेरो मण्डली खोल्नुहोस्</button></section>
        ) : (
          <>
            {activeMemberships.length > 1 && <label className="preparation-church-picker">मण्डली<select value={selectedMembership.id} onChange={(event) => { setNotice(null); setMembershipId(Number(event.target.value)); }}>{activeMemberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.churchNameNe || membership.churchName}</option>)}</select></label>}

            <section className="preparation-intro-card">
              <span aria-hidden="true">✎</span>
              <div><p>{selectedMembership.churchNameNe || selectedMembership.churchName}</p><h1>जिम्मेवारी भएको फेलोशिपका लागि तयारी पठाउनुहोस्</h1><small>अगुवा र अधिकृत पोस्ट-होल्डरले सधैँ पोस्ट गर्न सक्छन्। सामान्य सदस्यलाई तोकिएको जिम्मेवारी भएको फेलोशिप मात्र देखिन्छ।</small></div>
            </section>

            {loading ? (
              <section className="membership-empty-card" role="status"><span aria-hidden="true">⌛</span><h1>तयारी लोड हुँदैछ…</h1></section>
            ) : fellowships.length === 0 ? (
              <section className="membership-empty-card preparation-posting-locked"><span aria-hidden="true">🛡️</span><h1>पोस्ट गर्ने विकल्प अहिले उपलब्ध छैन</h1><p>सामान्य सदस्यलाई सक्रिय जिम्मेवारी तोकिएपछि त्यस फेलोशिपको पोस्टिङ सूची यहाँ देखिन्छ। अगुवा, मण्डली प्रशासक र अधिकृत फेलोशिप पोस्ट-होल्डरलाई यो विकल्प सधैँ उपलब्ध हुन्छ।</p></section>
            ) : (
              <section className="preparation-form-card">
                <div className="membership-section-heading"><span>＋</span><div><p>नयाँ सदस्य पोस्ट</p><h2>स्वीकृतिका लागि तयारी पठाउनुहोस्</h2></div></div>
                <form onSubmit={submitPreparation}>
                  <label htmlFor="preparation-fellowship">फेलोशिप</label>
                  <select id="preparation-fellowship" value={fellowshipId ?? ""} onChange={(event) => setFellowshipId(Number(event.target.value))}>{fellowships.map((fellowship) => <option key={fellowship.id} value={fellowship.id}>{fellowship.title} · {formatDate(fellowship.starts_at)}</option>)}</select>
                  <label htmlFor="preparation-type">तयारीको प्रकार</label>
                  <select id="preparation-type" value={preparationType} onChange={(event) => setPreparationType(event.target.value)}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <label htmlFor="preparation-title">शीर्षक</label>
                  <input id="preparation-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="जस्तै: आराधनाका गीत र मुख्य विचार" />
                  <label htmlFor="preparation-body">तयारी विवरण</label>
                  <textarea id="preparation-body" maxLength={5000} rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder="तपाईंले तयार गरेको गवाही, प्रार्थना, वचन वा कार्यक्रम सामग्री…" />
                  <button className="membership-primary-action" type="submit" disabled={submitting}>{submitting ? "पठाउँदै…" : "प्रशासकको स्वीकृतिका लागि पठाउनुहोस्"}</button>
                </form>
              </section>
            )}

            {notice && <p className={`membership-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}

            <section className="preparation-list-section">
              <div className="preparation-section-heading"><div><p>मेरो इतिहास</p><h2>पठाएका तयारी</h2></div><span>{mine.length.toLocaleString("ne-NP")}</span></div>
              {mine.length === 0 ? <p className="preparation-empty-copy">तपाईंले अहिलेसम्म कुनै तयारी पठाउनुभएको छैन।</p> : mine.map((item) => <article className="my-preparation-card" key={item.id}><div><span>{TYPE_LABELS[item.preparation_type] ?? item.preparation_type}</span><em className={`preparation-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</em></div><h3>{item.title}</h3><p>{item.body}</p><small>{item.fellowship_title} · {formatDate(item.updated_at)}</small>{item.review_note && <blockquote><strong>प्रशासकको टिप्पणी</strong>{item.review_note}</blockquote>}</article>)}
            </section>

            <section className="preparation-list-section approved-feed-section">
              <div className="preparation-section-heading"><div><p>मण्डली फिड</p><h2>स्वीकृत तयारी</h2></div><span>{feed.length.toLocaleString("ne-NP")}</span></div>
              {feed.length === 0 ? <p className="preparation-empty-copy">स्वीकृत सामग्री प्रकाशित भएपछि यहाँ देखिन्छ।</p> : feed.map((item) => <article className="approved-preparation-card" key={item.id}><span>{TYPE_LABELS[item.preparation_type] ?? item.preparation_type}</span><h3>{item.title}</h3><p>{item.body}</p><footer><strong>{item.author_name}</strong><small>{item.fellowship_title} · {formatDate(item.published_at)}</small></footer></article>)}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
