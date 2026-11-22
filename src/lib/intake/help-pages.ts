import { endingWords } from "../../components/public-ending-words";
import { intakeWords, type IntakeLanguage, type IntakeWords, type NeedKind } from "./intake-words";

/**
 * kindhelps.com/help and /ayuda, and the status page: finished HTML from a route handler, one inline style block
 * (budget: /mnt/project-files/app-load/intake-budget/budget.md), and on the pages that post to /help or /ayuda one small
 * script of ours (HELP_SCRIPT, built from src/lib/help-page/botid-client.ts): Vercel BotID, which only judges requests
 * sent with fetch, so the script sends those forms with fetch. With JavaScript off the form says to call 211. The status
 * page has no script and works without it. Every value written into the page goes through `esc`.
 */

export type HelpValues = Partial<{
  needs: NeedKind[];
  said: string;
  phone: string;
  email: string;
  zip: string;
  street: string;
  nearby: string;
  speaks: IntakeLanguage;
  safe: "yes" | "no";
  callAt: string;
  adult: "yes" | "no";
}>;
export type HelpErrors = Partial<Record<keyof IntakeWords["errors"], true>>;

export type HelpView =
  | { kind: "form"; values?: HelpValues; errors?: HelpErrors; unplaced?: boolean }
  | { kind: "danger"; values: HelpValues }
  | { kind: "code"; to: string; by: "email" | "phone"; wrong?: boolean; resent?: boolean }
  | { kind: "sent"; team: string; by: string; callAt?: string; statusHref: string; phone?: string }
  | { kind: "away"; finderHref: string }
  | { kind: "full" }
  | { kind: "limit"; phone: string }
  /** Nothing can be taken right now (the site is not set up, or the backend failed): not about this person. */
  | { kind: "closed" }
  /** Vercel BotID said bot, or could not say: not about a limit. */
  | { kind: "refused" }
  | { kind: "young"; youthLine: string }
  | { kind: "status"; step: "received" | "contact" | "closed"; sentOn: string; by: string; late?: boolean; askHref: string; removing?: boolean; removed?: boolean; phone?: string };

/** The pages' one script: built into public/ by scripts/help-script.mts on every build. */
export const HELP_SCRIPT = "/help-botid.js";

const NEEDS: NeedKind[] = ["rent", "utilities", "food", "vouchers", "other"];

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const tel = (number: string) => `tel:${number.replace(/[^\d+]/g, "")}`;

/** What a shared link to the form shows: the page's own head and deck, and its card (app/help/card, app/ayuda/card). */
const cardAlt = {
  en: "Two paper hands lifting a telephone receiver from its cradle, its cord curling across the sheet, beside the words Ask for help.",
  es: "Dos manos de papel que levantan el auricular de un teléfono, con el cable enroscado sobre la hoja, junto a las palabras Pide ayuda.",
} satisfies Record<IntakeLanguage, string>;
function shareTags(language: IntakeLanguage, w: IntakeWords) {
  const path = language === "es" ? "/ayuda" : "/help";
  const head = `${w.title.replace(/\.$/, "")} · Kind Helps`;
  return [
    `<meta name="description" content="${esc(w.deck)}">`,
    `<link rel="canonical" href="https://kindhelps.com${path}">`,
    // Both languages and the default, the same set on each page, so a search engine pairs them (as the other public pages do).
    `<link rel="alternate" hreflang="en" href="https://kindhelps.com/help"><link rel="alternate" hreflang="es" href="https://kindhelps.com/ayuda">`,
    `<link rel="alternate" hreflang="x-default" href="https://kindhelps.com/help">`,
    `<meta property="og:type" content="website"><meta property="og:site_name" content="Kind Helps">`,
    `<meta property="og:locale" content="${language === "es" ? "es_LA" : "en_US"}">`,
    `<meta property="og:url" content="https://kindhelps.com${path}">`,
    `<meta property="og:title" content="${esc(head)}"><meta property="og:description" content="${esc(w.deck)}">`,
    `<meta property="og:image" content="https://kindhelps.com${path}/card"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(cardAlt[language])}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("\n");
}

/** The page for one view. `action` is where the form posts (the same address, so no path ever names a person). */
export function helpPage(language: IntakeLanguage, view: HelpView, action = language === "es" ? "/ayuda" : "/help") {
  const w = intakeWords[language];
  const status = view.kind === "status";
  const corner = view.kind === "code" || (status && view.step !== "closed") ? "waits" : view.kind === "sent" ? "given" : "";
  // The status page's title says nothing of what it is about: someone glancing at the tab learns nothing.
  const title = status ? w.wordmark : view.kind === "form" ? w.title : w.wordmark;
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
${status ? '<meta name="robots" content="noindex">' : ""}
<title>${esc(title)}</title>
${status ? "" : `<script src="${HELP_SCRIPT}" defer></script>`}
${view.kind === "form" ? shareTags(language, w) : ""}
<style>${CSS}</style>
</head>
<body>
<header class="bar">
  <a class="mark" href="/">${esc(w.wordmark)}</a>
  ${
    status
      ? `<a class="exit" href="https://weather.com/" rel="noreferrer">${esc(w.status.exit)}</a>`
      : `<a class="lang" href="${w.other.href}" lang="${language === "es" ? "en" : "es"}">${w.other.label}</a>`
  }
</header>
<div class="wall${status ? " plain" : ""}">
<main class="sheet${corner ? ` ${corner}` : ""}">
${body(w, view, action)}
</main>
${status ? "" : aside(w)}
</div>
${status ? "" : foot(language)}
</body>
</html>`;
}

/** The foot every public page shares (public-foot.tsx), in plain HTML: the promise, the four ways on, the name. Not on a status page, which keeps its quick exit alone. */
function foot(language: IntakeLanguage) {
  const said = endingWords[language];
  return `<footer class="colophon">
  <span><em>${esc(said.free[0])}</em>${esc(said.free[1])}</span>
  <nav aria-label="${esc(said.about)}"><a href="/app/help-line?intent=sample">${esc(said.sample)}</a><a href="${said.howMadePath}">${esc(said.howMade)}</a><a href="${said.accessPath}">${esc(said.access)}</a><a href="${said.privacyPath}">${esc(said.privacy)}</a><a href="https://github.com/sponsors/Joe-Simo" target="_blank" rel="noopener noreferrer">${esc(said.give)}<span class="sr-only"> ${esc(said.newTab)}</span></a></nav>
  <a class="name" href="/" lang="en">kind helps</a>
</footer>`;
}

function aside(w: IntakeWords) {
  return `<aside class="slips">
  <section class="slip">
    <h2>${esc(w.how.title)}</h2>
    <ol>${w.how.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>
  </section>
  <section class="slip kraft">
    <h2>${esc(w.always.title)}</h2>
    <p><a href="tel:911">${esc(w.always.danger)}</a></p>
    <p><a href="tel:988">${esc(w.always.crisis)}</a></p>
    <p><a href="tel:211">${esc(w.always.lines)}</a></p>
  </section>
</aside>`;
}

const head = (kicker: string | null, title: string, deck?: string) =>
  `${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ""}<h1>${esc(title)}</h1>${deck ? `<p class="deck">${esc(deck)}</p>` : ""}`;
const lines = (...links: [href: string, label: string, quiet?: boolean][]) =>
  `<p class="lines">${links.map(([href, label, quiet]) => `<a class="btn${quiet ? " quiet" : ""}" href="${esc(href)}">${esc(label)}</a>`).join("")}</p>`;
const note = (text: string) => `<p class="note">${esc(text)}</p>`;

function body(w: IntakeWords, view: HelpView, action: string): string {
  switch (view.kind) {
    case "form":
      return head(w.kicker, w.title, w.deck) + form(w, view.values ?? {}, view.errors ?? {}, action, view.unplaced);
    case "danger":
      return `${head(null, w.dangerSend.title)}${danger(w)}
<form method="post" action="${esc(action)}">${hidden(view.values)}<input type="hidden" name="step" value="send-anyway">
<p class="lines"><button class="btn" type="submit" data-sending="${esc(w.sending)}" data-offline="${esc(w.offline)}">${esc(w.dangerSend.send)}</button><button class="btn quiet" type="submit" name="step" value="edit">${esc(w.dangerSend.back)}</button></p>
</form>`;
    case "code":
      return `${head(w.code.kicker, w.code.title, view.by === "email" ? w.code.deck(view.to) : w.code.deckPhone(view.to))}
<form method="post" action="${esc(action)}" class="form">
<input type="hidden" name="step" value="code">
${field(w.code.label, `<input class="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="7" required autofocus${view.wrong ? ' aria-invalid="true" aria-describedby="code-wrong"' : ""}>`, w.code.help, view.wrong ? ["code-wrong", w.code.wrong] : undefined)}
<p class="lines"><button class="btn" type="submit" data-sending="${esc(w.sending)}" data-offline="${esc(w.offline)}">${esc(w.code.confirm)}</button></p>
</form>
<form method="post" action="${esc(action)}" class="row"><input type="hidden" name="step" value="resend">${view.resent ? `<p class="said">${esc(w.code.sentAgain)}</p>` : `<button class="link" type="submit">${esc(w.code.again)}</button>`}
<a class="link" href="${esc(action)}">${esc(w.code.other)}</a></form>
${note(w.code.held)}`;
    case "sent":
      return `${head(w.sent.kicker, w.sent.title, w.sent.deck(view.team, view.by))}${view.callAt ? note(w.sent.callOnly(view.callAt)) : ""}
${lines([view.statusHref, w.sent.status])}${view.phone ? `<p class="deck"><a href="${esc(tel(view.phone))}">${esc(w.sent.call(view.phone))}</a></p>` : ""}${note(w.sent.statusHelp)}`;
    case "away":
      return `${head(w.away.kicker, w.away.title, w.away.deck)}${lines(["tel:211", w.away.call211], [view.finderHref, w.away.finder, true])}${note(w.away.nothing)}`;
    case "full":
      return `${head(null, w.full.title, w.full.deck)}${lines(["tel:211", w.away.call211])}`;
    case "closed":
      return `${head(null, w.closed.title, w.closed.deck)}${lines(["tel:211", w.away.call211])}`;
    case "refused":
      return `${head(null, w.refused.title, w.refused.deck)}${lines(["tel:211", w.away.call211])}`;
    case "limit":
      return `${head(null, w.limit.title, w.limit.deck(view.phone))}${lines([tel(view.phone), view.phone])}`;
    case "young":
      return `${head(w.young.kicker, w.young.title, w.young.deck)}${lines([tel(view.youthLine), w.young.youth], ["tel:211", w.young.call211, true])}
<p class="deck"><a href="tel:911">${esc(w.young.danger)}</a></p>${note(w.young.nothing)}`;
    case "status":
      return status(w, view, action);
  }
}

function status(w: IntakeWords, view: Extract<HelpView, { kind: "status" }>, action: string) {
  if (view.removed) return head(null, w.status.removed) + lines([view.askHref, w.status.askAgain, true]);
  const order = ["received", "contact", "closed"] as const;
  const at = order.indexOf(view.step);
  const deck = view.step === "received" ? w.status.receivedDeck(view.by) : view.step === "contact" ? w.status.contactDeck : w.status.closedDeck;
  return `${head(w.status.kicker, w.status.steps[view.step], deck)}
<ol class="ladder">${order.map((step, i) => `<li${i < at ? ' class="done"' : i === at ? ' class="now" aria-current="step"' : ""}>${esc(w.status.steps[step])}${i === 0 ? `<span>${esc(w.status.sentOn(view.sentOn))}</span>` : ""}</li>`).join("")}</ol>
${view.late && view.step !== "closed" ? `<div class="late"><p>${esc(w.status.late)}</p>${lines(["tel:211", w.away.call211])}</div>` : ""}
${view.step === "closed" ? lines([view.askHref, w.status.askAgain]) : ""}
${view.phone && view.step !== "closed" ? `<p class="deck"><a href="${esc(tel(view.phone))}">${esc(w.status.call(view.phone))}</a></p>` : ""}
<form method="post" action="${esc(action)}" class="remove">
${
  view.removing
    ? `<p class="deck">${esc(w.status.removeAsk)}</p><p class="lines"><button class="btn" type="submit" name="step" value="remove-yes">${esc(w.status.removeYes)}</button><a class="btn quiet" href="${esc(action)}">${esc(w.status.keep)}</a></p>`
    : `<button class="link" type="submit" name="step" value="remove">${esc(w.status.remove)}</button>`
}
</form>
<p class="note">${esc(w.status.exitHelp)}</p>`;
}

function danger(w: IntakeWords) {
  return `<div class="danger" role="alert">
<p class="danger-title">${esc(w.danger.title)}</p>
<p>${esc(w.danger.deck)}</p>
${lines(["tel:911", w.danger.call911], ["tel:988", w.danger.call988, true], ["sms:988", w.danger.text988, true])}
<p class="said">${esc(w.danger.still)}</p>
</div>`;
}

function hidden(values: HelpValues) {
  return Object.entries(values)
    .flatMap(([name, value]) => (Array.isArray(value) ? value.map((one) => [name, one] as const) : [[name, String(value ?? "")] as const]))
    .map(([name, value]) => `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`)
    .join("");
}

/** A labelled field: its help under the label, and its own problem (plum rule) under the box. */
function field(label: string, control: string, help?: string, problem?: [id: string, text: string]) {
  return `<label class="field${problem ? " wrong" : ""}"><span class="label">${esc(label)}</span>${help ? `<span class="help">${esc(help)}</span>` : ""}${control}${problem ? `<span class="problem" id="${problem[0]}">${esc(problem[1])}</span>` : ""}</label>`;
}

function choices(name: string, legend: string, options: [value: string, label: string, lang?: string][], picked: string[] | string | undefined, multiple: boolean, problem?: string, first = false) {
  const on = (value: string) => (Array.isArray(picked) ? picked.includes(value) : picked === value);
  // The fieldset names its problem, so a screen reader hears it with the question; the first problem on the page takes focus.
  return `<fieldset class="set${problem ? " wrong" : ""}"${problem ? ` aria-describedby="e-${name}"` : ""}><legend>${esc(legend)}</legend><div class="chips">${options
    .map(
      ([value, label, lang], i) =>
        `<label class="chip"${lang ? ` lang="${lang}"` : ""}><input type="${multiple ? "checkbox" : "radio"}" name="${name}" value="${value}" id="${name}-${value}"${on(value) ? " checked" : ""}${!multiple && i === 0 ? " required" : ""}${problem ? ' aria-invalid="true"' : ""}${first && i === 0 ? " autofocus" : ""}><span>${esc(label)}</span></label>`,
    )
    .join("")}</div>${problem ? `<span class="problem" id="e-${name}">${esc(problem)}</span>` : ""}</fieldset>`;
}

function form(w: IntakeWords, v: HelpValues, e: HelpErrors, action: string, unplaced?: boolean) {
  const val = (text?: string) => (text ? ` value="${esc(text)}"` : "");
  const bad = (key: keyof HelpErrors): [string, string] | undefined => (e[key] ? [`e-${key}`, w.errors[key]] : undefined);
  const wrong = (key: keyof HelpErrors) => (e[key] ? ` aria-invalid="true" aria-describedby="e-${key}"` : "");
  const any = Object.keys(e).length > 0;
  // The first problem in page order takes focus when the page comes back, with or without script.
  const order: (keyof HelpErrors | "unplaced")[] = ["needs", "reach", "phone", "email", "unplaced", "zip", "nearby", "safe", "when", "adult"];
  const firstWrong = order.find((key) => (key === "unplaced" ? unplaced : e[key]));
  const focus = (key: keyof HelpErrors | "unplaced") => (firstWrong === key ? " autofocus" : "");
  return `<form method="post" action="${esc(action)}" class="form" novalidate>
<input type="hidden" name="step" value="send">
${any ? `<p class="summary" role="alert">${esc(w.errors.summary)}</p>` : ""}
${choices("needs", w.need.label, NEEDS.map((kind) => [kind, w.need.kinds[kind]]), v.needs, true, e.needs ? w.errors.needs : undefined, firstWrong === "needs")}
${field(w.need.say, `<textarea name="said" rows="3" maxlength="500">${esc(v.said ?? "")}</textarea>`, w.need.sayHelp)}
<fieldset class="set${e.reach ? " wrong" : ""}"${e.reach ? ' aria-describedby="e-reach"' : ""}><legend>${esc(w.reach.legend)}</legend><div class="pair">
${field(w.reach.phone, `<input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20"${val(v.phone)}${wrong("phone")}${focus("phone")}${focus("reach")}>`, undefined, bad("phone"))}
${field(w.reach.email, `<input name="email" type="email" autocomplete="email" maxlength="120"${val(v.email)}${wrong("email")}${focus("email")}>`, undefined, bad("email"))}
</div>${e.reach ? `<span class="problem" id="e-reach">${esc(w.errors.reach)}</span>` : `<span class="help">${esc(w.reach.oneOf)}</span>`}</fieldset>
<div class="pair zipline">
${field(w.place.zip, `<input class="zip" name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5"${val(v.zip)}${wrong("zip")}${unplaced ? ' aria-invalid="true" aria-describedby="e-zip"' : ""}${focus("zip")}${focus("unplaced")}>`, w.place.zipHelp, unplaced ? ["e-zip", `${w.unknownZip.title} ${w.unknownZip.deck}`] : bad("zip"))}
${field(w.place.street, `<input name="street" autocomplete="street-address" maxlength="120"${val(v.street)}>`, w.place.streetHelp)}
</div>
<details class="noaddress"${v.nearby || e.nearby ? " open" : ""}><summary>${esc(w.place.noAddress)}</summary>
${field(w.place.nearby, `<input name="nearby" maxlength="120"${val(v.nearby)}${wrong("nearby")}${focus("nearby")}>`, w.place.nearbyHelp, bad("nearby"))}
</details>
${choices("speaks", w.language, [["en", "English", "en"], ["es", "Español", "es"]], v.speaks, false)}
${choices("safe", w.safe.legend, [["yes", w.safe.yes], ["no", w.safe.no]], v.safe, false, e.safe ? w.errors.safe : undefined, firstWrong === "safe")}
<div class="when">${field(w.whenIfNo, `<input name="callAt" maxlength="60"${val(v.callAt)}${wrong("when")}${focus("when")}>`, w.safe.whenHelp, bad("when"))}</div>
${choices("adult", w.adult.legend, [["yes", w.adult.yes], ["no", w.adult.no]], v.adult, false, e.adult ? w.errors.adult : undefined, firstWrong === "adult")}
<noscript><p class="problem">${esc(w.noScript)}</p><p class="lines"><a class="btn" href="tel:211">${esc(w.away.call211)}</a></p></noscript>
<p class="said">${esc(w.assistant)}</p>
<p class="lines"><button class="btn" type="submit" data-sending="${esc(w.sending)}" data-offline="${esc(w.offline)}">${esc(w.send)}</button></p>
</form>`;
}

/* One block, under 8 KB. Source Sans 3 is the one face loaded (swap, metric-matched fallback); heads are set in the
   system serif, so no display face is ever fetched. Ochre = waiting, plum = wrong, green = done. No red anywhere. */
const CSS = `@font-face{font-family:"Source Sans 3";src:url(/fonts/source-sans-3-latin-variable.woff2) format("woff2");font-weight:200 900;font-display:swap}
@font-face{font-family:"SS3 Fallback";src:local("Arial"),local("Helvetica Neue"),local("Roboto"),local("Liberation Sans");size-adjust:90.5%;ascent-override:113.1%;descent-override:44.2%;line-gap-override:0%}
:root{--paper:#f7f4ed;--sheet:#fbfaf6;--ink:#283c32;--muted:#5d6657;--rule:#d9d4c6;--green:#365c46;--plum:#6f5f93;--ochre:#c8962e;--kraft:#e9dcc3;color-scheme:light}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.5 "Source Sans 3","SS3 Fallback",sans-serif}
a{color:inherit;text-underline-offset:4px;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px;border-radius:4px}
.bar{display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:1040px;margin:0 auto;padding:16px 24px}
.mark,.lang,.slip p a{display:inline-flex;align-items:center;min-height:44px}
.mark{font:400 24px/1 Georgia,"Times New Roman",serif;letter-spacing:-.02em;text-decoration:none}
.lang{font-size:16px}
.exit{position:fixed;top:12px;right:12px;z-index:2;display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:4px;background:var(--ink);color:var(--sheet);font-weight:600;text-decoration:none;box-shadow:0 2px 6px #283c3240}
.wall{display:grid;gap:32px;max-width:1040px;margin:0 auto;padding:8px 24px 48px}
@media(min-width:960px){.wall{grid-template-columns:minmax(0,560px) 320px;justify-content:space-between;align-items:start;padding-top:24px}.slips{position:sticky;top:32px}}
.wall.plain{max-width:640px}
.sheet{position:relative;padding:clamp(24px,4vw,44px);background:var(--sheet);border-radius:3px;clip-path:polygon(0 0,calc(100% - 37px) 0,100% 37px,100% 100%,0 100%);filter:drop-shadow(0 1px 0 #fffdf7) drop-shadow(0 18px 22px #283c3226) drop-shadow(0 2px 3px #283c321f)}
.sheet::after{content:"";position:absolute;top:0;right:0;width:37px;height:37px;background:linear-gradient(225deg,transparent 50%,var(--corner,#e7e1d2) 50%);box-shadow:-3px 3px 7px -4px #283c3259}
.sheet.waits{--corner:var(--ochre)}.sheet.given{--corner:var(--green)}
.kicker{margin:0 0 10px;font-size:14px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h1{margin:0;font:400 clamp(34px,6vw,46px)/1.08 Georgia,"Times New Roman",serif;letter-spacing:-.02em;word-spacing:.04em;text-wrap:balance}
h2{margin:0 0 8px;font:400 22px/1.2 Georgia,"Times New Roman",serif;word-spacing:.04em}
.deck{margin:14px 0 0;color:var(--muted);text-wrap:pretty}
.form{display:grid;gap:20px;margin-top:28px}
.set{margin:0;padding:0;border:0;display:grid;gap:8px;min-width:0}
legend,.label{padding:0;font-weight:600}
legend{margin-bottom:8px}
.field{display:grid;gap:6px;min-width:0}
.help{font-size:15px;color:var(--muted)}
input:not([type=checkbox],[type=radio]),textarea{width:100%;min-height:48px;padding:10px 12px;border:1px solid #9aa391;border-radius:4px;background:#fff;color:var(--ink);font:inherit}
textarea{resize:vertical}
input.zip{max-width:9ch;letter-spacing:.08em}
input.code{max-width:10ch;font-size:24px;letter-spacing:.3em}
.pair{display:grid;gap:16px;align-items:end}
button,input,textarea{font:inherit}
@media(min-width:560px){.pair{grid-template-columns:1fr 1fr}.zipline{grid-template-columns:9.5rem 1fr}}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{position:relative}
.chip input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.chip span{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid #7d8874;border-radius:4px;background:var(--sheet)}
.chip input:checked+span{background:var(--ink);border-color:var(--ink);color:var(--sheet)}
.chip input:focus-visible+span{outline:2px solid var(--ink);outline-offset:3px}
.wrong input:not([type=checkbox],[type=radio]),[aria-invalid=true]{border-color:var(--plum);box-shadow:inset 3px 0 var(--plum)}
.problem,.summary{display:block;margin:0;padding-left:12px;border-left:3px solid var(--plum);font-size:15px;color:#4c3f6e}
.summary{padding:12px 16px;background:#f3f0f7;font-size:16px}
details.noaddress{border-top:1px solid var(--rule);padding-top:12px}
details.noaddress summary{cursor:pointer;width:max-content;max-width:100%;min-height:44px;display:flex;align-items:center;text-decoration:underline;text-underline-offset:4px}
details.noaddress[open] summary{margin-bottom:8px}
form:has(#safe-yes:checked) .when{display:none}
.said,.note{margin:0;font-size:15px;color:var(--muted)}
.note{margin-top:20px;padding-top:12px;border-top:1px solid var(--rule)}
.lines{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0 0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border:1px solid var(--ink);border-radius:4px;background:var(--green);border-color:var(--green);color:#fff;font:600 17px/1 inherit;font-family:inherit;text-decoration:none;cursor:pointer;box-shadow:0 2px 0 #24402f}
.btn.quiet{background:var(--sheet);color:var(--ink);border-color:#7d8874;box-shadow:none}
.form>.lines .btn{width:100%}
@media(min-width:560px){.form>.lines .btn{width:auto}}
.link{padding:0;min-height:44px;border:0;background:none;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
.row{display:flex;flex-wrap:wrap;gap:4px 20px;align-items:center;margin-top:8px}
.danger{margin-top:20px;padding:20px;border:2px solid var(--ink);border-radius:4px;background:#fff}
.danger p{margin:0 0 8px}.danger .lines{margin:16px 0 12px}
.danger-title{font:400 24px/1.2 Georgia,serif}
.slips{display:grid;gap:20px;align-content:start}
.slip{padding:20px 22px;background:var(--sheet);border-radius:2px;box-shadow:0 1px 0 #fffdf7,0 8px 14px #283c321f,0 1px 2px #283c3224}
.slip.kraft{background:var(--kraft);rotate:-.6deg}
.slip ol{margin:0;padding-left:20px;display:grid;gap:8px}
.slip p{margin:6px 0 0}
.ladder{list-style:none;margin:28px 0 0;padding:0;border-top:1px solid var(--rule)}
.ladder li{display:grid;padding:14px 0 14px 28px;border-bottom:1px solid var(--rule);position:relative;color:var(--muted)}
.ladder li::before{content:"";position:absolute;left:2px;top:21px;width:10px;height:10px;border-radius:50%;border:2px solid #9aa391}
.ladder li span{font-size:15px}
.ladder .done{color:var(--ink)}.ladder .done::before{background:var(--green);border-color:var(--green)}
.ladder .now{color:var(--ink);font-weight:600}.ladder .now::before{border-color:var(--ochre);background:var(--ochre)}
.late{margin-top:20px;padding:16px 18px;border-left:3px solid var(--ochre);background:#fbf5e6}
.late p{margin:0}.late .lines{margin-top:12px}
.remove{margin-top:28px}
@media(max-width:559px){.bar{padding:12px 16px}.wall{padding:4px 16px 40px}.sheet{padding:24px 20px}.exit{top:8px;right:8px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
@font-face{font-family:"Newsreader";font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/newsreader-display-regular.woff2) format("woff2")}
@font-face{font-family:"Newsreader";font-style:italic;font-weight:400;font-display:swap;src:url(/fonts/newsreader-display-italic.woff2) format("woff2")}
.colophon{container-type:inline-size;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:24px;padding:12px 20px calc(82px + env(safe-area-inset-bottom));background:#eee7d7;color:#293f32;font-size:15px}
.colophon em{font-family:Newsreader,Georgia,serif;font-style:italic;font-weight:400}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.colophon nav{display:flex;flex-wrap:wrap;gap:0 28px}
.colophon nav a{display:inline-flex;align-items:center;min-height:44px;white-space:nowrap;text-decoration-color:#343e3366}
.colophon .name{flex-basis:100%;display:inline-flex;align-items:center;margin:20px 0 -.08em;font:400 calc(100cqi / 4.1)/.8 Newsreader,Georgia,serif;letter-spacing:-.065em;word-spacing:.07em;text-decoration:none;text-shadow:.008em .016em .012em #3b2a1240,.03em .07em .08em #3b2a1224}
@media(max-width:560px){.colophon nav{display:grid;grid-template-columns:repeat(2,max-content)}}
@media(max-width:900px){.colophon{background:#f5f3ec}}
@media(max-width:600px){.colophon{padding-bottom:calc(82px + 22vw + env(safe-area-inset-bottom))}}
@media(min-width:901px){.colophon{flex-wrap:nowrap;min-height:clamp(92px,7.4vw,140px);gap:0 clamp(24px,3vw,48px);padding:0 7% env(safe-area-inset-bottom)}.colophon>span{flex:none}.colophon nav{flex:1 1 0;min-width:0;justify-content:center;gap:0 clamp(16px,2vw,28px)}.colophon .name{flex:none;min-height:44px;margin:0;font-size:clamp(48px,4.6vw,88px)}}
@media(min-width:1600px){.colophon{font-size:16px}}
@media(forced-colors:active){.colophon .name{text-shadow:none}}`;
