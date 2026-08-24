"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { AdminDashboard } from "./admin-dashboard";
import { BibleReader } from "./bible-reader";
import { ChurchMembership, type AccountMembership } from "./church-membership";
import { FellowshipRecap } from "./fellowship-recap";
import { FellowshipService } from "./fellowship-service";
import { LiveNotifications } from "./live-notifications";
import { MemberAttendance } from "./member-attendance";
import { MemberDirectory } from "./member-directory";
import { MemberPreparations } from "./member-preparations";
import { MoreSettings, type SettingsProfile } from "./more-settings";
import { MyAssignments } from "./my-assignments";
import { WorshipSongs } from "./worship-songs";

export type DashboardScreen = "home" | "schedule" | "detail" | "service" | "notifications" | "bible" | "songs" | "more" | "membership" | "admin" | "members" | "assignments" | "preparations" | "recaps" | "attendance";

type Role = {
  label: string;
  name: string;
  initials: string;
  tone: string;
  open?: boolean;
};

type Fellowship = {
  id: string;
  title: string;
  date: string;
  shortDate: string;
  time: string;
  host: string;
  area: string;
  address: string;
  theme: string;
  roles: Role[];
};

type LiveFellowship = {
  id: number;
  title: string;
  location_name: string | null;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
};

const FELLOWSHIPS: Fellowship[] = [
  {
    id: "sanepa",
    title: "सानेपा घर संगति",
    date: "यो बुधबार · भदौ १०",
    shortDate: "भदौ १०",
    time: "साँझ ७:०० – ८:३०",
    host: "योहन र मरियम तामाङ",
    area: "सानेपा, ललितपुर",
    address: "वार्ड २, सानेपा चोक नजिक, ललितपुर",
    theme: "विश्वासमा दृढ रहौँ",
    roles: [
      { label: "अगुवाइ", name: "दानिएल तामाङ", initials: "दा", tone: "teal" },
      { label: "आराधना", name: "सारा राई", initials: "सा", tone: "gold" },
      { label: "वचन", name: "पास्टर जीवन", initials: "जी", tone: "blue" },
      { label: "प्रार्थना", name: "अझै तोकिएको छैन", initials: "+", tone: "muted", open: true },
    ],
  },
  {
    id: "koteshwor",
    title: "कोटेश्वर युवा संगति",
    date: "अर्को शुक्रबार · भदौ १२",
    shortDate: "भदौ १२",
    time: "साँझ ६:३० – ८:००",
    host: "प्रकाश श्रेष्ठ",
    area: "कोटेश्वर, काठमाडौँ",
    address: "महादेवस्थान मार्ग, कोटेश्वर, काठमाडौँ",
    theme: "युवाहरूको उद्देश्य",
    roles: [
      { label: "अगुवाइ", name: "प्रकाश श्रेष्ठ", initials: "प्र", tone: "teal" },
      { label: "आराधना", name: "दाविद केसी", initials: "दा", tone: "gold" },
    ],
  },
  {
    id: "church",
    title: "संयुक्त आराधना संगति",
    date: "अर्को आइतबार · भदौ १४",
    shortDate: "भदौ १४",
    time: "बिहान १०:०० – १२:००",
    host: "अनुग्रह मण्डली",
    area: "पाटन, ललितपुर",
    address: "मण्डली भवन, पाटन, ललितपुर",
    theme: "एउटै शरीर, एउटै आशा",
    roles: [
      { label: "अगुवाइ", name: "एल्डर शमूएल", initials: "श", tone: "blue" },
      { label: "आराधना", name: "आराधना समूह", initials: "आ", tone: "gold" },
    ],
  },
];

function BrandMark() {
  return (
    <span className="dashboard-church-mark" aria-hidden="true">
      <i className="dashboard-church-cross" />
      <i className="dashboard-church-roof" />
    </span>
  );
}

function AppHeader({ name, userId, onNotifications, onProfile }: {
  name: string;
  userId: string | null;
  onNotifications: () => void;
  onProfile: () => void;
}) {
  const initial = name.trim().charAt(0) || "स";
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId) {
      const timer = window.setTimeout(() => setUnreadCount(0), 0);
      return () => window.clearTimeout(timer);
    }
    const refreshUnreadCount = () => {
      void client.rpc("notification_unread_count").then(({ data, error }) => {
        if (!error) setUnreadCount(Number(data ?? 0));
      });
    };
    const timer = window.setTimeout(refreshUnreadCount, 0);
    window.addEventListener("focus", refreshUnreadCount);
    window.addEventListener("church-notifications-read", refreshUnreadCount);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshUnreadCount);
      window.removeEventListener("church-notifications-read", refreshUnreadCount);
    };
  }, [userId]);

  return (
    <header className="dashboard-header">
      <div className="dashboard-brand"><BrandMark /><span>अनुग्रह मण्डली</span></div>
      <div className="dashboard-header-actions">
        <button className="icon-button notification-button" type="button" onClick={onNotifications} aria-label="सूचनाहरू खोल्नुहोस्">
          <span aria-hidden="true">♢</span>{(!userId || unreadCount > 0) && <i>{userId ? (unreadCount > 9 ? "9+" : unreadCount) : ""}</i>}
        </button>
        <button className="avatar-button" type="button" onClick={onProfile} aria-label="पूर्वावलोकन प्रोफाइल खोल्नुहोस्">{initial}</button>
      </div>
    </header>
  );
}

function PreviewTag() {
  return <span className="demo-tag">नमुना डेटा</span>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function AssignmentBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="assignment-banner" type="button" onClick={onOpen} aria-labelledby="assignment-title">
      <span className="assignment-icon" aria-hidden="true">◖</span>
      <div>
        <p id="assignment-title">तपाईंको जिम्मेवारी</p>
        <strong>यो बुधबार सुरुवाती प्रार्थना</strong>
      </div>
      <span className="assignment-arrow" aria-hidden="true">›</span>
    </button>
  );
}

function WeeklyCard({ fellowship, onDetails }: { fellowship: Fellowship; onDetails: () => void }) {
  return (
    <article className="weekly-card">
      <button className="weekly-visual" type="button" onClick={onDetails} aria-label={`${fellowship.title} को विवरण खोल्नुहोस्`}>
        <span className="visual-glow" />
        <span className="visual-house"><i /><b /></span>
        <span className="visual-people"><i /><i /><i /><i /></span>
        <span className="weekly-date"><strong>{fellowship.date}</strong><small>{fellowship.time}</small></span>
      </button>
      <div className="weekly-body">
        <div className="weekly-title-row"><div><h3>{fellowship.title}</h3><p>आयोजक: {fellowship.host}</p></div><PreviewTag /></div>
        <div className="location-row">
          <span className="location-pin" aria-hidden="true">⌖</span>
          <div><strong>{fellowship.area}</strong><small>{fellowship.address}</small></div>
          <a className="outline-action" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fellowship.address)}`} target="_blank" rel="noreferrer">दिशा</a>
        </div>
      </div>
    </article>
  );
}

function QuickActions({ onBible, onSongs }: { onBible: () => void; onSongs: () => void }) {
  return (
    <div className="quick-actions" aria-label="छिटो खोल्नुहोस्">
      <button type="button" onClick={onBible}> <span className="quick-icon quick-icon--book" aria-hidden="true">▤</span><strong>नेपाली बाइबल</strong><small>६६ पुस्तक</small></button>
      <button type="button" onClick={onSongs}> <span className="quick-icon quick-icon--song" aria-hidden="true">♪</span><strong>आराधना गीत</strong><small>१,९६८ गीत</small></button>
    </div>
  );
}

function UpcomingRow({ fellowship, onDetails }: { fellowship: Fellowship; onDetails: () => void }) {
  const [month, day] = fellowship.shortDate.split(" ");
  return (
    <button className="upcoming-row" type="button" onClick={onDetails}>
      <span className="date-tile"><small>{month}</small><strong>{day}</strong></span>
      <span className="upcoming-copy"><strong>{fellowship.title}</strong><small>{fellowship.time} · {fellowship.theme}</small></span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function HomeScreen({ name, authenticatedUserId, onNavigate, onShowProfile }: DashboardProps) {
  const firstName = name.trim().split(" ")[0] || "सदस्य";
  return (
    <div className="app-screen screen-enter">
      <AppHeader name={name} userId={authenticatedUserId} onNotifications={() => onNavigate("notifications")} onProfile={onShowProfile} />
      <div className="app-scroll dashboard-home">
        <div className="greeting-row"><div><p>जयमसीह, {firstName}</p><h1>आज मण्डलीसँग जोडिनुहोस्</h1></div><PreviewTag /></div>
        <AssignmentBanner onOpen={() => onNavigate("assignments")} />
        <section className="dashboard-section" aria-labelledby="this-week-heading">
          <div className="section-heading"><div><p>यस हप्ता</p><h2 id="this-week-heading">घर संगति</h2></div><button type="button" onClick={() => onNavigate("schedule")}>तालिका हेर्नुहोस्</button></div>
          <WeeklyCard fellowship={FELLOWSHIPS[0]} onDetails={() => onNavigate("detail")} />
        </section>
        <QuickActions onBible={() => onNavigate("bible")} onSongs={() => onNavigate("songs")} />
        <section className="dashboard-section upcoming-section" aria-labelledby="upcoming-heading">
          <div className="section-heading"><h2 id="upcoming-heading">आगामी कार्यक्रम</h2><button type="button" onClick={() => onNavigate("schedule")}>सबै हेर्नुहोस्</button></div>
          <div className="upcoming-list">
            {FELLOWSHIPS.slice(1).map((fellowship) => <UpcomingRow key={fellowship.id} fellowship={fellowship} onDetails={() => onNavigate("detail")} />)}
          </div>
        </section>
      </div>
      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
}

function RoleMini({ role }: { role: Role }) {
  return (
    <div className={`role-mini${role.open ? " role-mini--open" : ""}`}>
      <span className={`role-avatar role-avatar--${role.tone}`}>{role.initials}</span>
      <div><small>{role.label}</small><strong>{role.name}</strong></div>
    </div>
  );
}

function ScheduleCard({ fellowship, primary, onDetails }: { fellowship: Fellowship; primary?: boolean; onDetails: () => void }) {
  return (
    <article className={`schedule-card${primary ? " schedule-card--primary" : ""}`}>
      <div className="schedule-card-title"><div><h3>{fellowship.title}</h3><p>◷ {fellowship.time}</p></div><span>{fellowship.shortDate}</span></div>
      <div className="role-grid">{fellowship.roles.map((role) => <RoleMini key={`${fellowship.id}-${role.label}`} role={role} />)}</div>
      <button className="details-button" type="button" onClick={onDetails}>विवरण हेर्नुहोस्</button>
    </article>
  );
}

function ScheduleScreen({ name, authenticatedUserId, memberships, onNavigate, onShowProfile }: DashboardProps) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const activeMemberships = useMemo(() => memberships.filter((membership) => membership.status === "active"), [memberships]);
  const [membershipId, setMembershipId] = useState<number | null>(activeMemberships[0]?.id ?? null);
  const selectedMembership = activeMemberships.find((membership) => membership.id === membershipId) ?? activeMemberships[0] ?? null;
  const [liveFellowships, setLiveFellowships] = useState<LiveFellowship[]>([]);
  const [liveLoading, setLiveLoading] = useState(Boolean(authenticatedUserId));

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !authenticatedUserId || !selectedMembership) {
      const timer = window.setTimeout(() => { setLiveFellowships([]); setLiveLoading(false); }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setLiveLoading(true);
      void client.from("fellowships")
        .select("id, title, location_name, address, starts_at, ends_at, status")
        .eq("church_id", selectedMembership.churchId)
        .eq("status", "scheduled")
        .order("starts_at", { ascending: true })
        .limit(100)
        .then(({ data }) => {
          setLiveFellowships((data ?? []) as LiveFellowship[]);
          setLiveLoading(false);
        });
    }, 0);
    return () => window.clearTimeout(timer);
    // The selected membership is the tenant boundary for this query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticatedUserId, membershipId, selectedMembership?.id]);

  const showLiveSchedule = Boolean(authenticatedUserId && selectedMembership);
  return (
    <div className="app-screen screen-enter">
      <AppHeader name={name} userId={authenticatedUserId} onNotifications={() => onNavigate("notifications")} onProfile={onShowProfile} />
      <div className="app-scroll schedule-screen-content">
        <div className="schedule-heading-row"><div><p className="eyebrow">संगतिको समय</p><h1>तालिका</h1></div>{showLiveSchedule ? <span className="secure-data-tag">सुरक्षित मण्डली डेटा</span> : <PreviewTag />}</div>
        {showLiveSchedule && activeMemberships.length > 1 && <label className="live-schedule-church-picker">मण्डली<select value={selectedMembership?.id ?? ""} onChange={(event) => setMembershipId(Number(event.target.value))}>{activeMemberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.churchNameNe || membership.churchName}</option>)}</select></label>}
        {!showLiveSchedule && <div className="schedule-switch" aria-label="तालिका देखाउने तरिका">
          <button type="button" className={view === "list" ? "selected" : ""} onClick={() => setView("list")}><span aria-hidden="true">☷</span> सूची</button>
          <button type="button" className={view === "calendar" ? "selected" : ""} onClick={() => setView("calendar")}><span aria-hidden="true">▦</span> पात्रो</button>
        </div>}
        {!showLiveSchedule && view === "calendar" && (
          <div className="calendar-strip" aria-label="यस हप्ताका दिनहरू">
            {[["सोम", "८"], ["मंगल", "९"], ["बुध", "१०"], ["बिही", "११"], ["शुक्र", "१२"]].map(([day, date]) => (
              <button type="button" className={date === "१०" ? "selected" : ""} key={date}><small>{day}</small><strong>{date}</strong></button>
            ))}
          </div>
        )}
        <section className="schedule-list" aria-labelledby="schedule-list-heading">
          <h2 id="schedule-list-heading">{showLiveSchedule ? selectedMembership?.churchNameNe || selectedMembership?.churchName : view === "list" ? "आगामी संगतिहरू" : "भदौ १० का कार्यक्रम"}</h2>
          {showLiveSchedule ? liveLoading ? <div className="live-schedule-empty" role="status">फेलोशिप तालिका लोड हुँदैछ…</div> : liveFellowships.length === 0 ? <div className="live-schedule-empty">मण्डली प्रशासकले आगामी फेलोशिप तालिका बनाएपछि यहाँ देखिन्छ।</div> : liveFellowships.map((fellowship, index) => <article className={`schedule-card live-schedule-card${index === 0 ? " schedule-card--primary" : ""}`} key={fellowship.id}><div className="schedule-card-title"><div><h3>{fellowship.title}</h3><p>◷ {formatDateTime(fellowship.starts_at)}{fellowship.ends_at ? ` – ${new Intl.DateTimeFormat("ne-NP", { hour: "numeric", minute: "2-digit" }).format(new Date(fellowship.ends_at))}` : ""}</p></div><span>तालिकाबद्ध</span></div><div className="live-schedule-location"><span aria-hidden="true">⌖</span><p><strong>{fellowship.location_name || "स्थान राखिएको छैन"}</strong><small>{fellowship.address || "ठेगाना राखिएको छैन"}</small></p></div><div className="live-schedule-actions"><button className="details-button" type="button" onClick={() => { window.history.replaceState(null, "", `#service/${fellowship.id}`); onNavigate("service"); }}>आराधना र वचन स्लाइड</button><button className="details-button secondary" type="button" onClick={() => onNavigate("preparations")}>अन्य तयारी</button></div></article>) : (view === "list" ? FELLOWSHIPS : FELLOWSHIPS.slice(0, 1)).map((fellowship, index) => (
            <ScheduleCard key={fellowship.id} fellowship={fellowship} primary={index === 0} onDetails={() => onNavigate("detail")} />
          ))}
        </section>
      </div>
      <BottomNav active="schedule" onNavigate={onNavigate} />
    </div>
  );
}

function DetailScreen({ onNavigate, onUnavailable }: Pick<DashboardProps, "onNavigate"> & { onUnavailable: (label: string) => void }) {
  const fellowship = FELLOWSHIPS[0];
  return (
    <div className="app-screen screen-enter">
      <header className="detail-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("schedule")} aria-label="तालिकामा फर्कनुहोस्">←</button>
        <div className="dashboard-brand"><BrandMark /><span>अनुग्रह मण्डली</span></div>
        <span className="header-spacer" />
      </header>
      <div className="app-scroll detail-content">
        <section className="detail-hero">
          <span className="detail-pattern" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <div><PreviewTag /><h1>{fellowship.title}</h1><p>▣ {fellowship.date} · {fellowship.time}</p></div>
        </section>
        <section className="detail-location">
          <span className="location-pin location-pin--large" aria-hidden="true">⌖</span>
          <div><h2>{fellowship.host}को निवास</h2><p>{fellowship.address}</p></div>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fellowship.address)}`} target="_blank" rel="noreferrer">⌁ दिशा खोल्नुहोस्</a>
        </section>
        <section className="detail-section" aria-labelledby="theme-heading">
          <p className="eyebrow">यस हप्ताको विषय</p><h2 id="theme-heading">{fellowship.theme}</h2>
        </section>
        <section className="detail-section" aria-labelledby="roles-heading">
          <div className="section-heading"><h2 id="roles-heading">तोकिएका जिम्मेवारी</h2><span>{fellowship.roles.length} भूमिका</span></div>
          <div className="detail-roles">
            {fellowship.roles.map((role) => (
              <article className={`detail-role${role.open ? " detail-role--open" : ""}`} key={role.label}>
                <span className={`role-avatar role-avatar--${role.tone}`}>{role.initials}</span>
                <div><small>{role.label}</small><strong>{role.name}</strong></div>
                {role.open && <button type="button" onClick={() => onUnavailable("स्वयंसेवा")}>स्वयंसेवा</button>}
              </article>
            ))}
          </div>
        </section>
        <div className="protected-note"><span aria-hidden="true">🔒</span><p><strong>सुरक्षित कार्य रोकिएको छ</strong> स्वयंसेवा र जिम्मेवारी परिवर्तन वास्तविक प्रमाणीकरणपछि मात्र उपलब्ध हुनेछ।</p></div>
      </div>
      <BottomNav active="schedule" onNavigate={onNavigate} />
    </div>
  );
}

function BottomNav({ active, onNavigate }: {
  active: "home" | "schedule" | "bible" | "songs" | "more";
  onNavigate: (screen: DashboardScreen) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन">
      <button type="button" className={active === "home" ? "active" : ""} onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button>
      <button type="button" className={active === "schedule" ? "active" : ""} onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button>
      <button type="button" className={active === "bible" ? "active" : ""} onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button>
      <button type="button" className={active === "songs" ? "active" : ""} onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button>
      <button type="button" className={active === "more" ? "active" : ""} onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button>
    </nav>
  );
}

type DashboardProps = {
  screen: DashboardScreen;
  name: string;
  settingsProfile: SettingsProfile;
  authenticatedUserId: string | null;
  isSuperAdmin: boolean;
  memberships: AccountMembership[];
  membershipsLoading: boolean;
  onRefreshMemberships: () => Promise<void>;
  onNavigate: (screen: DashboardScreen) => void;
  onShowProfile: () => void;
  onLanguageChange: (language: "ne" | "en") => void;
  onHighContrastChange: (enabled: boolean) => void;
  onTextScaleChange: (scale: number | null) => void;
  settingsSyncState: "idle" | "saving" | "saved" | "error";
  onSignOut: () => void;
  onClearPreview: () => void;
};

export function ChurchDashboard(props: DashboardProps) {
  const [unavailable, setUnavailable] = useState("");
  const showUnavailable = (label: string) => {
    setUnavailable(`${label} अर्को ब्याचमा तयार हुनेछ।`);
    window.setTimeout(() => setUnavailable(""), 2600);
  };

  return (
    <>
      {props.screen === "home" && <HomeScreen {...props} />}
      {props.screen === "schedule" && <ScheduleScreen {...props} />}
      {props.screen === "detail" && <DetailScreen onNavigate={props.onNavigate} onUnavailable={showUnavailable} />}
      {props.screen === "service" && <FellowshipService userId={props.authenticatedUserId} memberships={props.memberships} onNavigate={props.onNavigate} />}
      {props.screen === "notifications" && <LiveNotifications userId={props.authenticatedUserId} memberships={props.memberships} onNavigate={props.onNavigate} />}
      {props.screen === "bible" && <BibleReader onHome={() => props.onNavigate("home")} onSchedule={() => props.onNavigate("schedule")} onSongs={() => props.onNavigate("songs")} onMore={() => props.onNavigate("more")} />}
      {props.screen === "songs" && <WorshipSongs onHome={() => props.onNavigate("home")} onSchedule={() => props.onNavigate("schedule")} onBible={(hash) => { if (hash) window.history.replaceState(null, "", `#bible/${hash}`); props.onNavigate("bible"); }} onMore={() => props.onNavigate("more")} />}
      {props.screen === "more" && <MoreSettings profile={props.settingsProfile} settingsSyncState={props.settingsSyncState} onNavigate={props.onNavigate} onLanguageChange={props.onLanguageChange} onHighContrastChange={props.onHighContrastChange} onTextScaleChange={props.onTextScaleChange} onSignOut={props.onSignOut} onClearPreview={props.onClearPreview} />}
      {props.screen === "membership" && <ChurchMembership userId={props.authenticatedUserId} memberships={props.memberships} loading={props.membershipsLoading} onRefresh={props.onRefreshMemberships} onNavigate={props.onNavigate} />}
      {props.screen === "admin" && <AdminDashboard userId={props.authenticatedUserId} memberships={props.memberships} isSuperAdmin={props.isSuperAdmin} onNavigate={props.onNavigate} />}
      {props.screen === "members" && <MemberDirectory currentName={props.name} onNavigate={props.onNavigate} />}
      {props.screen === "assignments" && <MyAssignments name={props.name} userId={props.authenticatedUserId} memberships={props.memberships} onNavigate={props.onNavigate} />}
      {props.screen === "preparations" && <MemberPreparations userId={props.authenticatedUserId} memberships={props.memberships} onNavigate={props.onNavigate} />}
      {props.screen === "recaps" && <FellowshipRecap name={props.name} userId={props.authenticatedUserId} memberships={props.memberships} onNavigate={props.onNavigate} />}
      {props.screen === "attendance" && <MemberAttendance memberships={props.memberships} onNavigate={props.onNavigate} />}
      {unavailable && <p className="app-toast" role="status">{unavailable}</p>}
    </>
  );
}
