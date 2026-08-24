"use client";

import { useEffect, useMemo, useState } from "react";

type BibleBookSummary = {
  id: string;
  name: string;
  longName: string;
  order: number;
  testament: "old" | "new";
  chapters: number;
};

type BibleIndex = {
  translation: {
    id: string;
    name: string;
    shortName: string;
    copyright: string;
    license: string;
    source: string;
    formatNote: string;
  };
  books: BibleBookSummary[];
  stats: { books: number; chapters: number; verses: number };
};

type Verse = { number: string; text: string };
type BibleBook = { book: BibleBookSummary; chapters: Record<string, Verse[]> };
type Bookmark = { bookId: string; bookName: string; chapter: number; verse: string };
type SearchResult = { chapter: number; verse: string; text: string };

const BOOKMARK_STORAGE_KEY = "church-app-preview-bible-bookmarks-v1";

function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    return stored ? JSON.parse(stored) as Bookmark[] : [];
  } catch {
    return [];
  }
}

function BibleMark() {
  return (
    <span className="dashboard-church-mark" aria-hidden="true">
      <i className="dashboard-church-cross" />
      <i className="dashboard-church-roof" />
    </span>
  );
}

export function BibleReader({ onHome, onSchedule, onSongs, onMore }: {
  onHome: () => void;
  onSchedule: () => void;
  onSongs: () => void;
  onMore: () => void;
}) {
  const [index, setIndex] = useState<BibleIndex | null>(null);
  const [bookId, setBookId] = useState("JHN");
  const [bookData, setBookData] = useState<BibleBook | null>(null);
  const [chapter, setChapter] = useState(3);
  const [fontScale, setFontScale] = useState(1);
  const [query, setQuery] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);
  const [targetVerse, setTargetVerse] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const match = window.location.hash.match(/^#bible\/([A-Z0-9]{3})\/(\d+)(?:\/([^/]+))?$/);
    if (match) {
      setBookId(match[1]);
      setChapter(Number(match[2]));
      setTargetVerse(match[3] ?? "");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/bible/npiulb/index.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Bible index unavailable");
        return response.json() as Promise<BibleIndex>;
      })
      .then(setIndex)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setError("नेपाली बाइबल सूची खोल्न सकिएन।");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/bible/npiulb/${bookId}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Bible book unavailable");
        return response.json() as Promise<BibleBook>;
      })
      .then((data) => {
        setBookData(data);
        setChapter((current) => Math.min(Math.max(current, 1), data.book.chapters));
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError("यो पुस्तक अहिले खोल्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [bookId]);

  useEffect(() => {
    if (!loading && targetVerse) {
      window.setTimeout(() => document.getElementById(`bible-verse-${targetVerse}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
  }, [loading, targetVerse, chapter, bookId]);

  const verses = bookData?.chapters[String(chapter)] ?? [];
  const selectedBook = index?.books.find((book) => book.id === bookId);
  const normalizedQuery = query.trim().toLocaleLowerCase("ne");
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!bookData || normalizedQuery.length < 2) return [];
    const results: SearchResult[] = [];
    for (const [chapterNumber, chapterVerses] of Object.entries(bookData.chapters)) {
      for (const verse of chapterVerses) {
        if (verse.text.toLocaleLowerCase("ne").includes(normalizedQuery)) {
          results.push({ chapter: Number(chapterNumber), verse: verse.number, text: verse.text });
          if (results.length >= 40) return results;
        }
      }
    }
    return results;
  }, [bookData, normalizedQuery]);

  function chooseBook(nextBookId: string) {
    setBookId(nextBookId);
    setChapter(1);
    setQuery("");
    setNotice("");
    setTargetVerse("");
    window.history.replaceState(null, "", `#bible/${nextBookId}/1`);
  }

  function changeChapter(nextChapter: number) {
    if (!bookData) return;
    setChapter(Math.min(Math.max(nextChapter, 1), bookData.book.chapters));
    setQuery("");
    setNotice("");
    setTargetVerse("");
    window.history.replaceState(null, "", `#bible/${bookId}/${Math.min(Math.max(nextChapter, 1), bookData.book.chapters)}`);
  }

  function toggleBookmark(verse: Verse) {
    if (!bookData) return;
    const exists = bookmarks.some((bookmark) => bookmark.bookId === bookId && bookmark.chapter === chapter && bookmark.verse === verse.number);
    const next = exists
      ? bookmarks.filter((bookmark) => !(bookmark.bookId === bookId && bookmark.chapter === chapter && bookmark.verse === verse.number))
      : [...bookmarks, { bookId, bookName: bookData.book.name, chapter, verse: verse.number }];
    setBookmarks(next);
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(next));
    setNotice(exists ? "यस उपकरणबाट बुकमार्क हटाइयो।" : "यस उपकरणमा बुकमार्क राखियो।");
    window.setTimeout(() => setNotice(""), 2200);
  }

  function isBookmarked(verse: Verse) {
    return bookmarks.some((bookmark) => bookmark.bookId === bookId && bookmark.chapter === chapter && bookmark.verse === verse.number);
  }

  async function copyVerseLink(verse: Verse) {
    const link = new URL(window.location.href);
    link.hash = `bible/${bookId}/${chapter}/${verse.number}`;
    window.history.replaceState(null, "", link.hash);
    setTargetVerse(verse.number);
    try {
      await navigator.clipboard.writeText(link.toString());
      setNotice(`${bookData?.book.name} ${chapter}:${verse.number} को लिङ्क प्रतिलिपि भयो।`);
    } catch {
      setNotice(`सन्दर्भ लिङ्क तयार भयो: ${bookData?.book.name} ${chapter}:${verse.number}`);
    }
    window.setTimeout(() => setNotice(""), 2400);
  }

  return (
    <div className="app-screen screen-enter">
      <header className="detail-header bible-header">
        <button className="icon-button" type="button" onClick={onHome} aria-label="होममा फर्कनुहोस्">←</button>
        <div className="dashboard-brand"><BibleMark /><span>नेपाली बाइबल</span></div>
        <span className="header-spacer" />
      </header>

      <div className="app-scroll bible-content">
        <section className="bible-intro">
          <div><span className="demo-tag">पूर्ण ६६ पुस्तक</span><h1>पवित्र बाइबल</h1><p>नेपाली अनलक्क्ड लिटरल बाइबल</p></div>
          <span className="bible-intro-mark" aria-hidden="true">✦</span>
        </section>

        <div className="bible-source-note" role="note"><span aria-hidden="true">✓</span><p><strong>खुला अनुमतिप्राप्त पाठ</strong> Door43 World Missions Community · CC BY-SA 4.0</p></div>

        <section className="bible-controls" aria-label="पुस्तक र अध्याय छान्नुहोस्">
          <label htmlFor="bible-book">पुस्तक</label>
          <select id="bible-book" value={bookId} onChange={(event) => chooseBook(event.target.value)} disabled={!index}>
            <optgroup label="पुरानो करार">
              {index?.books.filter((book) => book.testament === "old").map((book) => <option value={book.id} key={book.id}>{book.name}</option>)}
            </optgroup>
            <optgroup label="नयाँ करार">
              {index?.books.filter((book) => book.testament === "new").map((book) => <option value={book.id} key={book.id}>{book.name}</option>)}
            </optgroup>
          </select>

          <div className="chapter-control-row">
            <button type="button" onClick={() => changeChapter(chapter - 1)} disabled={chapter <= 1} aria-label="अघिल्लो अध्याय">‹</button>
            <label htmlFor="bible-chapter">अध्याय
              <select id="bible-chapter" value={chapter} onChange={(event) => changeChapter(Number(event.target.value))} disabled={!bookData}>
                {Array.from({ length: selectedBook?.chapters ?? bookData?.book.chapters ?? 0 }, (_, indexValue) => indexValue + 1).map((chapterNumber) => <option value={chapterNumber} key={chapterNumber}>{chapterNumber}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => changeChapter(chapter + 1)} disabled={!bookData || chapter >= bookData.book.chapters} aria-label="अर्को अध्याय">›</button>
          </div>
        </section>

        <section className="bible-search" aria-labelledby="bible-search-heading">
          <div className="bible-search-title"><div><p className="eyebrow">यस पुस्तकमा</p><h2 id="bible-search-heading">शब्द खोज्नुहोस्</h2></div><span aria-hidden="true">⌕</span></div>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="जस्तै: प्रेम, विश्वास, अनुग्रह" aria-label="बाइबलमा शब्द खोज्नुहोस्" />
          {normalizedQuery.length >= 2 && (
            <div className="bible-search-results">
              <p>{searchResults.length ? `${searchResults.length}${searchResults.length === 40 ? "+" : ""} नतिजा` : "नतिजा भेटिएन"}</p>
              {searchResults.slice(0, 8).map((result) => (
                <button type="button" key={`${result.chapter}-${result.verse}`} onClick={() => { setChapter(result.chapter); setTargetVerse(result.verse); setQuery(""); window.history.replaceState(null, "", `#bible/${bookId}/${result.chapter}/${result.verse}`); }}>
                  <strong>{bookData?.book.name} {result.chapter}:{result.verse}</strong><span>{result.text}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="reader-toolbar" aria-label="पढ्ने अक्षरको आकार">
          <div><p className="eyebrow">पढाइ</p><h2>{bookData?.book.name ?? "पुस्तक"} {chapter}</h2></div>
          <div><button type="button" onClick={() => setFontScale((value) => Math.max(0.9, value - 0.1))} aria-label="अक्षर सानो बनाउनुहोस्">अ−</button><span>{Math.round(fontScale * 100)}%</span><button type="button" onClick={() => setFontScale((value) => Math.min(1.4, value + 0.1))} aria-label="अक्षर ठूलो बनाउनुहोस्">अ+</button></div>
        </section>

        {error && <p className="form-message form-message--error bible-error" role="alert">{error}</p>}
        {loading && <div className="bible-loading" role="status"><span /><span /><span /><p>पाठ खोलिँदैछ…</p></div>}
        {!loading && !error && (
          <article className="scripture-reader" style={{ "--reader-scale": fontScale } as React.CSSProperties} aria-label={`${bookData?.book.name} अध्याय ${chapter}`}>
            {verses.map((verse) => (
              <div id={`bible-verse-${verse.number}`} className={`scripture-verse${isBookmarked(verse) ? " scripture-verse--bookmarked" : ""}${targetVerse === verse.number ? " scripture-verse--linked" : ""}`} key={verse.number}>
                <sup>{verse.number}</sup><p>{verse.text}</p>
                <span className="verse-actions">
                  <button type="button" onClick={() => toggleBookmark(verse)} aria-label={`${bookData?.book.name} ${chapter}:${verse.number} ${isBookmarked(verse) ? "बुकमार्क हटाउनुहोस्" : "बुकमार्क गर्नुहोस्"}`} title="यस उपकरणमा बुकमार्क">
                    <span aria-hidden="true">{isBookmarked(verse) ? "★" : "☆"}</span>
                  </button>
                  <button type="button" onClick={() => void copyVerseLink(verse)} aria-label={`${bookData?.book.name} ${chapter}:${verse.number} को लिङ्क प्रतिलिपि गर्नुहोस्`} title="सन्दर्भ लिङ्क प्रतिलिपि"><span aria-hidden="true">↗</span></button>
                </span>
              </div>
            ))}
          </article>
        )}

        <div className="chapter-footer-nav">
          <button type="button" onClick={() => changeChapter(chapter - 1)} disabled={chapter <= 1}>← अघिल्लो</button>
          <span>{bookData?.book.name} {chapter}</span>
          <button type="button" onClick={() => changeChapter(chapter + 1)} disabled={!bookData || chapter >= bookData.book.chapters}>अर्को →</button>
        </div>

        <footer className="bible-attribution">
          <strong>{index?.translation.copyright ?? "Copyright © 2019 Door43 World Missions Community"}</strong>
          <p>USFM पाठलाई पढ्न मिल्ने JSON ढाँचामा रूपान्तरण गरिएको हो; धर्मशास्त्रको शब्दावली परिवर्तन गर्ने उद्देश्य छैन।</p>
          <div><a href="https://ebible.org/Bible/details.php?id=npiulb" target="_blank" rel="noreferrer">मूल स्रोत</a><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></div>
        </footer>
      </div>

      <nav className="bottom-nav" aria-label="मुख्य नेभिगेसन">
        <button type="button" onClick={onHome}><span aria-hidden="true">⌂</span><small>होम</small></button>
        <button type="button" onClick={onSchedule}><span aria-hidden="true">▣</span><small>तालिका</small></button>
        <button type="button" className="active"><span aria-hidden="true">▤</span><small>बाइबल</small></button>
        <button type="button" onClick={onSongs}><span aria-hidden="true">♪</span><small>गीत</small></button>
        <button type="button" onClick={onMore}><span aria-hidden="true">•••</span><small>थप</small></button>
      </nav>
      {notice && <p className="app-toast" role="status">{notice}</p>}
    </div>
  );
}
