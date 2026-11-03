/**
 * Code checks on a translation. The model is never asked whether it kept the facts; these functions look.
 * Every number, time, date, phone, email, web address and street address in the English is found by regex,
 * then searched for in the translation. Weekday and month names are checked in the English back-translation.
 */

import { findReferences } from "./scripture-ref";

export type FactKind = "verse" | "time" | "date" | "money" | "phone" | "email" | "url" | "address" | "number";

export type Fact = {
  kind: FactKind;
  raw: string;
  index: number;
  /** Digits a translation must still contain, for example ["10","30"] for 10:30 AM. */
  digits: string[];
  time?: { h24: number; h12: number; m: number; meridiem: "am" | "pm" | null };
  date?: { month: number | null; day: number };
};

export type CheckStatus = "ok" | "check" | "missing";

export type FactCheck = { fact: Fact; status: CheckStatus; note: string };

export type ExtraNumber = { value: string; note: string };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const STREET_SUFFIX = "(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Parkway|Pkwy|Place|Pl|Highway|Hwy|Trail|Trl|Circle|Cir)";

/** Turn full-width and Arabic-Indic digits into ASCII so a translation's numbers can be compared. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[\uFF10-\uFF19]/g, (d) => String(d.charCodeAt(0) - 0xff10))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\uFF1A/g, ":");
}

const stripZeros = (s: string) => String(Number(s.replace(/,/g, "")));

function monthIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3);
  return MONTHS.findIndex((m) => m.startsWith(w)) + 1;
}

/** Find the facts a translation must preserve. Earlier kinds mask their text so a phone number is not also read as three numbers. */
export function extractFacts(text: string): Fact[] {
  const facts: Fact[] = [];
  let masked = text;
  const take = (re: RegExp, make: (m: RegExpExecArray) => Omit<Fact, "raw" | "index"> | null) => {
    for (const m of masked.matchAll(re)) {
      const made = make(m as RegExpExecArray);
      if (!made) continue;
      const index = m.index ?? 0;
      facts.push({ ...made, raw: m[0], index });
      masked = masked.slice(0, index) + " ".repeat(m[0].length) + masked.slice(index + m[0].length);
    }
  };

  // Bible references first, so "Hebrews 13:2" is not read as the time 13:02.
  for (const r of findReferences(masked)) {
    facts.push({ kind: "verse", raw: r.raw, index: r.index, digits: [String(r.chapter), String(r.from), ...(r.to > r.from ? [String(r.to)] : [])] });
    masked = masked.slice(0, r.index) + " ".repeat(r.raw.length) + masked.slice(r.index + r.raw.length);
  }
  take(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, () => ({ kind: "email", digits: [] }));
  take(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|church|example|edu|gov|us|io)(?:\/[^\s)]*)?/gi, () => ({ kind: "url", digits: [] }));
  take(/(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b|\b\d{3}-\d{4}\b/g, (m) => ({ kind: "phone", digits: [m[0].replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")] }));
  take(/\$\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g, (m) => ({ kind: "money", digits: [stripZeros(m[1]), ...(m[2] && m[2] !== "00" ? [m[2]] : [])] }));
  take(new RegExp(`\\b\\d{1,6}\\s+(?:[NSEW]\\.?\\s+)?(?:[A-Z][\\w'.]*\\s+){1,4}${STREET_SUFFIX}\\b`, "g"), (m) => ({ kind: "address", digits: [m[0].match(/\d+/)![0]] }));
  // Times: "10:30 AM", "7 PM", "7pm", "10:15", "noon".
  take(/\b(\d{1,2})(?::([0-5]\d))?\s*([ap])(?:\.\s?m\.|\s?m\b)/gi, (m) => time(Number(m[1]), Number(m[2] ?? 0), m[3].toLowerCase() === "a" ? "am" : "pm"));
  take(/\b(\d{1,2}):([0-5]\d)\b/g, (m) => time(Number(m[1]), Number(m[2]), null));
  take(/\bnoon\b/gi, () => time(12, 0, "pm"));
  // Dates: "Nov 15", "November 15th", "15 November", "11/15".
  take(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi"), (m) => ({ kind: "date", digits: [String(Number(m[2]))], date: { month: monthIndex(m[1]), day: Number(m[2]) } }));
  take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, "gi"), (m) => ({ kind: "date", digits: [String(Number(m[1]))], date: { month: monthIndex(m[2]), day: Number(m[1]) } }));
  take(/\b(1[0-2]|0?[1-9])\/([12]\d|3[01]|0?[1-9])(?:\/(\d{2,4}))?\b/g, (m) => ({ kind: "date", digits: [String(Number(m[1])), String(Number(m[2]))], date: { month: Number(m[1]), day: Number(m[2]) } }));
  take(/\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\b/g, (m) => ({ kind: "number", digits: [m[0].includes(".") ? m[0] : stripZeros(m[0])] }));

  return facts.sort((a, b) => a.index - b.index);
}

function time(h: number, m: number, meridiem: "am" | "pm" | null): Omit<Fact, "raw" | "index"> | null {
  if (h > 23 || (meridiem && (h < 1 || h > 12))) return null;
  const h24 = meridiem === "pm" ? (h % 12) + 12 : meridiem === "am" ? h % 12 : h;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { kind: "time", digits: [String(h)], time: { h24, h12, m, meridiem } };
}

const PM_MARKERS = /p\.?\s?m\b|\bpm\b|tarde|noche|soir|aswè|apremidi|apre midi|tối|chiều|下午|晚上|오후|저녁|nachmittags|abends|hapon|gabi|مساء|вечера|дня|wieczorem|po południu|शाम|रात|da noite|da tarde/i;

/** Every standalone number in a text, with thousands separators removed. */
export function numbersIn(text: string): string[] {
  const t = normalizeDigits(text);
  const out: string[] = [];
  for (const m of t.matchAll(/(?<![\d])\d{1,3}(?:[,.\u00a0\u202f]\d{3})+(?![\d])|(?<![\d])\d+(?![\d])/g)) {
    const v = m[0];
    out.push(/[,.\u00a0\u202f]\d{3}$/.test(v) && v.length > 4 ? stripZeros(v.replace(/[,.\u00a0\u202f]/g, "")) : stripZeros(v));
  }
  return out;
}

function findTime(t: string, f: NonNullable<Fact["time"]>): { status: CheckStatus; note: string } {
  const mm = String(f.m).padStart(2, "0");
  const sep = "\\s*(?::|\\.|h|H|点|點|時|시|giờ|ساعة)\\s*";
  const hourRe = (h: number) => new RegExp(`(?<!\\d)0?${h}(?!\\d)`);
  const hm = (h: number) => new RegExp(`(?<!\\d)0?${h}${sep}${mm}(?!\\d)`);
  if (f.m !== 0) {
    if (hm(f.h24).test(t) && f.h24 !== f.h12) return { status: "ok", note: `Found as ${f.h24}:${mm}` };
    if (hm(f.h12).test(t)) {
      if (f.meridiem === "pm" && f.h24 !== f.h12 && !PM_MARKERS.test(t)) return { status: "check", note: `${f.h12}:${mm} found, but no afternoon or evening word. Confirm it still reads PM.` };
      return { status: "ok", note: `Found ${f.h12}:${mm}` };
    }
    return { status: "missing", note: `${f.h12}:${mm} not found in the translation` };
  }
  if (hm(f.h24).test(t) && f.h24 !== f.h12) return { status: "ok", note: `Found as ${f.h24}:00` };
  if (hourRe(f.h12).test(t) || hourRe(f.h24).test(t)) {
    if (f.meridiem === "pm" && f.h24 !== f.h12 && !hourRe(f.h24).test(t) && !PM_MARKERS.test(t)) return { status: "check", note: `Hour ${f.h12} found, but no afternoon or evening word. Confirm it still reads PM.` };
    return { status: "ok", note: `Found hour ${f.h12}` };
  }
  return { status: "missing", note: `The hour ${f.h12} is not in the translation` };
}

/** Check each English fact against one translated block. */
export function checkFacts(source: string, translation: string): { checks: FactCheck[]; extras: ExtraNumber[] } {
  const facts = extractFacts(source);
  const t = normalizeDigits(translation);
  const lower = t.toLowerCase();
  const available = numbersIn(t);
  const checks: FactCheck[] = facts.map((fact) => {
    if (fact.kind === "email" || fact.kind === "url") {
      const ok = lower.includes(fact.raw.toLowerCase().replace(/[.,]$/, ""));
      return { fact, status: ok ? "ok" : "missing", note: ok ? "Kept exactly" : "Must appear exactly as written" };
    }
    if (fact.kind === "phone") {
      const d = fact.digits[0];
      const re = new RegExp(d.split("").join("[\\s().-]*"));
      const ok = re.test(t);
      return { fact, status: ok ? "ok" : "missing", note: ok ? "Same digits" : "Phone digits changed or missing" };
    }
    if (fact.kind === "address") {
      const number = fact.digits[0];
      const name = fact.raw.replace(/^\d+\s+/, "").replace(new RegExp(`\\s+${STREET_SUFFIX}\\.?$`), "").trim();
      const hasNumber = available.includes(stripZeros(number));
      const hasName = new RegExp(`(?<![\\p{L}\\p{N}@.])${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u").test(lower);
      if (hasNumber && hasName) return { fact, status: "ok", note: "Street number and name kept" };
      return { fact, status: "missing", note: !hasNumber ? `Street number ${number} missing` : `Street name "${name}" was changed. Addresses should stay as written.` };
    }
    if (fact.kind === "time" && fact.time) {
      const r = findTime(t, fact.time);
      return { fact, ...r };
    }
    const missing = fact.digits.filter((d) => !available.includes(d.includes(".") ? d : stripZeros(d)) && !t.includes(d));
    if (missing.length === 0 && fact.kind === "verse") return { fact, status: "ok", note: "Chapter and verse numbers kept" };
    if (missing.length === 0) return { fact, status: "ok", note: fact.kind === "date" ? "Day number found. Month and weekday are checked in the back-translation." : "Same number" };
    return { fact, status: "missing", note: `${missing.join(", ")} not found${fact.kind === "date" ? " (the day of the month)" : ""}` };
  });

  const allowed = new Set<string>();
  for (const f of facts) {
    for (const d of f.digits) for (const n of numbersIn(d)) allowed.add(n);
    if (f.time) [f.time.h24, f.time.h12, f.time.m].forEach((n) => allowed.add(String(n)));
    if (f.date) {
      allowed.add(String(f.date.day));
      if (f.date.month) allowed.add(String(f.date.month));
    }
    if (f.kind === "phone") for (const n of numbersIn(f.raw)) allowed.add(n);
  }
  allowed.add("0");
  const extras: ExtraNumber[] = [...new Set(available)]
    .filter((n) => !allowed.has(n))
    .map((value) => ({ value, note: `The translation has the number ${value}, which is not in the English` }));
  return { checks, extras };
}

export type WordCheck = { word: string; status: "ok" | "missing" | "added" };

/** Weekdays and months named in the English must come back in the back-translation, and none may be added. */
export function checkCalendarWords(source: string, back: string): WordCheck[] {
  const words = (s: string) => {
    const found = new Set<string>();
    const l = s.toLowerCase();
    for (const w of WEEKDAYS) if (new RegExp(`\\b${w.slice(0, 3)}(?:${w.slice(3)})?s?\\b`).test(l)) found.add(w);
    for (const m of l.matchAll(new RegExp(`\\b${MONTH_RE}\\b\\.?(?=\\s*\\d)|\\b(january|february|march|april|june|july|august|september|october|november|december)\\b`, "g"))) {
      const i = monthIndex(m[1] ?? m[2]);
      if (i > 0) found.add(MONTHS[i - 1]);
    }
    return found;
  };
  const a = words(source);
  const b = words(back);
  const out: WordCheck[] = [];
  for (const w of a) out.push({ word: cap(w), status: b.has(w) ? "ok" : "missing" });
  for (const w of b) if (!a.has(w)) out.push({ word: cap(w), status: "added" });
  return out;
}

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

const STOP = new Set("a an the and or of to in on at for with by from is are be will we our us you your it this that as if can all".split(" "));

/** Content words of the English that do not come back in the back-translation. A hint for the reviewer, not a verdict. */
export function driftWords(source: string, back: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  const stem = (w: string) => w.replace(/'s$/, "").replace(/(ing|ed|es|s)$/, "");
  const backStems = new Set(norm(back).map(stem));
  const out: string[] = [];
  for (const w of norm(source)) {
    if (w.length < 4 || STOP.has(w) || /\d/.test(w)) continue;
    if (!backStems.has(stem(w)) && !out.includes(w)) out.push(w);
  }
  return out;
}

export type BlockFlags = {
  facts: FactCheck[];
  extras: ExtraNumber[];
  calendar: WordCheck[];
  drift: string[];
  /** Set when a paragraph that cites scripture came back much longer, which can mean the AI wrote out the verse. */
  verseText: string | null;
  /** Problems a reviewer must look at before approving. */
  problems: number;
};

export function flagBlock(source: string, translation: string, back: string | null): BlockFlags {
  const { checks, extras } = checkFacts(source, translation);
  const calendar = back ? checkCalendarWords(source, back) : [];
  const drift = back ? driftWords(source, back) : [];
  const verseText = addedVerseText(source, translation);
  const problems = checks.filter((c) => c.status !== "ok").length + extras.length + calendar.filter((c) => c.status !== "ok").length + (verseText ? 1 : 0);
  return { facts: checks, extras, calendar, drift, verseText, problems };
}

/**
 * The prompt tells the model never to write verse text. This checks it: a paragraph that cites a verse and comes back
 * far longer than the English gets flagged, because the extra words may be a verse the AI wrote from memory.
 */
export function addedVerseText(source: string, translation: string): string | null {
  if (findReferences(source).length === 0) return null;
  const len = (s: string) => s.replace(/\s+/g, " ").trim().length;
  if (len(translation) <= Math.max(len(source) * 1.8, len(source) + 120)) return null;
  return "This paragraph cites scripture and the translation is much longer than the English. Make sure the AI did not write out the verse. Neighborly adds verse text itself, only from a public-domain Bible.";
}
