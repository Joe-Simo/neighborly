/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { DateTime } from "luxon";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
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
  const as = (userId: Id<"users">) => {
    emails.set(userId, `${userId}@example.org`);
    return signedIn(t, userId);
  };
  return { t, as };
}

async function sample() {
  const { t, as } = start();
  const churchId = await t.mutation(internal.sampleData.load, {});
  const data = await t.run(async (ctx) => ({
    memberships: await ctx.db.query("memberships").collect(),
    teams: await ctx.db.query("teams").collect(),
    commitments: await ctx.db.query("commitments").collect(),
    neighbors: await ctx.db.query("neighbors").collect(),
    calls: await ctx.db.query("calls").collect(),
    requests: await ctx.db.query("assistanceRequests").collect(),
    visits: await ctx.db.query("visits").collect(),
    ledger: await ctx.db.query("ledgerEntries").collect(),
    shelf: await ctx.db.query("voucherStock").collect(),
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
    const report = await as(owner.userId).query(api.reports.year, { at: Date.now(), churchId, year: 2026 });

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
      // A voucher is given from the shelf, not paid: the household counts by the vouchers it kept.
      const kept = data.requests.filter((request) => request.neighborId === neighbor._id && request.kind === "voucher")
        .filter((request) => data.shelf.filter((line) => line.requestId === request._id && inYearDay(line.date)).reduce((sum, line) => sum - line.change, 0) > 0);
      if (kept.length) {
        byKind.voucher.households += 1;
        byKind.voucher.people += size;
      }
      if (!visited.length && !payments.length && !kept.length) continue;
      hand.households += 1;
      hand.people += size;
      hand.adults += neighbor.adults;
      hand.children += neighbor.children;
      if (neighbor.language !== "other") hand[neighbor.language] += 1;
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
    const theirs = new Set(received.map((request) => request._id));
    const paidFor = (own: boolean) => data.ledger.filter((entry) => entry.kind === "expense" && entry.requestId && inYearDay(entry.date) && theirs.has(entry.requestId) === own).reduce((sum, entry) => sum + entry.amount, 0);
    expect(paidFor(true) + paidFor(false)).toBe(hand.helpPaid);
    // Marked paid, yet the payment falls after the year: counted here as paid later, and in help paid next year.
    const paidInYear = (requestId: string) => data.ledger.filter((entry) => entry.kind === "expense" && entry.requestId === requestId && inYearDay(entry.date)).reduce((sum, entry) => sum + entry.amount, 0);
    const later = received.filter((request) => request.status === "paid" && paidInYear(request._id) < (request.amountApproved ?? 0));
    const paidLater = { requests: later.filter((request) => paidInYear(request._id) === 0).length, amount: later.reduce((sum, request) => sum + (request.amountApproved ?? 0) - paidInYear(request._id), 0) };
    expect(report.kinds.reduce((paid, line) => paid + line.requestsPaid, 0)).toBe(received.filter((request) => request.status === "paid" && request.kind !== "voucher").length - paidLater.requests + data.ledger.filter((entry) => entry.kind === "expense" && entry.requestId && inYearDay(entry.date) && !theirs.has(entry.requestId)).length);
    expect(report.requests.amountApproved).toBe(report.requests.paidTowardThese + paidLater.amount + received.reduce((sum, request) => sum + (request.status === "approved" ? request.amountApproved ?? 0 : 0), 0));
    expect(paidLater).toEqual({ requests: 3, amount: 52000 });
    const few = received.slice(0, 3);
    const seen = data.visits.slice(0, 2);
    expect(await as(owner.userId).query(api.reports.flagged, { churchId, requestIds: few.map((request) => request._id), visitIds: seen.map((visit) => visit._id) })).toEqual({
      requests: few.map((request) => ({ id: request._id, neighborId: request.neighborId, kind: request.kind, amount: request.amountApproved ?? request.amountRequested, status: request.status, at: request.decidedAt ?? request.createdAt })),
      visits: seen.map((visit) => ({ id: visit._id, status: visit.status, at: visit.scheduledAt })),
    });
    expect(report.requests).toEqual({
      paidLater,
      closedAfterPart: { requests: 0, paid: 0, approved: 0 },
      paidTowardThese: paidFor(true),
      paidTowardEarlier: paidFor(false),
      received: received.length,
      open: count("open"), approved: count("approved"), paid: count("paid"), declined: count("declined"), closed: count("closed"),
      referred: 0,
      amountRequested: received.reduce((sum, request) => sum + request.amountRequested, 0),
      amountApproved: received.reduce((sum, request) => sum + (request.status === "paid" || request.status === "approved" ? request.amountApproved ?? 0 : 0), 0),
    });
    // Vouchers from the shelf, counted from the shelf's own lines.
    const lines = data.shelf.filter((line) => line.requestId && inYearDay(line.date));
    const holding = new Map<string, number>();
    for (const line of lines) holding.set(line.requestId!, (holding.get(line.requestId!) ?? 0) - line.change);
    const holders = [...holding].filter(([, held]) => held > 0).map(([requestId]) => data.requests.find((request) => request._id === requestId)!.neighborId);
    expect(report.vouchers).toEqual({
      given: lines.reduce((sum, line) => sum - line.change, 0),
      takenBack: lines.reduce((sum, line) => sum + Math.max(0, line.change), 0),
      requests: holders.length,
      households: new Set(holders).size,
    });
    const calls = data.calls.filter((call) => inYear(call.takenAt));
    expect(report.calls).toEqual({ taken: calls.length, returned: calls.filter((call) => call.callback === "done").length, waiting: calls.filter((call) => call.callback === "needed").length });

    // The treasurer's four lines.
    const income = (test: (date: string) => boolean, opening = false) => data.ledger.filter((entry) => entry.kind === "income" && test(entry.date) && (entry.category === "Opening balance") === opening).reduce((sum, entry) => sum + entry.amount, 0);
    const expense = (test: (date: string) => boolean) => data.ledger.filter((entry) => entry.kind === "expense" && test(entry.date)).reduce((sum, entry) => sum + entry.amount, 0);
    const before = (date: string) => date < "2025-10-01";
    // The sample enters its opening balance inside the year; it belongs on the beginning line, not with money received.
    expect(income(inYearDay, true)).toBe(420000);
    expect(report.money.beginningBalance).toBe(income(before) - expense(before) + 420000);
    expect(report.money.received).toBe(income(inYearDay));
    expect(report.money.spent).toBe(expense(inYearDay));
    // The sample conference also buys for the pantry and pays council dues, so help is most of the spending, not all of it.
    expect(report.money.spent).toBeGreaterThan(report.helpPaid);
    expect(report.money.endingBalance).toBe(report.money.beginningBalance + report.money.received - report.money.spent);
    expect(report.money.sources.reduce((sum, line) => sum + line.amount, 0)).toBe(report.money.received);
    expect(report.money.sources.map((line) => line.label).sort()).toEqual(expect.arrayContaining(["Donation", "Parish collection"]));
    expect(report.money.otherSpending.map((line) => line.label).sort()).toEqual(["Bus tokens", "Council dues", "Pantry purchase", "Supplies"]);
    expect(report.money.otherSpending.reduce((sum, line) => sum + line.amount, 0)).toBe(report.money.spent - report.helpPaid);

    // The twelve months add back up to the year.
    expect(report.months.map((line) => line.month)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    const total = (pick: (line: (typeof report.months)[number]) => number) => report.months.reduce((sum, line) => sum + pick(line), 0);
    expect([total((line) => line.calls), total((line) => line.requests), total((line) => line.visits), total((line) => line.paid), total((line) => line.moneyIn)]).toEqual([report.calls.taken, report.requests.received, report.visits, report.helpPaid, report.money.received]);
    const march = data.visits.filter((visit) => visit.status === "completed" && visit.scheduledAt >= Date.parse("2026-03-01T05:00:00Z") && visit.scheduledAt < Date.parse("2026-04-01T04:00:00Z"));
    expect(report.months[5].visits).toBe(march.length);

    // Time given: every member's visits and finished shifts, counted one member at a time.
    const visited = data.visits.filter((visit) => visit.status === "completed" && inYear(visit.scheduledAt));
    const worked = data.commitments.filter((shift) => shift.assigneeId && !shift.cancelled && inYear(shift.start) && shift.end <= Date.now());
    const byMember = data.memberships.map((member) => {
      const own = visited.flatMap((visit) => visit.visitors.filter((visitor) => visitor.memberId === member._id));
      const shifts = worked.filter((shift) => shift.assigneeId === member._id);
      return { memberId: member._id, name: member.name, visits: own.length, shifts: shifts.length, hours: own.reduce((sum, visitor) => sum + visitor.hours, 0) + shifts.reduce((sum, shift) => sum + (shift.end - shift.start) / HOUR, 0), miles: own.reduce((sum, visitor) => sum + visitor.miles, 0) };
    }).filter((line) => line.visits + line.shifts > 0).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
    expect(report.time.members).toEqual(byMember);
    expect(report.time.membersServing).toBe(byMember.length);
    const byTeam = data.teams.map((team) => {
      const shifts = worked.filter((shift) => shift.teamId === team._id);
      return { teamId: team._id, name: team.name, shifts: shifts.length, people: new Set(shifts.map((shift) => shift.assigneeId)).size, hours: shifts.reduce((sum, shift) => sum + (shift.end - shift.start) / HOUR, 0) };
    }).filter((team) => team.shifts > 0).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
    expect(report.time.teams).toEqual(byTeam);
    expect(byTeam.map((team) => team.name).sort()).toEqual(["Help line", "Pantry"]);
    const shiftHours = worked.reduce((sum, shift) => sum + (shift.end - shift.start) / HOUR, 0);
    expect(report.time).toMatchObject({ activeMembers: 12, shiftHours, hours: report.visitHours + shiftHours });
    expect(byMember.reduce((sum, line) => sum + line.hours, 0)).toBe(report.time.hours);
    // Households that money went toward for more than one request.
    const again = data.neighbors.filter((neighbor) => data.ledger.filter((entry) => entry.neighborId === neighbor._id && entry.kind === "expense" && inYearDay(entry.date)).length > 1).length;
    expect(report.householdsHelpedAgain).toBe(again);
    expect(again).toBeGreaterThan(0);

    // The same year written down as plain numbers, so a change to the arithmetic cannot pass unnoticed.
    expect({ households: report.households, people: report.people, visits: report.visits, helpPaid: report.helpPaid, hours: report.visitHours, miles: report.visitMiles, calls: report.calls.taken, requests: report.requests.received }).toMatchInlineSnapshot(`
      {
        "calls": 439,
        "helpPaid": 5172500,
        "hours": 1109,
        "households": 179,
        "miles": 8456,
        "people": 753,
        "requests": 354,
        "visits": 320,
      }
    `);
  });

  test("the check before sending finds the three seeded records and nothing else, vouchers included", async () => {
    const { as, churchId, owner } = await sample();
    // Two requests approved with no payment (one note says a check was sent) and one visit whose note says it happened.
    const found = (await as(owner.userId).action(api.drafts.checkYear, { churchId, year: 2026 })).flags;
    expect(found.map((flag) => flag.kind).sort()).toEqual(["approvedNotPaid", "noteSaysPaid", "visitNotMarked"]);
    expect((await as(owner.userId).action(api.drafts.checkYear, { churchId, year: 2027 })).flags).toEqual([]);
  });

  test("the check names no neighbor to open for a record that was removed for good", async () => {
    const { t, as, churchId, owner } = await sample();
    const [kept, removed] = await t.run(async (ctx) => {
      const requests = await ctx.db.query("assistanceRequests").collect();
      const other = requests.find((request) => request.neighborId !== requests[0].neighborId)!;
      // What removal leaves: the row without a name, marked by an empty name key, so the year still adds up.
      await ctx.db.patch("neighbors", requests[0].neighborId, { name: "Record removed", nameKey: "" });
      return [other, requests[0]];
    });
    const found = await as(owner.userId).query(api.reports.flagged, { churchId, requestIds: [kept._id, removed._id], visitIds: [] });
    expect(found.requests.map((request) => request.neighborId)).toEqual([kept.neighborId, null]);
  });

  test("removing a neighbor’s record for good moves no figure of the year and leaves no name in it", async () => {
    const { t, as, churchId, owner } = await sample();
    const owned = as(owner.userId);
    // A household the year really counts: money paid toward it and a visit made, with nothing still open.
    const neighbor = await t.run(async (ctx) => {
      const [neighbors, requests, visits, ledger] = await Promise.all([ctx.db.query("neighbors").collect(), ctx.db.query("assistanceRequests").collect(), ctx.db.query("visits").collect(), ctx.db.query("ledgerEntries").collect()]);
      const found = neighbors.find((candidate) => {
        const theirs = requests.filter((request) => request.neighborId === candidate._id);
        const seen = visits.filter((visit) => visit.neighborId === candidate._id);
        return theirs.some((request) => request.status === "paid" && ledger.some((entry) => entry.requestId === request._id)) && seen.some((visit) => visit.status === "completed")
          && !theirs.some((request) => request.status === "open" || request.status === "approved") && !seen.some((visit) => visit.status === "scheduled");
      });
      if (!found) throw new Error("The sample has no settled household to remove.");
      return { ...found, requestIds: requests.filter((request) => request.neighborId === found._id).map((request) => request._id) };
    });
    const { years } = await owned.query(api.reports.years, { at: Date.now(), churchId });
    const everything = async () => Promise.all(years.flatMap((year) => [undefined, 1, 2, 3, 4].map((quarter) => owned.query(api.reports.year, { at: Date.now(), churchId, year, ...(quarter ? { quarter: quarter as 1 | 2 | 3 | 4 } : {}) }))));
    const before = await everything();
    expect(before.some((report) => report.households > 0 && report.helpPaid > 0)).toBe(true);

    await owned.mutation(api.neighbors.remove, { churchId, neighborId: neighbor._id, typedName: neighbor.name });

    const after = await everything();
    expect(after).toEqual(before);
    const written = JSON.stringify(after);
    for (const detail of [neighbor.name, neighbor.phone, neighbor.address].filter(Boolean)) expect(written).not.toContain(detail);
    // And the check before sending offers no way into the record that is gone.
    const found = await owned.query(api.reports.flagged, { churchId, requestIds: neighbor.requestIds, visitIds: [] });
    expect(found.requests.length).toBe(neighbor.requestIds.length);
    expect(found.requests.every((request) => request.neighborId === null)).toBe(true);
  });

  test("the years on offer run from the first record to today's", async () => {
    const { as, churchId, coordinator } = await sample();
    expect(await as(coordinator.userId).query(api.reports.years, { at: Date.now(), churchId })).toEqual({ current: 2027, years: [2027, 2026] });
    const running = await as(coordinator.userId).query(api.reports.year, { at: Date.now(), churchId, year: 2027 });
    expect(running).toMatchObject({ closed: false, firstDay: "2026-10-01", lastDay: "2027-09-30" });
    expect(running.calls.waiting).toBeGreaterThan(0);
    // The year that just began starts with what the last one ended with.
    const last = await as(coordinator.userId).query(api.reports.year, { at: Date.now(), churchId, year: 2026 });
    expect(running.money.beginningBalance).toBe(last.money.endingBalance);
  });

  test("the cash lines agree with the treasury's own cash flow for the same days", async () => {
    const { as, churchId, owner } = await sample();
    for (const quarter of [undefined, 1, 3] as const) {
      const report = await as(owner.userId).query(api.reports.year, { at: Date.now(), churchId, year: 2026, quarter });
      const flow = await as(owner.userId).query(api.treasury.cashFlow, { churchId, from: report.firstDay, to: report.lastDay });
      // The one difference in wording: an opening balance entered inside the period is cash in to the ledger, and the beginning balance here.
      const openingEntered = flow.kinds.find((kind) => kind.direction === "in" && kind.category === "Opening balance")?.amount ?? 0;
      expect(report.money.beginningBalance).toBe(flow.opening + openingEntered);
      expect(report.money.received).toBe(flow.moneyIn - openingEntered);
      expect(report.money.spent).toBe(flow.moneyOut);
      expect(report.money.endingBalance).toBe(flow.closing);
      expect(report.helpPaid).toBe(flow.kinds.filter((kind) => kind.direction === "out" && ["rent", "utility", "food", "voucher", "other"].includes(kind.category)).reduce((sum, kind) => sum + kind.amount, 0));
    }
  });

  test("a report carries counts and never a neighbor's name, phone or address", async () => {
    const { as, churchId, data, owner } = await sample();
    const text = JSON.stringify(await as(owner.userId).query(api.reports.year, { at: Date.now(), churchId, year: 2026 }));
    for (const neighbor of data.neighbors) {
      for (const part of [neighbor.name, ...neighbor.name.split(" "), neighbor.phone, neighbor.phoneKey, neighbor.address, neighbor._id])
        expect(text.includes(part), part).toBe(false);
    }
  });

  test("members and people outside the group are refused", async () => {
    const { t, as, churchId, member } = await sample();
    await expect(as(member.userId).query(api.reports.year, { at: Date.now(), churchId, year: 2026 })).rejects.toThrow(refused);
    await expect(as(member.userId).query(api.reports.years, { at: Date.now(), churchId })).rejects.toThrow(refused);
    await expect(as(member.userId).query(api.reports.flagged, { churchId, requestIds: [], visitIds: [] })).rejects.toThrow(refused);
    await expect(t.query(api.reports.year, { at: Date.now(), churchId, year: 2026 })).rejects.toThrow("Sign in required.");
    const stranger = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const elsewhere = await ctx.db.insert("churches", { name: "Elsewhere", timeZone: "UTC" });
      await ctx.db.insert("memberships", { churchId: elsewhere, userId, name: "Owner elsewhere", email: "owner@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
      return userId;
    });
    await expect(as(stranger).query(api.reports.year, { at: Date.now(), churchId, year: 2026 })).rejects.toThrow("Workspace access required.");
    await expect(as(stranger).query(api.reports.years, { at: Date.now(), churchId })).rejects.toThrow("Workspace access required.");
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

  test("a request closed after part was paid is not closed without help, and a voucher taken back is no longer given", async () => {
    const { t, as, ids } = await conference();
    await t.run(async (ctx) => {
      await ctx.db.patch("assistanceRequests", ids.requestId, { status: "closed" });
      await ctx.db.insert("ledgerEntries", { churchId: ids.churchId, kind: "expense", amount: 20000, date: "2026-02-10", category: "utility", payee: "Example", memo: "", requestId: ids.requestId, neighborId: ids.neighborId, recordedBy: ids.owner.memberId, createdAt: 0 });
      const other = await ctx.db.insert("neighbors", { churchId: ids.churchId, name: "Second Sample", nameKey: "second sample", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 0, language: "en", notes: "", createdBy: ids.owner.memberId, createdAt: 0 });
      const ask = (neighborId: Id<"neighbors">) => ctx.db.insert("assistanceRequests", { churchId: ids.churchId, neighborId, kind: "voucher", summary: "Beds", amountRequested: 0, status: "closed", decisionNote: "", payeeKind: "vendor", payeeName: "", source: "person", createdBy: ids.owner.memberId, createdAt: Date.parse("2026-03-03T15:00:00Z") });
      const shelf = (requestId: Id<"assistanceRequests">, date: string, change: number) => ctx.db.insert("voucherStock", { churchId: ids.churchId, date, change, item: "Bed", note: "", requestId, recordedBy: ids.owner.memberId, createdAt: 0 });
      const kept = await ask(other), returned = await ask(ids.neighborId);
      // Given and marked paid, as the help line records a voucher: it owes no money.
      await ctx.db.patch("assistanceRequests", kept, { status: "paid", amountApproved: 0 });
      await shelf(kept, "2026-03-04", -2);
      await shelf(returned, "2026-03-05", -1);
      await shelf(returned, "2026-03-09", 1);
    });
    const report = await as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 2026 });
    expect(report.requests).toMatchObject({ received: 3, closed: 2, paid: 1, paidLater: { requests: 0, amount: 0 }, closedAfterPart: { requests: 1, paid: 20000, approved: 30000 } });
    expect(report.helpPaid).toBe(20000);
    expect(report.vouchers).toEqual({ given: 2, takenBack: 1, requests: 1, households: 1 });
    // One household by money, one by a voucher it kept.
    expect(report.households).toBe(2);
    expect(report.kinds[3]).toMatchObject({ kind: "voucher", households: 1, paid: 0 });
  });

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
    const report = await as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 2026 });
    expect(report.helpPaid).toBe(20000);
    expect(report.kinds[1]).toEqual({ kind: "utility", requests: 1, requestsPaid: 1, households: 1, people: 5, paid: 20000 });
    expect(report).toMatchObject({ households: 1, people: 5, adults: 2, children: 3, householdsByLanguage: { en: 0, es: 1, ht: 0 }, visits: 0 });
    expect(report.requests).toMatchObject({ received: 1, approved: 1, referred: 1, amountApproved: 30000, paidTowardThese: 20000, paidTowardEarlier: 0 });
    // Seen from the next year, the same payments would be toward an earlier request; here the year after has none.
    expect((await as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 2027 })).requests).toMatchObject({ received: 0, paidTowardThese: 0, paidTowardEarlier: 0 });
    expect(report.money).toEqual({ beginningBalance: 100000, received: 50000, sources: [{ label: "Parish collection", amount: 50000 }], otherSpending: [{ label: "Twinning gift", amount: 15000 }], spent: 35000, endingBalance: 115000 });
    expect(report.months[4]).toMatchObject({ month: "2026-02", requests: 1, households: 1, paid: 20000 });
    expect(report.months[3]).toMatchObject({ month: "2026-01", moneyIn: 50000 });
  });

  test("help brought over from ServWare is counted apart and never as ledger money", async () => {
    const { t, as, ids } = await conference();
    await t.run(async (ctx) => {
      const other = await ctx.db.insert("neighbors", { churchId: ids.churchId, name: "Example Household", nameKey: "example household", phone: "(555) 0101", phoneKey: "5550101", email: "", address: "2 Sample St", adults: 1, children: 2, language: "en", notes: "", createdBy: ids.owner.memberId, createdAt: 0 });
      const history = (neighborId: typeof other, kind: "rent" | "food", date: string, importedAmount?: number) =>
        ctx.db.insert("assistanceRequests", { churchId: ids.churchId, neighborId, kind, summary: "From ServWare", amountRequested: importedAmount ?? 0, importedAmount, status: "closed", decisionNote: "", payeeKind: "vendor", payeeName: "Example Payee", source: "import", createdBy: ids.owner.memberId, createdAt: Date.parse(date) });
      await history(other, "rent", "2025-11-04T15:00:00Z", 45000);
      await history(other, "food", "2025-12-09T15:00:00Z", 6000);
      await history(ids.neighborId, "rent", "2026-01-06T15:00:00Z", 30000);
      await history(ids.neighborId, "food", "2026-01-20T15:00:00Z");
      await history(other, "rent", "2025-09-02T15:00:00Z", 99900);
      await ctx.db.insert("ledgerEntries", { churchId: ids.churchId, kind: "expense", amount: 20000, date: "2026-02-13", category: "utility", payee: "Example Water Authority", memo: "", requestId: ids.requestId, neighborId: ids.neighborId, recordedBy: ids.owner.memberId, createdAt: 0 });
    });
    const report = await as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 2026 });
    expect(report.history).toEqual({
      requests: 4, households: 2, people: 8, amount: 81000,
      kinds: [{ kind: "rent", requests: 2, amount: 75000 }, { kind: "utility", requests: 0, amount: 0 }, { kind: "food", requests: 2, amount: 6000 }, { kind: "voucher", requests: 0, amount: 0 }, { kind: "other", requests: 0, amount: 0 }],
      // The household helped both here and in the history is one household.
      householdsInAll: 2, peopleInAll: 8,
    });
    // Nothing from the history reaches the counts the ledger and the request list stand behind.
    expect(report).toMatchObject({ households: 1, people: 5, helpPaid: 20000 });
    expect(report.requests).toMatchObject({ received: 1, closed: 0, approved: 1, amountRequested: 30000 });
    expect(report.kinds.map((line) => [line.requests, line.paid])).toEqual([[0, 0], [1, 20000], [0, 0], [0, 0], [0, 0]]);
    expect(report.money.spent).toBe(20000);
    expect(report.months.reduce((sum, line) => sum + line.requests, 0)).toBe(1);
    const first = await as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 2026, quarter: 1 });
    expect(first.history).toMatchObject({ requests: 2, households: 1, amount: 51000, householdsInAll: 1 });
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
    const report = await as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 2027 });
    expect(report.time.teams.map(({ name, shifts, people, hours }) => ({ name, shifts, people, hours }))).toEqual([{ name: "Help line", shifts: 2, people: 2, hours: 6 }, { name: "Pantry", shifts: 1, people: 1, hours: 1.5 }]);
    expect(report.time).toMatchObject({ shiftHours: 7.5, hours: 10.5, activeMembers: 2, membersServing: 2 });
    expect(report.time.members.map(({ name, visits, shifts, hours, miles }) => ({ name, visits, shifts, hours, miles }))).toEqual([{ name: "Sample Helper", visits: 1, shifts: 2, hours: 6, miles: 12 }, { name: "Sample Owner", visits: 1, shifts: 1, hours: 4.5, miles: 12 }]);
    expect(report).toMatchObject({ visits: 1, peopleVisited: 5, visitHours: 3, visitMiles: 24, households: 1, people: 5, helpPaid: 0 });
    expect(report.months[1]).toMatchObject({ month: "2026-11", visits: 1, households: 1 });
  });

  test("a quarter is three months of the same year, and the four quarters add up to it", async () => {
    const { as, churchId, owner } = await sample();
    const read = (quarter?: 1 | 2 | 3 | 4) => as(owner.userId).query(api.reports.year, { at: Date.now(), churchId, year: 2026, quarter });
    const [whole, ...quarters] = await Promise.all([read(), read(1), read(2), read(3), read(4)]);
    expect(quarters.map((quarter) => [quarter.quarter, quarter.firstDay, quarter.lastDay, quarter.months.length])).toEqual([[1, "2025-10-01", "2025-12-31", 3], [2, "2026-01-01", "2026-03-31", 3], [3, "2026-04-01", "2026-06-30", 3], [4, "2026-07-01", "2026-09-30", 3]]);
    expect(whole.quarter).toBeNull();
    const sum = (pick: (report: typeof whole) => number) => quarters.reduce((total, quarter) => total + pick(quarter), 0);
    for (const pick of [(report: typeof whole) => report.visits, (report: typeof whole) => report.helpPaid, (report: typeof whole) => report.calls.taken, (report: typeof whole) => report.requests.received, (report: typeof whole) => report.visitHours, (report: typeof whole) => report.visitMiles, (report: typeof whole) => report.peopleVisited, (report: typeof whole) => report.money.received, (report: typeof whole) => report.money.spent])
      expect(sum(pick)).toBe(pick(whole));
    // A household helped in two quarters is one household in the year.
    expect(sum((report) => report.households)).toBeGreaterThan(whole.households);
    // Each quarter begins with what the one before ended with.
    expect(quarters[2].money.beginningBalance).toBe(quarters[1].money.endingBalance);
    expect(quarters[3].money.endingBalance).toBe(whole.money.endingBalance);
    expect(quarters[1].months.map((line) => line.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(quarters[1].visits).toBe(whole.months.slice(3, 6).reduce((visits, line) => visits + line.visits, 0));
  });

  test("a group with no records gets a year of zeros, not an error", async () => {
    const { t, as, ids } = await conference();
    await t.run((ctx) => ctx.db.delete(ids.requestId));
    const report = await as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 2027 });
    expect(report).toMatchObject({ households: 0, people: 0, visits: 0, helpPaid: 0, calls: { taken: 0, returned: 0, waiting: 0 }, money: { beginningBalance: 0, received: 0, spent: 0, endingBalance: 0, sources: [], otherSpending: [] } });
    expect(report.kinds.every((line) => line.paid === 0 && line.requests === 0)).toBe(true);
    expect(await as(ids.owner.userId).query(api.reports.years, { at: Date.now(), churchId: ids.churchId })).toEqual({ current: 2027, years: [2027] });
    await expect(as(ids.owner.userId).query(api.reports.year, { at: Date.now(), churchId: ids.churchId, year: 26 })).rejects.toThrow("Choose a year.");
  });
});
