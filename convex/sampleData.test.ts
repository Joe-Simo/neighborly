/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const tables = ["churches", "users", "memberships", "teams", "teamMembers", "commitments", "availability", "timeOff", "tasks", "announcements", "neighbors", "calls", "assistanceRequests", "visits", "ledgerEntries"] as const;

const start = () => convexTest(schema, modules);

async function everything(t: ReturnType<typeof start>) {
  return t.run(async (ctx) => ({
    churches: await ctx.db.query("churches").collect(),
    users: await ctx.db.query("users").collect(),
    memberships: await ctx.db.query("memberships").collect(),
    teams: await ctx.db.query("teams").collect(),
    teamMembers: await ctx.db.query("teamMembers").collect(),
    commitments: await ctx.db.query("commitments").collect(),
    availability: await ctx.db.query("availability").collect(),
    timeOff: await ctx.db.query("timeOff").collect(),
    tasks: await ctx.db.query("tasks").collect(),
    announcements: await ctx.db.query("announcements").collect(),
    neighbors: await ctx.db.query("neighbors").collect(),
    calls: await ctx.db.query("calls").collect(),
    assistanceRequests: await ctx.db.query("assistanceRequests").collect(),
    visits: await ctx.db.query("visits").collect(),
    ledgerEntries: await ctx.db.query("ledgerEntries").collect(),
  }));
}

describe("sample conference", () => {
  test("loads a year of activity that adds up", async () => {
    const t = start();
    const churchId = await t.mutation(internal.sampleData.load, {});
    const data = await everything(t);
    expect(data.churches).toMatchObject([{ _id: churchId, sample: true }]);
    expect(data.memberships.filter((member) => member.role === "owner")).toHaveLength(1);
    expect(data.neighbors).toHaveLength(40);
    // The overview reads at most 200 commitments, so the coming weeks must come first and the total stay under it.
    expect(data.commitments.length).toBeLessThanOrEqual(200);
    const finished = data.commitments.filter((shift) => shift.end < Date.now());
    expect(finished.length).toBeGreaterThanOrEqual(150);
    expect(finished.every((shift) => shift.assigneeId !== null)).toBe(true);
    expect(data.commitments.findIndex((shift) => shift.end < Date.now())).toBeGreaterThan(0);
    expect(data.teams.map((team) => team.name).sort()).toEqual(["Help line", "Home visitors", "Pantry"]);
    expect(data.calls.length).toBeGreaterThanOrEqual(60);
    for (const status of ["open", "approved", "declined", "paid", "closed"] as const)
      expect(data.assistanceRequests.some((request) => request.status === status), status).toBe(true);
    const span = Math.max(...data.calls.map((call) => call.takenAt)) - Math.min(...data.calls.map((call) => call.takenAt));
    expect(span).toBeGreaterThan(300 * 86400000);
    expect(Math.max(...data.calls.map((call) => call.takenAt))).toBeLessThanOrEqual(Date.now());

    // Every payment is tied to a paid request, for the approved amount, and every paid request has exactly one payment.
    const expenses = data.ledgerEntries.filter((entry) => entry.kind === "expense");
    const paid = data.assistanceRequests.filter((request) => request.status === "paid");
    expect(expenses).toHaveLength(paid.length);
    for (const request of paid) {
      const payments = expenses.filter((entry) => entry.requestId === request._id);
      expect(payments).toMatchObject([{ amount: request.amountApproved, neighborId: request.neighborId, payee: request.payeeName }]);
      expect(request.amountApproved).toBeLessThanOrEqual(request.amountRequested);
    }
    // The balance never goes below zero on any day of the year.
    let balance = 0;
    for (const entry of [...data.ledgerEntries].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "income" ? -1 : 1))) {
      expect(Number.isInteger(entry.amount) && entry.amount > 0).toBe(true);
      balance += entry.kind === "income" ? entry.amount : -entry.amount;
      expect(balance, entry.date).toBeGreaterThanOrEqual(0);
    }

    // Visits are always two different people; only completed visits carry hours and miles.
    expect(data.visits.some((visit) => visit.status === "scheduled")).toBe(true);
    for (const visit of data.visits) {
      expect(new Set(visit.visitors.map((visitor) => visitor.memberId)).size).toBe(2);
      const logged = visit.visitors.every((visitor) => visitor.hours > 0 && visitor.miles > 0);
      expect(logged).toBe(visit.status === "completed");
      if (visit.status === "scheduled") expect(visit.scheduledAt).toBeGreaterThan(Date.now());
    }
  });

  test("uses only invented contact details", async () => {
    const t = start();
    await t.mutation(internal.sampleData.load, {});
    const data = await everything(t);
    for (const member of data.memberships) expect(member.email).toMatch(/@neighborly\.example$/);
    for (const neighbor of data.neighbors) {
      expect(neighbor.phone).toMatch(/^\(555\) 01\d\d$/);
      if (neighbor.email) expect(neighbor.email).toMatch(/@neighborly\.example$/);
    }
    expect(new Set(data.neighbors.map((neighbor) => neighbor.nameKey)).size).toBe(40);
    expect(new Set(data.neighbors.map((neighbor) => neighbor.phoneKey)).size).toBe(40);
  });

  test("is the same conference every time", async () => {
    const shape = async () => {
      const t = start();
      await t.mutation(internal.sampleData.load, {});
      const data = await everything(t);
      return { neighbors: data.neighbors.map((neighbor) => [neighbor.name, neighbor.address]), requests: data.assistanceRequests.map((request) => [request.kind, request.amountRequested]) };
    };
    expect(await shape()).toEqual(await shape());
  });

  test("a real owner keeps their account when the sample is cleared, and nothing else is touched", async () => {
    const t = start();
    const kept = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const churchId = await ctx.db.insert("churches", { name: "Real", timeZone: "UTC" });
      await ctx.db.insert("memberships", { churchId, userId, name: "Judge", email: "judge@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
      return { userId, churchId };
    });
    const sample = await t.mutation(internal.sampleData.load, { owner: { userId: kept.userId, name: "Judge", email: "judge@example.org" } });
    const loaded = await everything(t);
    expect(loaded.memberships.filter((member) => member.churchId === sample && member.role === "owner")).toMatchObject([{ userId: kept.userId }]);

    await expect(t.mutation(internal.sampleData.clear, { churchId: kept.churchId })).rejects.toThrow("Only a sample group can be cleared.");
    await t.mutation(internal.sampleData.clear, { churchId: sample });
    const after = await everything(t);
    expect(after.churches.map((church) => church._id)).toEqual([kept.churchId]);
    expect(after.users.map((user) => user._id)).toEqual([kept.userId]);
    expect(after.memberships).toHaveLength(1);
    for (const table of tables.slice(3)) expect(after[table], table).toHaveLength(0);
  });
});
