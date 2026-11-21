/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function group() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
    const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
    const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
    const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "14 Sample St", adults: 1, children: 2, language: "es", notes: "", createdBy: memberId, createdAt: 0 });
    const requestId = await ctx.db.insert("assistanceRequests", { churchId, neighborId, kind: "utility", summary: "Rosa Delgado at 14 Sample St is behind on the power bill and has no food this week.", amountRequested: 30000, status: "open", decisionNote: "", payeeKind: "utility", payeeName: "", source: "person", createdBy: memberId, createdAt: 0 });
    await ctx.db.insert("referralAgencies", { churchId, name: "Harvest Pantry", phone: "", helpsWith: "groceries and a food pantry" });
    await ctx.db.insert("referralAgencies", { churchId, name: "County Rent Program", phone: "", helpsWith: "rent and eviction help" });
    await ctx.db.insert("referralAgencies", { churchId, name: "Unwritten Place", phone: "", helpsWith: "" });
    const visitId = await ctx.db.insert("visits", { churchId, neighborId, requestId, scheduledAt: 0, status: "completed", visitors: [{ memberId, hours: 1, miles: 0 }], notes: "Ana Visitor met Rosa Delgado. Kitchen empty, no food in the house. Two kids, one on insulin.", completedAt: 1, createdBy: memberId, createdAt: 0 });
    return { churchId, requestId, visitId };
  });
  return { t, ids, signed: t.withIdentity({ subject: "clerk|coordinator", email: "c@example.org", emailVerified: true }) };
}
type Body = { state: Record<string, unknown>; questions: Record<string, unknown> };
const replying = (answers: Record<string, unknown>) => vi.fn<(url: string, init: { body: string }) => Promise<Response>>(async () => Response.json({ answers }));
const yes = (noul: number) => ({ type: "noul", noul });

describe("referral suggestions", () => {
  test("only places at 0.9 are offered; names, addresses and place names never leave", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = replying({ p0: yes(0.4), p1: yes(0.97) });
    vi.stubGlobal("fetch", fetch);
    const { ids, signed } = await group();
    const found = await signed.action(api.drafts.suggestReferrals, { churchId: ids.churchId, requestId: ids.requestId });
    expect(found).toEqual({ places: ["Harvest Pantry"], verification: "checked" });
    const body = JSON.parse(fetch.mock.calls[0][1].body) as Body;
    // A place with nothing under "helps with" is not asked about.
    expect(Object.keys(body.questions)).toEqual(["p0", "p1"]);
    expect(fetch.mock.calls[0][1].body).not.toMatch(/Rosa|Delgado|14 Sample|Harvest|County Rent/);
  });

  test("with no key, nothing leaves and nothing is offered; signed-out is refused", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { t, ids, signed } = await group();
    const args = { churchId: ids.churchId, requestId: ids.requestId };
    expect(await signed.action(api.drafts.suggestReferrals, args)).toEqual({ places: [], verification: "review" });
    await expect(t.action(api.drafts.suggestReferrals, args)).rejects.toThrow("Sign in required.");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("what a visit found", () => {
  test("a need and signs at 0.9 are kept on the visit and shown on the board; nothing is started", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = replying({ noFood: yes(0.98), child: yes(0.95), medical: yes(0.93), alone: yes(0.6), chosenKind: { type: "choice", choice: "food", confidence: 0.94 } });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, signed } = await group();
    const read = await signed.action(api.drafts.readVisit, { churchId: ids.churchId, visitId: ids.visitId });
    expect(read).toEqual({ kind: "food", signs: ["noFood", "child", "medical"], verification: "checked" });
    expect(fetch.mock.calls[0][1].body).not.toMatch(/Rosa|Delgado|Ana Visitor/);
    const visit = await t.run(ctx => ctx.db.get("visits", ids.visitId));
    expect(visit?.found).toMatchObject({ kind: "food", signs: ["noFood", "child", "medical"] });
    expect(await t.run(ctx => ctx.db.query("assistanceRequests").collect())).toHaveLength(1);
  });

  test("an unsure pick is left out, and with no reply nothing is kept", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", replying({ chosenKind: { type: "choice", choice: "food", confidence: 0.7 } }));
    const { t, ids, signed } = await group();
    expect(await signed.action(api.drafts.readVisit, { churchId: ids.churchId, visitId: ids.visitId })).toMatchObject({ kind: null, signs: [] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await t.run(ctx => ctx.db.patch("visits", ids.visitId, { found: undefined }));
    expect(await signed.action(api.drafts.readVisit, { churchId: ids.churchId, visitId: ids.visitId })).toMatchObject({ verification: "review" });
    expect((await t.run(ctx => ctx.db.get("visits", ids.visitId)))?.found).toBeUndefined();
  });
});
