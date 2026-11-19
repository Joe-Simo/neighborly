/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const description = "Our Welcome team serves every other Sunday. We need two people from 9am to 10am.";

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(ctx => ctx.db.insert("users", { clerkId: "clerk|sample" }));
  return { t, signed: t.withIdentity({ subject: "clerk|sample", email: "sample@example.org", emailVerified: true }) };
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("reviewable team drafting", () => {
  test("a team description leaves without the names, phones and addresses typed into it", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = vi.fn<(url: string, init: { body: string }) => Promise<Response>>(async () => Response.json({ answers: {} }));
    vi.stubGlobal("fetch", fetch);
    const { signed } = await setup();
    const draft = await signed.action(api.drafts.suggestTeam, { description: "Our Welcome team serves every Sunday from 9am to 10am. We need two people. Ask Rosa Delgado, (239) 555-0142, rosa@sample.example, 14 Sample Street." });
    const sent = fetch.mock.calls[0][1].body;
    expect(sent).toContain("every");
    expect(sent).not.toMatch(/Rosa|Delgado|555-0142|rosa@|14 Sample/);
    // The dialog shows the person exactly what left: the same scrubbed words, and nothing when nothing was asked.
    expect(draft.sent).toContain("welcome team serves every Sunday");
    expect(draft.sent).not.toMatch(/Rosa|Delgado|555-0142|rosa@|14 Sample/);
    expect(sent).toContain(JSON.stringify(draft.sent).slice(1, -1));
    const unread = await signed.action(api.drafts.suggestTeam, { description: "Ask Rosa Delgado, (239) 555-0142, about Saturdays." });
    expect(unread).toMatchObject({ teamName: "", verification: "review", sent: "" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("there is one door to the model, and it takes identity out of everything it is handed", async () => {
    // Every path to Jev goes through decide(); a second fetch in this file would be a way around the scrubbing.
    const source = (await import("./drafts.ts?raw")).default as string;
    expect(source.match(/\bfetch\(/g)).toHaveLength(1);
    expect(source).toContain("state: scrubbed(state, known)");
    expect(source.match(/api\.typesafe\.ai/g)).toHaveLength(1);
  });

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

  test("the name, phone and address are taken out before the note leaves, and the model writes nothing", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ kind: 0.99, amountRequested: 0.99, payeeKind: 0.99 });
    vi.stubGlobal("fetch", fetch);
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft.verification).toBe("checked");
    const sent = fetch.mock.calls[0][1].body;
    expect(sent).not.toMatch(/rosa|delgado|555|0142|14 sample|apt 2|property co/i);
    expect(sent).toContain("four hundred fifty");
    const body = JSON.parse(sent) as { state: Record<string, unknown>; questions: Record<string, { type: string; instructions: string }> };
    // Each question says in plain words what is being asked; a bare field name gave the live model nothing to judge.
    expect(Object.keys(body.state)).toEqual(["note"]);
    expect(body.questions.kind.instructions).toContain("mention rent, a landlord or an eviction");
    // The amount is read by code from the note's own words and is not asked about.
    expect(Object.keys(body.questions)).toEqual(["kind", "payeeKind", "chosenKind"]);
    expect(JSON.parse(sent)).toMatchObject({ model: "jev-1.14.0" });
    expect(draft.amountRequested).toBe(45000);
    expect(body.questions.payeeKind.instructions).toContain("mention a landlord?");
    // Two yes-or-no questions and one pick from a closed list; no question asks for text.
    expect(Object.values(body.questions).map(question => question.type)).toEqual(["noul", "noul", "choice"]);
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

  test("urgent signs are read from the note, a doubtful one is dropped, and the server says whose reading it was", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ shutoff: 0.97, alone: 0.3 });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, coordinator, member } = await helpLine();
    await t.run(ctx => ctx.db.patch("calls", ids.callId, { note: "Rosa Delgado has a power shut-off notice for the 21st. Lives alone." }));
    const args = { churchId: ids.churchId, callId: ids.callId };
    const mark = async () => (await t.run(ctx => ctx.db.get("calls", ids.callId)))?.urgent;
    // Checked by the model: the assistant's.
    expect(await coordinator.action(api.drafts.readUrgency, args)).toEqual({ signs: [{ reason: "shutoff", day: 21 }], verification: "checked" });
    expect(await mark()).toEqual({ reasons: ["shutoff"], day: 21, by: "assistant" });
    expect(fetch.mock.calls[0][1].body).not.toMatch(/rosa|delgado/i);
    await expect(member.action(api.drafts.readUrgency, args)).rejects.toThrow("coordinators and owners only");
    // The model away: the fixed rules alone, and saved as theirs.
    vi.stubEnv("TYPESAFE_API_KEY", "");
    expect(await coordinator.action(api.drafts.readUrgency, args)).toEqual({ signs: [{ reason: "shutoff", day: 21 }, { reason: "alone", day: null }], verification: "review" });
    expect(await mark()).toEqual({ reasons: ["shutoff", "alone"], day: 21, by: "rules" });
    // A person's word is never overwritten by a reading.
    await coordinator.mutation(api.assistance.setUrgency, { ...args, reasons: [] });
    await coordinator.action(api.drafts.readUrgency, args);
    expect((await mark())?.by).toBe("person");
    expect(await t.run(ctx => ctx.db.query("auditEvents").collect())).toEqual([]);
  });

  test("once the month's allowance is used, the urgent signs come from the rules alone and nothing leaves", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ shutoff: 0.97, alone: 0.3 });
    vi.stubGlobal("fetch", fetch);
    const { t, ids, coordinator } = await helpLine();
    await t.run(async ctx => {
      await ctx.db.patch("calls", ids.callId, { note: "Rosa Delgado has a power shut-off notice for the 21st. Lives alone." });
      await ctx.db.insert("aiUsageByChurch", { churchId: ids.churchId, month: new Date().toISOString().slice(0, 7), count: 2000 });
    });
    expect(await coordinator.action(api.drafts.readUrgency, { churchId: ids.churchId, callId: ids.callId })).toEqual({ signs: [{ reason: "shutoff", day: 21 }, { reason: "alone", day: null }], verification: "review" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("what was sent and each answer are kept with the call, open only to those who can open the note", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
      vi.stubGlobal("fetch", answers({ kind: 0.99, payeeKind: 0.99, chosenKind: 0.99 }));
      const { t, ids, coordinator, member } = await helpLine();
      const args = { churchId: ids.churchId, callId: ids.callId };
      await coordinator.action(api.drafts.draftRequest, args);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const draft = await coordinator.query(api.aiReads.latest, { ...args, purpose: "draft" });
      expect(draft).toMatchObject({ model: "jev-1.14.0", outcome: "checked" });
      expect(draft?.sentText).not.toMatch(/rosa|delgado|555|0142|14 sample/i);
      expect(draft?.asked.map((one) => [one.key, one.yes])).toEqual([["kind", true], ["payeeKind", true], ["chosenKind", true]]);
      expect(draft?.asked[0].question).toContain("mention rent");
      await expect(member.query(api.aiReads.latest, { ...args, purpose: "draft" })).rejects.toThrow("coordinators and owners only");
      await expect(coordinator.query(api.aiReads.latest, { ...args, churchId: ids.otherChurch, purpose: "draft" })).rejects.toThrow();
      // The draft going takes what was sent for it; the urgency reading stays with the note.
      await coordinator.action(api.drafts.readUrgency, args);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await coordinator.query(api.aiReads.latest, { ...args, purpose: "urgency" })).not.toBeNull();
      await coordinator.mutation(api.assistance.discardDraft, args);
      expect(await coordinator.query(api.aiReads.latest, { ...args, purpose: "draft" })).toBeNull();
      // The neighbor's record removed: the note goes, and every row about it with it.
      await t.run(async ctx => {
        const own = await ctx.db.query("memberships").collect();
        for (const one of own) if (one.role === "coordinator") await ctx.db.patch("memberships", one._id, { role: "owner" });
      });
      const neighborId = (await t.run(ctx => ctx.db.get("calls", ids.callId)))!.neighborId!;
      await coordinator.mutation(api.neighbors.remove, { churchId: ids.churchId, neighborId, typedName: "Rosa Delgado" });
      expect(await t.run(ctx => ctx.db.query("aiReads").collect())).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  test("a call removed takes its rows, and a failed keep never holds up the answer", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
      vi.stubGlobal("fetch", answers({ kind: 0.99, payeeKind: 0.99, chosenKind: 0.99 }));
      const { t, ids, coordinator } = await helpLine();
      const args = { churchId: ids.churchId, callId: ids.callId };
      await coordinator.action(api.drafts.draftRequest, args);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      await t.run(ctx => ctx.db.patch("calls", ids.callId, { takenAt: Date.now() }));
      await coordinator.mutation(api.assistance.takeBackCall, args);
      expect(await t.run(ctx => ctx.db.query("aiReads").collect())).toEqual([]);
      // A keep that finds its call gone writes nothing and throws nothing.
      await t.mutation(internal.aiReads.keep, { ...args, purpose: "draft", sentText: "x", asked: [], model: "jev-1.14.0", outcome: "review", at: 0 });
      expect(await t.run(ctx => ctx.db.query("aiReads").collect())).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  test("a record of what was sent goes after 30 days, and a newer one stays", async () => {
    const { t, ids } = await helpLine();
    const day = 86_400_000;
    await t.run(async ctx => {
      for (const at of [Date.now() - 31 * day, Date.now() - day]) await ctx.db.insert("aiReads", { churchId: ids.churchId, callId: ids.callId, purpose: "draft", sentText: "behind on rent", asked: [], model: "jev-1.14.0", outcome: "review", at });
    });
    await t.mutation(internal.aiReads.dropOld, {});
    const left = await t.run(ctx => ctx.db.query("aiReads").collect());
    expect(left).toHaveLength(1);
    expect(left[0].at).toBeGreaterThan(Date.now() - 2 * day);
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
      // A voucher given from the shelf is marked paid with no money owed: never a missing payment.
      await ctx.db.insert("assistanceRequests", { churchId: ids.churchId, neighborId: neighbor._id, kind: "voucher", summary: "A bed", amountRequested: 0, amountApproved: 0, status: "paid", decisionNote: "", payeeKind: "vendor", payeeName: "", voucher: { item: "Bed", quantity: 1 }, source: "person", createdBy: ids.coordinator.memberId, createdAt: now - 40 * day });
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
      // Well past three days: the note is asked by the hour, so an age turns over up to an hour late.
      await ctx.db.patch("calls", ids.callId, { takenAt: now - 3 * day - 7_200_000 });
      await ctx.db.insert("calls", { churchId: ids.churchId, callerName: "Earl Jennings", phone: "(239) 555-0178", note: "Power shut-off notice for the 21st. Lives alone.", callback: "needed", takenBy: ids.coordinator.memberId, takenAt: now - day, urgent: { reasons: ["shutoff"], day: 21, by: "assistant" } });
      // Put first by the fixed rules alone (the model away): counted as the rules', never as the assistant's.
      await ctx.db.insert("calls", { churchId: ids.churchId, callerName: "Sample Caller", phone: "", note: "Eviction notice.", callback: "needed", takenBy: ids.coordinator.memberId, takenAt: now - day, urgent: { reasons: ["eviction"], by: "rules" } });
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
    const note = await coordinator.query(api.drafts.weekNote, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId: ids.churchId });
    expect(note).toEqual({ callsWaiting: 3, callsFirstByAssistant: 1, callsFirstByRules: 1, callsFirstByPerson: 0, oldestWaitingDays: 3, visitsPlanned: 1, requestsOpen: 0, approvedUnpaid: 1, approvedUnpaidCents: 25000, openPlaces: 1, away: 1 });
    // The hour asked about began before a call taken within it: its age reads zero, never less.
    expect((await coordinator.query(api.drafts.weekNote, { at: Math.floor(Date.now() / 3600000) * 3600000 - 96 * 3600000, churchId: ids.churchId })).oldestWaitingDays).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    await expect(member.query(api.drafts.weekNote, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId: ids.churchId })).rejects.toThrow("coordinators and owners only");
  });

  test("scores from the live runs: 0.9 stands, 0.89 and below leave the field blank for a person", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const { ids, coordinator } = await helpLine();
    const args = { churchId: ids.churchId, callId: ids.callId };
    // Call 1 of the second run: every field at or over the line, payee exactly on it.
    vi.stubGlobal("fetch", answers({ kind: 0.91, amountRequested: 0.97, payeeKind: 0.9 }));
    expect(await coordinator.action(api.drafts.draftRequest, args)).toMatchObject({ kind: "rent", amountRequested: 45000, payeeKind: "landlord", verification: "checked" });
    // Call 2: a kind at 0.53 and a payee a hair under the line are both left for a person, and said so.
    // The amount no longer depends on a score: the note gives one amount, so code shows it.
    vi.stubGlobal("fetch", answers({ kind: 0.53, payeeKind: 0.89 }));
    const unsure = await coordinator.action(api.drafts.draftRequest, args);
    expect(unsure).toMatchObject({ kind: null, amountRequested: 45000, payeeKind: null, verification: "checked" });
    expect(unsure.notes).toEqual(expect.arrayContaining(["Please confirm the kind of help.", "Please confirm who is paid."]));
    // Call 3: 0.18 is a no.
    vi.stubGlobal("fetch", answers({ kind: 0.18, amountRequested: 0.99, payeeKind: 0.99 }));
    expect(await coordinator.action(api.drafts.draftRequest, args)).toMatchObject({ kind: null, amountRequested: 45000 });
    // Urgency from the same runs: both signs of a call well over the line are kept.
    await coordinator.run(ctx => ctx.db.patch("calls", ids.callId, { note: "Power bill of $186.40 with a shut-off on the 24th. Two kids at home." }));
    vi.stubGlobal("fetch", answers({ shutoff: 0.94, child: 0.98 }));
    expect(await coordinator.action(api.drafts.readUrgency, args)).toEqual({ signs: [{ reason: "shutoff", day: 24 }, { reason: "child", day: null }], verification: "checked" });
  });

  test("the kind of help: two readings that agree stand, a disagreement is left blank, and Jev reads what code cannot", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const { ids, coordinator } = await helpLine();
    const args = { churchId: ids.churchId, callId: ids.callId };
    const reply = (kind: number, choice: string, confidence: number) => vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: {
      kind: { type: "noul", noul: kind }, payeeKind: { type: "noul", noul: 0.95 },
      chosenKind: { type: "choice", choice, confidence, probabilities: {} },
    } })));
    // Code says rent and Jev picks rent at 0.85: under the line for a pick alone, enough when code proposed the same.
    reply(0.87, "rent", 0.85);
    expect(await coordinator.action(api.drafts.draftRequest, args)).toMatchObject({ kind: "rent", verification: "checked" });
    // A note that mentions rent and asks for nothing: sure the word is there (0.99), unsure anything is asked (0.57).
    // These are the scores of the one wrong mark in the second measured run; the pick has to carry the kind.
    reply(0.99, "rent", 0.57);
    expect(await coordinator.action(api.drafts.draftRequest, args)).toMatchObject({ kind: null });
    // Code says rent, Jev picks something else or "none": left for a person, however sure either is.
    reply(0.97, "utility", 0.94);
    const split = await coordinator.action(api.drafts.draftRequest, args);
    expect(split).toMatchObject({ kind: null, payeeKind: "landlord" });
    expect(split.notes).toContain("Please confirm the kind of help.");
    reply(0.97, "none", 0.94);
    expect(await coordinator.action(api.drafts.draftRequest, args)).toMatchObject({ kind: null });
  });

  test("a note code cannot read: Jev's pick of the kind stands at 0.9, not under it, and never a kind outside the list", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const { ids, coordinator } = await helpLine();
    const args = { churchId: ids.churchId, callId: ids.callId };
    await coordinator.run(ctx => ctx.db.patch("calls", ids.callId, { note: "No tiene comida en casa para los niños." }));
    const reply = (choice: string, confidence: number) => vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: { chosenKind: { type: "choice", choice, confidence, probabilities: {} } } })));
    const missing = "The note does not say what kind of help is asked for.";
    reply("food", 0.93);
    const read = await coordinator.action(api.drafts.draftRequest, args);
    expect(read).toMatchObject({ kind: "food", amountRequested: null, payeeKind: null, verification: "checked" });
    expect(read.notes).not.toContain(missing);
    reply("food", 0.89);
    expect(await coordinator.action(api.drafts.draftRequest, args)).toMatchObject({ kind: null, verification: "checked", notes: expect.arrayContaining([missing]) });
    reply("housing", 0.99);
    expect(await coordinator.action(api.drafts.draftRequest, args)).toMatchObject({ kind: null, verification: "checked" });
  });

  test("a sign code cannot read is shown when Jev is sure of it, without a day, and never under the line", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const { ids, coordinator } = await helpLine();
    await coordinator.run(ctx => ctx.db.patch("calls", ids.callId, { note: "Pa gen manje lakay la. Kouran an ap koupe 21." }));
    // Scores from the measured run: hungry at 0.82 was not true of the note, so under 0.9 nothing is shown.
    const fetch = answers({ shutoff: 0.95, noFood: 0.92, hungry: 0.82, child: 0.02 });
    vi.stubGlobal("fetch", fetch);
    expect(await coordinator.action(api.drafts.readUrgency, { churchId: ids.churchId, callId: ids.callId })).toEqual({ signs: [{ reason: "shutoff", day: null }, { reason: "noFood", day: null }], verification: "checked" });
    const { questions } = JSON.parse(fetch.mock.calls[0][1].body) as { questions: Record<string, { type: string; criteria?: Record<string, string> }> };
    expect(Object.keys(questions)).toHaveLength(8);
    expect(Object.values(questions).every(question => question.type === "noul" && question.criteria)).toBe(true);
  });

  test("the note as the assistant is given it has no name, phone or address, and a member cannot ask for it", async () => {
    const { ids, coordinator, member } = await helpLine();
    await coordinator.run(ctx => ctx.db.patch("calls", ids.callId, { callerName: "Rosa Delgado", note: "Mrs. Rosa Delgado called, (239) 555-0142. Light bill is $145. She lives at 14 Sample Street." }));
    const sent = await coordinator.query(api.drafts.noteAsSent, { churchId: ids.churchId, callId: ids.callId });
    expect(sent).toContain("Light bill is $145");
    expect(sent).not.toMatch(/Rosa|Delgado|555|Sample Street/);
    await expect(member.query(api.drafts.noteAsSent, { churchId: ids.churchId, callId: ids.callId })).rejects.toThrow();
  });

  test("a neighbor added a moment ago is taken out of the very next note, and so is a new name after a rename", async () => {
    const { t, ids, coordinator } = await helpLine();
    // Before the backfill there is no list: the scrub reads the records themselves and still takes the names out.
    await coordinator.run(ctx => ctx.db.patch("calls", ids.callId, { note: "Marisol drove her here. Rent is $450." }));
    const asNote = () => coordinator.query(api.drafts.noteAsSent, { churchId: ids.churchId, callId: ids.callId });
    await t.mutation(internal.knownNames.backfill, {});
    expect(await asNote()).toContain("Marisol drove");
    const person = { phone: "", email: "", address: "", adults: 1, children: 0, language: "en" as const, notes: "" };
    const marisol = await coordinator.mutation(api.neighbors.create, { churchId: ids.churchId, name: "Marisol Vega", ...person, confirmedNew: true });
    expect(await asNote()).not.toMatch(/Marisol|Vega/);
    await coordinator.run(ctx => ctx.db.patch("calls", ids.callId, { note: "Ines drove her here. Rent is $450." }));
    await coordinator.mutation(api.neighbors.update, { churchId: ids.churchId, neighborId: marisol, name: "Ines Brandt", ...person });
    expect(await asNote()).not.toMatch(/Ines/);
    expect(await asNote()).toContain("$450");
  });

  test("with no list yet the scrub reads every record, so a note is never sent unscrubbed", async () => {
    const { ids, coordinator } = await helpLine();
    await coordinator.run(async ctx => {
      await ctx.db.insert("neighbors", { churchId: ids.churchId, name: "Marisol Vega", nameKey: "marisol vega", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 0, language: "en", notes: "", createdBy: ids.coordinator.memberId, createdAt: 0 });
      await ctx.db.patch("calls", ids.callId, { note: "Marisol drove her here. Rent is $450." });
    });
    expect(await coordinator.query(api.drafts.noteAsSent, { churchId: ids.churchId, callId: ids.callId })).not.toMatch(/Marisol/);
  });

  test("a field the model is not sure of comes back blank", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", answers({ kind: 0.99, payeeKind: 0.4 }));
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft).toMatchObject({ kind: "rent", amountRequested: 45000, payeeKind: null, verification: "checked" });
    expect(draft.notes).toContain("Please confirm who is paid.");
  });

  test("who is paid, read from the payee's own name, is not asked of a model that never sees the name", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ kind: 0.99 });
    vi.stubGlobal("fetch", fetch);
    const { ids, coordinator } = await helpLine();
    await coordinator.run(ctx => ctx.db.patch("calls", ids.callId, { note: "Water bill is $72 and due on the 28th. Paid to County Water Authority." }));
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    const body = JSON.parse(fetch.mock.calls[0][1].body) as { state: { note: string }; questions: Record<string, unknown> };
    expect(body.state.note).not.toContain("County");
    expect(Object.keys(body.questions)).toEqual(["kind", "chosenKind"]);
    expect(draft).toMatchObject({ kind: "utility", amountRequested: 7200, payeeKind: "utility", payeeName: "County Water Authority", verification: "checked" });
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

  test("the measuring run sends only made-up notes, counts against the month, and reports marks and scores without a note", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    type Asked = { state: { note: string }; questions: Record<string, { type: string }> };
    const fetch = vi.fn<(url: string, init: { body: string }) => Promise<Response>>(async (_url, init) => {
      const { questions } = JSON.parse(init.body) as Asked;
      return Response.json({ answers: Object.fromEntries(Object.entries(questions).map(([name, question]) => [name, question.type === "choice" ? { type: "choice", choice: "food", confidence: 0.95, probabilities: {} } : { type: "noul", noul: name.startsWith("choose_") ? 0.02 : 0.95 }])) });
    });
    vi.stubGlobal("fetch", fetch);
    const { t, ids } = await helpLine();
    const before = await t.run(ctx => ctx.db.query("calls").collect());
    const report = await t.action(internal.drafts.measure, { churchId: ids.churchId });
    expect(report).toMatchObject({ status: "done", notes: 38, unanswered: 0, model: "jev-1.14.0" });
    // Every top line counts all 38 notes, and every line under "fresh" the 12 fresh ones: no line leaves out a row it shows.
    for (const arm of ["mix", "confirm", "choose"] as const) {
      const marks = report.rows.flatMap(row => Object.values(row[arm] ?? {}));
      for (const mark of ["right", "blank", "wrong"] as const) expect(report[arm][mark]).toBe(marks.filter(value => value === mark).length);
      expect(report[arm].right + report[arm].blank + report[arm].wrong).toBe(152);
      expect(report.fresh[arm].right + report.fresh[arm].blank + report.fresh[arm].wrong).toBe(48);
    }
    expect(report.rows).toHaveLength(38);
    // The first note is the one the live runs passed: code proposes every field and each is confirmed.
    expect(report.rows[0]).toMatchObject({ id: "rent-eviction", confirm: { kind: "right", amount: "right", payeeKind: "right", signs: "right" }, choose: { kind: "wrong", signs: "blank" } });
    // The way the screens work: code says rent, this fake Jev picks food, so the kind is left blank instead of shown wrong.
    expect(report.rows[0].mix).toEqual({ kind: "blank", amount: "right", payeeKind: "right", signs: "right" });
    expect(report.mix.wrong).toBeLessThan(report.choose.wrong);
    expect(report.rows[0].scores).toMatchObject({ kind: 0.95, confirm_eviction: 0.95, choose_kind: "food", choose_kind_confidence: 0.95 });
    expect(JSON.stringify(report)).not.toMatch(/marisol|jennings|example lane|555|behind on/i);
    for (const [, init] of fetch.mock.calls) expect(init.body).not.toMatch(/marisol|vega|jennings|555-01|14 example/i);
    expect(await t.run(ctx => ctx.db.query("aiUsageByChurch").collect())).toMatchObject([{ churchId: ids.churchId, count: 38 }]);
    expect(await t.run(ctx => ctx.db.query("calls").collect())).toEqual(before);
    expect(await t.run(ctx => ctx.db.query("assistanceRequests").collect())).toEqual([]);
  });

  test("the measuring run does nothing without a key or without room in the month", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { t, ids } = await helpLine();
    vi.stubEnv("TYPESAFE_API_KEY", "");
    expect(await t.action(internal.drafts.measure, { churchId: ids.churchId })).toMatchObject({ status: "no key", rows: [] });
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    await t.run(ctx => ctx.db.insert("aiUsageByChurch", { churchId: ids.churchId, month: new Date().toISOString().slice(0, 7), count: 1990 }));
    expect(await t.action(internal.drafts.measure, { churchId: ids.churchId })).toMatchObject({ status: "no allowance", rows: [] });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the sample's allowance is each visitor's own", () => {
  test("one visitor's session runs out without touching another's, and other accounts keep their own count", async () => {
    vi.stubEnv("DEMO_CLERK_USER_ID", "clerk|visitor");
    const t = convexTest(schema, modules);
    const { userId, churchId } = await t.run(async ctx => ({
      userId: await ctx.db.insert("users", { clerkId: "clerk|visitor" }),
      churchId: await ctx.db.insert("churches", { name: "Sample", timeZone: "UTC", sample: true }),
    }));
    const session = (sid: string) => t.withIdentity({ subject: "clerk|visitor", email: "demo@kindhelps.com", emailVerified: true, sid });
    const ask = (sid: string) => session(sid).mutation(internal.drafts.reserve, { userId, churchId });
    // Five a minute each, so the clock moves a minute between rounds.
    vi.useFakeTimers({ now: Date.parse("2026-11-20T12:00:00Z") });
    const answers: string[] = [];
    for (let i = 0; i < 14; i++) { if (i % 5 === 0) vi.advanceTimersByTime(60_000); answers.push(await ask("sess_a")); }
    expect(answers.filter(a => a === "ok")).toHaveLength(12);
    expect(answers.at(-1)).toBe("month");
    // A second visitor is not held by the first one's use.
    expect(await ask("sess_b")).toBe("ok");
    vi.useRealTimers();
  });

  test("the nightly reset clears the days before today and keeps today's", async () => {
    vi.stubEnv("SAMPLE_NIGHTLY", "off");
    const t = convexTest(schema, modules);
    vi.useFakeTimers({ now: Date.parse("2026-11-20T09:00:00Z") });
    await t.run(async ctx => {
      await ctx.db.insert("aiUsageBySession", { session: "a", day: "2026-11-19", windowStart: 0, minute: 1, count: 3 });
      await ctx.db.insert("aiUsageBySession", { session: "b", day: "2026-11-20", windowStart: 0, minute: 1, count: 1 });
    });
    await t.mutation(internal.demo.nightly, {});
    expect((await t.run(ctx => ctx.db.query("aiUsageBySession").collect())).map(row => row.session)).toEqual(["b"]);
    vi.useRealTimers();
  });
});
