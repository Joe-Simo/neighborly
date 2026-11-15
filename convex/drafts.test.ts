/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const description = "Our Welcome team serves every other Sunday. We need two people from 9am to 10am.";

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { clerkId: "clerk|sample" }));
  return { t, signed: t.withIdentity({ subject: "clerk|sample", email: "sample@example.org", emailVerified: true }) };
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("reviewable team drafting", () => {
  test("requires authentication and works without an AI provider", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const { t, signed } = await setup();
    await expect(t.action(api.drafts.suggestTeam, { description })).rejects.toThrow("Sign in");
    const draft = await signed.action(api.drafts.suggestTeam, { description });
    expect(draft.teamName).toBe("Welcome team");
    expect(draft.peopleCount).toBe("2");
    expect(draft.verification).toBe("review");
  });

  test("uncertain AI checks remove proposed facts without creating records", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: {
      teamName: { type: "noul", noul: 0.99 }, recurrence: { type: "noul", noul: 0.2 },
      peopleCount: { type: "noul", noul: 0.99 }, time: { type: "noul", noul: 0.99 },
    } })));
    const { t, signed } = await setup();
    const draft = await signed.action(api.drafts.suggestTeam, { description });
    expect(draft.recurrence).toBe("");
    expect(draft.verification).toBe("checked");
    expect(await t.run(ctx => ctx.db.query("teams").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("memberships").collect())).toEqual([]);
  });

  test("limits provider requests and fails safely on malformed answers", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = vi.fn(async () => Response.json({ answers: { teamName: { type: "noul", noul: 2 } } }));
    vi.stubGlobal("fetch", fetch);
    const { signed } = await setup();
    for (let index = 0; index < 5; index++) {
      expect((await signed.action(api.drafts.suggestTeam, { description })).verification).toBe("review");
    }
    await expect(signed.action(api.drafts.suggestTeam, { description })).rejects.toThrow("wait a minute");
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});

describe("a call note drafted into a request", () => {
  const note = "Rosa Delgado called from (239) 555-0142, lives at 14 Sample St, Apt 2. Behind on November rent. The landlord says four hundred fifty by Friday. Landlord is Sample Property Co.";

  async function helpLine() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const otherChurch = await ctx.db.insert("churches", { name: "Elsewhere", timeZone: "UTC" });
      const join = async (role: "coordinator" | "member") => {
        const userId = await ctx.db.insert("users", { clerkId: `clerk|${role}` });
        return { userId, memberId: await ctx.db.insert("memberships", { churchId, userId, name: role, email: `${role}@example.org`, role, active: true, approved: true, coverOptIn: false }) };
      };
      const coordinator = await join("coordinator"), member = await join("member");
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "(239) 555-0142", phoneKey: "2395550142", email: "", address: "14 Sample St, Apt 2", adults: 2, children: 2, language: "es", notes: "", createdBy: coordinator.memberId, createdAt: 0 });
      const callId = await ctx.db.insert("calls", { churchId, neighborId, callerName: "Rosa Delgado", phone: "(239) 555-0142", note, callback: "needed", takenBy: coordinator.memberId, takenAt: 0 });
      return { churchId, otherChurch, coordinator, member, callId };
    });
    const as = (role: "coordinator" | "member") => t.withIdentity({ subject: `clerk|${role}`, email: `${role}@example.org`, emailVerified: true });
    return { t, ids, coordinator: as("coordinator"), member: as("member") };
  }
  const answers = (sure: Record<string, number>) => vi.fn<(url: string, init: { body: string }) => Promise<Response>>(async () => Response.json({ answers: Object.fromEntries(Object.entries(sure).map(([field, noul]) => [field, { type: "noul", noul }])) }));

  test("with no key the draft comes back for review, and nothing leaves", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft).toMatchObject({ kind: "rent", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co", verification: "review" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("members and people outside the group are refused", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const { t, ids, coordinator, member } = await helpLine();
    const args = { churchId: ids.churchId, callId: ids.callId };
    await expect(member.action(api.drafts.draftRequest, args)).rejects.toThrow("coordinators and owners only");
    await expect(t.action(api.drafts.draftRequest, args)).rejects.toThrow("Sign in required.");
    await expect(coordinator.action(api.drafts.draftRequest, { churchId: ids.otherChurch, callId: ids.callId })).rejects.toThrow("Workspace access required.");
  });

  test("the name, phone and address are taken out before the note leaves, and the model is asked yes or no only", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ kind: 0.99, amountRequested: 0.99, payeeKind: 0.99 });
    vi.stubGlobal("fetch", fetch);
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft.verification).toBe("checked");
    const sent = fetch.mock.calls[0][1].body;
    expect(sent).not.toMatch(/rosa|delgado|555|0142|14 sample|apt 2|property co/i);
    expect(sent).toContain("four hundred fifty");
    const body = JSON.parse(sent) as { state: { proposed: Record<string, string> }; questions: Record<string, { type: string }> };
    expect(body.state.proposed).toEqual({ kind: "rent", amountRequested: "$450.00", payeeKind: "landlord" });
    expect(Object.values(body.questions).map(question => question.type)).toEqual(["noul", "noul", "noul"]);
  });

  test("a very long note is not sent anywhere", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { t, ids, coordinator } = await helpLine();
    await t.run(ctx => ctx.db.patch("calls", ids.callId, { note: `Behind on rent, $450. ${"She said more. ".repeat(140)}` }));
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft).toMatchObject({ amountRequested: 45000, verification: "review" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("urgent signs are read from the note, a doubtful one is dropped, and nothing is written", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ shutoff: 0.97, alone: 0.3 });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, coordinator, member } = await helpLine();
    await t.run(ctx => ctx.db.patch("calls", ids.callId, { note: "Rosa Delgado has a power shut-off notice for the 21st. Lives alone." }));
    const args = { churchId: ids.churchId, callId: ids.callId };
    expect(await coordinator.action(api.drafts.readUrgency, args)).toEqual({ signs: [{ reason: "shutoff", day: 21 }], verification: "checked" });
    expect(fetch.mock.calls[0][1].body).not.toMatch(/rosa|delgado/i);
    await expect(member.action(api.drafts.readUrgency, args)).rejects.toThrow("coordinators and owners only");
    vi.stubEnv("TYPESAFE_API_KEY", "");
    expect(await coordinator.action(api.drafts.readUrgency, args)).toEqual({ signs: [{ reason: "shutoff", day: 21 }, { reason: "alone", day: null }], verification: "review" });
    expect(await t.run(ctx => ctx.db.query("auditEvents").collect())).toEqual([]);
  });

  test("a group that has used its month's allowance gets the draft for review, not an error", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ kind: 0.99, amountRequested: 0.99, payeeKind: 0.99 });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, coordinator } = await helpLine();
    const month = new Date().toISOString().slice(0, 7);
    await t.run(ctx => ctx.db.insert("aiUsageByChurch", { churchId: ids.churchId, month, count: 1999 }));
    const args = { churchId: ids.churchId, callId: ids.callId };
    expect((await coordinator.action(api.drafts.draftRequest, args)).verification).toBe("checked");
    expect((await coordinator.action(api.drafts.draftRequest, args)).verification).toBe("review");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await t.run(ctx => ctx.db.query("aiUsageByChurch").collect()))[0].count).toBe(2000);
  });

  test("before the yearly report: rules find what does not add up, the model reads only picked notes, nothing changes", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ n0: 0.98, n1: 0.2 });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, coordinator, member } = await helpLine();
    const day = 86_400_000, now = Date.now(), year = new Date(now).getUTCMonth() >= 9 ? new Date(now).getUTCFullYear() + 1 : new Date(now).getUTCFullYear();
    const made = await t.run(async ctx => {
      const neighbor = (await ctx.db.query("neighbors").first())!;
      const request = (status: "open" | "approved" | "paid", decisionNote: string, decidedAt?: number) => ctx.db.insert("assistanceRequests", { churchId: ids.churchId, neighborId: neighbor._id, kind: "rent", summary: "", amountRequested: 45000, status, decisionNote, decidedAt, payeeKind: "landlord", payeeName: "Sample Property Co", source: "person", createdBy: ids.coordinator.memberId, createdAt: now - 40 * day });
      const visit = (status: "scheduled" | "completed", notes: string, hours: number) => ctx.db.insert("visits", { churchId: ids.churchId, neighborId: neighbor._id, scheduledAt: now - 5 * day, status, visitors: [{ memberId: ids.coordinator.memberId, hours, miles: 0 }], notes, createdBy: ids.coordinator.memberId, createdAt: now - 6 * day });
      const settled = await request("paid", "");
      await ctx.db.insert("ledgerEntries", { churchId: ids.churchId, kind: "expense", amount: 45000, date: "2026-11-01", category: "rent", payee: "Sample Property Co", memo: "", requestId: settled, recordedBy: ids.coordinator.memberId, createdAt: now });
      return {
        paidNoPayment: await request("paid", ""), approvedNotPaid: await request("approved", "Approved at the meeting.", now - 35 * day),
        fresh: await request("approved", "Approved.", now - 2 * day),
        noteSaysPaid: await request("approved", "Rosa Delgado's landlord was paid by check on Friday.", now - 3 * day),
        doubtful: await request("open", "Ask whether the rent was paid."),
        visitNoHours: await visit("completed", "", 0), fine: await visit("completed", "", 1.5),
      };
    });
    const args = { churchId: ids.churchId, year };
    const result = await coordinator.action(api.drafts.checkYear, args);
    expect(result.verification).toBe("checked");
    expect(result.flags).toEqual([
      { kind: "paidNoPayment", record: { table: "assistanceRequests", id: made.paidNoPayment }, source: "rule" },
      { kind: "approvedNotPaid", record: { table: "assistanceRequests", id: made.approvedNotPaid }, source: "rule" },
      { kind: "visitNoHours", record: { table: "visits", id: made.visitNoHours }, source: "rule" },
      { kind: "noteSaysPaid", record: { table: "assistanceRequests", id: made.noteSaysPaid }, source: "assistant" },
    ]);
    expect(fetch.mock.calls[0][1].body).not.toMatch(/rosa|delgado/i);
    expect(JSON.stringify(result)).not.toMatch(/rosa|delgado/i);
    await expect(member.action(api.drafts.checkYear, args)).rejects.toThrow("coordinators and owners only");
    // With no key a person reads the picked notes themselves; it is never an error.
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const calm = await coordinator.action(api.drafts.checkYear, args);
    expect(calm.verification).toBe("review");
    expect(calm.flags.filter(flag => flag.kind === "noteSaysPaid").map(flag => flag.source)).toEqual(["rule", "rule"]);
    expect((await t.run(ctx => ctx.db.get("assistanceRequests", made.noteSaysPaid)))?.status).toBe("approved");
  });

  test("the Monday note is counted by code, asks the model nothing and names no one", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { t, ids, coordinator, member } = await helpLine();
    const day = 86_400_000, now = Date.now();
    await t.run(async ctx => {
      const neighbor = (await ctx.db.query("neighbors").first())!;
      await ctx.db.patch("calls", ids.callId, { takenAt: now - 3 * day - 1000 });
      await ctx.db.insert("calls", { churchId: ids.churchId, callerName: "Earl Jennings", phone: "(239) 555-0178", note: "Power shut-off notice for the 21st. Lives alone.", callback: "needed", takenBy: ids.coordinator.memberId, takenAt: now - day, urgent: { reasons: ["shutoff"], day: 21, by: "assistant" } });
      await ctx.db.insert("calls", { churchId: ids.churchId, callerName: "Mai Tran", phone: "(239) 555-0119", note: "No food today.", callback: "done", takenBy: ids.coordinator.memberId, takenAt: now - day });
      await ctx.db.insert("visits", { churchId: ids.churchId, neighborId: neighbor._id, scheduledAt: now + 2 * day, status: "scheduled", visitors: [], notes: "", createdBy: ids.coordinator.memberId, createdAt: now });
      await ctx.db.insert("visits", { churchId: ids.churchId, neighborId: neighbor._id, scheduledAt: now + 9 * day, status: "scheduled", visitors: [], notes: "", createdBy: ids.coordinator.memberId, createdAt: now });
      const request = await ctx.db.insert("assistanceRequests", { churchId: ids.churchId, neighborId: neighbor._id, kind: "rent", summary: "", amountRequested: 45000, amountApproved: 40000, status: "approved", decisionNote: "", payeeKind: "landlord", payeeName: "Sample Property Co", source: "person", createdBy: ids.coordinator.memberId, createdAt: now });
      await ctx.db.insert("ledgerEntries", { churchId: ids.churchId, kind: "expense", amount: 15000, date: "2026-11-01", category: "rent", payee: "Sample Property Co", memo: "", requestId: request, recordedBy: ids.coordinator.memberId, createdAt: now });
      const teamId = await ctx.db.insert("teams", { churchId: ids.churchId, name: "Tuesday team", description: "" });
      const shift = (start: number, assigneeId: typeof ids.member.memberId | null) => ctx.db.insert("commitments", { churchId: ids.churchId, teamId, title: "Help line", start, end: start + 7_200_000, location: "", preparation: "", assigneeId, coordinatorId: ids.coordinator.memberId, version: 1 });
      await shift(now + day, null); await shift(now + 2 * day, ids.member.memberId); await shift(now + 20 * day, null);
      const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
      await ctx.db.insert("timeOff", { churchId: ids.churchId, memberId: ids.member.memberId, start: iso(now - 2 * day), end: iso(now + 3 * day), note: "" });
    });
    const note = await coordinator.query(api.drafts.weekNote, { churchId: ids.churchId });
    expect(note).toEqual({ callsWaiting: 2, callsFirstByAssistant: 1, callsFirstByPerson: 0, oldestWaitingDays: 3, visitsPlanned: 1, requestsOpen: 0, approvedUnpaid: 1, approvedUnpaidCents: 25000, openPlaces: 1, away: 1 });
    expect(fetch).not.toHaveBeenCalled();
    await expect(member.query(api.drafts.weekNote, { churchId: ids.churchId })).rejects.toThrow("coordinators and owners only");
  });

  test("a field the model is not sure of comes back blank", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", answers({ kind: 0.99, amountRequested: 0.4, payeeKind: 0.99 }));
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft).toMatchObject({ kind: "rent", amountRequested: null, payeeKind: "landlord", verification: "checked" });
    expect(draft.notes).toContain("Please confirm the amount.");
  });

  test("drafting writes no request, and a failed check falls back to review", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    const { t, ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft.verification).toBe("review");
    expect(await t.run(ctx => ctx.db.query("assistanceRequests").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("ledgerEntries").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("auditEvents").collect())).toEqual([]);
  });
});
