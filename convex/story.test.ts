/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const HOUR = 3_600_000;
const at = () => Math.floor(Date.now() / HOUR) * HOUR;

// The story happens on fixed days in fiscal year 2027 (October 2026 to September 2027), so every figure stays put.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T14:00:00Z"));
});
afterEach(() => void vi.useRealTimers());

describe("the $210 story, from the call to the printed year", () => {
  test("a call, a visit, a $210 approval and its payment agree on every page that shows them", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const join = async (name: string, role: "owner" | "member") => {
        const userId = await ctx.db.insert("users", {});
        const memberId = await ctx.db.insert("memberships", { churchId, userId, name, email: `${name.split(" ")[0].toLowerCase()}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
        return { userId, memberId };
      };
      const owner = await join("Marisol Vega", "owner"), partner = await join("Thomas Okafor", "member");
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Esperanza Montoya", nameKey: "esperanza montoya", phone: "(100) 555-0104", phoneKey: "1005550104", email: "", address: "14 Sample St", adults: 2, children: 3, language: "es", notes: "", createdBy: owner.memberId, createdAt: 0 });
      return { churchId, owner, partner, neighborId };
    });
    const { churchId } = ids;
    const owner = signedIn(t, ids.owner.userId, true);
    const opened = async (requestId: Id<"assistanceRequests">) => owner.query(api.assistance.request, { churchId, requestId, opening: await owner.mutation(api.neighbors.open, { churchId, neighborId: ids.neighborId }) });
    const report = () => owner.query(api.reports.year, { churchId, at: at(), year: 2027 });

    // Nothing yet: the year is blank and the books are empty.
    const blank = await report();
    expect([blank.calls.taken, blank.requests.received, blank.helpPaid, blank.money.endingBalance]).toEqual([0, 0, 0, 0]);

    // 1. The call comes in, and the number on file places it on Esperanza's record.
    const { callId, neighborId } = await owner.mutation(api.assistance.recordCall, { churchId, callerName: "Esperanza Montoya", phone: "100-555-0104", note: "Shut-off notice on the electric bill, $240 due.", callback: "needed" });
    expect(neighborId).toBe(ids.neighborId);
    const line = await owner.query(api.assistance.calls, { churchId, at: at() });
    expect(line.waiting.map((call) => [call.id, call.neighborName, call.openRequest])).toEqual([[callId, "Esperanza Montoya", false]]);

    // 2. A request is opened from the call.
    const requestId = await owner.mutation(api.assistance.createRequest, { churchId, neighborId: ids.neighborId, callId, kind: "utility", summary: "Electric shut-off notice.", amountRequested: 24000, payeeKind: "utility", payeeName: "Sample Power & Light" });
    expect(await t.run((ctx) => ctx.db.get("churches", churchId))).toMatchObject({ waitingCount: 1 });
    expect(await opened(requestId)).toMatchObject({ status: "open", amountRequested: 24000 });

    // 3. A pair visits the next morning and writes it up.
    const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.neighborId, requestId, at: "2026-11-10T10:00", visitorIds: [ids.owner.memberId, ids.partner.memberId] });
    vi.setSystemTime(new Date("2026-11-10T17:00:00Z"));
    await owner.mutation(api.visits.writeUp, { churchId, visitId, notes: "Bill is real; $30 already paid by the family.", hours: 1.5, miles: 8, driverId: ids.partner.memberId });
    const visit = await t.run((ctx) => ctx.db.get("visits", visitId));
    expect(visit).toMatchObject({ status: "completed", visitors: [{ memberId: ids.owner.memberId, hours: 1.5, miles: 0 }, { memberId: ids.partner.memberId, hours: 1.5, miles: 8 }] });

    // 4. The decision: $210 approved, to the utility.
    await owner.mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 21000, note: "Approved $210 toward the bill." });
    expect(await opened(requestId)).toMatchObject({ status: "approved", amountApproved: 21000 });
    expect(await t.run((ctx) => ctx.db.get("churches", churchId))).toMatchObject({ waitingCount: 0 });
    expect(await owner.query(api.treasury.payable, { churchId })).toEqual([expect.objectContaining({ requestId, amountApproved: 21000, paid: 0, remaining: 21000, payeeName: "Sample Power & Light" })]);
    // Money comes in first, so the books do not go below zero.
    await owner.mutation(api.treasury.recordIncome, { churchId, source: "collection", from: "St. Example parish", amount: 50000, date: "2026-11-01" });

    vi.setSystemTime(new Date("2026-11-12T16:00:00Z"));
    // 5. The payment: check 1042 for the whole $210, which settles the request.
    await expect(owner.mutation(api.treasury.recordPayment, { churchId, requestId, amount: 21001, date: "2026-11-12", paidSeen: 0 })).rejects.toThrow("more than what is left");
    const entryId = await owner.mutation(api.treasury.recordPayment, { churchId, requestId, amount: 21000, date: "2026-11-12", checkNumber: "1042", memo: "Account 4471", paidSeen: 0 });
    expect(await opened(requestId)).toMatchObject({ status: "paid", amountApproved: 21000 });
    expect(await owner.query(api.treasury.payable, { churchId })).toEqual([]);
    await expect(owner.mutation(api.treasury.recordPayment, { churchId, requestId, amount: 21000, date: "2026-11-12", checkNumber: "1042", paidSeen: 0 })).rejects.toThrow();

    // 6. The ledger: one $210 expense to the utility, the balance after it $290.
    const ledger = await owner.query(api.treasury.ledger, { churchId, month: "2026-11" });
    expect(ledger).toMatchObject({ month: "2026-11", balance: 29000, opening: 0, moneyIn: 50000, moneyOut: 21000, neighborsHelped: 1 });
    expect(ledger.entries[0]).toMatchObject({ id: entryId, kind: "expense", amount: 21000, category: "utility", payee: "Sample Power & Light", checkNumber: "1042", balance: 29000 });
    const flow = await owner.query(api.treasury.cashFlow, { churchId, from: "2026-10-01", to: "2027-09-30" });
    expect(flow).toEqual({ opening: 0, closing: 29000, moneyIn: 50000, moneyOut: 21000, kinds: [
      { category: "Parish collection", direction: "in", amount: 50000, entries: 1 },
      { category: "utility", direction: "out", amount: 21000, entries: 1 },
    ] });

    // 7. The year: every count the printed sheets and the download read.
    const year = await report();
    expect(year).toMatchObject({
      year: 2027, quarter: null, firstDay: "2026-10-01", lastDay: "2027-09-30", closed: false,
      households: 1, people: 5, adults: 2, children: 3, householdsHelpedAgain: 0, householdsByLanguage: { en: 0, es: 1 },
      visits: 1, peopleVisited: 5, visitHours: 3, visitMiles: 8,
      helpPaid: 21000,
      requests: { received: 1, open: 0, approved: 0, paid: 1, declined: 0, closed: 0, referred: 0, amountRequested: 24000, amountApproved: 21000, paidTowardThese: 21000, paidLater: { requests: 0, amount: 0 }, closedAfterPart: { requests: 0, paid: 0, approved: 0 }, paidTowardEarlier: 0 },
      calls: { taken: 1 },
      money: { beginningBalance: 0, received: 50000, sources: [{ label: "Parish collection", amount: 50000 }], otherSpending: [], spent: 21000, endingBalance: 29000 },
    });
    expect(year.kinds.find((kind) => kind.kind === "utility")).toMatchObject({ requests: 1, requestsPaid: 1, households: 1, people: 5, paid: 21000 });
    expect(year.kinds.reduce((sum, kind) => sum + kind.paid, 0)).toBe(year.helpPaid);
    const november = year.months.find((month) => month.month === "2026-11");
    expect(november).toMatchObject({ calls: 1, requests: 1, visits: 1, households: 1, paid: 21000, moneyIn: 50000 });
    expect(year.months.reduce((sum, month) => sum + month.paid, 0)).toBe(year.helpPaid);
    expect(year.time.members.map((member) => [member.name, member.visits, member.hours, member.miles])).toEqual([["Marisol Vega", 1, 1.5, 0], ["Thomas Okafor", 1, 1.5, 8]].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

    // Report, cash flow and ledger agree.
    expect([year.money.received, year.money.spent, year.money.endingBalance]).toEqual([flow.moneyIn, flow.moneyOut, flow.closing]);
    expect(year.money.endingBalance).toBe(ledger.balance);
    expect(year.money.beginningBalance + year.money.received - year.money.spent).toBe(year.money.endingBalance);

    // 8. The records download: the same request, visit and check, in dollars.
    const exported = await owner.mutation(api.importExport.recordExport, { churchId });
    const page = (file: "requests" | "visits" | "ledger" | "calls") => owner.query(api.importExport.exportPage, { churchId, exported, file, cursor: null });
    const cells = async (file: "requests" | "visits" | "ledger" | "calls") => {
      const { columns, rows } = await page(file);
      return rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
    };
    expect(await cells("requests")).toEqual([expect.objectContaining({ Name: "Esperanza Montoya", "Request Status": "Completed", Outcome: "Paid", Value: "210.00", "Decided On": "11/10/2026", "Amount Requested": "240.00", "Amount Approved": "210.00", Payee: "Sample Power & Light" })]);
    const ledgerRows = await cells("ledger");
    expect(ledgerRows).toHaveLength(2);
    expect(ledgerRows.find((row) => row["Check Number"] === "1042")).toMatchObject({ Date: "11/12/2026", "In or Out": "Money out", Amount: "210.00", Payee: "Sample Power & Light", Neighbor: "Esperanza Montoya" });
    const signedSum = ledgerRows.reduce((sum, row) => sum + (row["In or Out"] === "Money in" ? 1 : -1) * Math.round(Number(row.Amount) * 100), 0);
    expect(signedSum).toBe(year.money.endingBalance);
    expect(await cells("visits")).toEqual([expect.objectContaining({ Name: "Esperanza Montoya", Status: "Completed" })]);
    expect(await cells("calls")).toHaveLength(1);
  });
});
