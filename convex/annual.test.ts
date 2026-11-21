/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const HOUR = 3_600_000;

describe("the annual report's own lines, kept where the work happens", () => {
  test("a visit's place and other volunteers' hours, and goods given with a decision, reach the year", async () => {
    const t = convexTest(schema, modules);
    const now = Math.floor(Date.now() / HOUR) * HOUR;
    const ids = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 2, language: "en", notes: "", createdBy: memberId, createdAt: now - HOUR });
      const visitId = await ctx.db.insert("visits", { churchId, neighborId, scheduledAt: now - HOUR, status: "scheduled", visitors: [{ memberId, hours: 0, miles: 0 }], notes: "", createdBy: memberId, createdAt: now - 2 * HOUR });
      const requestId = await ctx.db.insert("assistanceRequests", { churchId, neighborId, kind: "food", summary: "Groceries", amountRequested: 0, status: "open", decisionNote: "", payeeKind: "vendor", payeeName: "", source: "person", createdBy: memberId, createdAt: now - HOUR });
      return { churchId, visitId, requestId };
    });
    const signed = t.withIdentity({ subject: "clerk|coordinator", email: "c@example.org", emailVerified: true });
    await expect(signed.mutation(api.visits.writeUp, { churchId: ids.churchId, visitId: ids.visitId, notes: "Visited at the hospital.", hours: 1, miles: 0, guestHours: -1 })).rejects.toThrow("other volunteers");
    await signed.mutation(api.visits.writeUp, { churchId: ids.churchId, visitId: ids.visitId, notes: "Visited at the hospital.", hours: 1, miles: 0, place: "hospital", guestHours: 2 });
    await expect(signed.mutation(api.assistance.decide, { churchId: ids.churchId, requestId: ids.requestId, decision: "declined", note: "", goods: { food: 1.5, furniture: 0, clothing: 0 } })).rejects.toThrow("whole counts");
    await signed.mutation(api.assistance.decide, { churchId: ids.churchId, requestId: ids.requestId, decision: "declined", note: "Gave a bag of groceries.", goods: { food: 12, furniture: 0, clothing: 3 } });
    const { current } = await signed.query(api.reports.years, { churchId: ids.churchId, at: now });
    const year = await signed.query(api.reports.year, { churchId: ids.churchId, at: now, year: current });
    expect(year.visitsByPlace.hospital).toEqual({ visits: 1, people: 3 });
    expect(year.visitsByPlace.home.visits).toBe(0);
    expect(year.guestHours).toBe(2);
    expect(year.goods).toEqual({ food: { times: 1, items: 12 }, furniture: { times: 0, items: 0 }, clothing: { times: 1, items: 3 } });
  });
});
