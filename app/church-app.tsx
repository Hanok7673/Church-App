"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChurchDashboard, DashboardScreen } from "./dashboard";
import type { AccountMembership } from "./church-membership";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Screen = "welcome" | "access" | "profile" | "complete" | DashboardScreen;
type AccessMethod = "phone" | "gmail";
type AuthMode = "signin" | "signup";
type SettingsSyncState = "idle" | "saving" | "saved" | "error";
type Notice = { tone: "error" | "info" | "success"; text: string } | null;

type SignupChurch = {
  church_id: number;
  church_name: string;
  church_name_ne: string | null;
  address: string | null;
};

type PreviewAccess = {
  method: AccessMethod;
  identifier: string;
};

type PreviewProfile = PreviewAccess & {
  fullName: string;
  dateOfBirth: string;
  language: "ne" | "en";
  highContrast: boolean;
  textScaleOverride?: number | null;
};

const ACCESS_STORAGE_KEY = "church-app-preview-access-v1";
const PROFILE_STORAGE_KEY = "church-app-preview-profile-v1";
const LOCAL_PREVIEW_KEYS = [
  ACCESS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  "church-app-preview-song-favourites-v1",
  "church-app-preview-recap-song-selection-v1",
  "church-app-preview-bible-bookmarks-v1",
  "church-app-preview-assignment-checklist-v1",
  "church-app-preview-recap-draft-v1",
];

function ChurchMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "church-mark church-mark--compact" : "church-mark"} aria-hidden="true">
      <span className="church-cross" />
      <span className="church-roof" />
      <span className="church-door" />
    </div>
  );
}

function CommunityScene() {
  return (
    <div className="community-scene" aria-label="नेपाली मण्डलीका सदस्यहरू सँगै भेला भएको चित्र" role="img">
      <div className="sun" />
      <div className="mountain mountain--back" />
      <div className="mountain mountain--front" />
      <div className="cloud cloud--one" />
      <div className="cloud cloud--two" />
      <div className="chapel">
        <span className="chapel-cross" />
        <span className="chapel-roof" />
        <span className="chapel-window" />
        <span className="chapel-door" />
      </div>
      <div className="tree tree--left"><span /></div>
      <div className="tree tree--right"><span /></div>
      <div className="people" aria-hidden="true">
        <span className="person person--one" />
        <span className="person person--two" />
        <span className="person person--three" />
        <span className="person person--four" />
      </div>
      <div className="scene-caption"><span>🇳🇵</span> विश्वासमा बढौँ, सेवामा जोडिऔँ</div>
    </div>
  );
}

function recommendedScale(dateOfBirth: string) {
  if (!dateOfBirth) return 1;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  if (age >= 65) return 1.2;
  if (age >= 50) return 1.1;
  return 1;
}

function parseStoredValue<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function screenFromHash(fallback: Screen): Screen {
  const hash = window.location.hash;
  if (hash.startsWith("#bible/")) return "bible";
  if (hash.startsWith("#songs")) return "songs";
  if (hash.startsWith("#service/")) return "service";
  if (hash.startsWith("#admin")) return "admin";
  if (hash.startsWith("#membership")) return "membership";
  if (hash.startsWith("#members")) return "members";
  if (hash.startsWith("#assignments")) return "assignments";
  if (hash.startsWith("#preparations")) return "preparations";
  if (hash.startsWith("#recaps")) return "recaps";
  if (hash.startsWith("#attendance")) return "attendance";
  if (hash.startsWith("#notifications")) return "notifications";
  if (hash.startsWith("#schedule")) return "schedule";
  if (hash === "#more") return "more";
  return fallback;
}

export function ChurchApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);
  const [authenticatedEmail, setAuthenticatedEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canPostPreparations, setCanPostPreparations] = useState(false);
  const [accessExperience, setAccessExperience] = useState<"secure" | "preview">("secure");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [settingsSyncState, setSettingsSyncState] = useState<SettingsSyncState>("idle");
  const [memberships, setMemberships] = useState<AccountMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [accessMethod, setAccessMethod] = useState<AccessMethod>("phone");
  const [phone, setPhone] = useState("");
  const [gmail, setGmail] = useState("");
  const [previewAccess, setPreviewAccess] = useState<PreviewAccess | null>(null);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [temporaryAddress, setTemporaryAddress] = useState("");
  const [sameAsPermanent, setSameAsPermanent] = useState(true);
  const [signupChurchId, setSignupChurchId] = useState<number | "">("");
  const [signupChurches, setSignupChurches] = useState<SignupChurch[]>([]);
  const [language, setLanguage] = useState<"ne" | "en">("ne");
  const [highContrast, setHighContrast] = useState(false);
  const [textScaleOverride, setTextScaleOverride] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const formattedPhone = useMemo(() => phone.replace(/\D/g, "").slice(0, 10), [phone]);
  const recommendedTextScale = recommendedScale(dateOfBirth);
  const textScale = textScaleOverride ?? recommendedTextScale;

  function restorePreview() {
    const storedProfile = parseStoredValue<PreviewProfile>(PROFILE_STORAGE_KEY);
    if (storedProfile) {
      setPreviewAccess({ method: storedProfile.method, identifier: storedProfile.identifier });
      setAccessMethod(storedProfile.method);
      setFullName(storedProfile.fullName);
      setDateOfBirth(storedProfile.dateOfBirth);
      setLanguage(storedProfile.language);
      setHighContrast(storedProfile.highContrast);
      setTextScaleOverride(storedProfile.textScaleOverride ?? null);
      setScreen(screenFromHash("complete"));
      return;
    }

    const storedAccess = parseStoredValue<PreviewAccess>(ACCESS_STORAGE_KEY);
    if (storedAccess) {
      setPreviewAccess(storedAccess);
      setAccessMethod(storedAccess.method);
      setScreen("profile");
    }
  }

  async function hydrateAuthenticatedUser(user: User) {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const [profileResult, privateResult, platformRoleResult] = await Promise.all([
      client.from("profiles").select("full_name, preferred_language").eq("id", user.id).maybeSingle(),
      client.from("profile_private").select("phone, date_of_birth, permanent_address, temporary_address, gender, high_contrast, text_scale_override").eq("id", user.id).maybeSingle(),
      client.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);

    const profile = profileResult.data;
    const privateProfile = privateResult.data;
    setIsAuthenticated(true);
    setAuthenticatedUserId(user.id);
    setAuthenticatedEmail(user.email ?? "सुरक्षित इमेल खाता");
    setIsSuperAdmin(platformRoleResult.data?.role === "super_admin");
    setPreviewAccess(null);
    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    setFullName(profile?.full_name || (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "Church App सदस्य"));
    setDateOfBirth(privateProfile?.date_of_birth ?? "");
    setPhone(privateProfile?.phone?.replace(/^\+977/, "") ?? "");
    setGender(privateProfile?.gender ?? "");
    setPermanentAddress(privateProfile?.permanent_address ?? "");
    setTemporaryAddress(privateProfile?.temporary_address ?? "");
    setSameAsPermanent(Boolean(privateProfile?.permanent_address && privateProfile?.permanent_address === privateProfile?.temporary_address));
    setLanguage(profile?.preferred_language === "en" ? "en" : "ne");
    setHighContrast(privateProfile?.high_contrast ?? false);
    setTextScaleOverride(privateProfile?.text_scale_override ?? null);
    await Promise.all([loadMemberships(user.id), refreshPreparationPostingAccess()]);
    setScreen(screenFromHash("home"));
  }

  async function refreshPreparationPostingAccess() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setCanPostPreparations(false);
      return;
    }
    const { data, error } = await client.rpc("can_post_preparations");
    setCanPostPreparations(!error && data === true);
  }

  async function loadMemberships(userId = authenticatedUserId) {
    const client = getSupabaseBrowserClient();
    if (!client || !userId) {
      setMemberships([]);
      setCanPostPreparations(false);
      setMembershipsLoading(false);
      return;
    }

    setMembershipsLoading(true);
    const { data: membershipRows, error: membershipError } = await client
      .from("memberships")
      .select("id, church_id, role, status, joined_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });

    if (membershipError || !membershipRows?.length) {
      setMemberships([]);
      setCanPostPreparations(false);
      setMembershipsLoading(false);
      return;
    }

    const churchIds = [...new Set(membershipRows.map((membership) => membership.church_id))];
    const { data: churchRows } = await client.from("churches").select("id, name, name_ne, address").in("id", churchIds);
    const churchById = new Map((churchRows ?? []).map((church) => [church.id, church]));
    const nextMemberships = membershipRows.flatMap((membership): AccountMembership[] => {
      const church = churchById.get(membership.church_id);
      if (!church) return [];
      const role: AccountMembership["role"] = membership.role === "owner" || membership.role === "admin" || membership.role === "leader" ? membership.role : "member";
      return [{
        id: membership.id,
        churchId: membership.church_id,
        churchName: church.name,
        churchNameNe: church.name_ne,
        address: church.address,
        role,
        status: membership.status,
        joinedAt: membership.joined_at,
      }];
    });
    setMemberships(nextMemberships);
    setMembershipsLoading(false);
  }

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();

    if (!client) {
      const fallbackTimer = window.setTimeout(() => {
        if (!active) return;
        restorePreview();
        setSessionLoading(false);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(fallbackTimer);
      };
    }

    void client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session?.user) await hydrateAuthenticatedUser(data.session.user);
      else restorePreview();
      if (active) setSessionLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
        window.setTimeout(() => { if (active) void hydrateAuthenticatedUser(session.user); }, 0);
      }
      if (event === "SIGNED_OUT") {
        setIsAuthenticated(false);
        setAuthenticatedUserId(null);
        setAuthenticatedEmail("");
        setIsSuperAdmin(false);
        setCanPostPreparations(false);
        setMemberships([]);
        setMembershipsLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  // The stable Supabase singleton owns subsequent session changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.rpc("list_joinable_churches").then(({ data }) => {
      if (active) setSignupChurches((data ?? []) as SignupChurch[]);
    });
    return () => { active = false; };
  }, []);

  async function submitAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    const normalizedEmail = gmail.trim().toLowerCase();

    if (!client) {
      setNotice({ tone: "error", text: "Supabase जडान उपलब्ध छैन। .env.local को public URL र publishable key जाँच्नुहोस्।" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setNotice({ tone: "error", text: "कृपया सही इमेल ठेगाना लेख्नुहोस्।" });
      return;
    }
    if (authPassword.length < 8) {
      setNotice({ tone: "error", text: "सुरक्षित पासवर्ड कम्तीमा ८ अक्षरको हुनुपर्छ।" });
      return;
    }
    if (authMode === "signup" && fullName.trim().length < 2) {
      setNotice({ tone: "error", text: "खाता बनाउन आफ्नो पूरा नाम लेख्नुहोस्।" });
      return;
    }
    if (authMode === "signup" && (!dateOfBirth || new Date(`${dateOfBirth}T00:00:00`) >= new Date())) {
      setNotice({ tone: "error", text: "खाता बनाउन सही जन्ममिति छान्नुहोस्।" });
      return;
    }
    if (authMode === "signup" && !/^(97|98)\d{8}$/.test(formattedPhone)) {
      setNotice({ tone: "error", text: "९७ वा ९८ बाट सुरु हुने १० अङ्कको नेपाली मोबाइल नम्बर लेख्नुहोस्।" });
      return;
    }
    if (authMode === "signup" && !["female", "male", "other", "prefer_not_to_say"].includes(gender)) {
      setNotice({ tone: "error", text: "कृपया लिङ्गसम्बन्धी विकल्प छान्नुहोस्।" });
      return;
    }
    if (authMode === "signup" && permanentAddress.trim().length < 3) {
      setNotice({ tone: "error", text: "कृपया स्थायी ठेगाना लेख्नुहोस्।" });
      return;
    }
    if (authMode === "signup" && !sameAsPermanent && temporaryAddress.trim().length < 3) {
      setNotice({ tone: "error", text: "कृपया हाल बसोबास गर्ने अस्थायी ठेगाना लेख्नुहोस्।" });
      return;
    }
    if (authMode === "signup" && authPassword !== authPasswordConfirm) {
      setNotice({ tone: "error", text: "दुवै पासवर्ड मिलेनन्।" });
      return;
    }

    setAuthBusy(true);
    setNotice(null);
    try {
      if (authMode === "signin") {
        const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password: authPassword });
        if (error) throw error;
        if (data.user) await hydrateAuthenticatedUser(data.user);
      } else {
        const { data, error } = await client.auth.signUp({
          email: normalizedEmail,
          password: authPassword,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: `+977${formattedPhone}`,
              date_of_birth: dateOfBirth,
              gender,
              permanent_address: permanentAddress.trim(),
              temporary_address: sameAsPermanent ? permanentAddress.trim() : temporaryAddress.trim(),
              church_id: signupChurchId === "" ? null : String(signupChurchId),
            },
          },
        });
        if (error) throw error;
        if (data.session?.user) {
          await hydrateAuthenticatedUser(data.session.user);
        } else {
          setAuthMode("signin");
          setAuthPassword("");
          setAuthPasswordConfirm("");
          setNotice({ tone: "success", text: "खाता तयार भयो। Supabase ले इमेल पुष्टि मागेको छ भने inbox को सुरक्षित पुष्टि लिंक खोलेर यहाँ पासवर्डसहित प्रवेश गर्नुहोस्।" });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      setNotice({
        tone: "error",
        text: message.includes("invalid login credentials")
          ? "इमेल वा पासवर्ड मिलेन। फेरि जाँच्नुहोस्।"
          : message.includes("email not confirmed")
            ? "पहिले inbox मा आएको Supabase पुष्टि लिंक खोल्नुहोस्।"
            : "सुरक्षित प्रवेश पूरा भएन। विवरण जाँचेर फेरि प्रयास गर्नुहोस्।",
      });
    } finally {
      setAuthBusy(false);
    }
  }

  function selectAccessMethod(method: AccessMethod) {
    setAccessMethod(method);
    setNotice(null);
  }

  function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let access: PreviewAccess;

    if (accessMethod === "phone") {
      if (!/^(97|98)\d{8}$/.test(formattedPhone)) {
        setNotice({ tone: "error", text: "कृपया ९७ वा ९८ बाट सुरु हुने १० अङ्कको नेपाली मोबाइल नम्बर लेख्नुहोस्।" });
        return;
      }
      access = { method: "phone", identifier: `+977 ${formattedPhone}` };
    } else {
      const normalizedGmail = gmail.trim().toLowerCase();
      if (!/^[^\s@]+@gmail\.com$/i.test(normalizedGmail)) {
        setNotice({ tone: "error", text: "कृपया सही Gmail ठेगाना लेख्नुहोस् (उदाहरण: name@gmail.com)।" });
        return;
      }
      access = { method: "gmail", identifier: normalizedGmail };
    }

    window.localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(access));
    setPreviewAccess(access);
    setNotice(null);
    setScreen("profile");
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      setNotice({ tone: "error", text: "कृपया आफ्नो पूरा नाम लेख्नुहोस्।" });
      return;
    }
    if (!dateOfBirth || new Date(`${dateOfBirth}T00:00:00`) >= new Date()) {
      setNotice({ tone: "error", text: "कृपया सही जन्ममिति छान्नुहोस्।" });
      return;
    }
    if (!previewAccess) {
      setScreen("access");
      setNotice({ tone: "error", text: "कृपया फेरि फोन वा Gmail बाट प्रवेश गर्नुहोस्।" });
      return;
    }

    const profile: PreviewProfile = {
      ...previewAccess,
      fullName: fullName.trim(),
      dateOfBirth,
      language,
      highContrast,
      textScaleOverride,
    };
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    setFullName(profile.fullName);
    setNotice(null);
    setScreen("complete");
  }

  function clearPreview() {
    LOCAL_PREVIEW_KEYS.forEach((key) => window.localStorage.removeItem(key));
    setPreviewAccess(null);
    setFullName("");
    setDateOfBirth("");
    setGender("");
    setPermanentAddress("");
    setTemporaryAddress("");
    setSameAsPermanent(true);
    setSignupChurchId("");
    setLanguage("ne");
    setHighContrast(false);
    setTextScaleOverride(null);
    setPhone("");
    setGmail("");
    setNotice(null);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setScreen("welcome");
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) {
      setNotice({ tone: "error", text: "अहिले खाता बन्द गर्न सकिएन। फेरि प्रयास गर्नुहोस्।" });
      return;
    }
    setIsAuthenticated(false);
    setAuthenticatedUserId(null);
    setAuthenticatedEmail("");
    setIsSuperAdmin(false);
    setCanPostPreparations(false);
    setMemberships([]);
    setMembershipsLoading(false);
    setFullName("");
    setDateOfBirth("");
    setLanguage("ne");
    setHighContrast(false);
    setTextScaleOverride(null);
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setNotice({ tone: "success", text: "सुरक्षित खाताबाट बाहिरिनुभयो।" });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setScreen("access");
    setAccessExperience("secure");
  }

  function updateStoredProfile(updates: Partial<PreviewProfile>) {
    const storedProfile = parseStoredValue<PreviewProfile>(PROFILE_STORAGE_KEY);
    if (storedProfile) window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...storedProfile, ...updates }));
  }

  async function persistAuthenticatedLanguage(nextLanguage: "ne" | "en") {
    const client = getSupabaseBrowserClient();
    if (!client || !authenticatedUserId) return;
    setSettingsSyncState("saving");
    const { error } = await client.from("profiles").update({ preferred_language: nextLanguage }).eq("id", authenticatedUserId);
    setSettingsSyncState(error ? "error" : "saved");
  }

  async function persistAuthenticatedPrivateSettings(updates: { high_contrast?: boolean; text_scale_override?: number | null }) {
    const client = getSupabaseBrowserClient();
    if (!client || !authenticatedUserId) return;
    setSettingsSyncState("saving");
    const { error } = await client.from("profile_private").update(updates).eq("id", authenticatedUserId);
    setSettingsSyncState(error ? "error" : "saved");
  }

  function changeLanguage(nextLanguage: "ne" | "en") {
    setLanguage(nextLanguage);
    if (isAuthenticated) void persistAuthenticatedLanguage(nextLanguage);
    else updateStoredProfile({ language: nextLanguage });
  }

  function changeHighContrast(enabled: boolean) {
    setHighContrast(enabled);
    if (isAuthenticated) void persistAuthenticatedPrivateSettings({ high_contrast: enabled });
    else updateStoredProfile({ highContrast: enabled });
  }

  function changeTextScale(scale: number | null) {
    const normalizedScale = scale === null ? null : Math.min(1.3, Math.max(0.9, scale));
    setTextScaleOverride(normalizedScale);
    if (isAuthenticated) void persistAuthenticatedPrivateSettings({ text_scale_override: normalizedScale });
    else updateStoredProfile({ textScaleOverride: normalizedScale });
  }

  function goBack() {
    setNotice(null);
    setScreen("welcome");
  }

  function navigateDashboard(nextScreen: DashboardScreen) {
    if (nextScreen === "bible") {
      if (!window.location.hash.startsWith("#bible/")) window.history.replaceState(null, "", "#bible/JHN/3");
    } else if (nextScreen === "songs") {
      if (!window.location.hash.startsWith("#songs")) window.history.replaceState(null, "", "#songs");
    } else if (nextScreen === "service") {
      if (!window.location.hash.startsWith("#service/")) window.history.replaceState(null, "", "#schedule");
    } else if (nextScreen === "more") {
      window.history.replaceState(null, "", "#more");
      if (isAuthenticated) void refreshPreparationPostingAccess();
    } else if (nextScreen === "admin") {
      if (!window.location.hash.startsWith("#admin")) window.history.replaceState(null, "", "#admin");
    } else if (nextScreen === "members") {
      if (!window.location.hash.startsWith("#members")) window.history.replaceState(null, "", "#members");
    } else if (nextScreen === "membership") {
      if (!window.location.hash.startsWith("#membership")) window.history.replaceState(null, "", "#membership");
    } else if (nextScreen === "assignments") {
      if (!window.location.hash.startsWith("#assignments")) window.history.replaceState(null, "", "#assignments");
    } else if (nextScreen === "preparations") {
      if (!window.location.hash.startsWith("#preparations")) window.history.replaceState(null, "", "#preparations");
    } else if (nextScreen === "recaps") {
      if (!window.location.hash.startsWith("#recaps")) window.history.replaceState(null, "", "#recaps");
    } else if (nextScreen === "attendance") {
      if (!window.location.hash.startsWith("#attendance")) window.history.replaceState(null, "", "#attendance");
    } else if (nextScreen === "notifications") {
      if (!window.location.hash.startsWith("#notifications")) window.history.replaceState(null, "", "#notifications");
    } else if (nextScreen === "schedule") {
      if (!window.location.hash.startsWith("#schedule")) window.history.replaceState(null, "", "#schedule");
    } else if (window.location.hash.startsWith("#bible/") || window.location.hash.startsWith("#songs") || window.location.hash.startsWith("#service/") || window.location.hash.startsWith("#admin") || window.location.hash.startsWith("#membership") || window.location.hash.startsWith("#members") || window.location.hash.startsWith("#assignments") || window.location.hash.startsWith("#preparations") || window.location.hash.startsWith("#recaps") || window.location.hash.startsWith("#attendance") || window.location.hash.startsWith("#notifications") || window.location.hash.startsWith("#schedule") || window.location.hash === "#more") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setScreen(nextScreen);
  }

  const shellStyle = { "--app-text-scale": textScale } as CSSProperties;
  const dashboardScreens: DashboardScreen[] = ["home", "schedule", "detail", "service", "notifications", "bible", "songs", "more", "membership", "admin", "members", "assignments", "preparations", "recaps", "attendance"];

  if (sessionLoading) {
    return (
      <main className="app-shell">
        <section className="phone-shell auth-session-loading" aria-live="polite">
          <ChurchMark />
          <strong>सुरक्षित सत्र जाँच्दै…</strong>
          <span>Church App</span>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className={`phone-shell${highContrast ? " high-contrast" : ""}`} style={shellStyle} aria-live="polite">
        {screen === "welcome" && (
          <div className="welcome-screen screen-enter">
            <header className="welcome-header">
              <ChurchMark />
              <p className="eyebrow">नेपाली मण्डलीको डिजिटल घर</p>
              <h1>Church App</h1>
              <p className="welcome-copy">सँगै जोडिऔँ, वचनमा बढौँ र प्रेमले सेवा गरौँ।</p>
            </header>
            <CommunityScene />
            <div className="welcome-actions">
              <button className="primary-button" type="button" onClick={() => setScreen("access")}>
                सुरु गर्नुहोस् <span aria-hidden="true">→</span>
              </button>
              <p>तपाईंको चर्च परिवार, सधैँ नजिक।</p>
            </div>
          </div>
        )}

        {screen === "access" && (
          <div className="auth-screen screen-enter">
            <button className="back-button" type="button" onClick={goBack} aria-label="पछाडि जानुहोस्">
              <span aria-hidden="true">←</span> पछाडि
            </button>
            <div className="auth-brand"><ChurchMark compact /><span>Church App</span></div>
            <div className="auth-experience-switch" role="group" aria-label="प्रवेशको प्रकार">
              <button type="button" className={accessExperience === "secure" ? "selected" : ""} onClick={() => { setAccessExperience("secure"); setNotice(null); }}>सुरक्षित खाता</button>
              <button type="button" className={accessExperience === "preview" ? "selected" : ""} onClick={() => { setAccessExperience("preview"); setNotice(null); }}>पूर्वावलोकन मात्र</button>
            </div>

            {accessExperience === "secure" ? (
              <form className="auth-form" onSubmit={submitAuthentication} noValidate>
                <div className="auth-heading">
                  <p className="eyebrow">Supabase सुरक्षित खाता</p>
                  <h1>{authMode === "signin" ? "आफ्नो खातामा प्रवेश गर्नुहोस्" : "नयाँ सुरक्षित खाता बनाउनुहोस्"}</h1>
                  <p>इमेल र पासवर्ड Supabase Auth ले सुरक्षित रूपमा जाँच गर्छ। फोन प्रवेशका लागि भविष्यमा OTP प्रदायक चाहिन्छ।</p>
                </div>

                <div className="auth-mode-tabs" role="tablist" aria-label="खाता प्रवेश वा दर्ता">
                  <button type="button" role="tab" aria-selected={authMode === "signin"} className={authMode === "signin" ? "selected" : ""} onClick={() => { setAuthMode("signin"); setNotice(null); }}>प्रवेश</button>
                  <button type="button" role="tab" aria-selected={authMode === "signup"} className={authMode === "signup" ? "selected" : ""} onClick={() => { setAuthMode("signup"); setNotice(null); }}>नयाँ खाता</button>
                </div>

                {authMode === "signup" && (
                  <>
                    <label htmlFor="auth-full-name">पूरा नाम</label>
                    <input className="profile-input" id="auth-full-name" autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); setNotice(null); }} placeholder="जस्तै: सारा तामाङ" />

                    <div className="signup-field-grid">
                      <label htmlFor="auth-birth-date">जन्ममिति<input className="profile-input" id="auth-birth-date" type="date" value={dateOfBirth} onChange={(event) => { setDateOfBirth(event.target.value); setNotice(null); }} max={new Date().toISOString().slice(0, 10)} /></label>
                      <label htmlFor="auth-gender">लिङ्ग<select className="profile-input" id="auth-gender" value={gender} onChange={(event) => { setGender(event.target.value); setNotice(null); }}><option value="">छान्नुहोस्…</option><option value="female">महिला</option><option value="male">पुरुष</option><option value="other">अन्य</option><option value="prefer_not_to_say">भन्न नचाहने</option></select></label>
                    </div>

                    <label htmlFor="auth-phone">मोबाइल नम्बर</label>
                    <div className="phone-input-wrap signup-phone-input"><span className="country-code"><b>🇳🇵</b> +977</span><input id="auth-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={formattedPhone} onChange={(event) => { setPhone(event.target.value); setNotice(null); }} placeholder="98XXXXXXXX" /></div>

                    <label htmlFor="auth-permanent-address">स्थायी ठेगाना</label>
                    <textarea className="profile-input signup-address-input" id="auth-permanent-address" rows={2} maxLength={500} autoComplete="street-address" value={permanentAddress} onChange={(event) => { setPermanentAddress(event.target.value); setNotice(null); }} placeholder="प्रदेश, जिल्ला, पालिका, वडा र टोल" />

                    <label className="same-address-row"><input type="checkbox" checked={sameAsPermanent} onChange={(event) => { setSameAsPermanent(event.target.checked); setNotice(null); }} /><span><strong>हालको ठेगाना स्थायी ठेगानासँग उही छ</strong><small>फरक भएमा तल अस्थायी ठेगाना लेख्नुहोस्।</small></span></label>

                    {!sameAsPermanent && <><label htmlFor="auth-temporary-address">अस्थायी / हालको ठेगाना</label><textarea className="profile-input signup-address-input" id="auth-temporary-address" rows={2} maxLength={500} autoComplete="street-address" value={temporaryAddress} onChange={(event) => { setTemporaryAddress(event.target.value); setNotice(null); }} placeholder="अहिले बसोबास गर्ने पूरा ठेगाना" /></>}

                    <label htmlFor="auth-church">आफ्नो मण्डली (ऐच्छिक)</label>
                    <select className="profile-input" id="auth-church" value={signupChurchId} onChange={(event) => { setSignupChurchId(event.target.value ? Number(event.target.value) : ""); setNotice(null); }}><option value="">पछि छान्छु</option>{signupChurches.map((church) => <option key={church.church_id} value={church.church_id}>{church.church_name_ne || church.church_name}{church.address ? ` — ${church.address}` : ""}</option>)}</select>
                    <p className="field-help">मण्डली छानेमा सदस्यता अनुरोध प्रशासककहाँ जान्छ। स्वीकृत नहुँदासम्म तपाईं सामान्य खातामै रहनुहुन्छ।</p>
                  </>
                )}

                <label htmlFor="auth-email">इमेल ठेगाना</label>
                <input className="profile-input" id="auth-email" name="email" type="email" inputMode="email" autoComplete="email" value={gmail} onChange={(event) => { setGmail(event.target.value); setNotice(null); }} placeholder="name@gmail.com" />

                <label htmlFor="auth-password">पासवर्ड</label>
                <input className="profile-input" id="auth-password" name="password" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={8} value={authPassword} onChange={(event) => { setAuthPassword(event.target.value); setNotice(null); }} placeholder="कम्तीमा ८ अक्षर" />

                {authMode === "signup" && (
                  <>
                    <label htmlFor="auth-password-confirm">पासवर्ड फेरि लेख्नुहोस्</label>
                    <input className="profile-input" id="auth-password-confirm" type="password" autoComplete="new-password" minLength={8} value={authPasswordConfirm} onChange={(event) => { setAuthPasswordConfirm(event.target.value); setNotice(null); }} placeholder="उही पासवर्ड" />
                  </>
                )}

                {notice && <NoticeBox notice={notice} />}
                <button className="primary-button" type="submit" disabled={authBusy}>
                  {authBusy ? "सुरक्षित जाँच हुँदैछ…" : authMode === "signin" ? "सुरक्षित प्रवेश गर्नुहोस्" : "खाता बनाउनुहोस्"} <span aria-hidden="true">→</span>
                </button>
                <p className="secure-auth-help">नयाँ खातामा परियोजनाको सेटिङअनुसार inbox मा एकपटक पुष्टि लिंक आउन सक्छ; कुनै SMS शुल्क लाग्दैन।</p>
              </form>
            ) : (
              <form className="auth-form" onSubmit={submitAccess} noValidate>
                <div className="auth-heading">
                  <p className="eyebrow">अस्थायी प्रवेश</p>
                  <h1>फोन वा Gmail बाट नमुना हेर्नुहोस्</h1>
                  <p>यो विकल्प केवल यस उपकरणमा पूर्वावलोकन चलाउनका लागि हो।</p>
                </div>

                <div className="preview-notice" role="note">
                  <span aria-hidden="true">ⓘ</span>
                  <p><strong>प्रमाणित खाता होइन</strong> फोन वा Gmail जाँचिँदैन, र जानकारी Supabase मा पठाइँदैन। सदस्य वा नेता अधिकार यसबाट खुल्दैन।</p>
                </div>

                <fieldset className="access-fieldset">
                  <legend>पूर्वावलोकनको तरिका</legend>
                  <div className="segmented-control">
                    <button type="button" className={accessMethod === "phone" ? "selected" : ""} onClick={() => selectAccessMethod("phone")}>मोबाइल नम्बर</button>
                    <button type="button" className={accessMethod === "gmail" ? "selected" : ""} onClick={() => selectAccessMethod("gmail")}>Gmail</button>
                  </div>
                </fieldset>

                {accessMethod === "phone" ? (
                  <>
                    <label htmlFor="phone">मोबाइल नम्बर</label>
                    <div className="phone-input-wrap">
                      <span className="country-code"><b>🇳🇵</b> +977</span>
                      <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={formattedPhone} onChange={(event) => { setPhone(event.target.value); setNotice(null); }} placeholder="98XXXXXXXX" aria-describedby="phone-help" />
                    </div>
                    <p className="field-help" id="phone-help">OTP बिना यो नम्बर वास्तविक पहिचान होइन।</p>
                  </>
                ) : (
                  <>
                    <label htmlFor="gmail">Gmail ठेगाना</label>
                    <input className="profile-input access-email-input" id="gmail" name="gmail" type="email" inputMode="email" autoComplete="email" value={gmail} onChange={(event) => { setGmail(event.target.value); setNotice(null); }} placeholder="name@gmail.com" aria-describedby="gmail-help" />
                    <p className="field-help access-email-help" id="gmail-help">पासवर्ड वा इमेल जाँच नभएको पूर्वावलोकन मात्र।</p>
                  </>
                )}

                {notice && <NoticeBox notice={notice} />}
                <button className="primary-button" type="submit">पूर्वावलोकन खोल्नुहोस् <span aria-hidden="true">→</span></button>
              </form>
            )}
            <footer className="auth-footer">सुरक्षित खाता Supabase Auth र Row Level Security द्वारा सुरक्षित छ।</footer>
          </div>
        )}

        {screen === "profile" && (
          <div className="profile-screen screen-enter">
            <div className="profile-topbar">
              <div className="auth-brand"><ChurchMark compact /><span>Church App</span></div>
              <span className="step-pill">चरण २ / २</span>
            </div>
            <form className="profile-form" onSubmit={submitProfile} noValidate>
              <div className="auth-heading">
                <p className="eyebrow">तपाईंको परिचय</p>
                <h1>स्वागतका लागि केही जानकारी</h1>
                <p>{previewAccess?.identifier} बाट अस्थायी प्रवेश गरिएको छ। यी विवरण यस उपकरणको पूर्वावलोकनमा मात्र राखिनेछन्।</p>
              </div>
              {notice && <NoticeBox notice={notice} />}

              <label htmlFor="full-name">पूरा नाम</label>
              <input className="profile-input" id="full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="जस्तै: सारा तामाङ" />

              <label htmlFor="birth-date">जन्ममिति</label>
              <input className="profile-input" id="birth-date" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} max={new Date().toISOString().slice(0, 10)} />
              <p className="field-help profile-help">जन्ममितिअनुसार अक्षरको आकार स्वतः सहज बनाइन्छ। अहिलेको सुझाव: {Math.round(textScale * 100)}%</p>

              <fieldset className="language-fieldset">
                <legend>मुख्य भाषा</legend>
                <div className="segmented-control">
                  <button type="button" className={language === "ne" ? "selected" : ""} onClick={() => setLanguage("ne")}>नेपाली</button>
                  <button type="button" className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>English</button>
                </div>
              </fieldset>

              <label className="toggle-row">
                <span><strong>उच्च कन्ट्रास्ट</strong><small>अक्षर र बटन अझ स्पष्ट देखाउनुहोस्</small></span>
                <input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} />
              </label>

              <button className="primary-button" type="submit">पूर्वावलोकन प्रोफाइल पूरा गर्नुहोस्</button>
            </form>
          </div>
        )}

        {screen === "complete" && (
          <div className="complete-screen screen-enter">
            <div className="success-mark" aria-hidden="true">✓</div>
            <p className="eyebrow">पूर्वावलोकन तयार भयो</p>
            <h1>स्वागत छ{fullName ? `, ${fullName.split(" ")[0]}` : ""}!</h1>
            <p>तपाईंको अस्थायी प्रोफाइल यस उपकरणमा तयार छ। नेपाली बाइबल, आराधना गीत र मण्डलीका सुविधा अर्को ब्याचमा जोडिँदै जानेछन्।</p>
            <div className="ready-card preview-ready-card">
              <span aria-hidden="true">🛡️</span>
              <div><strong>Supabase सुरक्षित नै छ</strong><small>यो पूर्वावलोकनले वास्तविक खाता बनाउँदैन र सुरक्षित डेटाबेस सामग्रीमा पहुँच दिँदैन।</small></div>
            </div>
            <button className="primary-button" type="button" onClick={() => setScreen("home")}>ड्यासबोर्ड खोल्नुहोस् <span aria-hidden="true">→</span></button>
            <button className="text-button" type="button" onClick={clearPreview}>स्थानीय पूर्वावलोकन हटाउनुहोस्</button>
          </div>
        )}

        {dashboardScreens.includes(screen as DashboardScreen) && (
          <ChurchDashboard
            screen={screen as DashboardScreen}
            name={fullName}
            settingsProfile={{
              name: fullName,
              identifier: isAuthenticated ? authenticatedEmail : previewAccess?.identifier ?? "स्थानीय पूर्वावलोकन",
              accessMethod: isAuthenticated ? "email" : previewAccess?.method ?? "phone",
              isAuthenticated,
              membershipCount: memberships.length,
              churchName: memberships[0]?.churchNameNe || memberships[0]?.churchName || null,
              membershipRole: memberships[0]?.role ?? null,
              isSuperAdmin,
              canPostPreparations: canPostPreparations || memberships.some((membership) => membership.role === "owner" || membership.role === "admin" || membership.role === "leader"),
              language,
              highContrast,
              textScale,
              recommendedTextScale,
            }}
            onNavigate={navigateDashboard}
            authenticatedUserId={authenticatedUserId}
            isSuperAdmin={isSuperAdmin}
            memberships={memberships}
            membershipsLoading={membershipsLoading}
            onRefreshMemberships={() => loadMemberships(authenticatedUserId)}
            onShowProfile={() => isAuthenticated ? navigateDashboard("more") : (window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`), setScreen("complete"))}
            onLanguageChange={changeLanguage}
            onHighContrastChange={changeHighContrast}
            onTextScaleChange={changeTextScale}
            settingsSyncState={settingsSyncState}
            onSignOut={() => { void signOut(); }}
            onClearPreview={clearPreview}
          />
        )}
      </section>
    </main>
  );
}

function NoticeBox({ notice }: { notice: NonNullable<Notice> }) {
  return <p className={`form-message form-message--${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>;
}
