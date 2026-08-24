"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { Database } from "../types/supabase";

type AttendanceRow = Database["public"]["Functions"]["list_fellowship_attendance"]["Returns"][number];
type AttendanceStatus = "attended" | "missed" | "excused" | "unknown";
type AdminFellowship = { id: number; title: string; starts_at: string; status: string };
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  attended: "उपस्थित",
  missed: "अनुपस्थित",
  excused: "कारणसहित",
  unknown: "नतोकिएको",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "मालिक",
  admin: "प्रशासक",
  leader: "अगुवा",
  member: "सदस्य",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function AdminAttendanceManager({ churchId, userId, fellowships }: {
  churchId: number;
  userId: string;
  fellowships: AdminFellowship[];
}) {
  const usableFellowships = useMemo(() => fellowships.filter((fellowship) => fellowship.status !== "cancelled"), [fellowships]);
  const [fellowshipId, setFellowshipId] = useState<number | null>(() => usableFellowships[0]?.id ?? null);
  const selectedFellowship = usableFellowships.find((fellowship) => fellowship.id === fellowshipId) ?? usableFellowships[0] ?? null;
  const [roster, setRoster] = useState<AttendanceRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const filteredRoster = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("ne");
    if (!search) return roster;
    return roster.filter((row) => `${row.member_name} ${ROLE_LABELS[row.membership_role] ?? row.membership_role}`.toLocaleLowerCase("ne").includes(search));
  }, [query, roster]);

  const totals = useMemo(() => ({
    attended: roster.filter((row) => row.attendance_status === "attended").length,
    missed: roster.filter((row) => row.attendance_status === "missed").length,
    excused: roster.filter((row) => row.attendance_status === "excused").length,
    unknown: roster.filter((row) => row.attendance_status === "unknown").length,
  }), [roster]);

  const refreshRoster = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedFellowship) {
      setRoster([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await client.rpc("list_fellowship_attendance", { p_fellowship_id: selectedFellowship.id });
    if (error) {
      setRoster([]);
      setNotice({ tone: "error", text: "उपस्थिति सूची लोड गर्न सकिएन। प्रशासन अधिकार फेरि जाँच्नुहोस्।" });
    } else {
      const rows = (data ?? []) as AttendanceRow[];
      setRoster(rows);
      setNotes(Object.fromEntries(rows.map((row) => [row.user_id, row.attendance_notes ?? ""])));
    }
    setLoading(false);
  }, [selectedFellowship]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshRoster(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshRoster]);

  async function markAttendance(row: AttendanceRow, status: AttendanceStatus) {
    const client = getSupabaseBrowserClient();
    if (!client || !selectedFellowship) return;
    setBusyUserId(row.user_id);
    setNotice(null);

    if (status === "unknown") {
      if (!row.attendance_id) {
        setBusyUserId(null);
        return;
      }
      const { error } = await client.from("attendance").delete().eq("id", row.attendance_id).eq("church_id", churchId).eq("fellowship_id", selectedFellowship.id);
      if (error) setNotice({ tone: "error", text: `${row.member_name} को उपस्थिति हटाउन सकिएन।` });
      else setNotice({ tone: "info", text: `${row.member_name} को अवस्था नतोकिएको बनाइयो।` });
      await refreshRoster();
      setBusyUserId(null);
      return;
    }

    const payload = { status, notes: notes[row.user_id]?.trim() || null, marked_by: userId };
    const result = row.attendance_id
      ? await client.from("attendance").update(payload).eq("id", row.attendance_id).eq("church_id", churchId).eq("fellowship_id", selectedFellowship.id)
      : await client.from("attendance").insert({
          ...payload,
          church_id: churchId,
          fellowship_id: selectedFellowship.id,
          user_id: row.user_id,
        });

    if (result.error) setNotice({ tone: "error", text: `${row.member_name} को उपस्थिति सुरक्षित गर्न सकिएन।` });
    else setNotice({ tone: "success", text: `${row.member_name}: ${STATUS_LABELS[status]} सुरक्षित भयो।` });
    await refreshRoster();
    setBusyUserId(null);
  }

  return (
    <section className="admin-attendance-panel" aria-labelledby="admin-attendance-heading">
      <div className="admin-section-heading"><div><p className="eyebrow">सदस्य हेरचाह</p><h2 id="admin-attendance-heading">फेलोशिप उपस्थिति</h2></div><span>{roster.length.toLocaleString("ne-NP")}</span></div>
      <p className="admin-section-copy">एउटै मण्डलीका सक्रिय सदस्यको उपस्थिति तोक्नुहोस्। सदस्यले आफ्नो इतिहास मात्र पढ्न सक्छन्।</p>
      {notice && <p className={`admin-inline-notice ${notice.tone}`} role="status">{notice.text}</p>}
      {usableFellowships.length === 0 ? <div className="admin-attendance-empty"><strong>पहिले फेलोशिप बनाउनुहोस्</strong><small>उपस्थिति सधैँ वास्तविक फेलोशिपसँग जोडिन्छ।</small></div> : <>
        <label className="admin-attendance-fellowship">फेलोशिप<select value={selectedFellowship?.id ?? ""} onChange={(event) => setFellowshipId(Number(event.target.value))}>{usableFellowships.map((fellowship) => <option value={fellowship.id} key={fellowship.id}>{fellowship.title} · {formatDate(fellowship.starts_at)}</option>)}</select></label>
        <div className="admin-attendance-summary"><div className="attended"><strong>{totals.attended.toLocaleString("ne-NP")}</strong><small>उपस्थित</small></div><div className="missed"><strong>{totals.missed.toLocaleString("ne-NP")}</strong><small>अनुपस्थित</small></div><div className="excused"><strong>{totals.excused.toLocaleString("ne-NP")}</strong><small>कारणसहित</small></div><div><strong>{totals.unknown.toLocaleString("ne-NP")}</strong><small>बाँकी</small></div></div>
        <label className="admin-attendance-search">सदस्य खोज्नुहोस्<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="नाम वा भूमिका…" /></label>
        {loading ? <p className="admin-section-copy">सदस्य सूची खोलिँदैछ…</p> : filteredRoster.length === 0 ? <div className="admin-attendance-empty"><strong>सदस्य भेटिएन</strong><small>सक्रिय सदस्यता वा खोज शब्द जाँच्नुहोस्।</small></div> : <div className="admin-attendance-roster">{filteredRoster.map((row) => <article key={row.membership_id}><div className="admin-attendance-member"><span>{row.member_name.trim().charAt(0) || "स"}</span><p><strong>{row.member_name}</strong><small>{ROLE_LABELS[row.membership_role] ?? row.membership_role}</small></p><em className={row.attendance_status}>{STATUS_LABELS[row.attendance_status as AttendanceStatus] ?? row.attendance_status}</em></div><input maxLength={500} disabled={busyUserId === row.user_id} value={notes[row.user_id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.user_id]: event.target.value }))} placeholder="टिप्पणी वा कारण (ऐच्छिक)" aria-label={`${row.member_name} को उपस्थिति टिप्पणी`} /><div className="admin-attendance-actions">{(["attended", "missed", "excused", "unknown"] as AttendanceStatus[]).map((status) => <button type="button" className={row.attendance_status === status ? `selected ${status}` : status} disabled={busyUserId === row.user_id} onClick={() => { void markAttendance(row, status); }} key={status}>{STATUS_LABELS[status]}</button>)}</div></article>)}</div>}
      </>}
    </section>
  );
}
