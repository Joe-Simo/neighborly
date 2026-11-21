import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { statusKeyHash } from "./intake";
import { readCode, readKey, readSubmission } from "../src/lib/intake-rules";

/**
 * The endpoints behind the "Ask for help" form: POST /intake/submit and POST /intake/confirm, called by the site's own
 * server (src/lib/help-page/), never by a browser. Here: the shared secret, Turnstile (checked with Cloudflare before
 * anything is kept or sent), the input, and hashing. Then convex/intake.ts does the rest in one transaction.
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
const address = (value: unknown) => (typeof value === "string" && /^[0-9a-fA-F:.]{2,64}$/.test(value) ? value : "unknown");

async function body(request: Request): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("Content-Length") ?? "0") > 8192) return null;
  try {
    const text = await request.text();
    if (text.length > 8192) return null;
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch { return null; }
}

/** Cloudflare's own word on the Turnstile token. With no secret set, the form is closed: nothing is let through unchecked. */
const TOKEN_MAX_AGE = 5 * 60 * 1000;
async function turnstile(token: unknown, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") form.set("remoteip", ip);
  try {
    const answer = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const result: unknown = await answer.json();
    if (typeof result !== "object" || result === null) return false;
    const said = result as { success?: unknown; hostname?: unknown; action?: unknown; challenge_ts?: unknown };
    // Cloudflare refuses a token used twice; the page's own host, the form's action name and a fresh token are checked here too.
    const host = siteOrigin() ? new URL(siteOrigin() ?? "").hostname : null;
    const age = typeof said.challenge_ts === "string" ? Date.now() - Date.parse(said.challenge_ts) : Infinity;
    return said.success === true && said.action === "ask-for-help" && (!host || said.hostname === host) && age >= 0 && age < TOKEN_MAX_AGE;
  } catch { return false; }
}

export const submit = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  if (!input) return reply(400, { result: "invalid", problem: "need" });
  const read = readSubmission(input);
  if (!read.ok) return reply(400, { result: "invalid", problem: read.problem });
  const ip = address(input.ip);
  // The bot check comes before anything is kept or any code is sent.
  if (!(await turnstile(input.token, ip))) return reply(403, { result: "check" });
  const device = typeof input.device === "string" && /^[\w-]{8,64}$/.test(input.device) ? input.device : `none:${ip}`;
  const site = siteOrigin();
  if (!site) return reply(503, { result: "closed" });
  const { value } = read;
  const statusKey = hex(random(16));
  const code = sixDigits();
  const page = value.language === "es" ? "/ayuda/estado?k=" : "/help/status?k=";
  const result = await ctx.runMutation(internal.intake.receive, {
    ...value,
    ipHash: await keyed(`ip:${ip}`), deviceHash: await keyed(`device:${device}`), contactHash: await keyed(`email:${value.email}`),
    ...(value.phone ? { phoneHash: await keyed(`phone:${value.phone}`) } : {}),
    statusKeyHash: await statusKeyHash(statusKey), codeHash: await keyed(`code:${statusKey}:${code}`), code, statusLink: `${site}${page}${statusKey}`,
  });
  if (result === "no_team" || result === "unknown_zip") return reply(200, { result });
  if (result === "slow") return reply(429, { result: "slow" });
  // The key goes back even when nothing was sent (a limit, a block): the reply looks the same either way.
  return reply(200, { result: "sent", key: statusKey });
});

export const confirm = httpAction(async (ctx, request) => {
  if (!(await fromSite(request))) return reply(403, { result: "refused" });
  const input = await body(request);
  const key = readKey(input?.key), code = readCode(input?.code);
  if (!key || !code) return reply(400, { result: "wrong" });
  const ok = await ctx.runMutation(internal.intake.confirm, { statusKeyHash: await statusKeyHash(key), codeHash: await keyed(`code:${key}:${code}`), ipHash: await keyed(`ip:${address(input?.ip)}`) });
  return reply(200, { result: ok ? "confirmed" : "wrong" });
});
