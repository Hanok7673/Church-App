"use client";

import { useMemo, useState } from "react";
import type { DashboardScreen } from "./dashboard";

type MemberFilter = "all" | "leaders" | "worship" | "youth" | "children";
type PreviewMember = {
  id: string;
  name: string;
  initials: string;
  role: string;
  fellowship: string;
  area: string;
  ministry: string;
  joined: string;
  categories: Exclude<MemberFilter, "all">[];
  skills: string[];
  availability: string;
  bio: string;
  tone: "teal" | "gold" | "blue" | "rose" | "green";
};

const MEMBER_FILTERS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "सबै" },
  { value: "leaders", label: "अगुवा" },
  { value: "worship", label: "आराधना" },
  { value: "youth", label: "युवा" },
  { value: "children", label: "बाल सेवा" },
];

const PREVIEW_MEMBERS: PreviewMember[] = [
  { id: "sara-tamang", name: "सारा तामाङ", initials: "सा", role: "आराधना टोली", fellowship: "सानेपा घर संगति", area: "सानेपा, ललितपुर", ministry: "स्वर तथा आराधना", joined: "२०७८ देखि", categories: ["worship", "youth"], skills: ["स्वर", "गिटार", "प्रार्थना"], availability: "बुधबार र आइतबार", bio: "युवा आराधना र घर संगतिमा गीत अगुवाइ गर्ने नमुना सदस्य प्रोफाइल।", tone: "gold" },
  { id: "daniel-tamang", name: "दानिएल तामाङ", initials: "दा", role: "घर संगति अगुवा", fellowship: "सानेपा घर संगति", area: "सानेपा, ललितपुर", ministry: "संगति अगुवाइ", joined: "२०७५ देखि", categories: ["leaders"], skills: ["अगुवाइ", "बाइबल अध्ययन", "परामर्श"], availability: "बुधबार साँझ", bio: "सानो समूहलाई वचन, प्रार्थना र आपसी हेरचाहमा अगाडि बढाउने नमुना अगुवा।", tone: "teal" },
  { id: "maria-rai", name: "मरियम राई", initials: "म", role: "प्रार्थना सेवक", fellowship: "पाटन महिला संगति", area: "पाटन, ललितपुर", ministry: "मध्यस्थ प्रार्थना", joined: "२०७७ देखि", categories: ["leaders"], skills: ["प्रार्थना", "भेटघाट", "आतिथ्य"], availability: "मंगलबार र शुक्रबार", bio: "प्रार्थना र सदस्य हेरचाहमा सहयोग गर्ने काल्पनिक पूर्वावलोकन प्रोफाइल।", tone: "rose" },
  { id: "david-kc", name: "दाविद केसी", initials: "दा", role: "वाद्यवादक", fellowship: "कोटेश्वर युवा संगति", area: "कोटेश्वर, काठमाडौँ", ministry: "आराधना संगीत", joined: "२०७९ देखि", categories: ["worship", "youth"], skills: ["किबोर्ड", "बेस गिटार", "ध्वनि"], availability: "शुक्रबार साँझ", bio: "युवा संगतिको आराधना टोलीमा वाद्यवादन गर्ने नमुना सदस्य।", tone: "blue" },
  { id: "prerna-shrestha", name: "प्रेरणा श्रेष्ठ", initials: "प्र", role: "युवा संयोजक", fellowship: "कोटेश्वर युवा संगति", area: "कोटेश्वर, काठमाडौँ", ministry: "युवा सेवा", joined: "२०७६ देखि", categories: ["leaders", "youth"], skills: ["समन्वय", "शिक्षण", "कार्यक्रम"], availability: "शुक्रबार र शनिबार", bio: "युवा कार्यक्रम र चेलापन समूह समन्वय गर्ने काल्पनिक सदस्य प्रोफाइल।", tone: "green" },
  { id: "samuel-lama", name: "शमूएल लामा", initials: "श", role: "मण्डली एल्डर", fellowship: "पाटन संयुक्त संगति", area: "पाटन, ललितपुर", ministry: "आत्मिक निगरानी", joined: "२०७० देखि", categories: ["leaders"], skills: ["वचन", "परामर्श", "नेतृत्व"], availability: "आइतबार र भेटघाटमा", bio: "मण्डलीको आत्मिक हेरचाह र अगुवा विकासमा सेवा गर्ने नमुना प्रोफाइल।", tone: "blue" },
  { id: "esther-gurung", name: "एस्तर गुरुङ", initials: "ए", role: "बाल शिक्षक", fellowship: "मण्डली बाल संगति", area: "जावलाखेल, ललितपुर", ministry: "बाल सेवा", joined: "२०७८ देखि", categories: ["children"], skills: ["कथा", "हस्तकला", "बाल गीत"], availability: "आइतबार बिहान", bio: "बालबालिकालाई उमेरअनुसार बाइबल कथा सिकाउने काल्पनिक सदस्य।", tone: "rose" },
  { id: "joshua-magar", name: "यहोशू मगर", initials: "य", role: "बाल आराधना सहयोगी", fellowship: "मण्डली बाल संगति", area: "लगनखेल, ललितपुर", ministry: "बाल आराधना", joined: "२०८० देखि", categories: ["children", "worship", "youth"], skills: ["गिटार", "खेल", "बाल गीत"], availability: "शनिबार र आइतबार", bio: "बाल गीत र गतिविधिमा सहयोग गर्ने काल्पनिक युवा सदस्य।", tone: "gold" },
  { id: "anita-bk", name: "अनिता वि.क.", initials: "अ", role: "आतिथ्य टोली", fellowship: "सानेपा घर संगति", area: "कुपण्डोल, ललितपुर", ministry: "स्वागत तथा आतिथ्य", joined: "२०७९ देखि", categories: ["youth"], skills: ["स्वागत", "खाना व्यवस्थापन", "भेटघाट"], availability: "बुधबार", bio: "नयाँ सदस्यलाई स्वागत र संगतिमा जोड्न सहयोग गर्ने नमुना प्रोफाइल।", tone: "green" },
  { id: "prakash-shrestha", name: "प्रकाश श्रेष्ठ", initials: "प्र", role: "युवा संगति अगुवा", fellowship: "कोटेश्वर युवा संगति", area: "कोटेश्वर, काठमाडौँ", ministry: "युवा चेलापन", joined: "२०७४ देखि", categories: ["leaders", "youth"], skills: ["अगुवाइ", "मार्गदर्शन", "खेलकुद"], availability: "शुक्रबार साँझ", bio: "युवा चेलापन र साप्ताहिक संगति सञ्चालन गर्ने काल्पनिक अगुवा प्रोफाइल।", tone: "teal" },
  { id: "ruth-maharjan", name: "रूथ महर्जन", initials: "रू", role: "कोरस सदस्य", fellowship: "पाटन संयुक्त संगति", area: "मंगलबजार, ललितपुर", ministry: "कोरस तथा स्वर", joined: "२०७७ देखि", categories: ["worship"], skills: ["स्वर", "कोरस", "गीत अभ्यास"], availability: "शनिबार अभ्यास", bio: "संयुक्त आराधनाको कोरस टोलीमा सेवा गर्ने नमुना सदस्य।", tone: "gold" },
  { id: "timothy-thapa", name: "तिमोथी थापा", initials: "ति", role: "मिडिया सहयोगी", fellowship: "कोटेश्वर युवा संगति", area: "बानेश्वर, काठमाडौँ", ministry: "मिडिया तथा ध्वनि", joined: "२०८० देखि", categories: ["youth", "worship"], skills: ["ध्वनि", "प्रस्तुति", "भिडियो"], availability: "शुक्रबार र आइतबार", bio: "आराधना र कार्यक्रममा ध्वनि तथा प्रस्तुति सहयोग गर्ने काल्पनिक सदस्य।", tone: "blue" },
];

function readSelectedMemberId() {
  if (typeof window === "undefined") return "";
  return window.location.hash.match(/^#members\/([a-z0-9-]+)$/)?.[1] ?? "";
}

export function MemberDirectory({ currentName, onNavigate }: { currentName: string; onNavigate: (screen: DashboardScreen) => void }) {
  const [selectedId, setSelectedId] = useState(readSelectedMemberId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [notice, setNotice] = useState("");
  const selectedMember = PREVIEW_MEMBERS.find((member) => member.id === selectedId);
  const normalizedQuery = query.trim().toLocaleLowerCase("ne");
  const visibleMembers = useMemo(() => PREVIEW_MEMBERS.filter((member) => {
    const filterMatches = filter === "all" || member.categories.includes(filter);
    const searchable = `${member.name} ${member.role} ${member.fellowship} ${member.area} ${member.ministry} ${member.skills.join(" ")}`.toLocaleLowerCase("ne");
    return filterMatches && (!normalizedQuery || searchable.includes(normalizedQuery));
  }), [filter, normalizedQuery]);

  function openMember(member: PreviewMember) {
    setSelectedId(member.id);
    window.history.replaceState(null, "", `#members/${member.id}`);
  }

  function closeMember() {
    setSelectedId("");
    window.history.replaceState(null, "", "#members");
  }

  function showProtected(label: string) {
    setNotice(`${label} वास्तविक प्रमाणीकरणपछि मात्र उपलब्ध हुनेछ।`);
    window.setTimeout(() => setNotice(""), 2500);
  }

  if (selectedMember) {
    return (
      <div className="app-screen screen-enter">
        <header className="detail-header member-detail-header">
          <button className="icon-button" type="button" onClick={closeMember} aria-label="सदस्य सूचीमा फर्कनुहोस्">←</button>
          <div><strong>सदस्य परिचय</strong><small>नमुना प्रोफाइल</small></div>
          <span className="demo-tag">पूर्वावलोकन</span>
        </header>
        <div className="app-scroll member-detail-content">
          <section className={`member-profile-hero member-tone--${selectedMember.tone}`}>
            <span className="member-profile-avatar">{selectedMember.initials}</span>
            <div><span>{selectedMember.role}</span><h1>{selectedMember.name}</h1><p>{selectedMember.fellowship}</p></div>
          </section>

          <div className="member-preview-warning" role="note"><span aria-hidden="true">ⓘ</span><p><strong>यो वास्तविक सदस्य रेकर्ड होइन</strong> नाम र विवरण Church App डिजाइन परीक्षणका लागि तयार गरिएको काल्पनिक नमुना हो।</p></div>

          <section className="member-profile-section" aria-labelledby="member-about-heading"><p className="eyebrow">परिचय</p><h2 id="member-about-heading">सेवा र सहभागिता</h2><p>{selectedMember.bio}</p><div className="member-facts"><span><small>क्षेत्र</small><strong>{selectedMember.area}</strong></span><span><small>सहभागिता</small><strong>{selectedMember.joined}</strong></span><span><small>उपलब्धता</small><strong>{selectedMember.availability}</strong></span></div></section>

          <section className="member-profile-section" aria-labelledby="member-ministry-heading"><p className="eyebrow">सेवकाइ</p><h2 id="member-ministry-heading">{selectedMember.ministry}</h2><div className="member-skill-list">{selectedMember.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>

          <section className="member-protected-actions" aria-labelledby="member-actions-heading"><div><span aria-hidden="true">🔒</span><p><strong id="member-actions-heading">सुरक्षित सदस्य कार्य</strong><small>सम्पर्क विवरण, सम्पादन र भूमिका परिवर्तन अहिले बन्द छन्।</small></p></div><div><button type="button" onClick={() => showProtected("सम्पर्क")}>सम्पर्क</button><button type="button" onClick={() => showProtected("भूमिका व्यवस्थापन")}>भूमिका</button></div></section>
        </div>
        <MemberBottomNav onNavigate={onNavigate} />
        {notice && <p className="app-toast" role="status">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header members-header">
        <button className="icon-button" type="button" onClick={() => onNavigate("more")} aria-label="थपमा फर्कनुहोस्">←</button>
        <div><p className="eyebrow">मण्डली परिवार</p><strong>सदस्य सूची</strong></div>
        <span className="demo-tag">नमुना</span>
      </header>

      <div className="app-scroll members-content">
        <section className="members-intro"><div><span>१२ नमुना सदस्य</span><h1>एक-अर्कालाई चिन्नुहोस्</h1><p>संगति, सेवकाइ र भूमिकाअनुसार सदस्य खोज्न मिल्ने पूर्वावलोकन।</p></div><span aria-hidden="true">◎</span></section>

        <div className="current-preview-member" role="note"><span>{currentName.trim().charAt(0) || "त"}</span><p><small>तपाईंको स्थानीय प्रोफाइल</small><strong>{currentName || "Church App सदस्य"}</strong></p><b>यस उपकरणमा मात्र</b></div>

        <div className="member-preview-warning" role="note"><span aria-hidden="true">ⓘ</span><p><strong>सबै सूची विवरण काल्पनिक नमुना हुन्</strong> वास्तविक Supabase सदस्य डेटा प्रमाणीकरण नभएसम्म बन्द र सुरक्षित छ।</p></div>

        <label className="member-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="नाम, संगति, क्षेत्र वा सेवकाइ खोज्नुहोस्…" aria-label="सदस्य खोज्नुहोस्" /></label>
        <div className="member-filter-tabs" aria-label="सदस्यका समूहहरू">{MEMBER_FILTERS.map((item) => <button type="button" className={filter === item.value ? "selected" : ""} onClick={() => setFilter(item.value)} key={item.value}>{item.label}</button>)}</div>

        <section className="member-list" aria-labelledby="member-list-heading">
          <div className="member-list-heading"><div><p className="eyebrow">{MEMBER_FILTERS.find((item) => item.value === filter)?.label}</p><h2 id="member-list-heading">सदस्यहरू</h2></div><span>{visibleMembers.length} सदस्य</span></div>
          {visibleMembers.length === 0 && <div className="member-empty"><span aria-hidden="true">◎</span><strong>सदस्य भेटिएन</strong><p>अर्को शब्द वा समूह छान्नुहोस्।</p></div>}
          {visibleMembers.map((member) => (
            <button className="member-card" type="button" onClick={() => openMember(member)} key={member.id}>
              <span className={`member-card-avatar member-tone--${member.tone}`}>{member.initials}</span>
              <span className="member-card-copy"><strong>{member.name}</strong><small>{member.role}</small><em>{member.fellowship}</em></span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </section>
      </div>
      <MemberBottomNav onNavigate={onNavigate} />
    </div>
  );
}

function MemberBottomNav({ onNavigate }: { onNavigate: (screen: DashboardScreen) => void }) {
  return <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन"><button type="button" onClick={() => onNavigate("home")}><span aria-hidden="true">⌂</span><small>होम</small></button><button type="button" onClick={() => onNavigate("schedule")}><span aria-hidden="true">▣</span><small>तालिका</small></button><button type="button" onClick={() => onNavigate("bible")}><span aria-hidden="true">▤</span><small>बाइबल</small></button><button type="button" onClick={() => onNavigate("songs")}><span aria-hidden="true">♪</span><small>गीत</small></button><button type="button" className="active" onClick={() => onNavigate("more")}><span aria-hidden="true">•••</span><small>थप</small></button></nav>;
}
