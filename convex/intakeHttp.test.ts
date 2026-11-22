/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const SECRET = "s".repeat(40);

beforeEach(() => {
  vi.stubEnv("INTAKE_SERVER_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://example.org");
});
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.intake.seedZips, { rows: [{ zip: "94103", lat: 37.772, lng: -122.411 }] });
  return t;
}
let serial = 0;
/** One submission from the site's server, for a zip no team serves (nothing is kept; only the counters move). */
const submit = (t: Awaited<ReturnType<typeof setup>>, over: Record<string, unknown> = {}) => {
  serial++;
  return t.fetch("/intake/submit", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ adult: true, kinds: ["food"], need: "Groceries.", email: `p${serial}@example.org`, phone: "", zip: "94103", language: "en", safe: "yes", human: true, ...over }),
  }).then((answer) => answer.json() as Promise<{ result: string }>);
};

describe("the sender's address and device, as the limits count them", () => {
  test("senders with no address or device are never counted together", async () => {
    const t = await setup();
    // Twelve people the site could not place: more than the 10 an hour one network may send.
    for (let i = 0; i < 12; i++) expect(await submit(t)).toEqual({ result: "no_team" });
    const keys = await t.run(async (ctx) => (await ctx.db.query("webLimits").collect()).filter((row) => row.key.startsWith("ip:") || row.key.startsWith("device:")));
    expect(keys.every((row) => row.count === 1)).toBe(true);
  });
  test("one real address is still limited", async () => {
    const t = await setup();
    const answers = [];
    for (let i = 0; i < 11; i++) answers.push((await submit(t, { ip: "203.0.113.7", device: `device-${i}-abcdef` })).result);
    expect(answers.slice(0, 10).every((one) => one === "no_team")).toBe(true);
    expect(answers[10]).toBe("slow");
  });
  test("without the site's BotID word, nothing is counted or kept", async () => {
    const t = await setup();
    expect(await submit(t, { human: false })).toEqual({ result: "check" });
    expect(await t.run((ctx) => ctx.db.query("webLimits").collect())).toEqual([]);
  });
});
