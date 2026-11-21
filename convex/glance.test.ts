/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const DAY = 86_400_000;
const at = Date.UTC(2026, 10, 16, 15);

async function group() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const churchId = await ctx.db.insert("churches", { name: "Glance Conference", timeZone: "America/New_York", monthlyBudget: 200000 });
    const leadUser = await ctx.db.insert("users", { clerkId: "clerk|lead" });
    const leadId = await ctx.db.insert("memberships", { churchId, userId: leadUser, name: "Ana Lead", email: "l@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
    const memberUser = await ctx.db.insert("users", { clerkId: "clerk|member" });
    const memberId = await ctx.db.insert("memberships", { churchId, userId: memberUser, name: "Ben Visitor", email: "m@example.org", role: "member", active: true, approved: true, coverOptIn: false });
    const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 0, language: "en", notes: "", createdBy: leadId, createdAt: 0 });
    const base = { churchId, neighborId, summary: "", decisionNote: "", payeeKind: "landlord" as const, payeeName: "", source: "person" as const, createdBy: leadId };
    await ctx.db.insert("assistanceRequests", { ...base, kind: "rent", amountRequested: 40000, amountApproved: 40000, status: "paid", decidedAt: at - 5 * DAY, createdAt: at - 6 * DAY });
    await ctx.db.insert("assistanceRequests", { ...base, kind: "rent", amountRequested: 25000, amountApproved: 25000, status: "paid", decidedAt: at - 370 * DAY, createdAt: at - 371 * DAY });
    await ctx.db.insert("assistanceRequests", { ...base, kind: "food", amountRequested: 5000, status: "open", createdAt: at - 3 * DAY });
    await ctx.db.insert("calls", { churchId, callerName: "Late Caller", phone: "", note: "", callback: "needed", ownerId: leadId, takenAt: at - 3 * DAY, urgent: { reasons: ["shutoff"], by: "assistant" } });
    await ctx.db.insert("calls", { churchId, callerName: "New Caller", phone: "", note: "", callback: "needed", takenAt: at - DAY / 2 });
    await ctx.db.insert("visits", { churchId, neighborId, scheduledAt: at + 2 * DAY, status: "scheduled", visitors: [{ memberId, hours: 0, miles: 0, response: "pending" }], notes: "", createdBy: leadId, createdAt: at });
    await ctx.db.insert("visits", { churchId, neighborId, scheduledAt: at - 2 * DAY, status: "scheduled", visitors: [{ memberId: leadId, hours: 0, miles: 0 }], notes: "", createdBy: leadId, createdAt: at });
    await ctx.db.insert("tasks", { churchId, title: "Bring the food", dueAt: at - DAY, assigneeId: memberId, complete: false });
    await ctx.db.insert("timeOff", { churchId, memberId, start: "2026-11-15", end: "2026-11-20", note: "" });
    await ctx.db.insert("ledgerEntries", { churchId, kind: "income", amount: 100000, date: "2026-11-01", category: "Collection", payee: "", memo: "", recordedBy: leadId, createdAt: at });
    await ctx.db.insert("ledgerEntries", { churchId, kind: "expense", amount: 40000, date: "2026-11-11", category: "Rent", payee: "", memo: "", recordedBy: leadId, createdAt: at });
    return { churchId };
  });
  const as = (who: string) => t.withIdentity({ subject: `clerk|${who}`, email: `${who[0]}@example.org`, emailVerified: true });
  return { churchId: ids.churchId, lead: as("lead"), member: as("member") };
}

describe("the home's glance", () => {
  test("a leader sees the whole conference, from the records", async () => {
    const { churchId, lead } = await group();
    const { conference, own } = await lead.query(api.glance.home, { churchId, at });
    expect(own).toEqual({ visitAsks: 0, tasks: 0, tasksLate: 0 });
    expect(conference).toEqual({
      callbacks: { owed: 2, late: 1, mine: 1 },
      month: { month: 11, approved: { now: 40000, before: 25000 }, budget: 200000, day: 16, days: 30 },
      year: { fiscalYear: 2027, approved: { now: 40000, before: 25000 }, households: { now: 1, before: 1 } },
      visits: { due: 1, late: 1 },
      volunteers: { active: 2, away: ["Ben Visitor"] },
      balance: 60000,
      flags: { urgent: 1, drafts: 0, doubles: 0 },
    });
  });

  test("a member sees only their own visits and tasks, and nothing of the conference", async () => {
    const { churchId, member } = await group();
    const { conference, own, councils } = await member.query(api.glance.home, { churchId, at });
    expect(conference).toBeNull();
    expect(councils).toEqual([]);
    expect(own).toEqual({ visitAsks: 1, tasks: 1, tasksLate: 1 });
  });
});
