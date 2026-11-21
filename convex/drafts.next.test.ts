/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { decisionLines } from "../src/lib/repeat-words";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

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
    return { churchId, requestId, visitId, userId };
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
    const { t, ids } = await group();
    const read = await t.action(internal.drafts.readVisit, { churchId: ids.churchId, visitId: ids.visitId, userId: ids.userId });
    expect(read).toEqual({ kind: "food", signs: ["noFood", "child", "medical"], verification: "checked" });
    expect(fetch.mock.calls[0][1].body).not.toMatch(/Rosa|Delgado|Ana Visitor/);
    const visit = await t.run(ctx => ctx.db.get("visits", ids.visitId));
    expect(visit?.found).toMatchObject({ kind: "food", signs: ["noFood", "child", "medical"] });
    expect(await t.run(ctx => ctx.db.query("assistanceRequests").collect())).toHaveLength(1);
  });

  test("an unsure pick is left out, and with no reply nothing is kept", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", replying({ chosenKind: { type: "choice", choice: "food", confidence: 0.7 } }));
    const { t, ids } = await group();
    expect(await t.action(internal.drafts.readVisit, { churchId: ids.churchId, visitId: ids.visitId, userId: ids.userId })).toMatchObject({ kind: null, signs: [] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await t.run(ctx => ctx.db.patch("visits", ids.visitId, { found: undefined }));
    expect(await t.action(internal.drafts.readVisit, { churchId: ids.churchId, visitId: ids.visitId, userId: ids.userId })).toMatchObject({ verification: "review" });
    expect((await t.run(ctx => ctx.db.get("visits", ids.visitId)))?.found).toBeUndefined();
  });
});

describe("repeat help before a decision", () => {
  const day = 86_400_000;
  async function household() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "14 Sample St", adults: 1, children: 2, language: "es", notes: "", createdBy: memberId, createdAt: 0 });
      const base = { churchId, neighborId, decisionNote: "", payeeKind: "utility" as const, payeeName: "Lee Power", source: "person" as const, createdBy: memberId };
      await ctx.db.insert("assistanceRequests", { ...base, kind: "utility", summary: "Rosa Delgado: power bill $210 for October.", amountRequested: 21000, amountApproved: 21000, status: "paid", decidedAt: 190 * day, createdAt: 189 * day });
      await ctx.db.insert("assistanceRequests", { ...base, kind: "rent", summary: "Rent short $300.", amountRequested: 30000, status: "declined", createdAt: 30 * day });
      await ctx.db.insert("neighborNotes", { churchId, neighborId, body: "Rosa Delgado lives with her two children at 14 Sample St.", authorId: memberId, createdAt: 150 * day });
      const requestId = await ctx.db.insert("assistanceRequests", { ...base, kind: "utility", summary: "Rosa Delgado lives alone. Power bill $210 for October is unpaid.", amountRequested: 21000, status: "open", createdAt: 200 * day });
      return { churchId, requestId };
    });
    return { t, ids, signed: t.withIdentity({ subject: "clerk|coordinator", email: "c@example.org", emailVerified: true }) };
  }

  test("recent same-kind help comes from the records; readings show only at 0.9; no names leave", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const low = Object.fromEntries([0, 1, 2].flatMap(index => ["same", "differs", "home", "work", "paid"].map(field => [`${field}${index}`, yes(0.1)])));
    const fetch = replying({ ...low, same0: yes(0.97), home1: yes(0.95), differs2: yes(0.89) });
    vi.stubGlobal("fetch", fetch);
    const { ids, signed } = await household();
    const found = await signed.action(api.drafts.checkRepeat, ids);
    expect(found.recent).toEqual([{ at: 190 * day, kind: "utility", status: "paid", amount: 21000 }]);
    expect(found.same).toEqual([{ at: 189 * day, what: "request", kind: "utility" }]);
    expect(found.differs).toEqual([{ at: 150 * day, what: "note" }]);
    expect(decisionLines("en", found)).toEqual([
      { text: "Utility help was paid on July 9: $210.", assistant: false },
      { text: "The assistant reads this as the same need as the request from July 8.", assistant: true },
      { text: "The assistant reads the note from May 30 as saying otherwise. Read both before you decide.", assistant: true },
    ]);
    const body = JSON.parse(fetch.mock.calls[0][1].body) as Body;
    // Three earlier records, newest first, five questions each; the declined rent request is asked about but not flagged.
    expect(Object.keys(body.questions)).toHaveLength(15);
    expect(fetch.mock.calls[0][1].body).not.toMatch(/Rosa|Delgado|14 Sample|Lee Power/);
  });

  test("with no key nothing leaves but the records still speak; signed-out is refused", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { t, ids, signed } = await household();
    expect(await signed.action(api.drafts.checkRepeat, ids)).toMatchObject({ same: [], differs: [], verification: "review", recent: [{ kind: "utility" }] });
    await expect(t.action(api.drafts.checkRepeat, ids)).rejects.toThrow("Sign in required.");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the next step after a returned call", () => {
  async function returned(outcome: string) {
    const made = await group();
    const callId = await made.t.run(async ctx => {
      const member = (await ctx.db.query("memberships").first())!;
      const neighbor = (await ctx.db.query("neighbors").first())!;
      return ctx.db.insert("calls", { churchId: made.ids.churchId, neighborId: neighbor._id, callerName: "Rosa Delgado", phone: "", note: "Asked for a call back.", callback: "needed", takenBy: member._id, takenAt: Date.now() });
    });
    vi.useFakeTimers();
    await made.signed.mutation(api.assistance.markReturned, { churchId: made.ids.churchId, callId, outcome });
    await made.t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const row = (await made.signed.query(api.assistance.calls, { churchId: made.ids.churchId, at: Math.floor(Date.now() / 3_600_000) * 3_600_000 })).returned.find(call => call.id === callId);
    return { ...made, callId, row };
  }

  test("a step at 0.9 is kept on the call and shown; the outcome leaves without names; nothing is started", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = replying({ nextStep: { type: "choice", choice: "request", confidence: 0.95 } });
    vi.stubGlobal("fetch", fetch);
    const { t, row } = await returned("Rosa Delgado at 14 Sample St owes $150 on the power bill and asked us for help.");
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body) as Body;
    expect(Object.keys(body.questions)).toEqual(["nextStep"]);
    expect(Object.keys((body.questions.nextStep as { criteria: object }).criteria)).toEqual(["resolved", "request", "refer", "callAgain", "none"]);
    expect(fetch.mock.calls[0][1].body).not.toMatch(/Rosa|Delgado|14 Sample/);
    expect(row?.nextStep).toBe("request");
    expect(await t.run(ctx => ctx.db.query("assistanceRequests").collect())).toHaveLength(1);
  });

  test("under 0.9, or \"none\", nothing is shown; an empty outcome is never sent", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", replying({ nextStep: { type: "choice", choice: "refer", confidence: 0.8 } }));
    expect((await returned("Gave her the legal aid number.")).row?.nextStep).toBeNull();
    vi.stubGlobal("fetch", replying({ nextStep: { type: "choice", choice: "none", confidence: 0.99 } }));
    expect((await returned("Talked for a while.")).row?.nextStep).toBeNull();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await returned("")).row?.nextStep).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("a read that finishes after the return was undone keeps nothing", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", replying({ nextStep: { type: "choice", choice: "callAgain", confidence: 0.97 } }));
    const { t, ids, callId } = await returned("No answer, try again tomorrow.");
    await t.run(ctx => ctx.db.patch("calls", callId, { callback: "needed", returnedAt: undefined, nextStep: undefined }));
    expect(await t.action(internal.drafts.readOutcome, { churchId: ids.churchId, callId, returnedAt: 1, userId: ids.userId })).toBeNull();
    expect((await t.run(ctx => ctx.db.get("calls", callId)))?.nextStep).toBeUndefined();
  });

  test("the measured set is judged on the same 0.9 line", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", replying({ nextStep: { type: "choice", choice: "callAgain", confidence: 0.95 } }));
    const { t, ids } = await group();
    const run = await t.action(internal.drafts.measureNextStep, { churchId: ids.churchId });
    expect(run.status).toBe("done");
    expect(run.rows).toHaveLength(12);
    expect(run.all).toEqual({ right: 3, missed: 0, wrong: 9 });
    expect(run.heldOut).toEqual({ right: 1, missed: 0, wrong: 3 });
  });
});

describe("a caller who needs Spanish", () => {
  const at = () => Math.floor(Date.now() / 3600000) * 3600000;
  async function withCalls() {
    const { t, ids, signed } = await group();
    const more = await t.run(async ctx => {
      const memberId = (await ctx.db.query("memberships").first())!._id;
      await ctx.db.patch("memberships", memberId, { language: "es" });
      const luisUser = await ctx.db.insert("users", { clerkId: "clerk|luis" });
      await ctx.db.insert("memberships", { churchId: ids.churchId, userId: luisUser, name: "Luis Helper", email: "l@example.org", role: "member", active: true, approved: true, coverOptIn: false, language: "es" });
      const awayUser = await ctx.db.insert("users", { clerkId: "clerk|away" });
      await ctx.db.insert("memberships", { churchId: ids.churchId, userId: awayUser, name: "Away Person", email: "a@example.org", role: "member", active: false, approved: true, coverOptIn: false, language: "es" });
      const rosa = (await ctx.db.query("neighbors").first())!._id;
      const base = { churchId: ids.churchId, phone: "", callback: "needed" as const, takenBy: memberId, takenAt: Date.now() };
      return {
        unlinked: await ctx.db.insert("calls", { ...base, callerName: "Marta Sample", note: "Marta Sample llamó. Le van a cortar la luz el viernes." }),
        linked: await ctx.db.insert("calls", { ...base, callerName: "Rosa Delgado", neighborId: rosa, note: "Needs help with the power bill." }),
      };
    });
    return { t, ids, signed, ...more };
  }

  test("an unlinked call asks one more question in the same request, kept at 0.9 and shown with who speaks Spanish", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = replying({ spanish: yes(0.96) });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, signed, unlinked } = await withCalls();
    await signed.action(api.drafts.readUrgency, { churchId: ids.churchId, callId: unlinked });
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body) as Body;
    expect(body.questions.spanish).toEqual({ type: "noul", instructions: "Is note written in Spanish, or does it say the caller speaks Spanish?" });
    expect(fetch.mock.calls[0][1].body).not.toMatch(/Marta/);
    expect((await t.run(ctx => ctx.db.get("calls", unlinked)))?.spanish).toBe(true);
    const { waiting, spanishSpeakers } = await signed.query(api.assistance.calls, { churchId: ids.churchId, at: at() });
    expect(waiting.find(call => call.id === unlinked)?.spanish).toBe("assistant");
    expect(spanishSpeakers.sort()).toEqual(["Ana Visitor", "Luis Helper"]);
  });

  test("under 0.9 nothing is shown; a linked neighbor's record answers without asking", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = replying({ spanish: yes(0.6) });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, signed, unlinked, linked } = await withCalls();
    await signed.action(api.drafts.readUrgency, { churchId: ids.churchId, callId: unlinked });
    expect((await t.run(ctx => ctx.db.get("calls", unlinked)))?.spanish).toBe(false);
    await signed.action(api.drafts.readUrgency, { churchId: ids.churchId, callId: linked });
    expect(Object.keys((JSON.parse(fetch.mock.calls[1][1].body) as Body).questions)).not.toContain("spanish");
    expect((await t.run(ctx => ctx.db.get("calls", linked)))?.spanish).toBeUndefined();
    const { waiting } = await signed.query(api.assistance.calls, { churchId: ids.churchId, at: at() });
    expect(waiting.find(call => call.id === unlinked)?.spanish).toBeNull();
    expect(waiting.find(call => call.id === linked)?.spanish).toBe("record");
  });
});

describe("spending before a decision", () => {
  test("the month's approved help and an amount above every earlier one come from the records, with no model", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 0, language: "en", notes: "", createdBy: memberId, createdAt: 0 });
      const base = { churchId, neighborId, kind: "rent" as const, summary: "", decisionNote: "", payeeKind: "landlord" as const, payeeName: "", source: "person" as const, createdBy: memberId };
      const now = Date.now();
      for (let i = 0; i < 10; i++) await ctx.db.insert("assistanceRequests", { ...base, amountRequested: 30000, amountApproved: 30000, status: "paid", decidedAt: now - 1000 - i, createdAt: now - 2000 - i });
      const requestId = await ctx.db.insert("assistanceRequests", { ...base, amountRequested: 90000, status: "open", createdAt: now });
      return { churchId, requestId };
    });
    const signed = t.withIdentity({ subject: "clerk|coordinator", email: "c@example.org", emailVerified: true });
    const found = await signed.action(api.drafts.checkRepeat, ids);
    expect(decisionLines("en", found).map(line => line.text)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Approved so far in \w+: \$3,000\. \w+ last year: none\.$/),
      "This amount is above every rent approval in the past year. The middle amount was $300.",
    ]));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("monthly budget", () => {
  test("is set in whole cents, said with the month's approved help, cleared with null, and closed to signed-out callers", async () => {
    const t = convexTest(schema, modules);
    const churchId = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
      await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
      return churchId;
    });
    const signed = t.withIdentity({ subject: "clerk|coordinator", email: "c@example.org", emailVerified: true });
    await signed.mutation(api.treasury.setBudget, { churchId, budget: 200000 });
    expect(await signed.query(api.treasury.budget, { churchId, month: "2026-11" })).toEqual({ budget: 200000, approved: 0, householdCap: null });
    await expect(signed.mutation(api.treasury.setBudget, { churchId, budget: 12.5 })).rejects.toThrow("between $1");
    await signed.mutation(api.treasury.setHouseholdCap, { churchId, cap: 60000 });
    expect((await signed.query(api.treasury.budget, { churchId, month: "2026-11" })).householdCap).toBe(60000);
    await expect(signed.mutation(api.treasury.setHouseholdCap, { churchId, cap: 0 })).rejects.toThrow("between $1");
    await signed.mutation(api.treasury.setHouseholdCap, { churchId, cap: null });
    expect((await signed.query(api.treasury.budget, { churchId, month: "2026-11" })).householdCap).toBeNull();
    await signed.mutation(api.treasury.setBudget, { churchId, budget: null });
    expect((await signed.query(api.treasury.budget, { churchId, month: "2026-11" })).budget).toBeNull();
    await expect(t.mutation(api.treasury.setBudget, { churchId, budget: 100 })).rejects.toThrow();
  });
});
