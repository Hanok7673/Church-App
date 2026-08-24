import { readFile } from "node:fs/promises";
import path from "node:path";

const catalogPath = path.resolve("public/songs/church-app-originals.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const errors = [];

if (catalog.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (catalog.language !== "ne") errors.push("catalog language must be ne");
if (catalog.license !== "CC0-1.0") errors.push("demo catalog license must be CC0-1.0");
if (!Array.isArray(catalog.songs) || catalog.songs.length < 6) errors.push("catalog must include at least 6 songs");

const ids = new Set();
const bookNumbers = new Set();
const bibleBooks = new Map();
for (const [index, song] of (catalog.songs ?? []).entries()) {
  const label = `songs[${index}]`;
  for (const field of ["id", "titleNe", "titleRomanized", "category", "key", "timeSignature"]) {
    if (typeof song[field] !== "string" || !song[field].trim()) errors.push(`${label}.${field} is required`);
  }
  if (ids.has(song.id)) errors.push(`${label}.id must be unique`);
  ids.add(song.id);
  if (!['भजन', 'कोरस', 'मौलिक'].includes(song.bookSection)) errors.push(`${label}.bookSection must be भजन, कोरस, or मौलिक`);
  if (!Number.isInteger(song.number) || song.number < 1) errors.push(`${label}.number must be a positive integer`);
  const bookNumber = `${song.bookSection}:${song.number}`;
  if (bookNumbers.has(bookNumber)) errors.push(`${label} duplicates ${bookNumber}`);
  bookNumbers.add(bookNumber);
  if (!Number.isInteger(song.tempo) || song.tempo < 40 || song.tempo > 220) errors.push(`${label}.tempo must be 40–220 BPM`);
  if (!song.bibleReference?.label || !/^[A-Z0-9]{3}\/\d+\/[^/]+$/.test(song.bibleReference?.hash ?? "")) {
    errors.push(`${label}.bibleReference is invalid`);
  } else {
    const [bookId, chapter, verse] = song.bibleReference.hash.split("/");
    if (!bibleBooks.has(bookId)) {
      try {
        bibleBooks.set(bookId, JSON.parse(await readFile(path.resolve(`public/bible/npiulb/${bookId}.json`), "utf8")));
      } catch {
        errors.push(`${label}.bibleReference book ${bookId} does not exist`);
      }
    }
    const referencedBook = bibleBooks.get(bookId);
    if (referencedBook && !referencedBook.chapters?.[chapter]?.some((item) => item.number === verse)) errors.push(`${label}.bibleReference ${song.bibleReference.hash} does not exist`);
  }
  if (!Array.isArray(song.sections) || song.sections.length < 2) errors.push(`${label}.sections must include at least 2 sections`);
  for (const [sectionIndex, section] of (song.sections ?? []).entries()) {
    if (!section.label || !["verse", "chorus", "bridge"].includes(section.kind)) errors.push(`${label}.sections[${sectionIndex}] has invalid metadata`);
    if (!Array.isArray(section.lines) || section.lines.length < 2 || section.lines.some((line) => typeof line.lyrics !== "string" || !line.lyrics.trim())) errors.push(`${label}.sections[${sectionIndex}].lines is invalid`);
  }
}

if (errors.length) {
  console.error(`Song catalog validation failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  const sectionCount = catalog.songs.reduce((total, song) => total + song.sections.length, 0);
  const lineCount = catalog.songs.reduce((total, song) => total + song.sections.reduce((sum, section) => sum + section.lines.length, 0), 0);
  console.log(`Song catalog valid: ${catalog.songs.length} songs, ${sectionCount} sections, ${lineCount} lyric lines, ${catalog.license}.`);
}
