import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { showForm, takeStep } from "./handle";
import { seal } from "./seal";

const env = { NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud", NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site", INTAKE_SERVER_SECRET: "s".repeat(40), NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" };
const realFetch = globalThis.fetch;
let sent: { url: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  Object.assign(process.env, env);
  sent = [];
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
const sealOf = (page: string) => page.match(/name="seal" value="([^"]+)"/)?.[1] ?? "";
/** The form step, then the check page's own POST with a Turnstile answer. */
async function throughCheck(fields: Record<string, string | string[]>, language: "en" | "es" = "en") {
  const checkPage = await (await takeStep(language, post(fields))).text();
  return takeStep(language, post({ step: "check", seal: sealOf(checkPage), "cf-turnstile-response": "token" }));
}

describe("the Ask for help pages", () => {
  test("the form is finished HTML with no script at all, under 100 KB", async () => {
    const page = await (await showForm("en", new Request("https://kindhelps.com/help"))).text();
    expect(page.length).toBeLessThan(100 * 1024);
    expect(page).not.toContain("<script");
    expect(page).not.toContain("challenges.cloudflare.com");
  });
  test("the form step keeps nothing: it answers with the check page, the one page with a script, values sealed", async () => {
    const answer = await takeStep("en", post(good));
    const page = await answer.text();
    expect(sent).toHaveLength(0);
    expect(page.length).toBeLessThan(100 * 1024);
    expect(page).toContain("One quick check.");
    expect([...page.matchAll(/<script/g)]).toHaveLength(1);
    expect(page).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js");
    // Without JavaScript: 211, said plainly.
    expect(page).toMatch(/<noscript>.*tel:211.*<\/noscript>/s);
    // No one's words in the clear.
    for (const typed of ["ana@example.org", "groceries", "48201"]) expect(page).not.toContain(typed);
    expect(await (await takeStep("es", post({ ...good, speaks: "es" }))).text()).toContain("Una revisión rápida.");
  });
  test("a seal that was changed, or is older than ten minutes, sends nothing", async () => {
    const real = sealOf(await (await takeStep("en", post(good))).text());
    const changed = real.slice(0, 20) + (real[20] === "A" ? "B" : "A") + real.slice(21);
    const tampered = await takeStep("en", post({ step: "check", seal: changed, "cf-turnstile-response": "token" }));
    expect(tampered.status).toBe(400);
    expect(await takeStep("en", post({ step: "check", seal: await seal("another secret, long enough to be real", { values: good, urgent: false }), "cf-turnstile-response": "token" }))).toHaveProperty("status", 400);
    const old = await seal(env.INTAKE_SERVER_SECRET, { values: good, urgent: false }, Date.now() - 11 * 60 * 1000);
    const late = await takeStep("en", post({ step: "check", seal: old, "cf-turnstile-response": "token" }));
    expect(late.status).toBe(400);
    expect(await late.text()).toContain("more than 10 minutes");
    expect(sent).toHaveLength(0);
  });
  test("from the check page, changing what was written opens the form again with it", async () => {
    const real = sealOf(await (await takeStep("en", post(good))).text());
    // The hidden step comes first, the pressed button's last.
    const back = await (await takeStep("en", post({ step: ["check", "edit"], seal: real }))).text();
    expect(back).toContain('value="ana@example.org"');
    expect(back).not.toContain("<script");
    expect(sent).toHaveLength(0);
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
    await throughCheck({ ...good, said, step: "send-anyway" });
    expect(sent[0].body).toMatchObject({ urgent: true, ip: "203.0.113.9", token: "token" });
  });
  test("a good request asks the backend, which emails a code; the key stays in a cookie, not the page", async () => {
    const answer = await throughCheck(good);
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
    expect(page).not.toContain("challenges.cloudflare.com");
  });
  test("a signed-in partner gets the form with no bot check, and sends with its session", async () => {
    answer({ result: "landed", key: "0123456789abcdef0123456789abcdef", team: "St. Example", by: String(Date.UTC(2026, 10, 23)), timeZone: "America/Detroit" });
    const cookie = { cookie: `kh_partner=${"b".repeat(32)}` };
    const form = await (await showForm("en", new Request(`https://kindhelps.com/help?p=${link}`, { headers: cookie }))).text();
    expect(form).not.toContain("challenges.cloudflare.com");
    const body = new FormData();
    for (const [name, value] of Object.entries({ ...good, needs: "food" })) body.append(name, value);
    await takeStep("en", new Request(`https://kindhelps.com/help?p=${link}`, { method: "POST", body, headers: cookie }));
    expect(sent[0].body).toMatchObject({ partnerLink: link, partnerSession: "b".repeat(32) });
  });
  test("a team full this week says so", async () => {
    answer({ result: "full" });
    expect(await (await throughCheck(good)).text()).toContain("full this week");
  });
  test("a failed Turnstile check comes back to the check page, never the form", async () => {
    answer({ result: "check" });
    const again = await throughCheck(good);
    expect(again.status).toBe(403);
    const page = await again.text();
    expect(page).toContain("check this came from a person");
    expect(sealOf(page)).not.toBe("");
  });
});
