/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { minutesEmail } from "../src/lib/email/paper-email";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const DAY = 86_400_000;

describe("a conference meeting's agenda and minutes", () => {
  test("the agenda comes from the records since the meeting before; minutes and attendance are kept; members may not open it", async () => {
    const t = convexTest(schema, modules);
    const start = Date.UTC(2026, 10, 20, 23);
    const ids = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
      const otherUser = await ctx.db.insert("users", { clerkId: "clerk|member" });
      const helperId = await ctx.db.insert("memberships", { churchId, userId: otherUser, name: "Team Member", email: "m@example.org", role: "member", active: true, approved: true, coverOptIn: false });
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "14 Sample St", adults: 1, children: 2, language: "en", notes: "", createdBy: memberId, createdAt: 0 });
      const meeting = { churchId, location: "Hall", fanoutStatus: "complete" as const, cutoff: 0 };
      await ctx.db.insert("meetings", { ...meeting, title: "Earlier", start: start - 7 * DAY, end: start - 7 * DAY + 3_600_000 });
      const meetingId = await ctx.db.insert("meetings", { ...meeting, title: "Weekly meeting", start, end: start + 3_600_000 });
      const base = { churchId, neighborId, summary: "Rent", decisionNote: "", payeeKind: "landlord" as const, payeeName: "", source: "person" as const, createdBy: memberId };
      await ctx.db.insert("assistanceRequests", { ...base, kind: "rent", amountRequested: 30000, status: "open", createdAt: start - 2 * DAY });
      await ctx.db.insert("assistanceRequests", { ...base, kind: "food", amountRequested: 5000, amountApproved: 5000, status: "approved", decidedAt: start - DAY, createdAt: start - 3 * DAY });
      await ctx.db.insert("assistanceRequests", { ...base, kind: "utility", amountRequested: 9000, status: "declined", decidedAt: start - 10 * DAY, createdAt: start - 11 * DAY });
      await ctx.db.insert("visits", { churchId, neighborId, scheduledAt: start - 2 * DAY, status: "completed", completedAt: start - 2 * DAY, place: "hospital", visitors: [{ memberId, hours: 1, miles: 0 }], notes: "", createdBy: memberId, createdAt: 0 });
      await ctx.db.insert("ledgerEntries", { churchId, kind: "income", amount: 100000, date: "2026-11-01", category: "Parish collection", payee: "", memo: "", recordedBy: memberId, createdAt: 0 });
      return { churchId, meetingId, memberId, helperId };
    });
    const signed = t.withIdentity({ subject: "clerk|coordinator", email: "c@example.org", emailVerified: true });
    const member = t.withIdentity({ subject: "clerk|member", email: "m@example.org", emailVerified: true });
    const args = { churchId: ids.churchId, meetingId: ids.meetingId };
    const sheet = await signed.query(api.minutes.sheet, args);
    expect(sheet.since).toBe(start - 7 * DAY);
    expect(sheet.waiting.map(row => row.kind)).toEqual(["rent"]);
    expect(sheet.decided.map(row => [row.kind, row.status])).toEqual([["food", "approved"]]);
    expect(sheet.visits.map(row => row.place)).toEqual(["hospital"]);
    expect(sheet.balance).toBe(100000);
    await expect(member.query(api.minutes.sheet, args)).rejects.toThrow("coordinators and owners only");
    await expect(signed.mutation(api.minutes.send, args)).rejects.toThrow("Save the minutes");
    await signed.mutation(api.minutes.keep, { ...args, reflection: "Matthew 25", minutes: "Rosa Delgado at 14 Sample St was helped.", attended: [ids.memberId, ids.helperId] });
    expect((await signed.query(api.minutes.sheet, args)).kept).toMatchObject({ reflection: "Matthew 25", attended: [ids.memberId, ids.helperId] });
    // Email delivery is off in tests: nothing leaves.
    expect(await signed.mutation(api.minutes.send, args)).toBe("not_sent");
  });

  test("the email says counts and the minutes, in Spanish too", () => {
    const email = minutesEmail({ language: "es", set: "vincentian", place: "St. Example", title: "Reunión semanal", start: Date.UTC(2026, 10, 20, 23), timeZone: "America/New_York", attended: 5, approved: 2, declined: 1, reflection: "Mateo 25", minutes: "Se ayudó a [name].", link: "https://example.org/app/tasks" });
    expect(email.subject).toBe("Acta de Reunión semanal, St. Example");
    expect(email.text).toContain("Asistieron 5. Decisiones: 2 aprobadas, 1 rechazadas.");
    expect(email.html).toContain("Mateo 25");
  });
});

describe("minutes leave without the households' names", () => {
  test("exact and misspelled names and addresses are taken out", async () => {
    const t = convexTest(schema, modules);
    const scrubbed = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|coordinator" });
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Ana Visitor", email: "c@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
      await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "", phoneKey: "", email: "", address: "14 Sample St", adults: 1, children: 2, language: "en", notes: "", createdBy: memberId, createdAt: 0 });
      const meetingId = await ctx.db.insert("meetings", { churchId, title: "Weekly", start: 0, end: 1, location: "Hall", fanoutStatus: "complete", cutoff: 0, minutes: "Approved rent for rosa delagdo at 14 Sample St. Ana Visitor will call.", reflection: "" });
      const meeting = await ctx.db.get("meetings", meetingId);
      const { minutesForEmail } = await import("./minutes");
      return minutesForEmail(ctx, meeting!);
    });
    expect(scrubbed.minutes).not.toMatch(/rosa|delagdo|Sample St/i);
    expect(scrubbed.minutes).toContain("Approved rent for");
  });
});
