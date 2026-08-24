"use client";

import { useMemo, useState } from "react";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";
import { LiveAssignments } from "./live-assignments";

type AssignmentStatus = "upcoming" | "later" | "completed";
type AssignmentFilter = "upcoming" | "all" | "completed";
type Assignment = {
  id: string;
  title: string;
  role: string;
  event: string;
  date: string;
  time: string;
  area: string;
  theme: string;
  status: AssignmentStatus;
  tone: "teal" | "gold" | "blue" | "green";
  icon: string;
  preparation: { id: string; label: string }[];
  bibleHash?: string;
};

const CHECKLIST_KEY = "church-app-preview-assignment-checklist-v1";
const ASSIGNMENTS: Assignment[] = [
  { id: "opening-prayer-sanepa", title: "सुरुवाती प्रार्थना", role: "प्रार्थना सहयोगी", event: "सानेपा घर संगति", date: "यो बुधबार · भदौ १०", time: "साँझ ७:००", area: "सानेपा, ललितपुर", theme: "विश्वासमा दृढ रहौँ", status: "upcoming", tone: "teal", icon: "◖", bibleHash: "PHP/4/6", preparation: [{ id: "read-theme", label: "यस हप्ताको विषय र वचन पढ्ने" }, { id: "write-points", label: "प्रार्थनाका मुख्य बुँदा तयार गर्ने" }, { id: "arrive-early", label: "१५ मिनेटअघि पुग्ने" }] },
  { id: "worship-support-youth", title: "आराधना टोली सहयोग", role: "आराधना सहयोगी", event: "कोटेश्वर युवा संगति", date: "अर्को शुक्रबार · भदौ १२", time: "साँझ ६:३०", area: "कोटेश्वर, काठमाडौँ", theme: "युवाहरूको उद्देश्य", status: "later", tone: "gold", icon: "♪", bibleHash: "1TI/4/12", preparation: [{ id: "review-songs", label: "छानिएका गीत र कर्ड अभ्यास गर्ने" }, { id: "confirm-key", label: "मुख्य गायकसँग की पुष्टि गर्ने" }, { id: "sound-check", label: "ध्वनि जाँचका लागि समयमै पुग्ने" }] },
  { id: "welcome-team-sunday", title: "स्वागत तथा आतिथ्य", role: "स्वागत टोली", event: "संयुक्त आराधना संगति", date: "अर्को आइतबार · भदौ १४", time: "बिहान ९:३०", area: "पाटन, ललितपुर", theme: "एउटै शरीर, एउटै आशा", status: "later", tone: "green", icon: "◎", bibleHash: "ROM/12/5", preparation: [{ id: "check-list", label: "नयाँ आगन्तुक सूची तयार राख्ने" }, { id: "welcome-desk", label: "स्वागत डेस्क मिलाउने" }, { id: "follow-up", label: "भेटिएका नयाँ सदस्य टिपोट गर्ने" }] },
  { id: "scripture-reading-last-week", title: "धर्मशास्त्र वाचन", role: "वचन सहयोगी", event: "सानेपा घर संगति", date: "गत बुधबार · भदौ ३", time: "साँझ ७:००", area: "सानेपा, ललितपुर", theme: "प्रेममा एक-अर्काको सेवा", status: "completed", tone: "blue", icon: "▤", bibleHash: "GAL/5/13", preparation: [{ id: "read-passage", label: "पाठ तीन पटक पढ्ने" }, { id: "mark-pauses", label: "वाचनमा विराम चिन्ह लगाउने" }] },
];

const MY_ROLES = [
  { icon: "◖", title: "प्रार्थना सहयोगी", group: "सानेपा घर संगति", tone: "teal" },
  { icon: "♪", title: "आराधना सहयोगी", group: "युवा तथा संयुक्त संगति", tone: "gold" },
  { icon: "◎", title: "स्वागत टोली", group: "आइतबार आराधना", tone: "green" },
];

function readChecklist() {
  if (typeof window === "undefined") return {} as Record<string, string[]>;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHECKLIST_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, string[]> : {};
  } catch {
    return {} as Record<string, string[]>;
  }
}

function readSelectedAssignmentId() {
  if (typeof window === "undefined") return "";
  return window.location.hash.match(/^#assignments\/([a-z0-9-]+)$/)?.[1] ?? "";
}

function statusLabel(status: AssignmentStatus) {
  if (status === "completed") return "सम्पन्न नमुना";
  if (status === "upcoming") return "यस हप्ता";
  return "आगामी";
}

function PreviewAssignments({ name, onNavigate }: { name: string; onNavigate: (screen: DashboardScreen) => void }) {
  const [selectedId, setSelectedId] = useState(readSelectedAssignmentId);
  const [filter, setFilter] = useState<AssignmentFilter>("upcoming");
  const [checklist, setChecklist] = useState<Record<string, string[]>>(readChecklist);
  const [notice, setNotice] = useState("");
  const selectedAssignment = ASSIGNMENTS.find((assignment) => assignment.id === selectedId);
  const visibleAssignments = useMemo(() => ASSIGNMENTS.filter((assignment) => {
    if (filter === "all") return true;
    if (filter === "completed") return assignment.status === "completed";
    return assignment.status !== "completed";
  }), [filter]);
  const firstName = name.trim().split(" ")[0] || "सदस्य";

  function openAssignment(assignment: Assignment) {
    setSelectedId(assignment.id);
    window.history.replaceState(null, "", `#assignments/${assignment.id}`);
  }

  function closeAssignment() {
    setSelectedId("");
    window.history.replaceState(null, "", "#assignments");
  }

  function toggleStep(assignmentId: string, stepId: string) {
    const current = checklist[assignmentId] ?? [];
    const nextSteps = current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId];
    const nextChecklist = { ...checklist, [assignmentId]: nextSteps };
    setChecklist(nextChecklist);
    window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(nextChecklist));
  }

  function showProtected(label: string) {
    setNotice(`${label} वास्तविक प्रमाणीकरण र अगुवा अनुमति भएपछि मात्र उपलब्ध हुनेछ।`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function openBible(hash: string) {
    window.history.replaceState(null, "", `#bible/${hash}`);
    onNavigate("bible");
  }

  if (selectedAssignment) {
    const checked = checklist[selectedAssignment.id] ?? [];
    const completedSteps = selectedAssignment.preparation.filter((step) => checked.includes(step.id)).length;
    const progress = Math.round((completedSteps / selectedAssignment.preparation.length) * 100);
    return (
      <div className="app-screen screen-enter">
        <header className="detail-header assignment-detail-header">
          <button className="icon-button" type="button" onClick={closeAssignment} aria-label="जिम्मेवारी सूचीमा फर्कनुहोस्">←</button>
          <div><strong>जिम्मेवारी विवरण</strong><small>स्थानीय पूर्वावलोकन</small></div>
          <span className="demo-tag">नमुना</span>
        </header>
        <div className="app-scroll assignment-detail-content">
          <section className={`assignment-detail-hero assignment-tone--${selectedAssignment.tone}`}><span aria-hidden="true">{selectedAssignment.icon}</span><div><small>{statusLabel(selectedAssignment.status)}</small><h1>{selectedAssignment.title}</h1><p>{selectedAssignment.event}</p></div></section>

          <div className="assignment-preview-note" role="note"><span aria-hidden="true">ⓘ</span><p><strong>यो नमुना जिम्मेवारी हो</strong> वास्तविक भूमिका, स्वीकृति वा उपस्थितिमा कुनै परिवर्तन हुँदैन।</p></div>

          <section className="assignment-info-grid" aria-label="जिम्मेवारीको समय र स्थान"><span><small>मिति</small><strong>{selectedAssignment.date}</strong></span><span><small>समय</small><strong>{selectedAssignment.time}</strong></span><span><small>स्थान</small><strong>{selectedAssignment.area}</strong></span><span><small>भूमिका</small><strong>{selectedAssignment.role}</strong></span></section>

          <section className="assignment-theme-card"><p className="eyebrow">संगतिको विषय</p><h2>{selectedAssignment.theme}</h2>{selectedAssignment.bibleHash && <button type="button" onClick={() => openBible(selectedAssignment.bibleHash!)}>सम्बन्धित बाइबल खण्ड खोल्नुहोस् <span aria-hidden="true">›</span></button>}</section>

          <section className="assignment-preparation" aria-labelledby="preparation-heading"><div className="assignment-preparation-heading"><div><p className="eyebrow">यस उपकरणमा मात्र</p><h2 id="preparation-heading">तयारी सूची</h2></div><span>{completedSteps}/{selectedAssignment.preparation.length}</span></div><div className="assignment-progress" aria-label={`${progress}% तयारी पूरा`}><span style={{ width: `${progress}%` }} /></div><div className="assignment-checklist">{selectedAssignment.preparation.map((step) => <label key={step.id}><input type="checkbox" checked={checked.includes(step.id)} onChange={() => toggleStep(selectedAssignment.id, step.id)} /><span>{step.label}</span></label>)}</div></section>

          {selectedAssignment.role.includes("आराधना") && <button className="assignment-song-link" type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><span><small>अभ्यासका लागि</small><strong>आराधना गीत र कर्ड खोल्नुहोस्</strong></span><b aria-hidden="true">›</b></button>}

          <section className="assignment-locked-actions"><div><span aria-hidden="true">🔒</span><p><strong>परिवर्तनका कार्य बन्द छन्</strong><small>स्वीकार, अस्वीकार, साटफेर र उपस्थिति वास्तविक लगइनपछि मात्र।</small></p></div><div><button type="button" onClick={() => showProtected("जिम्मेवारी पुष्टि")}>पुष्टि गर्नुहोस्</button><button type="button" onClick={() => showProtected("परिवर्तन अनुरोध")}>परिवर्तन माग्नुहोस्</button></div></section>
        </div>
        <AssignmentBottomNav onNavigate={onNavigate} />
        {notice && <p className="app-toast" role="status">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header assignments-header"><button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button><div><p className="eyebrow">सेवकाइ</p><strong>मेरो भूमिका</strong></div><span className="demo-tag">नमुना</span></header>
      <div className="app-scroll assignments-content">
        <section className="assignments-hero"><div><span>जयमसीह, {firstName}</span><h1>सेवाका लागि तयार रहनुहोस्</h1><p>भूमिका, आउने जिम्मेवारी र व्यक्तिगत तयारी एउटै ठाउँमा।</p></div><span aria-hidden="true">◖</span></section>
        <div className="assignment-preview-note" role="note"><span aria-hidden="true">ⓘ</span><p><strong>भूमिका र मिति काल्पनिक नमुना हुन्</strong> Supabase का वास्तविक assignment र member तालिका पढिएको छैन।</p></div>

        <section className="my-role-section" aria-labelledby="my-role-heading"><div className="assignment-section-heading"><div><p className="eyebrow">सेवकाइ क्षेत्र</p><h2 id="my-role-heading">मेरा नमुना भूमिका</h2></div><span>३ भूमिका</span></div><div className="my-role-grid">{MY_ROLES.map((role) => <article key={role.title} className={`my-role-card assignment-tone--${role.tone}`}><span aria-hidden="true">{role.icon}</span><div><strong>{role.title}</strong><small>{role.group}</small></div></article>)}</div></section>

        <section className="assignment-list-section" aria-labelledby="assignment-list-heading"><div className="assignment-section-heading"><div><p className="eyebrow">तालिका</p><h2 id="assignment-list-heading">जिम्मेवारीहरू</h2></div><span>{visibleAssignments.length} वटा</span></div><div className="assignment-filter-tabs" role="group" aria-label="जिम्मेवारी फिल्टर"><button type="button" className={filter === "upcoming" ? "selected" : ""} onClick={() => setFilter("upcoming")}>आउने</button><button type="button" className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>सबै</button><button type="button" className={filter === "completed" ? "selected" : ""} onClick={() => setFilter("completed")}>सम्पन्न</button></div><div className="assignment-list">{visibleAssignments.map((assignment) => { const complete = (checklist[assignment.id] ?? []).length; return <button type="button" className="assignment-card" onClick={() => openAssignment(assignment)} key={assignment.id}><span className={`assignment-card-icon assignment-tone--${assignment.tone}`}>{assignment.icon}</span><span className="assignment-card-copy"><small>{statusLabel(assignment.status)} · {assignment.date}</small><strong>{assignment.title}</strong><em>{assignment.event} · {assignment.time}</em>{assignment.status !== "completed" && <i>{complete}/{assignment.preparation.length} तयारी</i>}</span><span aria-hidden="true">›</span></button>; })}</div></section>

        <footer className="assignment-safety-note"><strong>अगुवाका व्यवस्थापन उपकरण अलग रहनेछन्</strong><p>भूमिका तोक्ने, सदस्य हटाउने, साटफेर स्वीकार गर्ने र उपस्थिति रेकर्ड गर्ने सुविधा सुरक्षित admin/leader क्षेत्रमा मात्र हुनेछ।</p></footer>
      </div>
      <AssignmentBottomNav onNavigate={onNavigate} />
    </div>
  );
}

export function MyAssignments({ name, userId, memberships, onNavigate }: {
  name: string;
  userId: string | null;
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
}) {
  if (userId) return <LiveAssignments name={name} userId={userId} memberships={memberships} onNavigate={onNavigate} />;
  return <PreviewAssignments name={name} onNavigate={onNavigate} />;
}

function AssignmentBottomNav({ onNavigate }: { onNavigate: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन"><button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button><button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button><button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button><button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button><button type="button" className="active" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button></nav>;
}
