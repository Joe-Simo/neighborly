/**
 * What the public "Ask for help" form accepts. The page checks it to help the person; the server checks it again
 * (convex/intakeHttp.ts) and trusts only its own check. Plain module: no imports, so both sides load it.
 */
export const HELP_KINDS = ["rent", "utility", "food", "voucher", "other"] as const;
export type HelpKind = (typeof HELP_KINDS)[number];
export const NEED_MIN = 3;
export const NEED_MAX = 500;

/** The page's words for the kinds (src/lib/intake/intake-words.ts) and the record's (convex/schema.ts helpKind). */
export const PAGE_KINDS = { rent: "rent", utilities: "utility", food: "food", vouchers: "voucher", other: "other" } as const satisfies Record<string, HelpKind>;

export type Submission = {
  kinds: HelpKind[];
  /** The person's own words, links taken out; may be empty when the kinds say it. */
  need: string;
  email: string;
  phone: string;
  zip: string;
  language: "en" | "es";
  /** Whether it is safe to text, email or leave a message. When not, nothing is ever sent and the team only calls at callAt. */
  safe: boolean;
  callAt?: string;
  /** A place to meet, for someone with no address. */
  meet?: string;
  referredBy?: string;
};
/** The page's own error names (intake-words errors). */
export type Problem = "needs" | "reach" | "phone" | "email" | "zip" | "nearby" | "safe" | "when" | "adult";

const isKind = (value: unknown): value is HelpKind => typeof value === "string" && (HELP_KINDS as readonly string[]).includes(value);
const str = (value: unknown) => (typeof value === "string" ? value : "");
const line = (value: unknown, max: number) => str(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
/** Digits only, without a leading US 1; empty when none was given. */
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/** Reads untrusted input into a submission, or names every field that needs a look. */
export function readSubmission(input: unknown): { ok: true; value: Submission } | { ok: false; problems: Problem[] } {
  const raw = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const problems: Problem[] = [];
  // Under 18, nothing is kept: the page shows the young view instead, and the server refuses it too.
  if (raw.adult !== true) problems.push("adult");
  const kinds = [...new Set((Array.isArray(raw.kinds) ? raw.kinds : []).filter(isKind))];
  if (!kinds.length) problems.push("needs");
  // Control characters out, runs of space folded, and links in any disguise taken out: the need is shown as plain text.
  const need = stripLinks(str(raw.need).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim()).slice(0, NEED_MAX);
  const email = str(raw.email).trim().toLowerCase();
  if (email && (email.length > 254 || !/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(email))) problems.push("email");
  const phoneRaw = str(raw.phone).trim();
  const phone = phoneDigits(phoneRaw);
  if (phoneRaw && (phoneRaw.length > 25 || phone.length !== 10 || !/^[\d\s().+-]+$/.test(phoneRaw))) problems.push("phone");
  if (!email && !phoneRaw) problems.push("reach");
  const meetRaw = line(raw.nearby, 120);
  const typedZip = str(raw.zip).trim().slice(0, 10).replace(/-\d{4}$/, "");
  // No address: a nearby zip in "nearby" places the request; any other words there are a place to meet, and still need a zip.
  const zip = typedZip || (/^\d{5}$/.test(meetRaw) ? meetRaw : "");
  if (!/^\d{5}$/.test(zip)) problems.push(typedZip || !meetRaw ? "zip" : "nearby");
  const meet = meetRaw && meetRaw !== zip ? stripLinks(meetRaw) : "";
  if (raw.safe !== "yes" && raw.safe !== "no") problems.push("safe");
  const callAt = line(raw.callAt, 60);
  if (raw.safe === "no" && !callAt) problems.push("when");
  if (raw.safe === "no" && !phoneRaw && !problems.includes("reach")) problems.push("reach");
  const language = raw.language === "es" ? "es" : "en";
  const referred = line(raw.referredBy, 80);
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    value: { kinds, need, email, phone, zip, language, safe: raw.safe === "yes", ...(callAt ? { callAt: stripLinks(callAt) } : {}), ...(meet ? { meet } : {}), ...(referred && /^[\w .'&-]{1,80}$/u.test(referred) ? { referredBy: referred } : {}) },
  };
}

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
/** The words with every word that reads as a link taken out. */
export function stripLinks(text: string) {
  if (!hasLink(text)) return text;
  const kept: string[] = [];
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    // A link may be spread over a few words ("bit . ly/x", "kindhelps dot com"): try it alone and with its next two.
    const span = [1, 2, 3, 4].find((n) => hasLink(words.slice(i, i + n).join(" ")) && !hasLink(words.slice(i + 1, i + n).join(" ")));
    if (span === undefined) kept.push(words[i]);
    else { kept.push("[link removed]"); i += span - 1; }
  }
  return kept.join(" ").trim();
}

/** A six-digit code, as typed: spaces and dashes set aside. */
export const readCode = (code: unknown) => {
  const digits = str(code).replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
};
/** The private status link's key: 32 hex characters (128 random bits). */
export const readKey = (key: unknown) => (typeof key === "string" && /^[0-9a-f]{32}$/.test(key) ? key : null);

/**
 * Words that may mean someone is in danger now. They never route, hold or hurry anything: they only show 911 and 988
 * first, and mark the call so the team sees why (a mark the team can clear, as on the help line).
 */
export function soundsUnsafe(text: string) {
  const plain = text.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  return /\b(danger|unsafe|kill|suicid\w*|hurt (myself|me)|end my life|beat(s|ing)? me|hits? me|abus\w*|threat\w*|weapon|gun|peligro|matar\w*|suicid\w*|hacerme dano|me pega|me golpea|maltrato|abuso|amenaz\w*|arma)\b/.test(plain);
}
