/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { DateTime } from "luxon";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { fiscalYear, fiscalYearOf } from "./reports";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const refused = "Neighbor records are open to coordinators and owners only.";
const zone = "America/New_York";
const HOUR = 3600000;

// The sample conference is built backward from today, so today is pinned and every count below stays put.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T15:00:00Z"));
});
afterEach(() => void vi.useRealTimers());

function start() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const empty = defineSchema({});
  t.registerComponent("auth", empty, { "./_generated/server.js": async () => ({}), "./public.ts": async () => ({ getSession: queryGeneric({ args: { sessionId: v.string() }, handler: async (_, { sessionId }) => (emails.has(sessionId) ? { userId: sessionId } : null) }) }) });
  t.registerComponent("authEmail", empty, { "./_generated/server.js": async () => ({}), "./verifiedEmails.ts": async () => ({ getPrimaryEmail: queryGeneric({ args: { userId: v.string() }, handler: async (_, { userId }) => emails.get(userId) ?? null }) }) });
  const as = (userId: Id<"users">) => {
    emails.set(userId, `${userId}@example.org`);
    return t.withIdentity({ subject: userId });
  };
  return { t, as };
}

async function sample() {
  const { t, as } = start();
  const churchId = await t.mutation(internal.sampleData.load, {});
  const data = await t.run(async (ctx) => ({
    memberships: await ctx.db.query("memberships").collect(),
    teams: await ctx.db.query("teams").collect(),
    neighbors: await ctx.db.query("neighbors").collect(),
    calls: await ctx.db.query("calls").collect(),
    requests: await ctx.db.query("assistanceRequests").collect(),
    visits: await ctx.db.query("visits").collect(),
    ledger: await ctx.db.query("ledgerEntries").collect(),
  }));
  const person = (role: "owner" | "coordinator" | "member") => {
    const found = data.memberships.find((member) => member.role === role);
    if (!found) throw new Error(`The sample has no ${role}.`);
    return found;
  };
  return { t, as, churchId, data, owner: person("owner"), coordinator: person("coordinator"), member: person("member") };
}

describe("the fiscal year", () => {
  test("runs October 1 to September 30 in the group's own time zone", () => {
    const span = fiscalYear(2026, zone);
    expect([span.firstDay, span.lastDay, span.dayAfter]).toEqual(["2025-10-01", "2026-09-30", "2026-10-01"]);
    expect(DateTime.fromMillis(span.start, { zone }).toISO()).toBe("2025-10-01T00:00:00.000-04:00");
    expect(span.months).toHaveLength(12);
    expect([span.months[0], span.months[11]]).toEqual(["2025-10", "2026-09"]);
    // The last evening of September in Fort Myers is already October in UTC, and still belongs to the old year.
    expect(fiscalYearOf(Date.parse("2026-10-01T02:00:00Z"), zone)).toBe(2026);
    expect(fiscalYearOf(Date.parse("2026-10-01T05:00:00Z"), zone)).toBe(2027);
  });
});

describe("the year's counts for the sample conference", () => {
  test("every total matches a count done by hand from the records", async () => {
    const { as, churchId, data, owner } = await sample();
    const report = await as(owner.userId).query(api.reports.year, { churchId, year: 2026 });

    // The hand count: walk the raw records one neighbor at a time, with the year written out as plain dates.
    const from = Date.parse("2025-10-01T04:00:00Z"), to = Date.parse("2026-10-01T04:00:00Z");
    const inYear = (time: number) => time >= from && time < to;
    const inYearDay = (date: string) => date >= "2025-10-01" && date <= "2026-09-30";
    const hand = { households: 0, people: 0, adults: 0, children: 0, visits: 0, peopleVisited: 0, hours: 0, miles: 0, helpPaid: 0, es: 0, ht: 0, en: 0 };
    const byKind = { rent: { paid: 0, people: 0, households: 0, requestsPaid: 0 }, utility: { paid: 0, people: 0, households: 0, requestsPaid: 0 }, food: { paid: 0, people: 0, households: 0, requestsPaid: 0 }, voucher: { paid: 0, people: 0, households: 0, requestsPaid: 0 }, other: { paid: 0, people: 0, households: 0, requestsPaid: 0 } };
    for (const neighbor of data.neighbors) {
      const size = neighbor.adults + neighbor.children;
      const visited = data.visits.filter((visit) => visit.neighborId === neighbor._id && visit.status === "completed" && inYear(visit.scheduledAt));
      const payments = data.ledger.filter((entry) => entry.neighborId === neighbor._id && entry.kind === "expense" && inYearDay(entry.date));
      hand.visits += visited.length;
      hand.peopleVisited += visited.length * size;
      for (const visit of visited) for (const visitor of visit.visitors) { hand.hours += visitor.hours; hand.miles += visitor.miles; }
      for (const kind of ["rent", "utility", "food", "voucher", "other"] as const) {
        const ofKind = payments.filter((entry) => entry.category === kind);
        if (!ofKind.length) continue;
        byKind[kind].households += 1;
        byKind[kind].people += size;
        byKind[kind].requestsPaid += ofKind.length;
        for (const entry of ofKind) { byKind[kind].paid += entry.amount; hand.helpPaid += entry.amount; }
      }
      if (!visited.length && !payments.length) continue;
      hand.households += 1;
      hand.people += size;
      hand.adults += neighbor.adults;
      hand.children += neighbor.children;
      hand[neighbor.language] += 1;
    }
    expect(report).toMatchObject({ year: 2026, firstDay: "2025-10-01", lastDay: "2026-09-30", timeZone: zone, closed: true });
    expect({ households: report.households, people: report.people, adults: report.adults, children: report.children, visits: report.visits, peopleVisited: report.peopleVisited, hours: report.visitHours, miles: report.visitMiles, helpPaid: report.helpPaid, ...report.householdsByLanguage }).toEqual(hand);

    const received = data.requests.filter((request) => inYear(request.createdAt));
    for (const line of report.kinds) {
      expect({ paid: line.paid, people: line.people, households: line.households, requestsPaid: line.requestsPaid }, line.kind).toEqual(byKind[line.kind]);
      expect(line.requests, line.kind).toBe(received.filter((request) => request.kind === line.kind).length);
    }
    expect(report.kinds.map((line) => line.kind)).toEqual(["rent", "utility", "food", "voucher", "other"]);
    expect(report.kinds.reduce((paid, line) => paid + line.paid, 0)).toBe(report.helpPaid);

    const count = (status: string) => received.filter((request) => request.status === status).length;
    expect(report.requests).toEqual({
      received: received.length,
      open: count("open"), approved: count("approved"), paid: count("paid"), declined: count("declined"), closed: count("closed"),
      referred: 0,
      amountRequested: received.reduce((sum, request) => sum + request.amountRequested, 0),
      amountApproved: received.reduce((sum, request) => sum + (request.status === "paid" || request.status === "approved" ? request.amountApproved ?? 0 : 0), 0),
    });
    const calls = data.calls.filter((call) => inYear(call.takenAt));
    expect(report.calls).toEqual({ taken: calls.length, returned: calls.filter((call) => call.callback === "done").length, waiting: calls.filter((call) => call.callback === "needed").length });

    // The treasurer's four lines.
    const income = (test: (date: string) => boolean) => data.ledger.filter((entry) => entry.kind === "income" && test(entry.date)).reduce((sum, entry) => sum + entry.amount, 0);
    const expense = (test: (date: string) => boolean) => data.ledger.filter((entry) => entry.kind === "expense" && test(entry.date)).reduce((sum, entry) => sum + entry.amount, 0);
    const before = (date: string) => date < "2025-10-01";
    expect(report.money.beginningBalance).toBe(income(before) - expense(before));
    expect(report.money.received).toBe(income(inYearDay));
    expect(report.money.spent).toBe(expense(inYearDay));
    expect(report.money.spent).toBe(report.helpPaid);
    expect(report.money.endingBalance).toBe(report.money.beginningBalance + report.money.received - report.money.spent);
    expect(report.money.sources.reduce((sum, line) => sum + line.amount, 0)).toBe(report.money.received);
    expect(report.money.sources.map((line) => line.label).sort()).toEqual(expect.arrayContaining(["Donation", "Parish collection"]));
    expect(report.money.otherSpending).toEqual([]);

    // The twelve months add back up to the year.
    expect(report.months.map((line) => line.month)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    const total = (pick: (line: (typeof report.months)[number]) => number) => report.months.reduce((sum, line) => sum + pick(line), 0);
    expect([total((line) => line.calls), total((line) => line.requests), total((line) => line.visits), total((line) => line.paid), total((line) => line.moneyIn)]).toEqual([report.calls.taken, report.requests.received, report.visits, report.helpPaid, report.money.received]);
    const march = data.visits.filter((visit) => visit.status === "completed" && visit.scheduledAt >= Date.parse("2026-03-01T05:00:00Z") && visit.scheduledAt < Date.parse("2026-04-01T04:00:00Z"));
    expect(report.months[5].visits).toBe(march.length);

    // The sample conference now has a year of finished help-line and pantry shifts.
    expect(report.time).toMatchObject({ activeMembers: 12 });
    expect(report.time.shiftHours).toBeGreaterThan(0);
    expect(report.time.hours).toBeCloseTo(report.visitHours + report.time.shiftHours, 5);
    expect(report.time.teams.map((team) => team.name).sort()).toEqual(["Help line", "Pantry"]);
    expect(report.time.membersServing).toBeGreaterThanOrEqual(new Set(data.visits.filter((visit) => visit.status === "completed" && inYear(visit.scheduledAt)).flatMap((visit) => visit.visitors.map((visitor) => visitor.memberId))).size);

    // The same year written down as plain numbers, so a change to the arithmetic cannot pass unnoticed.
    expect({ households: report.households, people: report.people, visits: report.visits, helpPaid: report.helpPaid, hours: report.visitHours, miles: report.visitMiles, calls: report.calls.taken, requests: report.requests.received }).toMatchInlineSnapshot(`
      {
        "calls": 78,
        "helpPaid": 467500,
        "hours": 177,
        "households": 35,
        "miles": 1282,
        "people": 144,
        "requests": 62,
        "visits": 50,
      }
    `);
  });

  test("the years on offer run from the first record to today's", async () => {
    const { as, churchId, coordinator } = await sample();
    expect(await as(coordinator.userId).query(api.reports.years, { churchId })).toEqual({ current: 2027, years: [2027, 2026] });
    const running = await as(coordinator.userId).query(api.reports.year, { churchId, year: 2027 });
    expect(running).toMatchObject({ closed: false, firstDay: "2026-10-01", lastDay: "2027-09-30" });
    expect(running.calls.waiting).toBeGreaterThan(0);
    // The year that just began starts with what the last one ended with.
    const last = await as(coordinator.userId).query(api.reports.year, { churchId, year: 2026 });
    expect(running.money.beginningBalance).toBe(last.money.endingBalance);
  });

  test("a report carries counts and never a neighbor's name, phone or address", async () => {
    const { as, churchId, data, owner } = await sample();
    const text = JSON.stringify(await as(owner.userId).query(api.reports.year, { churchId, year: 2026 }));
    for (const neighbor of data.neighbors) {
      for (const part of [neighbor.name, ...neighbor.name.split(" "), neighbor.phone, neighbor.phoneKey, neighbor.address, neighbor._id])
        expect(text.includes(part), part).toBe(false);
    }
  });

  test("members and people outside the group are refused", async () => {
    const { t, as, churchId, member } = await sample();
    await expect(as(member.userId).query(api.reports.year, { churchId, year: 2026 })).rejects.toThrow(refused);
    await expect(as(member.userId).query(api.reports.years, { churchId })).rejects.toThrow(refused);
    await expect(t.query(api.reports.year, { churchId, year: 2026 })).rejects.toThrow("Sign in required.");
    const stranger = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const elsewhere = await ctx.db.insert("churches", { name: "Elsewhere", timeZone: "UTC" });
      await ctx.db.insert("memberships", { churchId: elsewhere, userId, name: "Owner elsewhere", email: "owner@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
      return userId;
    });
    await expect(as(stranger).query(api.reports.year, { churchId, year: 2026 })).rejects.toThrow("Workspace access required.");
    await expect(as(stranger).query(api.reports.years, { churchId })).rejects.toThrow("Workspace access required.");
  });
});

describe("the parts the sample conference does not exercise", () => {
  async function conference() {
    const { t, as } = start();
    const ids = await t.run(async (ctx) => {
      const churchId = await ctx.db.insert("churches", { name: "St. Placeholder Conference", timeZone: zone });
      const join = async (name: string, role: "owner" | "member") => {
        const userId = await ctx.db.insert("users", {});
        return { userId, memberId: await ctx.db.insert("memberships", { churchId, userId, name, email: `${role}@example.org`, role, active: true, approved: true, coverOptIn: false }) };
      };
      const owner = await join("Sample Owner", "owner"), helper = await join("Sample Helper", "member");
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Sample Neighbor", nameKey: "sample neighbor", phone: "(555) 0100", phoneKey: "5550100", email: "", address: "1 Sample St", adults: 2, children: 3, language: "es", notes: "", createdBy: owner.memberId, createdAt: 0 });
      const requestId = await ctx.db.insert("assistanceRequests", { churchId, neighborId, kind: "utility", summary: "Past-due water bill", amountRequested: 30000, amountApproved: 30000, status: "approved", decisionNote: "", payeeKind: "utility", payeeName: "Example Water Authority", source: "person", referral: "County program", createdBy: owner.memberId, createdAt: Date.parse("2026-02-03T15:00:00Z") });
      return { churchId, owner, helper, neighborId, requestId };
    });
    return { t, as, ids };
  }

  test("a reversed payment comes back off the help paid, and a twinning gift is spending but not help", async () => {
    const { t, as, ids } = await conference();
    await t.run(async (ctx) => {
      const entry = (kind: "income" | "expense", date: string, amount: number, category: string, extra: { requestId?: Id<"assistanceRequests">; neighborId?: Id<"neighbors">; reverses?: Id<"ledgerEntries"> } = {}) =>
        ctx.db.insert("ledgerEntries", { churchId: ids.churchId, kind, amount, date, category, payee: "Example", memo: "", ...extra, recordedBy: ids.owner.memberId, createdAt: 0 });
      const links = { requestId: ids.requestId, neighborId: ids.neighborId };
      await entry("income", "2025-09-30", 100000, "Parish collection");
      await entry("income", "2026-01-10", 50000, "Parish collection");
      const lost = await entry("expense", "2026-02-10", 30000, "utility", links);
      await entry("income", "2026-02-12", 30000, "utility", { ...links, reverses: lost });
      await entry("expense", "2026-02-13", 20000, "utility", links);
      await entry("expense", "2026-03-01", 15000, "Twinning gift");
      const mistaken = await entry("income", "2026-03-02", 7000, "Donation");
      await entry("expense", "2026-03-03", 7000, "Donation", { reverses: mistaken });
    });
    const report = await as(ids.owner.userId).query(api.reports.year, { churchId: ids.churchId, year: 2026 });
    expect(report.helpPaid).toBe(20000);
    expect(report.kinds[1]).toEqual({ kind: "utility", requests: 1, requestsPaid: 1, households: 1, people: 5, paid: 20000 });
    expect(report).toMatchObject({ households: 1, people: 5, adults: 2, children: 3, householdsByLanguage: { en: 0, es: 1, ht: 0 }, visits: 0 });
    expect(report.requests).toMatchObject({ received: 1, approved: 1, referred: 1, amountApproved: 30000 });
    expect(report.money).toEqual({ beginningBalance: 100000, received: 50000, sources: [{ label: "Parish collection", amount: 50000 }], otherSpending: [{ label: "Twinning gift", amount: 15000 }], spent: 35000, endingBalance: 115000 });
    expect(report.months[4]).toMatchObject({ month: "2026-02", requests: 1, households: 1, paid: 20000 });
    expect(report.months[3]).toMatchObject({ month: "2026-01", moneyIn: 50000 });
  });

  test("hours come from visits and from finished shifts, by team; open, cancelled and coming shifts do not count", async () => {
    const { t, as, ids } = await conference();
    await t.run(async (ctx) => {
      const team = (name: string) => ctx.db.insert("teams", { churchId: ids.churchId, name, description: "" });
      const helpLine = await team("Help line"), pantry = await team("Pantry"), quiet = await team("Quiet team");
      const shift = (teamId: Id<"teams">, startIso: string, hours: number, extra: { assigneeId?: Id<"memberships"> | null; cancelled?: boolean } = {}) => {
        const begins = Date.parse(startIso);
        return ctx.db.insert("commitments", { churchId: ids.churchId, teamId, title: "Shift", start: begins, end: begins + hours * HOUR, location: "", preparation: "", assigneeId: ids.helper.memberId, coordinatorId: ids.owner.memberId, version: 1, ...extra });
      };
      await shift(helpLine, "2026-11-02T14:00:00Z", 3);
      await shift(helpLine, "2026-11-09T14:00:00Z", 3, { assigneeId: ids.owner.memberId });
      await shift(helpLine, "2026-11-10T14:00:00Z", 3, { assigneeId: null });
      await shift(helpLine, "2026-11-11T14:00:00Z", 3, { cancelled: true });
      await shift(helpLine, "2026-11-16T14:00:00Z", 3);
      await shift(helpLine, "2026-09-28T14:00:00Z", 3);
      await shift(pantry, "2026-10-20T14:00:00Z", 1.5);
      await shift(quiet, "2026-12-01T14:00:00Z", 2);
      await ctx.db.insert("visits", { churchId: ids.churchId, neighborId: ids.neighborId, scheduledAt: Date.parse("2026-11-03T15:00:00Z"), status: "completed", visitors: [{ memberId: ids.owner.memberId, hours: 1.5, miles: 12 }, { memberId: ids.helper.memberId, hours: 1.5, miles: 12 }], notes: "", createdBy: ids.owner.memberId, createdAt: 0 });
      await ctx.db.insert("visits", { churchId: ids.churchId, neighborId: ids.neighborId, scheduledAt: Date.parse("2026-11-20T15:00:00Z"), status: "scheduled", visitors: [{ memberId: ids.owner.memberId, hours: 0, miles: 0 }, { memberId: ids.helper.memberId, hours: 0, miles: 0 }], notes: "", createdBy: ids.owner.memberId, createdAt: 0 });
      await ctx.db.insert("visits", { churchId: ids.churchId, neighborId: ids.neighborId, scheduledAt: Date.parse("2026-11-05T15:00:00Z"), status: "cancelled", visitors: [], notes: "", createdBy: ids.owner.memberId, createdAt: 0 });
    });
    const report = await as(ids.owner.userId).query(api.reports.year, { churchId: ids.churchId, year: 2027 });
    expect(report.time.teams.map(({ name, shifts, people, hours }) => ({ name, shifts, people, hours }))).toEqual([{ name: "Help line", shifts: 2, people: 2, hours: 6 }, { name: "Pantry", shifts: 1, people: 1, hours: 1.5 }]);
    expect(report.time).toMatchObject({ shiftHours: 7.5, hours: 10.5, activeMembers: 2, membersServing: 2 });
    expect(report).toMatchObject({ visits: 1, peopleVisited: 5, visitHours: 3, visitMiles: 24, households: 1, people: 5, helpPaid: 0 });
    expect(report.months[1]).toMatchObject({ month: "2026-11", visits: 1, households: 1 });
  });

  test("a group with no records gets a year of zeros, not an error", async () => {
    const { t, as, ids } = await conference();
    await t.run((ctx) => ctx.db.delete(ids.requestId));
    const report = await as(ids.owner.userId).query(api.reports.year, { churchId: ids.churchId, year: 2027 });
    expect(report).toMatchObject({ households: 0, people: 0, visits: 0, helpPaid: 0, calls: { taken: 0, returned: 0, waiting: 0 }, money: { beginningBalance: 0, received: 0, spent: 0, endingBalance: 0, sources: [], otherSpending: [] } });
    expect(report.kinds.every((line) => line.paid === 0 && line.requests === 0)).toBe(true);
    expect(await as(ids.owner.userId).query(api.reports.years, { churchId: ids.churchId })).toEqual({ current: 2027, years: [2027] });
    await expect(as(ids.owner.userId).query(api.reports.year, { churchId: ids.churchId, year: 26 })).rejects.toThrow("Choose a year.");
  });
});
