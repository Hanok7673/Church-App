"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { AccountMembership } from "./church-membership";
import type { DashboardScreen } from "./dashboard";

type NotificationRow = {
  notification_id: number;
  church_id: number;
  church_name: string;
  church_name_ne: string | null;
  event_type: string;
  title: string;
  body: string;
  route: string;
  source_table: string;
  source_id: number;
  created_at: string;
  read_at: string | null;
};

type Props = {
  userId: string | null;
  memberships: AccountMembership[];
  onNavigate: (screen: DashboardScreen) => void;
};

const EVENT_ICONS: Record<string, string> = {
  assignment_created: "✓",
  preparation_approved: "✓",
  preparation_rejected: "↺",
  recap_published: "▤",
  schedule_created: "□",
  schedule_updated: "↻",
  schedule_cancelled: "×",
  attendance_marked: "●",
  attendance_changed: "↻",
  attendance_removed: "−",
};

function notificationScreen(route: string): DashboardScreen {
  if (route.startsWith("#assignments")) return "assignments";
  if (route.startsWith("#preparations")) return "preparations";
  if (route.startsWith("#recaps")) return "recaps";
  if (route.startsWith("#attendance")) return "attendance";
  if (route.startsWith("#schedule")) return "schedule";
  return "home";
}

function notificationTime(value: string) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "अहिले";
  if (minutes < 60) return `${new Intl.NumberFormat("ne-NP").format(minutes)} मिनेटअघि`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${new Intl.NumberFormat("ne-NP").format(hours)} घण्टाअघि`;
  return new Intl.DateTimeFormat("ne-NP", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function LiveNotifications({ userId, memberships, onNavigate }: Props) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(Boolean(userId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeMemberships = useMemo(
    () => memberships.filter((membership) => membership.status === "active"),
    [memberships],
  );
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const visibleNotifications = filter === "unread"
    ? notifications.filter((notification) => !notification.read_at)
    : notifications;

  const refresh = useCallback(async (showLoading = true) => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError("");
    const { data, error: requestError } = await client.rpc("list_my_notifications", { p_limit: 100 });
    if (requestError) {
      setError("सूचनाहरू लोड हुन सकेनन्। कृपया फेरि प्रयास गर्नुहोस्।");
    } else {
      setNotifications((data ?? []) as NotificationRow[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const openNotification = async (notification: NotificationRow) => {
    const client = getSupabaseBrowserClient();
    if (client && !notification.read_at) {
      const readAt = new Date().toISOString();
      const { error: updateError } = await client
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", notification.notification_id)
        .is("read_at", null);
      if (!updateError) {
        setNotifications((current) => current.map((item) => item.notification_id === notification.notification_id ? { ...item, read_at: readAt } : item));
        window.dispatchEvent(new Event("church-notifications-read"));
      }
    }
    window.history.replaceState(null, "", notification.route);
    onNavigate(notificationScreen(notification.route));
  };

  const markAllRead = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId || unreadCount === 0) return;
    setBusy(true);
    setError("");
    const readAt = new Date().toISOString();
    const { error: updateError } = await client
      .from("notifications")
      .update({ read_at: readAt })
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (updateError) {
      setError("सूचनाहरू पढिएको चिन्ह लगाउन सकेन।");
    } else {
      setNotifications((current) => current.map((notification) => notification.read_at ? notification : { ...notification, read_at: readAt }));
      window.dispatchEvent(new Event("church-notifications-read"));
    }
    setBusy(false);
  };

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("home")} aria-label="होममा फर्कनुहोस्">←</button>
        <div className="dashboard-brand"><span className="notification-brand-icon" aria-hidden="true">◖</span><span>सूचनाहरू</span></div>
        {userId ? <button className="notification-refresh" type="button" onClick={() => void refresh()} disabled={loading} aria-label="सूचनाहरू फेरि लोड गर्नुहोस्">↻</button> : <span className="demo-tag">नमुना डेटा</span>}
      </header>
      <div className="app-scroll notifications-content">
        {!userId ? (
          <div className="notification-empty-state">
            <span aria-hidden="true">◖</span>
            <h1>सुरक्षित सदस्य सूचनाहरू</h1>
            <p>साइन इन गरेपछि तपाईंको जिम्मेवारी, तयारी निर्णय, पुनरावलोकन, तालिका र हाजिरीका सूचनाहरू यहाँ देखिन्छन्।</p>
          </div>
        ) : activeMemberships.length === 0 ? (
          <div className="notification-empty-state">
            <span aria-hidden="true">⌂</span>
            <h1>सक्रिय मण्डली सदस्यता आवश्यक छ</h1>
            <p>मण्डलीको निमन्त्रणा स्वीकार गरेपछि त्यस मण्डलीका आफ्ना सूचनाहरू यहाँ देखिनेछन्।</p>
            <button type="button" onClick={() => onNavigate("membership")}>सदस्यता खोल्नुहोस्</button>
          </div>
        ) : (
          <>
            <div className="notification-summary live-notification-summary">
              <span aria-hidden="true">◖</span>
              <div><strong>{new Intl.NumberFormat("ne-NP").format(unreadCount)} नयाँ सूचना</strong><small>तपाईंका सक्रिय मण्डलीहरूबाट मात्र</small></div>
              <button type="button" onClick={() => void markAllRead()} disabled={busy || unreadCount === 0}>सबै पढियो</button>
            </div>
            <div className="notification-filter" role="tablist" aria-label="सूचना फिल्टर">
              <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>सबै</button>
              <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>नपढिएको ({new Intl.NumberFormat("ne-NP").format(unreadCount)})</button>
            </div>
            {error && <p className="notification-error" role="alert">{error}</p>}
            {loading ? <div className="notification-loading" role="status">सूचनाहरू लोड हुँदैछन्…</div> : visibleNotifications.length === 0 ? (
              <div className="notification-empty-state notification-empty-state--compact">
                <span aria-hidden="true">✓</span>
                <h2>{filter === "unread" ? "सबै सूचना पढिसक्नुभयो" : "अहिलेसम्म कुनै सूचना छैन"}</h2>
                <p>नयाँ मण्डली गतिविधि भएपछि यहाँ स्वतः देखिनेछ।</p>
              </div>
            ) : (
              <section className="notification-list" aria-label="सूचनाहरू">
                {visibleNotifications.map((notification) => (
                  <article className={`notification-card live-notification-card${notification.read_at ? "" : " notification-card--new"}`} key={notification.notification_id}>
                    <span className="live-notification-icon" aria-hidden="true">{EVENT_ICONS[notification.event_type] ?? "•"}</span>
                    <div className="live-notification-copy">
                      <div className="live-notification-meta"><span>{notification.church_name_ne || notification.church_name}</span><time dateTime={notification.created_at}>{notificationTime(notification.created_at)}</time></div>
                      <h2>{notification.title}</h2>
                      <p>{notification.body}</p>
                      <button type="button" onClick={() => void openNotification(notification)}>सम्बन्धित विवरण खोल्नुहोस् <span aria-hidden="true">›</span></button>
                    </div>
                    {!notification.read_at && <i className="notification-unread-dot" aria-label="नपढिएको" />}
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन">
        <button type="button" className="active" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button>
        <button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">□</span><small>तालिका</small></button>
        <button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button>
        <button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button>
        <button type="button" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button>
      </nav>
    </div>
  );
}
