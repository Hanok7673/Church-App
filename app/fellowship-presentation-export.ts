import type PptxGenJS from "pptxgenjs";

export type FellowshipPresentationItem = {
  id: number;
  kind: "song" | "scripture";
  section: string;
  label: string;
  title: string;
  lyrics?: string;
  scriptureText?: string[];
  reference?: string;
};

export type FellowshipPresentationInput = {
  fellowshipTitle: string;
  startsAt: string;
  sermonTopic: string;
  preacherName: string;
  items: FellowshipPresentationItem[];
};

type BackgroundAsset = {
  key: string;
  pageUrl: string;
  imageUrl: string;
  credit: string;
  fallback: string;
};

const BACKGROUNDS: BackgroundAsset[] = [
  {
    key: "worship",
    pageUrl: "https://unsplash.com/photos/silhouette-of-a-person-raising-hands-towards-the-stage-LMnfrGANEoM",
    imageUrl: "https://images.unsplash.com/photo-1428992992979-aaeb02b6960c?auto=format&fit=crop&fm=jpg&q=82&w=1920",
    credit: "Melissa Askew · Unsplash",
    fallback: "163B50",
  },
  {
    key: "word",
    pageUrl: "https://unsplash.com/photos/an-open-book-illuminated-by-warm-light-XoC3KhKTVuo",
    imageUrl: "https://images.unsplash.com/photo-1746385129996-ac3fc19cc2ed?auto=format&fit=crop&fm=jpg&q=82&w=1920",
    credit: "kristina juicesho · Unsplash",
    fallback: "4B3525",
  },
  {
    key: "scripture",
    pageUrl: "https://unsplash.com/photos/opened-bible-sqyQNuOUl8g",
    imageUrl: "https://images.unsplash.com/photo-1537806817607-45d08e8291bc?auto=format&fit=crop&fm=jpg&q=82&w=1920",
    credit: "wisconsinpictures · Unsplash",
    fallback: "283635",
  },
  {
    key: "peace",
    pageUrl: "https://unsplash.com/photos/tranquil-lake-reflecting-mountains-and-trees-under-clear-sky-98nNRJRvsIY",
    imageUrl: "https://images.unsplash.com/photo-1755611532271-4ac09b51f2bc?auto=format&fit=crop&fm=jpg&q=82&w=1920",
    credit: "Pascal Debrunner · Unsplash",
    fallback: "244B59",
  },
];

const WORSHIP_WORDS = ["आराधना", "महिमा", "स्तुति", "प्रशंसा", "जय", "worship", "praise", "glory"];
const WORD_WORDS = ["वचन", "बाइबल", "सत्य", "ज्योति", "word", "bible", "truth", "light"];
const PEACE_WORDS = ["शान्ति", "शांति", "आशा", "विश्राम", "विश्वास", "peace", "hope", "rest", "faith"];

function themeForText(text: string, kind: FellowshipPresentationItem["kind"]) {
  const normalized = text.toLocaleLowerCase();
  if (PEACE_WORDS.some((word) => normalized.includes(word.toLocaleLowerCase()))) return BACKGROUNDS[3];
  if (WORD_WORDS.some((word) => normalized.includes(word.toLocaleLowerCase()))) return BACKGROUNDS[1];
  if (WORSHIP_WORDS.some((word) => normalized.includes(word.toLocaleLowerCase()))) return BACKGROUNDS[0];
  return kind === "scripture" ? BACKGROUNDS[2] : BACKGROUNDS[0];
}

function cleanLyrics(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\[([A-G][^\]\n]{0,47})\]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function chunkLines(lines: string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];
  let characterCount = 0;
  for (const line of lines) {
    const nextCount = characterCount + line.length;
    if (current.length > 0 && (current.length >= 4 || nextCount > 210)) {
      chunks.push(current);
      current = [];
      characterCount = 0;
    }
    current.push(line);
    characterCount += line.length;
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [[" "]];
}

function chunkScripture(lines: string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];
  let characterCount = 0;
  for (const line of lines) {
    const nextCount = characterCount + line.length;
    if (current.length > 0 && (current.length >= 2 || nextCount > 330)) {
      chunks.push(current);
      current = [];
      characterCount = 0;
    }
    current.push(line);
    characterCount += line.length;
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [[" "]];
}

function bodyFontSize(text: string, kind: FellowshipPresentationItem["kind"]) {
  if (kind === "song") return text.length > 180 ? 32 : text.length > 120 ? 36 : 40;
  return text.length > 320 ? 26 : text.length > 230 ? 30 : text.length > 150 ? 34 : 38;
}

async function imageDataUrl(url: string) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function safeFileName(value: string) {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim();
  return `${cleaned || "fellowship-program"}.pptx`;
}

function formatPresentationDate(value: string) {
  return new Intl.DateTimeFormat("ne-NP", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export async function generateFellowshipPowerPoint(
  input: FellowshipPresentationInput,
  onProgress?: (message: string) => void,
) {
  onProgress?.("पृष्ठभूमि तयार हुँदैछ…");
  const pptxModule = await import("pptxgenjs");
  const pptx = new pptxModule.default();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Church App";
  pptx.company = "Church App";
  pptx.subject = input.sermonTopic || input.fellowshipTitle;
  pptx.title = input.fellowshipTitle;
  pptx.theme = {
    headFontFace: "Nirmala UI",
    bodyFontFace: "Nirmala UI",
  };

  const usedAssets = Array.from(new Set([
    themeForText(`${input.fellowshipTitle} ${input.sermonTopic}`, "scripture"),
    ...input.items.map((item) => themeForText(`${item.title} ${item.lyrics ?? ""} ${(item.scriptureText ?? []).join(" ")}`, item.kind)),
  ]));
  const imageCache = new Map<string, string | null>();
  await Promise.all(usedAssets.map(async (asset) => imageCache.set(asset.key, await imageDataUrl(asset.imageUrl))));

  const applyBackground = (slide: PptxGenJS.Slide, asset: BackgroundAsset, overlayTransparency = 42) => {
    const data = imageCache.get(asset.key);
    slide.background = { color: asset.fallback };
    if (data) slide.addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5 });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, line: { color: "000000", transparency: 100 }, fill: { color: "071619", transparency: overlayTransparency } });
    slide.addText(asset.credit, { x: 0.48, y: 7.13, w: 4.2, h: 0.18, fontFace: "Aptos", fontSize: 9, color: "E8F0EE", transparency: 20, margin: 0, breakLine: false });
    slide.addNotes(`[Sources]\n- ${asset.pageUrl} (background image; ${asset.credit}; Unsplash License)\n[/Sources]`);
  };

  const addHeader = (slide: PptxGenJS.Slide, eyebrow: string, title: string) => {
    slide.addText(eyebrow, { x: 0.72, y: 0.42, w: 8.8, h: 0.28, fontFace: "Nirmala UI", fontSize: 17, bold: true, color: "D6B978", charSpacing: 1.2, margin: 0, breakLine: false });
    slide.addText(title, { x: 0.72, y: 0.84, w: 11.9, h: 0.72, fontFace: "Nirmala UI", fontSize: 46, bold: true, color: "FFFFFF", margin: 0, breakLine: false, fit: "shrink" });
    slide.addShape(pptx.ShapeType.line, { x: 0.72, y: 1.68, w: 1.1, h: 0, line: { color: "D6B978", width: 3 } });
  };

  const coverAsset = themeForText(`${input.fellowshipTitle} ${input.sermonTopic}`, "scripture");
  const cover = pptx.addSlide();
  applyBackground(cover, coverAsset, 34);
  cover.addText(input.fellowshipTitle, { x: 0.85, y: 1.55, w: 11.6, h: 1.1, fontFace: "Nirmala UI", fontSize: 54, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, fit: "shrink" });
  if (input.sermonTopic) cover.addText(input.sermonTopic, { x: 1.5, y: 3.02, w: 10.33, h: 0.82, fontFace: "Nirmala UI", fontSize: 36, bold: false, color: "FFF4D6", align: "center", valign: "middle", margin: 0, fit: "shrink" });
  cover.addShape(pptx.ShapeType.line, { x: 5.71, y: 4.18, w: 1.9, h: 0, line: { color: "D6B978", width: 3 } });
  cover.addText([formatPresentationDate(input.startsAt), input.preacherName ? `वचन सेवक: ${input.preacherName}` : ""].filter(Boolean).join("  ·  "), { x: 1.1, y: 4.55, w: 11.13, h: 0.52, fontFace: "Nirmala UI", fontSize: 22, color: "F3F6F5", align: "center", margin: 0, fit: "shrink" });

  let slideNumber = 1;
  for (const item of input.items) {
    const asset = themeForText(`${item.title} ${item.lyrics ?? ""} ${(item.scriptureText ?? []).join(" ")}`, item.kind);
    const pages = item.kind === "song" ? chunkLines(cleanLyrics(item.lyrics ?? "")) : chunkScripture(item.scriptureText ?? []);
    for (const [pageIndex, pageLines] of pages.entries()) {
      const slide = pptx.addSlide();
      applyBackground(slide, asset, item.kind === "song" ? 44 : 49);
      const eyebrow = item.kind === "song" ? item.label : item.reference || item.label;
      addHeader(slide, pageIndex === 0 ? eyebrow : `${eyebrow} · जारी`, item.title);
      const body = pageLines.join("\n");
      slide.addText(body, {
        x: 0.9,
        y: 2.05,
        w: 11.53,
        h: 4.2,
        fontFace: "Nirmala UI",
        fontSize: bodyFontSize(body, item.kind),
        bold: item.kind === "song",
        color: "FFFFFF",
        align: item.kind === "song" ? "center" : "left",
        valign: "middle",
        breakLine: false,
        fit: "shrink",
        margin: item.kind === "song" ? 0.12 : 0.2,
        lineSpacingMultiple: item.kind === "song" ? 1.15 : 1.08,
        paraSpaceAfter: item.kind === "song" ? 11 : 15,
        shadow: { type: "outer", color: "000000", blur: 2, angle: 45, offset: 1, opacity: 0.4 },
      });
      slide.addText(String(slideNumber), { x: 12.35, y: 7.05, w: 0.42, h: 0.22, fontFace: "Aptos", fontSize: 10, color: "E8F0EE", align: "right", margin: 0 });
      slideNumber += 1;
    }
  }

  const closing = pptx.addSlide();
  applyBackground(closing, BACKGROUNDS[3], 38);
  closing.addText(input.sermonTopic || "परमेश्वरको वचनमा स्थिर रहौँ", { x: 1.1, y: 2.15, w: 11.13, h: 1.15, fontFace: "Nirmala UI", fontSize: 52, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, fit: "shrink" });
  closing.addText("सुनेको वचनलाई जीवनमा लागू गरौँ", { x: 1.6, y: 3.75, w: 10.13, h: 0.75, fontFace: "Nirmala UI", fontSize: 34, color: "FFF4D6", align: "center", margin: 0, fit: "shrink" });

  onProgress?.("PowerPoint फाइल बनाउँदैछ…");
  await pptx.writeFile({ fileName: safeFileName(`${input.fellowshipTitle} - projector`), compression: true });
  onProgress?.("PowerPoint डाउनलोड भयो।");
}
