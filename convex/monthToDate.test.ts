/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { DateTime } from "luxon";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const zone = "America/New_York";
const HOUR = 3_600_000;

afterEach(() => vi.unstubAllEnvs());

describe("the month's approved help and budget", () => {
  test("the glance, the treasury and the approve sheet say the same figure and the same budget", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const now = Date.now();
    const start = DateTime.fromMillis(now, { zone }).startOf("month");
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: zone, sample: true, monthlyBudget: 300000 });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|lead" });
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Lead", email: "l@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Sample Neighbor", nameKey: "sample neighbor", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 0, language: "en", notes: "", createdBy: memberId, createdAt: 0 });
      const base = { churchId, neighborId, kind: "rent" as const, summary: "", decisionNote: "", payeeKind: "landlord" as const, payeeName: "", source: "person" as const, createdBy: memberId };
      const decided = (amount: number, status: "approved" | "paid" | "declined", decidedAt: number) =>
        ctx.db.insert("assistanceRequests", { ...base, amountRequested: amount, amountApproved: status === "declined" ? undefined : amount, status, decidedAt, createdAt: decidedAt - 1000 });
      // Paid and approved both count; a decline does not; the evening before the 1st in the group's own zone is last month.
      await decided(120000, "paid", start.toMillis() + 30 * 60_000);
      await decided(90000, "approved", start.toMillis() + HOUR);
      await decided(50000, "declined", start.toMillis() + 2 * HOUR);
      await decided(40000, "paid", start.toMillis() - 30 * 60_000);
      // Decided a moment ago, inside the hour the glance asks at: still in every room's figure.
      await decided(7000, "approved", now - 1);
      const requestId = await ctx.db.insert("assistanceRequests", { ...base, amountRequested: 30000, status: "open", createdAt: now });
      return { churchId, requestId };
    });
    const lead = t.withIdentity({ subject: "clerk|lead", email: "l@example.org", emailVerified: true });
    const expected = 120000 + 90000 + 7000;

    const glance = (await lead.query(api.glance.home, { churchId: ids.churchId, at: Math.floor(now / HOUR) * HOUR })).conference!.month;
    const treasury = await lead.query(api.treasury.budget, { churchId: ids.churchId, month: start.toFormat("yyyy-MM") });
    const sheet = (await lead.action(api.drafts.checkRepeat, ids)).spent;

    expect([glance.approved.now, treasury.approved, sheet.thisMonth]).toEqual([expected, expected, expected]);
    expect([glance.budget, treasury.budget, sheet.budget]).toEqual([300000, 300000, 300000]);
  });
});
