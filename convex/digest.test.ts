/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { paperEmail } from "../src/lib/email/paper-email";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const DAY = 86_400_000;
const at = Date.UTC(2026, 10, 16, 15);

async function group() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York", monthlyBudget: 200000 });
    const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
    const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
    const helperId = await ctx.db.insert("users", { clerkId: "clerk|member" });
    await ctx.db.insert("memberships", { churchId, userId: helperId, name: "Team Member", email: "m@example.org", role: "member", active: true, approved: true, coverOptIn: false });
    const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 0, language: "en", notes: "", createdBy: memberId, createdAt: 0 });
    const base = { churchId, neighborId, summary: "", decisionNote: "", payeeKind: "landlord" as const, payeeName: "", source: "person" as const, createdBy: memberId };
    await ctx.db.insert("assistanceRequests", { ...base, kind: "rent", amountRequested: 40000, amountApproved: 40000, status: "paid", decidedAt: at - 5 * DAY, createdAt: at - 6 * DAY });
    await ctx.db.insert("assistanceRequests", { ...base, kind: "rent", amountRequested: 30000, status: "open", createdAt: at - 3 * DAY });
    await ctx.db.insert("assistanceRequests", { ...base, kind: "food", amountRequested: 5000, status: "open", createdAt: at - DAY });
    await ctx.db.insert("calls", { churchId, callerName: "Marcus Bellamy", phone: "", note: "", callback: "needed", takenBy: memberId, ownerId: memberId, takenAt: at - 3 * DAY });
    await ctx.db.insert("calls", { churchId, callerName: "Recent Caller", phone: "", note: "", callback: "needed", takenBy: memberId, takenAt: at - DAY / 2 });
    return { churchId };
  });
  return { t, ids, signed: t.withIdentity({ subject: "clerk|coordinator", email: "c@example.org", emailVerified: true }), member: t.withIdentity({ subject: "clerk|member", email: "m@example.org", emailVerified: true }) };
}

describe("the week for deciders", () => {
  test("waiting requests oldest first with repeat marks, the month against budget, and overdue callbacks, from records", async () => {
    const { ids, signed } = await group();
    const { digest, emailed } = await signed.query(api.digest.week, { churchId: ids.churchId, at });
    expect(emailed).toBe(false);
    expect(digest.waiting.count).toBe(2);
    expect(digest.waiting.rows.map(row => [row.kind, row.days, row.repeat])).toEqual([["rent", 3, "recent"], ["food", 1, null]]);
    expect(digest.month).toEqual({ month: 11, approved: 40000, budget: 200000, lastYear: 0 });
    expect(digest.overdue).toMatchObject({ count: 1, rows: [{ name: "Marcus Bellamy", days: 3, owner: "Ana Visitor" }] });
  });

  test("closed to team members and to anyone signed out; the email is each person's own choice", async () => {
    const { t, ids, signed, member } = await group();
    await expect(member.query(api.digest.week, { churchId: ids.churchId, at })).rejects.toThrow("coordinators and owners only");
    await expect(t.query(api.digest.week, { churchId: ids.churchId, at })).rejects.toThrow();
    await expect(member.mutation(api.digest.setDigestEmail, { churchId: ids.churchId, on: true })).rejects.toThrow();
    await signed.mutation(api.digest.setDigestEmail, { churchId: ids.churchId, on: true });
    expect((await signed.query(api.digest.week, { churchId: ids.churchId, at })).emailed).toBe(true);
    expect(await t.query(internal.digest.toSend, { at })).toMatchObject([{ email: "c@example.org", waiting: 2, overdue: 1, approved: 40000, budget: 200000 }]);
    await t.run(async ctx => ctx.db.patch("churches", ids.churchId, { sample: true }));
    expect(await t.query(internal.digest.toSend, { at })).toEqual([]);
  });

  test("the email carries counts in the reader's language and never a name", () => {
    const week = { waiting: 2, overdue: 1, approved: 40000, budget: 200000 };
    const en = paperEmail({ kind: "digest", language: "en", set: "vincentian", place: "St. Example", link: "https://example.org/app/reports", week });
    expect(en.text).toContain("2 requests are waiting on a decision. 1 call has waited two days or more for a callback. Approved this month: $400 of $2,000.");
    const es = paperEmail({ kind: "digest", language: "es", set: "vincentian", place: "St. Example", link: "https://example.org/app/reports", week });
    expect(es.subject).toBe("La semana en St. Example");
    expect(`${en.html}${es.html}`).not.toMatch(/Rosa|Marcus/);
  });
});
