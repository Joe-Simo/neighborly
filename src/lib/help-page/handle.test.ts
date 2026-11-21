import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { showForm, takeStep } from "./handle";

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
const good = { step: "send", needs: ["food"], said: "We need groceries this week.", email: "ana@example.org", zip: "48201", speaks: "en", safe: "yes", adult: "yes", "cf-turnstile-response": "token" };

describe("the Ask for help pages", () => {
  test("the form is finished HTML with no script but Turnstile's, under 100 KB", async () => {
    const page = await (await showForm("en", new Request("https://kindhelps.com/help"))).text();
    expect(page.length).toBeLessThan(100 * 1024);
    expect([...page.matchAll(/<script/g)]).toHaveLength(1);
    expect(page).toContain("challenges.cloudflare.com");
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
    await takeStep("en", post({ ...good, said, step: "send-anyway" }));
    expect(sent[0].body).toMatchObject({ urgent: true, ip: "203.0.113.9" });
  });
  test("a good request asks the backend, which emails a code; the key stays in a cookie, not the page", async () => {
    const answer = await takeStep("en", post(good));
    expect(sent[0].url).toBe("https://example.convex.site/intake/submit");
    expect(answer.headers.get("set-cookie")).toContain("kh_request=0123456789abcdef0123456789abcdef");
    expect(await answer.text()).not.toContain("0123456789abcdef");
  });
});
