/**
 * What the public "Ask for help" form accepts. The page checks it to help the person; the server checks it again
 * (convex/intakeHttp.ts) and trusts only its own check. Plain module: no imports, so both sides load it.
 */
export const HELP_KINDS = ["rent", "utility", "food", "voucher", "other"] as const;
export type HelpKind = (typeof HELP_KINDS)[number];
export const NEED_MIN = 3;
export const NEED_MAX = 500;

export type Submission = { kind: HelpKind; need: string; email: string; phone: string; zip: string; language: "en" | "es"; referredBy?: string };
export type Problem = "adult" | "kind" | "need" | "email" | "phone" | "zip" | "language" | "referredBy";

const isKind = (value: unknown): value is HelpKind => typeof value === "string" && (HELP_KINDS as readonly string[]).includes(value);
const str = (value: unknown) => (typeof value === "string" ? value : "");
/** Digits only, without a leading US 1; empty when none was given. */
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/**
 * A link in any of its disguises: a scheme, "www", a domain written with a dot, a spaced dot or the word "dot"
 * ("bit . ly", "kindhelps dot com"), after lookalike letters are folded to plain ones.
 */
export function hasLink(text: string) {
  const plain = text.normalize("NFKC").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase()
    .replace(/[\u0430\u0435\u043e\u0440\u0441\u0445\u0443]/g, (c) => ({ "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0445": "x", "\u0443": "y" })[c] ?? c);
  // A plain dot with no space reads as a domain for any common ending; a spaced dot or a spelled-out one only for endings
  // that are not also everyday words, so "I need help. Me too" is never taken for a link.
  const tight = String.raw`[a-z0-9-]{2,}\.(?:com|net|org|ly|io|co|info|xyz|me|link|site|top|biz|us|app|gl|to|cc)\b`;
  const loose = String.raw`[a-z0-9-]{2,}(?:\s+\.\s*|\s*\.\s+|\s*(?:\(dot\)|\[dot\]|\bdot\b|\bpunto\b)\s*)(?:com|net|org|ly|io|info|xyz|biz|gl|cc)\b`;
  return /(?:https?|hxxps?)\s*:\s*\/\/|\bwww\s*\./.test(plain) || new RegExp(`${tight}|${loose}`).test(plain);
}

/** Reads untrusted input into a submission, or names the first thing wrong with it. */
export function readSubmission(input: unknown): { ok: true; value: Submission } | { ok: false; problem: Problem } {
  const raw = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  // Under 18, nothing is kept: the page shows a youth line, 211 and 911 instead, and the server refuses it too.
  if (raw.adult !== true) return { ok: false, problem: "adult" };
  if (!isKind(raw.kind)) return { ok: false, problem: "kind" };
  // Control characters out, runs of space folded; links are not a need, and too many is how spam looks.
  const need = str(raw.need).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim();
  if (need.length < NEED_MIN || need.length > NEED_MAX || hasLink(need)) return { ok: false, problem: "need" };
  const email = str(raw.email).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(email)) return { ok: false, problem: "email" };
  const phoneRaw = str(raw.phone).trim();
  const phone = phoneDigits(phoneRaw);
  if (phoneRaw && (phoneRaw.length > 25 || phone.length !== 10 || !/^[\d\s().+-]+$/.test(phoneRaw))) return { ok: false, problem: "phone" };
  const zip = str(raw.zip).trim().slice(0, 10).replace(/-\d{4}$/, "");
  if (!/^\d{5}$/.test(zip)) return { ok: false, problem: "zip" };
  if (raw.language !== "en" && raw.language !== "es") return { ok: false, problem: "language" };
  const referred = str(raw.referredBy).trim();
  if (referred && !/^[\w .'&-]{1,80}$/u.test(referred)) return { ok: false, problem: "referredBy" };
  return { ok: true, value: { kind: raw.kind, need, email, phone, zip, language: raw.language, ...(referred ? { referredBy: referred } : {}) } };
}

/** A six-digit code, as typed: spaces and dashes set aside. */
export const readCode = (code: unknown) => {
  const digits = str(code).replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
};
/** The private status link's key: 32 hex characters. */
export const readKey = (key: unknown) => (typeof key === "string" && /^[0-9a-f]{32}$/.test(key) ? key : null);
