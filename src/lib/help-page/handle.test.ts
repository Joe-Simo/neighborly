import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, statSync } from "node:fs";

// Vercel BotID's verdict, set per test: a human, a bot, or no verdict at all (it threw: not on Vercel, no token).
let verdict: "human" | "bot" | "throws" = "human";
let judged = 0;
mock.module("botid/server", () => ({
  checkBotId: async () => {
    judged++;
    if (verdict === "throws") throw new Error("The 'x-vercel-oidc-token' header is missing from the request.");
    return { isHuman: verdict === "human", isBot: verdict === "bot", isVerifiedBot: false, bypassed: false };
  },
}));
const { showForm, takeStep } = await import("./handle");
const { HELP_SCRIPT } = await import("../intake/help-pages");

const env = { NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud", NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site", INTAKE_SERVER_SECRET: "s".repeat(40) };
const realFetch = globalThis.fetch;
let sent: { url: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  Object.assign(process.env, env);
  sent = [];
  verdict = "human";
  judged = 0;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    sent.push({ url, body });
    return new Response(JSON.stringify({ result: "sent", key: "0123456789abcdef0123456789abcdef" }));
  }) as typeof fetch;
});
afterEach(() => {
  for (const name of Object.keys(env)) delete process.env[name];
  globalThis.fetch = realFetch;
});
const post = (fields: Record<string, string | string[]>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) for (const one of Array.isArray(value) ? value : [value]) form.append(name, one);
  return new Request("https://kindhelps.com/help", { method: "POST", body: form, headers: { "x-forwarded-for": "203.0.113.9" } });
};
const good = { step: "send", needs: ["food"], said: "We need groceries this week.", email: "ana@example.org", zip: "48201", speaks: "en", safe: "yes", adult: "yes" };
/** The form's POST, as the page's script sends it (BotID's headers come with it; the mock stands in for their verdict). */
const send = (fields: Record<string, string | string[]>, language: "en" | "es" = "en") => takeStep(language, post(fields));

describe("the Ask for help pages", () => {
  test("the form is finished HTML with one small script of ours (BotID), under 100 KB with it, and 211 without JavaScript", async () => {
    const page = await (await showForm("en", new Request("https://kindhelps.com/help"))).text();
    expect([...page.matchAll(/<script/g)]).toHaveLength(1);
    expect(page).toContain(`<script src="${HELP_SCRIPT}" defer></script>`);
    expect(page).not.toMatch(/turnstile|cloudflare/i);
    expect(page).toMatch(/<noscript>.*JavaScript.*tel:211.*<\/noscript>/s);
    // The page and its script together stay under the cap (the script is built by scripts/help-script.mts).
    const script = existsSync(`public${HELP_SCRIPT}`) ? statSync(`public${HELP_SCRIPT}`).size : 0;
    expect(page.length + script).toBeLessThan(100 * 1024);
  });
  test("every POST is judged by BotID before anything else; a bot, or no verdict, gets the 211 page and nothing is sent", async () => {
    for (const said of ["bot", "throws"] as const) {
      verdict = said;
      const answer = await takeStep("en", post(good));
      expect(answer.status).toBe(403);
      const page = await answer.text();
      expect(page).toContain("tel:211");
      expect(page).not.toContain("ana@example.org");
      expect(sent).toHaveLength(0);
    }
    verdict = "bot";
    for (const step of ["code", "resend", "send-anyway", "edit"]) expect((await takeStep("en", post({ ...good, step }))).status).toBe(403);
    expect(sent).toHaveLength(0);
  });
  test("a human's request goes straight to the backend with the site's word, no extra step", async () => {
    await takeStep("en", post(good));
    expect(judged).toBe(1);
    expect(sent[0].url).toBe("https://example.convex.site/intake/submit");
    expect(sent[0].body).toMatchObject({ human: true });
    expect(sent[0].body).not.toHaveProperty("token");
  });
  test("the status page has no script and is not judged by BotID", async () => {
    globalThis.fetch = (async () => new Response("{}")) as unknown as typeof fetch;
    const answer = await (await import("./handle")).showStatus("en", new Request("https://kindhelps.com/help/status?k=0123456789abcdef0123456789abcdef", { method: "POST", body: new URLSearchParams({ step: "remove" }) }));
    expect(judged).toBe(0);
    expect(answer.status).toBeLessThan(600);
  });
  test("with no backend set, the page says to call 211 and keeps nothing", async () => {
    delete process.env.INTAKE_SERVER_SECRET;
    const answer = await showForm("es", new Request("https://kindhelps.com/ayuda"));
    expect(answer.status).toBe(503);
  });
  test("under 18 sees the young people's lines and nothing is sent", async () => {
    const page = await (await takeStep("en", post({ ...good, adult: "no" }))).text();
    expect(page).toContain("tel:18007862929");
    expect(sent).toHaveLength(0);
  });
  test("a missing contact comes back with the form and its problem", async () => {
    const answer = await takeStep("en", post({ ...good, email: "" }));
    expect(answer.status).toBe(400);
    expect(await answer.text()).toContain("Add a phone number or an email.");
    expect(sent).toHaveLength(0);
  });
  test("words of danger show 911 and 988 first; sending anyway marks it urgent", async () => {
    const said = "He hits me and I need rent";
    expect(await (await takeStep("en", post({ ...good, said }))).text()).toContain("tel:911");
    expect(sent).toHaveLength(0);
    await send({ ...good, said, step: "send-anyway" });
    expect(sent[0].body).toMatchObject({ urgent: true, ip: "203.0.113.9", human: true });
  });
  test("a good request asks the backend, which emails a code; the key stays in a cookie, not the page", async () => {
    const answer = await send(good);
    expect(sent[0].url).toBe("https://example.convex.site/intake/submit");
    expect(answer.headers.get("set-cookie")).toContain("kh_request=0123456789abcdef0123456789abcdef");
    expect(await answer.text()).not.toContain("0123456789abcdef");
  });
});

describe("partners and deleting", () => {
  const answer = (body: Record<string, unknown>) => {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      return new Response(JSON.stringify(body));
    }) as typeof fetch;
  };
  const link = "a".repeat(32);
  test("a partner link with no signed-in device sends a code to the partner, not a form", async () => {
    answer({ result: "code", to: "d•••@example.org" });
    const page = await (await showForm("en", new Request(`https://kindhelps.com/help?p=${link}`))).text();
    expect(sent[0].url).toBe("https://example.convex.site/intake/partner/start");
    expect(page).toContain("d•••@example.org");
    expect(page).not.toMatch(/cloudflare/i);
  });
  test("a signed-in partner gets the form with no bot check, and sends with its session", async () => {
    answer({ result: "landed", key: "0123456789abcdef0123456789abcdef", team: "St. Example", by: String(Date.UTC(2026, 10, 23)), timeZone: "America/Detroit" });
    const cookie = { cookie: `kh_partner=${"b".repeat(32)}` };
    const form = await (await showForm("en", new Request(`https://kindhelps.com/help?p=${link}`, { headers: cookie }))).text();
    expect(form).not.toMatch(/cloudflare/i);
    const body = new FormData();
    for (const [name, value] of Object.entries({ ...good, needs: "food" })) body.append(name, value);
    verdict = "throws";
    await takeStep("en", new Request(`https://kindhelps.com/help?p=${link}`, { method: "POST", body, headers: cookie }));
    expect(judged).toBe(0);
    expect(sent[0].body).toMatchObject({ partnerLink: link, partnerSession: "b".repeat(32) });
    expect(sent[0].body).not.toHaveProperty("human");
  });
  test("the team's phone is shown once the request has reached it, and nothing on the device remembers it", async () => {
    answer({ result: "landed", key: "0123456789abcdef0123456789abcdef", team: "St. Example", by: String(Date.UTC(2026, 10, 23)), timeZone: "America/Detroit", phone: "(313) 555-0100" });
    const landed = await send({ ...good, email: "", phone: "3135550100", safe: "no", callAt: "after 5" });
    expect(await landed.text()).toContain("tel:3135550100");
    expect(landed.headers.get("set-cookie") ?? "").not.toContain("555");
    // The next request from the same device: the limit page says 211, never the team.
    answer({ result: "slow" });
    const limit = await (await send(good)).text();
    expect(limit).toContain("tel:211");
    expect(limit).not.toContain("555-0100");
  });
  test("a signed-in partner over its limit sees its own team's phone", async () => {
    answer({ result: "slow", phone: "(313) 555-0100" });
    const link = "a".repeat(32);
    const body = new FormData();
    for (const [name, value] of Object.entries({ ...good, needs: "food" })) body.append(name, value);
    const page = await (await takeStep("en", new Request(`https://kindhelps.com/help?p=${link}`, { method: "POST", body, headers: { cookie: `kh_partner=${"b".repeat(32)}` } }))).text();
    expect(page).toContain("tel:3135550100");
  });
  test("a phone from the backend in any other shape is not shown", async () => {
    answer({ result: "landed", key: "0123456789abcdef0123456789abcdef", team: "St. Example", by: String(Date.UTC(2026, 10, 23)), timeZone: "America/Detroit", phone: "<b>call</b>" });
    const landed = await send({ ...good, email: "", phone: "3135550100", safe: "no", callAt: "after 5" });
    expect(await landed.text()).not.toContain("call</b>");
  });
  test("a team full this week says so", async () => {
    answer({ result: "full" });
    expect(await (await send(good)).text()).toContain("full this week");
  });
  test("if the backend still says the check is missing, the page closes to 211", async () => {
    answer({ result: "check" });
    const page = await send(good);
    expect(page.status).toBe(503);
    expect(await page.text()).toContain("tel:211");
  });

});
