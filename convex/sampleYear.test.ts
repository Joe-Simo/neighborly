/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import { DateTime } from "luxon";
import { sampleYear } from "../src/lib/sample-year";
import { kindsByMonth } from "../src/lib/sample-year-kinds";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

// The sample is built backward from today, so today is the moment the home page's figures were taken.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(sampleYear.asOf));
});
afterEach(() => void vi.useRealTimers());

test("the home page's four figures are the sample's own yearly report", async () => {
  const t = convexTest(schema, modules);
  const churchId = await t.mutation(internal.sampleData.load, {});
  const owner = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).find((member) => member.role === "owner"));
  if (!owner) throw new Error("The sample has no owner.");
  const report = await signedIn(t, owner.userId).query(api.reports.year, { churchId, year: sampleYear.year, at: Date.parse(sampleYear.asOf) });
  expect(report.closed).toBe(true);
  expect({ calls: report.calls.taken, requests: report.requests.received, visits: report.visits, helpPaid: report.helpPaid }).toEqual({
    calls: sampleYear.calls,
    requests: sampleYear.requests,
    visits: sampleYear.visits,
    helpPaid: sampleYear.helpPaid,
  });
  // The year in paper draws one slip a request, month by month, its corner ochre while the request still waits (open, or approved and unpaid).
  expect(report.months.map((month) => month.requests)).toEqual(sampleYear.requestsByMonth);
  const waiting = await t.run(async (ctx) => (await ctx.db.query("assistanceRequests").collect()).filter((request) => request.status === "open" || request.status === "approved"));
  const byMonth = report.months.map(({ month }) => waiting.filter((request) => DateTime.fromMillis(request.createdAt, { zone: report.timeZone }).toFormat("yyyy-MM") === month).length);
  expect(byMonth).toEqual(sampleYear.waitingByMonth);
  expect(byMonth.reduce((sum, count) => sum + count, 0)).toBe(report.requests.open + report.requests.approved);
  // Touching a slip names its request's kind of help: each month's kinds in the order the requests came in, the waiting ones last.
  const all = await t.run(async (ctx) => (await ctx.db.query("assistanceRequests").collect()).sort((a, b) => a.createdAt - b.createdAt));
  const still = (request: (typeof all)[number]) => request.status === "open" || request.status === "approved";
  const letters = report.months.map(({ month }) => {
    const mine = all.filter((request) => DateTime.fromMillis(request.createdAt, { zone: report.timeZone }).toFormat("yyyy-MM") === month);
    return [...mine.filter((request) => !still(request)), ...mine.filter(still)].map((request) => request.kind[0]).join("");
  });
  expect(letters).toEqual(kindsByMonth);
  // The week page's yes is the sample's own: the electric bill with a shut-off notice, approved after the visit.
  const shutOff = await t.run(async (ctx) =>
    (await ctx.db.query("assistanceRequests").collect()).find((request) => request.summary === "Electric bill with a shut-off notice."),
  );
  expect(shutOff?.amountApproved).toBe(sampleYear.weekHelp);
});

test("the year's money in Reports is the Treasury's: same closing balance, same money in and out", async () => {
  const t = convexTest(schema, modules);
  const churchId = await t.mutation(internal.sampleData.load, {});
  const owner = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).find((member) => member.role === "owner"));
  if (!owner) throw new Error("The sample has no owner.");
  const me = signedIn(t, owner.userId);
  const report = await me.query(api.reports.year, { churchId, year: sampleYear.year, at: Date.parse(sampleYear.asOf) });
  const flow = await me.query(api.treasury.cashFlow, { churchId, from: report.firstDay, to: report.lastDay });
  // An opening balance entered inside the year is money in to the Treasury, and the year's beginning in Reports.
  expect(report.money.endingBalance).toBe(flow.closing);
  expect(report.money.beginningBalance + report.money.received).toBe(flow.opening + flow.moneyIn);
  expect(report.money.spent).toBe(flow.moneyOut);
  // What the year paid to neighbors is its help by kind, and the rest of what it spent is its other spending.
  expect(report.kinds.reduce((paid, kind) => paid + kind.paid, 0)).toBe(report.helpPaid);
  expect(report.helpPaid + report.money.otherSpending.reduce((spent, line) => spent + line.amount, 0)).toBe(report.money.spent);
});

test("the year's hours are one total: the sheet's, the book's lines and the members' all add to it", async () => {
  const t = convexTest(schema, modules);
  const churchId = await t.mutation(internal.sampleData.load, {});
  const owner = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).find((member) => member.role === "owner"));
  if (!owner) throw new Error("The sample has no owner.");
  // Shifts count once they are over, so the total is read at the sample's moment and again days later.
  for (const at of [Date.parse(sampleYear.asOf), Date.parse(sampleYear.asOf) + 3 * 86_400_000]) {
    const report = await signedIn(t, owner.userId).query(api.reports.year, { churchId, year: sampleYear.year, at });
    const bookLines = report.visitHours + report.time.teams.reduce((hours, team) => hours + team.hours, 0);
    const members = report.time.members.reduce((hours, member) => hours + member.hours, 0);
    expect(report.time.hours).toBeCloseTo(bookLines, 2);
    expect(report.time.hours).toBeCloseTo(members, 1);
    expect(report.time.hours).toBe(1589);
  }
});
