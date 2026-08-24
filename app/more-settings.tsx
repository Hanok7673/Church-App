"use client";

import { useState } from "react";
import type { DashboardScreen } from "./dashboard";

export type SettingsProfile = {
  name: string;
  identifier: string;
  accessMethod: "phone" | "gmail" | "email";
  isAuthenticated: boolean;
  membershipCount: number;
  churchName: string | null;
  membershipRole: "owner" | "admin" | "leader" | "member" | null;
  isSuperAdmin: boolean;
  canPostPreparations: boolean;
  language: "ne" | "en";
  highContrast: boolean;
  textScale: number;
  recommendedTextScale: number;
};

export function MoreSettings({ profile, settingsSyncState, onNavigate, onLanguageChange, onHighContrastChange, onTextScaleChange, onSignOut, onClearPreview }: {
  profile: SettingsProfile;
  settingsSyncState: "idle" | "saving" | "saved" | "error";
  onNavigate: (screen: DashboardScreen) => void;
  onLanguageChange: (language: "ne" | "en") => void;
  onHighContrastChange: (enabled: boolean) => void;
  onTextScaleChange: (scale: number | null) => void;
  onSignOut: () => void;
  onClearPreview: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const initial = profile.name.trim().charAt(0) || "स";
  const scaleOptions = [0.9, 1, 1.1, 1.2, 1.3];

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header more-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("home")} aria-label="होममा फर्कनुहोस्">←</button>
        <div><p className="eyebrow">प्राथमिकता र गोपनीयता</p><strong>थप</strong></div>
        <span className="header-spacer" />
      </header>

      <div className="app-scroll more-content">
        <section className="settings-profile-card" aria-labelledby="settings-profile-name">
          <span className="settings-avatar" aria-hidden="true">{initial}</span>
          <div><p>{profile.isAuthenticated ? "Supabase सुरक्षित प्रोफाइल" : "स्थानीय पूर्वावलोकन प्रोफाइल"}</p><h1 id="settings-profile-name">{profile.name || "Church App सदस्य"}</h1><small>{profile.identifier}</small></div>
          <span className={`preview-status-pill${profile.isAuthenticated ? " authenticated" : ""}`}>{profile.isAuthenticated ? "सुरक्षित" : "अस्थायी"}</span>
        </section>

        <div className={`settings-security-note${profile.isAuthenticated ? " authenticated" : ""}`} role="note"><span aria-hidden="true">{profile.isAuthenticated ? "✓" : "⌾"}</span><p><strong>{profile.isAuthenticated ? "सुरक्षित इमेल खाता सक्रिय छ" : "यो पूर्वावलोकन प्रमाणित खाता होइन"}</strong>{profile.isAuthenticated ? " सत्र Supabase Auth ले प्रमाणित गरेको छ र प्रोफाइल प्राथमिकता RLS मार्फत तपाईंको खातामा मात्र लेखिन्छ।" : " फोन वा Gmail जाँचिएको छैन। प्रोफाइल र प्राथमिकता यस उपकरणमा मात्र राखिन्छन्।"}</p></div>

        {profile.isAuthenticated && (
          <p className={`settings-sync-status ${settingsSyncState}`} role="status">
            {settingsSyncState === "saving" ? "Supabase मा सुरक्षित गर्दै…" : settingsSyncState === "error" ? "प्राथमिकता सुरक्षित भएन—फेरि छनोट गर्नुहोस्।" : settingsSyncState === "saved" ? "प्राथमिकता Supabase मा सुरक्षित भयो।" : "प्राथमिकता यो सुरक्षित खातासँग जोडिएको छ।"}
          </p>
        )}

        <section className="settings-section" aria-labelledby="display-settings-heading">
          <div className="settings-section-heading"><span aria-hidden="true">Aa</span><div><p>पहुँचयोग्यता</p><h2 id="display-settings-heading">पढ्ने र देख्ने तरिका</h2></div></div>

          <div className="settings-control-block">
            <div className="settings-control-title"><span><strong>अक्षरको आकार</strong><small>सम्पूर्ण एपमा लागू हुन्छ</small></span><b>{Math.round(profile.textScale * 100)}%</b></div>
            <div className="text-scale-options" aria-label="अक्षरको आकार">
              {scaleOptions.map((scale) => <button type="button" className={Math.abs(profile.textScale - scale) < 0.01 ? "selected" : ""} onClick={() => onTextScaleChange(scale)} key={scale}>{Math.round(scale * 100)}%</button>)}
            </div>
            <button className="settings-reset-link" type="button" onClick={() => onTextScaleChange(null)}>उमेरअनुसार सुझावमा फर्काउनुहोस् ({Math.round(profile.recommendedTextScale * 100)}%)</button>
          </div>

          <label className="settings-toggle-row">
            <span><strong>उच्च कन्ट्रास्ट</strong><small>अक्षर, रेखा र बटन अझ स्पष्ट बनाउनुहोस्</small></span>
            <input type="checkbox" checked={profile.highContrast} onChange={(event) => onHighContrastChange(event.target.checked)} />
          </label>
        </section>

        <section className="settings-section" aria-labelledby="language-settings-heading">
          <div className="settings-section-heading"><span aria-hidden="true">अ</span><div><p>भाषा</p><h2 id="language-settings-heading">मुख्य भाषा प्राथमिकता</h2></div></div>
          <div className="settings-language-options" role="group" aria-label="मुख्य भाषा">
            <button type="button" className={profile.language === "ne" ? "selected" : ""} onClick={() => onLanguageChange("ne")}><strong>नेपाली</strong><small>प्राथमिक सामग्री</small></button>
            <button type="button" className={profile.language === "en" ? "selected" : ""} onClick={() => onLanguageChange("en")}><strong>English</strong><small>Preference</small></button>
          </div>
          <p className="settings-help">उपलब्ध बाइबल र गीतको मूल भाषा परिवर्तन हुँदैन। पूर्ण English interface भविष्यको अनुवाद ब्याचमा आउनेछ।</p>
        </section>

        <section className="settings-section" aria-labelledby="data-settings-heading">
          <div className="settings-section-heading"><span aria-hidden="true">▣</span><div><p>डेटा र सुरक्षा</p><h2 id="data-settings-heading">कहाँ के सुरक्षित हुन्छ?</h2></div></div>
          <div className="data-location-list">
            <div><span aria-hidden="true">{profile.isAuthenticated ? "🔒" : "◉"}</span><p><strong>{profile.isAuthenticated ? "Supabase मा निजी" : "यस उपकरणमा"}</strong><small>{profile.isAuthenticated ? "नाम, भाषा, जन्ममिति, कन्ट्रास्ट र अक्षर आकार—तपाईंको RLS-protected row मा" : "प्रोफाइल, भाषा, अक्षर आकार, मनपर्ने गीत र बाइबल बुकमार्क"}</small></p></div>
            <div><span aria-hidden="true">☁</span><p><strong>Supabase बाट पढ्ने मात्र</strong><small>१,९६८ अनुमतिप्राप्त प्रकाशित आराधना गीत</small></p></div>
            <div><span aria-hidden="true">🔒</span><p><strong>सदस्यता नजोडिउञ्जेल बन्द</strong><small>वास्तविक सदस्य, मण्डली, भूमिका, उपस्थिति र प्रकाशित पुनरावलोकन डेटा</small></p></div>
          </div>
        </section>

        <button className="member-directory-entry church-membership-entry" type="button" onClick={() => onNavigate("membership")}>
          <span aria-hidden="true">⌂</span>
          <span><small>{profile.isAuthenticated ? "Supabase सुरक्षित सदस्यता" : "सुरक्षित खाता आवश्यक"}</small><strong>{profile.churchName || "मेरो मण्डली जोड्नुहोस्"}</strong><em>{profile.membershipCount > 0 ? `${profile.membershipRole === "owner" ? "मालिक" : profile.membershipRole === "admin" ? "प्रशासक" : profile.membershipRole === "leader" ? "अगुवा" : "सदस्य"} · ${profile.membershipCount} सक्रिय सदस्यता` : "निमन्त्रणा कोड वा नयाँ मण्डली"}</em></span>
          <b aria-hidden="true">›</b>
        </button>

        {(profile.isSuperAdmin || profile.membershipRole === "owner" || profile.membershipRole === "admin") && (
          <button className="member-directory-entry admin-panel-entry" type="button" onClick={() => onNavigate("admin")}>
            <span aria-hidden="true">⚙</span>
            <span><small>{profile.isSuperAdmin ? "प्लेटफर्म सुपर एडमिन" : "मण्डली प्रशासन"}</small><strong>प्रशासन प्यानल खोल्नुहोस्</strong><em>{profile.isSuperAdmin ? "मण्डलीहरू, अवस्था र प्लेटफर्म निरीक्षण" : "निमन्त्रणा, सदस्य र फेलोशिप व्यवस्थापन"}</em></span>
            <b aria-hidden="true">›</b>
          </button>
        )}

        <button className="member-directory-entry" type="button" onClick={() => onNavigate("members")}>
          <span aria-hidden="true">◎</span>
          <span><small>नयाँ पूर्वावलोकन सुविधा</small><strong>सदस्य सूची खोल्नुहोस्</strong><em>१२ काल्पनिक सदस्य · खोज र समूह फिल्टर</em></span>
          <b aria-hidden="true">›</b>
        </button>

        <button className="member-directory-entry assignment-directory-entry" type="button" onClick={() => onNavigate("assignments")}>
          <span aria-hidden="true">◖</span>
          <span><small>मेरो सेवकाइ</small><strong>भूमिका र जिम्मेवारी</strong><em>आउने तालिका · स्थानीय तयारी सूची</em></span>
          <b aria-hidden="true">›</b>
        </button>

        {profile.canPostPreparations && <button className="member-directory-entry preparation-directory-entry" type="button" onClick={() => onNavigate("preparations")}>
          <span aria-hidden="true">✎</span>
          <span><small>जिम्मेवारी वा नेतृत्व अधिकार सक्रिय</small><strong>तयारी पठाउनुहोस्</strong><em>तोकिएको फेलोशिप · प्रशासक स्वीकृति · मण्डली फिड</em></span>
          <b aria-hidden="true">›</b>
        </button>}

        <button className="member-directory-entry recap-directory-entry" type="button" onClick={() => onNavigate("recaps")}>
          <span aria-hidden="true">✎</span>
          <span><small>संगतिको सम्झना</small><strong>पुनरावलोकन मस्यौदा</strong><em>वचन · गीत · गवाही · प्रार्थना</em></span>
          <b aria-hidden="true">›</b>
        </button>

        {profile.isAuthenticated && profile.membershipCount > 0 && <button className="member-directory-entry attendance-directory-entry" type="button" onClick={() => onNavigate("attendance")}>
          <span aria-hidden="true">✓</span>
          <span><small>निजी सदस्य अभिलेख</small><strong>मेरो उपस्थिति</strong><em>फेलोशिप अनुसार · पढ्ने मात्र · सुरक्षित</em></span>
          <b aria-hidden="true">›</b>
        </button>}

        <section className="settings-section settings-coming-soon" aria-labelledby="protected-features-heading">
          <div className="settings-section-heading"><span aria-hidden="true">⌛</span><div><p>अर्को चरण</p><h2 id="protected-features-heading">{profile.membershipCount > 0 ? "सदस्यताअनुसार वास्तविक डेटा जोड्ने" : profile.isAuthenticated ? "मण्डली सदस्यता र भूमिका जोडिएपछि" : "प्रमाणीकरणपछि खुल्ने सुविधा"}</h2></div></div>
          <div className="coming-feature-grid"><span>भूमिका व्यवस्थापन</span><span>पुनरावलोकन प्रकाशन</span><span>वास्तविक सदस्य डेटा</span><span>सुरक्षित सूचनाहरू</span></div>
        </section>

        {profile.isAuthenticated ? (
          <section className="settings-danger-zone account-signout-zone" aria-labelledby="account-signout-heading">
            <h2 id="account-signout-heading">सुरक्षित खाताबाट बाहिरिनुहोस्</h2>
            <p>यस उपकरणको Supabase सत्र बन्द हुन्छ। तपाईंको सुरक्षित प्रोफाइल डेटाबेसमै रहन्छ र फेरि प्रवेश गर्दा फर्किन्छ।</p>
            <button type="button" onClick={onSignOut}>खाताबाट बाहिरिनुहोस्</button>
          </section>
        ) : (
          <section className="settings-danger-zone" aria-labelledby="local-data-heading">
            <h2 id="local-data-heading">स्थानीय पूर्वावलोकन हटाउनुहोस्</h2>
            <p>यसले यस उपकरणबाट अस्थायी प्रोफाइल, प्राथमिकता, मनपर्ने, बुकमार्क र पुनरावलोकन छनोट हटाउँछ। Supabase को गीत वा बाइबल सामग्री मेटिँदैन।</p>
            {!confirmClear ? <button type="button" onClick={() => setConfirmClear(true)}>स्थानीय डेटा हटाउने विकल्प खोल्नुहोस्</button> : (
              <div className="clear-preview-confirm" role="alert">
                <strong>सबै स्थानीय पूर्वावलोकन डेटा हटाउने?</strong>
                <div><button type="button" onClick={() => setConfirmClear(false)}>रद्द गर्नुहोस्</button><button className="confirm" type="button" onClick={onClearPreview}>हो, हटाउनुहोस्</button></div>
              </div>
            )}
          </section>
        )}
      </div>

      <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन">
        <button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button>
        <button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button>
        <button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button>
        <button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button>
        <button type="button" className="active"><span aria-hidden="true">•••</span><small>थप</small></button>
      </nav>
    </div>
  );
}
