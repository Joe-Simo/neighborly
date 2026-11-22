import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { statusKeyHash } from "./intake";
import { hashPartnerLink } from "./intakeActions";
import { placeAddress } from "./geocode";
import { readCode, readKey, readSubmission } from "../src/lib/intake-rules";

/**
 * The endpoints behind the "Ask for help" form: POST /intake/submit and POST /intake/confirm, called by the site's own
 * server (src/lib/help-page/), never by a browser. Here: the shared secret, the site's word that Vercel BotID judged
 * the sender human (the site checks it, since only it sees the browser's request), the input, and hashing. Then convex/intake.ts does the rest in one transaction.
 */
const encode = (text: string) => new TextEncoder().encode(text);
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
/** A keyed hash, so a list of hashed emails cannot be reversed by hashing guesses. INTAKE_HASH_SECRET keys it. */
async function keyed(text: string) {
  const key = await crypto.subtle.importKey("raw", encode(process.env.INTAKE_HASH_SECRET || "kind-helps-intake"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encode(text)));
}
const random = (bytes: number) => crypto.getRandomValues(new Uint8Array(bytes));
function sixDigits() {
  // Rejection sampling keeps every code equally likely.
  for (;;) {
    const value = new DataView(random(4).buffer).getUint32(0);
    if (value < 4_294_000_000) return String(value % 1_000_000).padStart(6, "0");
  }
}

function siteOrigin() {
  try { return process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : null; } catch { return null; }
}
/**
 * Only the site's own server calls these (src/app/help, src/app/ayuda): it holds INTAKE_SERVER_SECRET and passes the
 * sender's address as it saw it. Without the secret set on both sides the form is closed.
 */
async function fromSite(request: Request) {
  const secret = process.env.INTAKE_SERVER_SECRET;
  const given = request.headers.get("Authorization") ?? "";
  if (!secret || secret.length < 32) return false;
  const [a, b] = await Promise.all([keyed(`auth:${given}`), keyed(`auth:Bearer ${secret}`)]);
  return a === b;
}
const reply = (status: number, body: Record<string, string | boolean>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
/**
 * The sender's address from the site, or, when there is none, a value of this request alone: an unknown sender is
 * never counted, limited or blocked in a bucket shared with everyone else whose address is unknown.
 */
const address = (value: unknown) => (typeof value === "string" && /^[0-9a-fA-F:.]{2,64}$/.test(value) ? value : `unknown:${hex(random(12))}`);

async function body(request: Request): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("Content-Length") ?? "0") > 8192) return null;
  try {
    const text = await request.text();
    if (text.length > 8192) return null;
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch { return null; }
}

function statusLink(language: "en" | "es", key: string) {
  const site = siteOrigin();
  return site ? `${site}${language === "es" ? "/ayuda/estado" : "/help/status"}?k=${key}` : null;
}

export const submit = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  if (!input) return reply(400, { result: "invalid" });
  const read = readSubmission(input);
  if (!read.ok) return reply(400, { result: "invalid" });
  const ip = address(input.ip);
  // A signed-in partner (its link and its device's session, both from the site's cookies) needs no bot check.
  const partnerLink = readKey(input.partnerLink), partnerSession = readKey(input.partnerSession);
  const partnerId = partnerLink && partnerSession ? await ctx.runQuery(internal.intakePartners.signedIn, { linkHash: await hashPartnerLink(partnerLink), sessionHash: await keyed(`session:${partnerSession}`) }) : null;
  if (partnerLink && !partnerId) return reply(403, { result: "partner" });
  // Everyone else: the site checked Vercel BotID before calling here; without its word, nothing is kept, looked up or sent.
  if (!partnerId && input.human !== true) return reply(403, { result: "check" });
  // A street address is placed with the Census geocoder (the address alone is sent); without it, the zip's centre.
  const street = typeof input.street === "string" ? input.street.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  const at = street && /^\d{5}$/.test(read.value.zip) ? await placeAddress(ctx, `${street}, ${read.value.zip}`) : null;
  // No device id: this request alone, never a shared "none" bucket.
  const device = typeof input.device === "string" && /^[\w-]{8,64}$/.test(input.device) ? input.device : `none:${hex(random(12))}`;
  const { value } = read;
  const statusKey = hex(random(16));
  const link = statusLink(value.language, statusKey);
  if (!link) return reply(503, { result: "closed" });
  const code = sixDigits();
  const { kinds, need, email, phone, zip, language, safe, callAt, meet, referredBy } = value;
  const answer = await ctx.runMutation(internal.intake.receive, {
    kinds, need, email, phone, zip, language, safe, urgent: input.urgent === true, ...(callAt ? { callAt } : {}), ...(meet ? { meet } : {}), ...(referredBy ? { referredBy } : {}),
    ipHash: await keyed(`ip:${ip}`), deviceHash: await keyed(`device:${device}`), contactHash: await keyed(email ? `email:${email}` : `phone:${phone}`),
    ...(phone ? { phoneHash: await keyed(`phone:${phone}`) } : {}),
    statusKeyHash: await statusKeyHash(statusKey), codeHash: await keyed(`code:${statusKey}:${code}`), code, statusLink: link,
    ...(at ? { at } : {}), ...(partnerId ? { partnerId } : {}),
  });
  if (answer.result === "sent") return reply(200, { result: "sent", key: statusKey });
  if (answer.result === "landed") return reply(200, { result: "landed", key: statusKey, team: answer.team ?? "", by: String(answer.by ?? ""), timeZone: answer.timeZone ?? "", phone: answer.phone ?? "" });
  return reply(answer.result === "slow" ? 429 : 200, { result: answer.result, ...("phone" in answer && answer.phone ? { phone: answer.phone } : {}) });
});

export const confirm = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  const key = readKey(input?.key), code = readCode(input?.code);
  if (!key || !code) return reply(400, { result: "wrong" });
  const shown = await ctx.runMutation(internal.intake.confirm, { statusKeyHash: await statusKeyHash(key), codeHash: await keyed(`code:${key}:${code}`), ipHash: await keyed(`ip:${address(input?.ip)}`) });
  return reply(200, shown ? { result: "confirmed", team: shown.team, by: String(shown.by), timeZone: shown.timeZone, phone: shown.phone ?? "" } : { result: "wrong" });
});

export const resendCode = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  const key = readKey(input?.key);
  const language = input?.language === "es" ? "es" : "en";
  const link = key ? statusLink(language, key) : null;
  if (key && link) {
    const code = sixDigits();
    await ctx.runMutation(internal.intake.resendCode, { statusKeyHash: await statusKeyHash(key), codeHash: await keyed(`code:${key}:${code}`), code, statusLink: link, ipHash: await keyed(`ip:${address(input?.ip)}`) });
  }
  return reply(200, { result: "sent" });
});

/** Deleting from the status page: without a code, sends one to the request's own email ("code"); with it, deletes. */
export const remove = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  const key = readKey(input?.key);
  if (!key) return reply(400, { result: "gone" });
  const code = readCode(input?.code);
  if (code) {
    const done = await ctx.runMutation(internal.intake.removeWithCode, { statusKeyHash: await statusKeyHash(key), codeHash: await keyed(`delete:${key}:${code}`) });
    return reply(200, { result: done ? "removed" : "wrong" });
  }
  const language = input?.language === "es" ? "es" : "en";
  const link = statusLink(language, key);
  if (!link) return reply(503, { result: "closed" });
  const fresh = sixDigits();
  const result = await ctx.runMutation(internal.intake.askToRemove, { statusKeyHash: await statusKeyHash(key), codeHash: await keyed(`delete:${key}:${fresh}`), code: fresh, statusLink: link, ipHash: await keyed(`ip:${address(input?.ip)}`) });
  return reply(200, { result });
});

/** A partner opened its link: a code goes to the partner's own email. Answers the masked address, or "gone". */
export const partnerStart = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  const link = readKey(input?.link);
  const site = siteOrigin();
  if (!link || !site) return reply(200, { result: "gone" });
  const code = sixDigits();
  const to = await ctx.runMutation(internal.intakePartners.startSignIn, { linkHash: await hashPartnerLink(link), codeHash: await keyed(`partner:${link}:${code}`), code, link: `${site}/help?p=${link}` });
  return reply(200, to ? { result: "code", to } : { result: "gone" });
});
/** The partner's code: a session for this device (30 days), returned once to the site's server for its cookie. */
export const partnerFinish = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  const link = readKey(input?.link), code = readCode(input?.code);
  if (!link || !code) return reply(200, { result: "wrong" });
  const session = hex(random(16));
  const ok = await ctx.runMutation(internal.intakePartners.finishSignIn, { linkHash: await hashPartnerLink(link), codeHash: await keyed(`partner:${link}:${code}`), sessionHash: await keyed(`session:${session}`) });
  return reply(200, ok ? { result: "signed_in", session } : { result: "wrong" });
});
