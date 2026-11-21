import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { PAGE_KINDS, readKey, readSubmission, soundsUnsafe, type Problem } from "../intake-rules";
import { esc, helpPage, type HelpErrors, type HelpValues, type HelpView } from "../intake/help-pages";
import type { IntakeLanguage, NeedKind } from "../intake/intake-words";

/**
 * The server side of /help and /ayuda and their status pages: finished HTML from src/lib/intake/help-pages.ts, no
 * script of ours (Turnstile's widget is the one script, in the form's check slot), and every step a plain form POST.
 * The backend (convex/intakeHttp.ts) is reached only from here, with INTAKE_SERVER_SECRET, and is told the sender's
 * address as Vercel saw it. It checks Turnstile before anything is kept or any code is sent.
 */
const SVDP_FINDER = "https://www.svdpusa.org/find-help/";
/** National Runaway Safeline: free, any hour, for young people. */
const YOUTH_LINE = "1-800-786-2929";
const DEVICE = "kh_device", REQUEST = "kh_request", TO = "kh_to", PARTNER = "kh_partner";
const paths = { en: { form: "/help", status: "/help/status" }, es: { form: "/ayuda", status: "/ayuda/estado" } } as const;

type Extra = Record<string, string | string[]>;
function respond(body: string, status = 200, extra: Extra = {}) {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  for (const [name, value] of Object.entries(extra)) for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  return new Response(body, { status, headers });
}
const page = (language: IntakeLanguage, view: HelpView, status = 200, extra: Extra = {}, action?: string) => respond(helpPage(language, view, action), status, extra);

const cookie = (request: Request, name: string) => request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]{1,300})`))?.[1];
const setCookie = (name: string, value: string, path: string, maxAge: number) => `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
function device(request: Request): { id: string; set: Extra } {
  const found = cookie(request, DEVICE);
  if (found && /^[\w-]{8,64}$/.test(found)) return { id: found, set: {} };
  const id = crypto.randomUUID();
  return { id, set: { "Set-Cookie": setCookie(DEVICE, id, "/", 31536000) } };
}
const senderIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

function backend() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL, site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL, secret = process.env.INTAKE_SERVER_SECRET, siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return url && site && secret && siteKey ? { url, site, secret, siteKey } : null;
}
async function call(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const ready = backend();
  if (!ready) return null;
  try {
    const answer = await fetch(`${ready.site}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ready.secret}` }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000) });
    const read: unknown = await answer.json();
    return typeof read === "object" && read !== null ? (read as Record<string, unknown>) : null;
  } catch { return null; }
}

/** Cloudflare's widget for the form's check slot: the page's one script, theirs. */
function check(language: IntakeLanguage) {
  const ready = backend();
  return ready
    ? `<div class="cf-turnstile" data-sitekey="${esc(ready.siteKey)}" data-action="ask-for-help" data-language="${language}" data-size="flexible"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
}
/** When nothing can be taken (no backend, a failure): the page says to call 211, the line that never closes. */
const closed = (language: IntakeLanguage) => page(language, { kind: "limit", phone: "211" }, 503);

const day = (language: IntakeLanguage, at: number, timeZone: string) =>
  new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric", timeZone }).format(at);

/** GET /help or /ayuda: the empty form, and a quiet device id for the per-device limit. */
export async function showForm(language: IntakeLanguage, request: Request) {
  if (!backend()) return closed(language);
  const partner = partnerLink(request);
  if (partner) return partnerDoor(language, request, partner);
  return page(language, { kind: "form", check: check(language) }, 200, device(request).set);
}

/** A partner's link (?p=…): the partner's own link token, never a person's. */
const partnerLink = (request: Request) => readKey(new URL(request.url).searchParams.get("p"));
const partnerAction = (language: IntakeLanguage, link: string) => `${paths[language].form}?p=${link}`;
/**
 * A partner's way in: a device signed in (cookie) gets the form with no bot check; any other gets a code sent to the
 * partner's own email, so a forwarded link alone opens nothing.
 */
async function partnerDoor(language: IntakeLanguage, request: Request, link: string, wrong = false) {
  const action = partnerAction(language, link);
  if (!wrong && readKey(cookie(request, PARTNER))) return page(language, { kind: "form" }, 200, {}, action);
  const answer = wrong ? { result: "code", to: "" } : await call("/intake/partner/start", { link });
  if (answer?.result !== "code") return page(language, { kind: "form", check: check(language) }, 200, {}, paths[language].form);
  return page(language, { kind: "code", to: String(answer.to ?? ""), by: "email", wrong }, 200, {}, action);
}

const text = (form: FormData, name: string, max = 600) => {
  const found = form.get(name);
  return typeof found === "string" ? found.slice(0, max) : "";
};
const NEEDS = Object.keys(PAGE_KINDS) as NeedKind[];
function valuesFrom(form: FormData): HelpValues {
  const speaks = text(form, "speaks"), safe = text(form, "safe"), adult = text(form, "adult");
  return {
    needs: form.getAll("needs").filter((value): value is NeedKind => typeof value === "string" && (NEEDS as string[]).includes(value)),
    said: text(form, "said"), phone: text(form, "phone", 25), email: text(form, "email", 254), zip: text(form, "zip", 10), street: text(form, "street", 120), nearby: text(form, "nearby", 120),
    ...(speaks === "en" || speaks === "es" ? { speaks } : {}), ...(safe === "yes" || safe === "no" ? { safe } : {}), callAt: text(form, "callAt", 60), ...(adult === "yes" || adult === "no" ? { adult } : {}),
  };
}
const submission = (values: HelpValues, language: IntakeLanguage) => ({
  adult: values.adult === "yes", kinds: (values.needs ?? []).map((kind) => PAGE_KINDS[kind]), need: values.said ?? "", email: values.email ?? "", phone: values.phone ?? "",
  zip: values.zip ?? "", nearby: values.nearby ?? "", language: values.speaks ?? language, safe: values.safe, callAt: values.callAt ?? "",
});
const errorsFrom = (problems: Problem[]): HelpErrors => Object.fromEntries(problems.map((problem) => [problem, true]));

/** POST /help or /ayuda: one step of the form. */
export async function takeStep(language: IntakeLanguage, request: Request) {
  if (!backend()) return closed(language);
  if (Number(request.headers.get("content-length") ?? "0") > 16384) return page(language, { kind: "form", check: check(language) }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return page(language, { kind: "form", check: check(language) }, 400); }
  const step = text(form, "step", 20);
  const { id: deviceId, set } = device(request);
  const here = paths[language].form;
  const partner = partnerLink(request);
  if (partner && (step === "code" || step === "resend")) {
    if (step === "resend") return partnerDoor(language, new Request(request.url), partner);
    const answer = await call("/intake/partner/finish", { link: partner, code: text(form, "code", 12) });
    const session = readKey(answer?.session);
    if (answer?.result !== "signed_in" || !session) return partnerDoor(language, request, partner, true);
    return page(language, { kind: "form" }, 200, { "Set-Cookie": setCookie(PARTNER, session, here, 30 * 86400) }, partnerAction(language, partner));
  }
  const action = partner ? partnerAction(language, partner) : undefined;
  const slot = partner ? undefined : check(language);

  if (step === "code" || step === "resend") {
    const key = readKey(cookie(request, REQUEST));
    const to = decodeURIComponent(cookie(request, TO) ?? "");
    if (!key) return page(language, { kind: "form", check: check(language) });
    if (step === "resend") {
      await call("/intake/resend", { key, language, ip: senderIp(request) });
      return page(language, { kind: "code", to, by: "email", resent: true });
    }
    const answer = await call("/intake/confirm", { key, code: text(form, "code", 12), ip: senderIp(request) });
    if (answer?.result !== "confirmed") return page(language, { kind: "code", to, by: "email", wrong: true }, 200);
    const statusHref = `${paths[language].status}?k=${key}`;
    return page(language, { kind: "sent", team: String(answer.team ?? ""), by: day(language, Number(answer.by), String(answer.timeZone || "America/New_York")), statusHref }, 200, {
      "Set-Cookie": [setCookie(REQUEST, "", here, 0), setCookie(TO, "", here, 0)],
    });
  }

  const values = valuesFrom(form);
  if (step === "edit") return page(language, { kind: "form", values, check: slot }, 200, {}, action);
  // Under 18: nothing is kept or sent.
  if (values.adult === "no") return page(language, { kind: "young", youthLine: YOUTH_LINE });
  const read = readSubmission(submission(values, language));
  if (!read.ok) return page(language, { kind: "form", values, errors: errorsFrom(read.problems), check: slot }, 400, set, action);
  // Words that sound like danger show 911 and 988 first; sending anyway marks the call so the team sees why. Nothing else changes.
  if (step !== "send-anyway" && soundsUnsafe(`${read.value.need} ${read.value.meet ?? ""}`)) return page(language, { kind: "danger", values, check: slot }, 200, {}, action);

  const { kinds, need, email, phone, zip, safe, callAt, meet } = read.value;
  const answer = await call("/intake/submit", {
    adult: true, kinds, need, email, phone, zip, nearby: meet ?? "", language: read.value.language, safe: safe ? "yes" : "no", callAt: callAt ?? "", urgent: step === "send-anyway",
    street: values.street ?? "", token: text(form, "cf-turnstile-response", 2048), ip: senderIp(request), device: deviceId,
    ...(partner ? { partnerLink: partner, partnerSession: readKey(cookie(request, PARTNER)) ?? "" } : {}),
  });
  switch (answer?.result) {
    case "sent": {
      const key = readKey(answer.key);
      if (!key) return closed(language);
      return page(language, { kind: "code", to: email, by: "email" }, 200, { "Set-Cookie": [setCookie(REQUEST, key, here, 86400), setCookie(TO, encodeURIComponent(email), here, 86400), ...(set["Set-Cookie"] ? [String(set["Set-Cookie"])] : [])] });
    }
    case "landed": {
      const key = readKey(answer.key);
      if (!key) return closed(language);
      // Not safe to message, or phone only: the link is shown once, here, and never sent.
      return page(language, { kind: "sent", team: String(answer.team ?? ""), by: day(language, Number(answer.by), String(answer.timeZone || "America/New_York")), ...(callAt && !safe ? { callAt } : {}), statusHref: `${paths[language].status}?k=${key}` });
    }
    case "no_team": return page(language, { kind: "away", finderHref: SVDP_FINDER });
    case "full": return page(language, { kind: "full" });
    // The partner's device is no longer signed in (revoked, a new link, or 30 days): sign in again.
    case "partner": return partner ? partnerDoor(language, new Request(request.url), partner) : closed(language);
    case "unknown_zip": return page(language, { kind: "form", values, unplaced: true, check: slot }, 400, {}, action);
    case "slow": return page(language, { kind: "limit", phone: "211" }, 429);
    case "check": return page(language, { kind: "form", values, errors: { check: true }, check: slot }, 403, {}, action);
    default: return closed(language);
  }
}

/** GET (and POST, to delete) /help/status?k=… : where one request stands, to whoever holds its private link. */
export async function showStatus(language: IntakeLanguage, request: Request) {
  const ready = backend();
  const key = readKey(new URL(request.url).searchParams.get("k"));
  const ask = paths[language].form;
  if (!ready || !key) return Response.redirect(new URL(ask, request.url), 303);
  const action = `${paths[language].status}?k=${key}`;
  const extra = { "X-Robots-Tag": "noindex" };
  if (request.method === "POST") {
    let step = "", codeTyped = "";
    try {
      const form = await request.formData();
      step = String(form.get("step") ?? "");
      codeTyped = String(form.get("code") ?? "").slice(0, 12);
    } catch { /* an empty post shows the page */ }
    const removed = () => page(language, { kind: "status", step: "closed", sentOn: "", by: "", askHref: ask, removed: true }, 200, extra, action);
    // Deleting needs the code sent to the request's own email; with no email to send to, the link alone deletes it.
    if (step === "remove-yes" || step === "resend") {
      const answer = await call("/intake/remove", { key, language, ip: senderIp(request) });
      if (answer?.result === "removed" || answer?.result === "gone") return removed();
      return page(language, { kind: "code", to: language === "es" ? "tu correo" : "your email", by: "email", resent: step === "resend" }, 200, extra, action);
    }
    if (step === "code") {
      const answer = await call("/intake/remove", { key, code: codeTyped, ip: senderIp(request) });
      if (answer?.result === "removed") return removed();
      return page(language, { kind: "code", to: language === "es" ? "tu correo" : "your email", by: "email", wrong: true }, 200, extra, action);
    }
    if (step === "remove") return render(true);
  }
  return render(false);

  async function render(removing: boolean) {
    let found;
    try { found = await new ConvexHttpClient(ready!.url).query(api.intake.status, { key: key! }); } catch { return closed(language); }
    if (!found || found.status === "pending") return Response.redirect(new URL(ask, request.url), 303);
    const step = found.status === "closed" ? "closed" : found.status === "received" ? "received" : "contact";
    const late = found.by !== null && Date.now() > found.by && found.status === "received";
    return page(language, { kind: "status", step, sentOn: day(language, found.sentAt, found.timeZone), by: found.by ? day(language, found.by, found.timeZone) : "", late, askHref: ask, removing }, 200, extra, action);
  }
}
