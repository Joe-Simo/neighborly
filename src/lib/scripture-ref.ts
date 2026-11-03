/**
 * Find Bible references like "Hebrews 13:2" or "Matt. 11:28-30" in English text. No AI, no verse text here.
 * Book names must be capitalized and a time like "Mark 10:30 AM" is not a reference.
 */

const BOOKS: [string, string[]][] = [
  ["GEN", ["Genesis", "Gen"]],
  ["EXO", ["Exodus", "Exod", "Ex"]],
  ["LEV", ["Leviticus", "Lev"]],
  ["NUM", ["Numbers", "Num"]],
  ["DEU", ["Deuteronomy", "Deut"]],
  ["JOS", ["Joshua", "Josh"]],
  ["JDG", ["Judges", "Judg"]],
  ["RUT", ["Ruth"]],
  ["1SA", ["1 Samuel", "1 Sam"]],
  ["2SA", ["2 Samuel", "2 Sam"]],
  ["1KI", ["1 Kings", "1 Kgs"]],
  ["2KI", ["2 Kings", "2 Kgs"]],
  ["1CH", ["1 Chronicles", "1 Chron"]],
  ["2CH", ["2 Chronicles", "2 Chron"]],
  ["EZR", ["Ezra"]],
  ["NEH", ["Nehemiah", "Neh"]],
  ["EST", ["Esther", "Esth"]],
  ["JOB", ["Job"]],
  ["PSA", ["Psalms", "Psalm", "Ps", "Psa"]],
  ["PRO", ["Proverbs", "Prov"]],
  ["ECC", ["Ecclesiastes", "Eccl"]],
  ["SNG", ["Song of Solomon", "Song of Songs"]],
  ["ISA", ["Isaiah", "Isa"]],
  ["JER", ["Jeremiah", "Jer"]],
  ["LAM", ["Lamentations", "Lam"]],
  ["EZK", ["Ezekiel", "Ezek"]],
  ["DAN", ["Daniel", "Dan"]],
  ["HOS", ["Hosea", "Hos"]],
  ["JOL", ["Joel"]],
  ["AMO", ["Amos"]],
  ["OBA", ["Obadiah", "Obad"]],
  ["JON", ["Jonah"]],
  ["MIC", ["Micah", "Mic"]],
  ["NAM", ["Nahum", "Nah"]],
  ["HAB", ["Habakkuk", "Hab"]],
  ["ZEP", ["Zephaniah", "Zeph"]],
  ["HAG", ["Haggai", "Hag"]],
  ["ZEC", ["Zechariah", "Zech"]],
  ["MAL", ["Malachi", "Mal"]],
  ["MAT", ["Matthew", "Matt", "Mt"]],
  ["MRK", ["Mark", "Mk"]],
  ["LUK", ["Luke", "Lk"]],
  ["JHN", ["John", "Jn"]],
  ["ACT", ["Acts"]],
  ["ROM", ["Romans", "Rom"]],
  ["1CO", ["1 Corinthians", "1 Cor"]],
  ["2CO", ["2 Corinthians", "2 Cor"]],
  ["GAL", ["Galatians", "Gal"]],
  ["EPH", ["Ephesians", "Eph"]],
  ["PHP", ["Philippians", "Phil"]],
  ["COL", ["Colossians", "Col"]],
  ["1TH", ["1 Thessalonians", "1 Thess"]],
  ["2TH", ["2 Thessalonians", "2 Thess"]],
  ["1TI", ["1 Timothy", "1 Tim"]],
  ["2TI", ["2 Timothy", "2 Tim"]],
  ["TIT", ["Titus"]],
  ["PHM", ["Philemon", "Phlm"]],
  ["HEB", ["Hebrews", "Heb"]],
  ["JAS", ["James", "Jas"]],
  ["1PE", ["1 Peter", "1 Pet"]],
  ["2PE", ["2 Peter", "2 Pet"]],
  ["1JN", ["1 John", "1 Jn"]],
  ["2JN", ["2 John"]],
  ["3JN", ["3 John"]],
  ["JUD", ["Jude"]],
  ["REV", ["Revelation", "Rev"]],
];

const NAME_TO_CODE = new Map<string, string>();
for (const [code, names] of BOOKS) for (const n of names) NAME_TO_CODE.set(n.toLowerCase(), code);

const names = BOOKS.flatMap(([, n]) => n)
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/ /g, "\\s+"));
// An en dash range ("11:28\u201330") is accepted in input; Neighborly never writes one.
const REF_RE = new RegExp(`\\b(${names.join("|")})\\.?\\s+(\\d{1,3}):(\\d{1,3})(?:\\s*[-\\u2013]\\s*(\\d{1,3}))?\\b(?!\\s*[AaPp]\\.?[Mm]\\b)`, "g");

export type ScriptureRef = { code: string; chapter: number; from: number; to: number; raw: string; index: number };

export function findReferences(text: string): ScriptureRef[] {
  const out: ScriptureRef[] = [];
  for (const m of text.matchAll(REF_RE)) {
    const code = NAME_TO_CODE.get(m[1].toLowerCase().replace(/\s+/g, " "));
    if (!code) continue;
    const from = Number(m[3]);
    const to = m[4] ? Number(m[4]) : from;
    if (from < 1 || to < from || to - from > 20) continue;
    out.push({ code, chapter: Number(m[2]), from, to, raw: m[0], index: m.index ?? 0 });
  }
  return out;
}

/** A plain-text label for a reference, with a hyphen for ranges. */
export const refLabel = (bookName: string, r: Pick<ScriptureRef, "chapter" | "from" | "to">) =>
  `${bookName} ${r.chapter}:${r.from}${r.to > r.from ? `-${r.to}` : ""}`;

/**
 * True when a paragraph cites a verse and also seems to quote it, for example `Hebrews 13:2 says "Do not forget..."`.
 * The AI would translate that quote, so Neighborly asks for the reference alone.
 */
export function quotesScripture(text: string): boolean {
  if (findReferences(text).length === 0) return false;
  return /["\u201c\u201d][^"\u201c\u201d]{20,}["\u201c\u201d]/.test(text);
}
