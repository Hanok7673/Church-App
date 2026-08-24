"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type FellowshipOption = {
  id: number;
  title: string;
  starts_at: string;
  status: string;
};

type ChurchMemberOption = {
  membership_id: number;
  user_id: string;
  full_name: string;
  role: string;
};

type MinistryRoleOption = {
  id: number;
  code: string;
  name_ne: string;
  sort_order: number;
};

type FellowshipAssignment = {
  assignment_id: number;
  member_membership_id: number;
  member_name: string;
  ministry_role_id: number;
  ministry_role_code: string;
  ministry_role_name_ne: string;
  notes: string | null;
  assignment_status: string;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type AssignmentNotice = { tone: "success" | "error" | "info"; text: string } | null;

const STATUS_LABELS: Record<string, string> = {
  assigned: "जवाफ बाँकी",
  accepted: "स्वीकार गरिएको",
  declined: "अस्वीकार गरिएको",
  completed: "सम्पन्न",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function AdminAssignmentManager({ churchId, userId, fellowships }: {
  churchId: number;
  userId: string;
  fellowships: FellowshipOption[];
}) {
  const assignableFellowships = useMemo(() => fellowships.filter((fellowship) => fellowship.status !== "cancelled"), [fellowships]);
  const [fellowshipId, setFellowshipId] = useState<number | null>(assignableFellowships[0]?.id ?? null);
  const selectedFellowship = assignableFellowships.find((fellowship) => fellowship.id === fellowshipId) ?? assignableFellowships[0] ?? null;
  const [members, setMembers] = useState<ChurchMemberOption[]>([]);
  const [roles, setRoles] = useState<MinistryRoleOption[]>([]);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [roster, setRoster] = useState<FellowshipAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<AssignmentNotice>(null);

  async function refreshRoster(targetFellowshipId: number) {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data, error } = await client.rpc("list_fellowship_assignments", { p_fellowship_id: targetFellowshipId });
    if (error) {
      setRoster([]);
      setNotice({ tone: "error", text: "यो फेलोशिपको जिम्मेवारी सूची लोड गर्न सकिएन।" });
    } else {
      setRoster((data ?? []) as FellowshipAssignment[]);
    }
  }

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void Promise.all([
        client.rpc("list_church_members", { p_church_id: churchId, p_search_text: "", p_page_size: 100, p_page_offset: 0 }),
        client.from("ministry_roles").select("id, code, name_ne, sort_order").eq("is_active", true).order("sort_order"),
      ]).then(([membersResult, rolesResult]) => {
        const nextMembers = (membersResult.data ?? []) as ChurchMemberOption[];
        const nextRoles = (rolesResult.data ?? []) as MinistryRoleOption[];
        setMembers(nextMembers);
        setRoles(nextRoles);
        setMemberId((current) => nextMembers.some((member) => member.membership_id === current) ? current : nextMembers[0]?.membership_id ?? null);
        setRoleId((current) => nextRoles.some((role) => role.id === current) ? current : nextRoles[0]?.id ?? null);
        if (membersResult.error || rolesResult.error) setNotice({ tone: "error", text: "सदस्य वा सेवकाइ भूमिका लोड गर्न सकिएन।" });
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [churchId]);

  useEffect(() => {
    if (!selectedFellowship) {
      const timer = window.setTimeout(() => { setRoster([]); setLoading(false); }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => { void refreshRoster(selectedFellowship.id); }, 0);
    return () => window.clearTimeout(timer);
    // The selected fellowship is the authorization boundary for this roster.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId, fellowshipId, selectedFellowship?.id]);

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !selectedFellowship || !memberId || !roleId) return;
    setBusy(true);
    setNotice(null);
    const { error } = await client.from("assignments").insert({
      fellowship_id: selectedFellowship.id,
      member_membership_id: memberId,
      ministry_role_id: roleId,
      notes: notes.trim() || null,
      assigned_by: userId,
    });
    if (error) {
      const roleOccupied = error.code === "23505";
      setNotice({ tone: "error", text: roleOccupied ? "यो फेलोशिपमा उक्त भूमिका पहिले नै तोकिएको छ। पहिले पुरानो जिम्मेवारी हटाउनुहोस्।" : "जिम्मेवारी तोक्न सकिएन। सदस्य र फेलोशिप एउटै मण्डलीमा छन् कि जाँच्नुहोस्।" });
    } else {
      setNotes("");
      setNotice({ tone: "success", text: "जिम्मेवारी सदस्यलाई पठाइयो। सदस्यले आफ्नो भूमिका स्क्रिनबाट स्वीकार वा अस्वीकार गर्न सक्छन्।" });
      await refreshRoster(selectedFellowship.id);
    }
    setBusy(false);
  }

  async function removeAssignment(assignmentId: number) {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedFellowship) return;
    setBusy(true);
    const { error } = await client.from("assignments").delete().eq("id", assignmentId).eq("fellowship_id", selectedFellowship.id);
    if (error) setNotice({ tone: "error", text: "जिम्मेवारी हटाउन सकिएन।" });
    else {
      setNotice({ tone: "success", text: "जिम्मेवारी हटाइयो र audit इतिहास सुरक्षित राखियो।" });
      await refreshRoster(selectedFellowship.id);
    }
    setBusy(false);
  }

  async function completeAssignment(assignmentId: number) {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedFellowship) return;
    setBusy(true);
    const { data, error } = await client.from("assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId)
      .eq("fellowship_id", selectedFellowship.id)
      .eq("status", "accepted")
      .select("id")
      .maybeSingle();
    if (error || !data) setNotice({ tone: "error", text: "स्वीकार गरिएको जिम्मेवारी मात्र सम्पन्न गर्न सकिन्छ।" });
    else {
      setNotice({ tone: "success", text: "जिम्मेवारी सम्पन्न भएको चिन्ह लगाइयो।" });
      await refreshRoster(selectedFellowship.id);
    }
    setBusy(false);
  }

  return (
    <section className="membership-form-card admin-section-card admin-assignment-section">
      <div className="membership-section-heading"><span>✓</span><div><p>मण्डली मालिक / प्रशासक</p><h2>सेवकाइ जिम्मेवारी तोक्नुहोस्</h2></div></div>
      {assignableFellowships.length === 0 ? (
        <div className="moderation-empty"><span aria-hidden="true">▣</span><p><strong>पहिले फेलोशिप बनाउनुहोस्</strong><small>जिम्मेवारी सधैँ एउटा वास्तविक फेलोशिपसँग जोडिन्छ।</small></p></div>
      ) : loading ? (
        <div className="moderation-empty" role="status"><span aria-hidden="true">⌛</span><p><strong>सदस्य र भूमिका लोड हुँदैछ…</strong></p></div>
      ) : members.length === 0 ? (
        <div className="moderation-empty"><span aria-hidden="true">◎</span><p><strong>सक्रिय सदस्य छैन</strong><small>पहिले निमन्त्रणा कोडबाट सदस्य जोड्नुहोस्।</small></p></div>
      ) : (
        <>
          <form onSubmit={createAssignment}>
            <label htmlFor="assignment-fellowship">फेलोशिप</label>
            <select id="assignment-fellowship" value={selectedFellowship?.id ?? ""} onChange={(event) => { setNotice(null); setFellowshipId(Number(event.target.value)); }}>{assignableFellowships.map((fellowship) => <option key={fellowship.id} value={fellowship.id}>{fellowship.title} · {formatDate(fellowship.starts_at)}</option>)}</select>
            <div className="admin-form-two-column"><label htmlFor="assignment-member">सदस्य<select id="assignment-member" value={memberId ?? ""} onChange={(event) => setMemberId(Number(event.target.value))}>{members.map((member) => <option key={member.membership_id} value={member.membership_id}>{member.full_name} · {member.role}</option>)}</select></label><label htmlFor="assignment-role">सेवकाइ भूमिका<select id="assignment-role" value={roleId ?? ""} onChange={(event) => setRoleId(Number(event.target.value))}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name_ne}</option>)}</select></label></div>
            <label htmlFor="assignment-notes">तयारी निर्देशन (ऐच्छिक)</label>
            <textarea id="assignment-notes" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="जस्तै: १५ मिनेटअघि आउनुहोस्, चयन गरिएको वचन तयार गर्नुहोस्…" />
            <button className="membership-primary-action" type="submit" disabled={busy || roles.length === 0}>{busy ? "तोक्दै…" : "सदस्यलाई जिम्मेवारी पठाउनुहोस्"}</button>
          </form>

          <div className="admin-assignment-roster">
            <div><h3>{selectedFellowship?.title}</h3><span>{roster.length.toLocaleString("ne-NP")} जिम्मेवारी</span></div>
            {roster.length === 0 ? <p>यस फेलोशिपमा जिम्मेवारी तोकिएको छैन।</p> : roster.map((assignment) => <article key={assignment.assignment_id}><span className={`assignment-admin-status ${assignment.assignment_status}`}>{STATUS_LABELS[assignment.assignment_status] ?? assignment.assignment_status}</span><div><strong>{assignment.ministry_role_name_ne}</strong><small>{assignment.member_name}{assignment.notes ? ` · ${assignment.notes}` : ""}</small></div><div className="admin-row-actions">{assignment.assignment_status === "accepted" && <button type="button" disabled={busy} onClick={() => { void completeAssignment(assignment.assignment_id); }}>सम्पन्न</button>}<button type="button" className="warning" disabled={busy} onClick={() => { void removeAssignment(assignment.assignment_id); }}>हटाउनुहोस्</button></div></article>)}
          </div>
        </>
      )}
      {notice && <p className={`membership-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
    </section>
  );
}
