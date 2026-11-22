/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { DateTime } from "luxon";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";
import { fiscalYear, fiscalYearOf } from "./reports";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
afterEach(() => void vi.useRealTimers());
const at = (iso: string, zone: string) => DateTime.fromISO(iso, { zone }).toMillis();
const hour = () => Math.floor(Date.now() / 3600000) * 3600000;
const pin = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

async function conference(zone: string) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const churchId = await ctx.db.insert("churches", { name: "Sample Edge Conference", timeZone: zone });
    const userId = await ctx.db.insert("users", {});
    const memberId = await ctx.db.insert("memberships", { churchId, userId, name: "Sample Owner", email: "owner@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
    const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Sample Neighbor", nameKey: "sample neighbor", phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 1, language: "en", notes: "", createdBy: memberId, createdAt: 0 });
    return { churchId, userId, memberId, neighborId };
  });
  const request = (createdAt: number, amountApproved = 10001) =>
    t.run((ctx) => ctx.db.insert("assistanceRequests", { churchId: ids.churchId, neighborId: ids.neighborId, kind: "rent", summary: "Rent", amountRequested: amountApproved, amountApproved, status: "approved", decisionNote: "", payeeKind: "landlord", payeeName: "Sample Landlord", source: "person", createdBy: ids.memberId, createdAt }));
  return { t, ids, request, owner: signedIn(t, ids.userId) };
}

describe("fiscal year edges in the group's own zone", () => {
  for (const zone of ["America/New_York", "Pacific/Honolulu", "America/Los_Angeles"]) {
    test(`${zone}: 23:59 on September 30 is the old year, 00:00 on October 1 the new one, and the quarters tile the year`, () => {
      expect(fiscalYearOf(at("2026-09-30T23:59:59.999", zone), zone)).toBe(2026);
      expect(fiscalYearOf(at("2026-10-01T00:00:00", zone), zone)).toBe(2027);
      const span = fiscalYear(2027, zone);
      expect(span.start).toBe(at("2026-10-01T00:00:00", zone));
      // Across both DST changes where the zone has them, no hour is lost or counted twice.
      const quarters = ([1, 2, 3, 4] as const).map((q) => fiscalYear(2027, zone, q));
      expect(quarters[0].start).toBe(span.start);
      expect(quarters[3].end).toBe(span.end);
      for (let q = 1; q < 4; q++) expect(quarters[q].start).toBe(quarters[q - 1].end);
      expect(quarters.flatMap((part) => part.months)).toEqual(span.months);
    });
  }

  test("one instant falls in different years for New York and Honolulu, and each report follows its own zone", async () => {
    pin("2026-11-15T15:00:00Z");
    // 01:00 on October 1 in New York; 19:00 on September 30 in Honolulu.
    const instant = Date.parse("2026-10-01T05:00:00Z");
    for (const [zone, year, month] of [["America/New_York", 2027, "2026-10"], ["Pacific/Honolulu", 2026, "2026-09"]] as const) {
      const { owner, ids, request } = await conference(zone);
      await request(instant);
      const report = await owner.query(api.reports.year, { at: hour(), churchId: ids.churchId, year });
      expect(report.requests.received).toBe(1);
      expect(report.months.find((line) => line.month === month)?.requests).toBe(1);
      expect((await owner.query(api.reports.year, { at: hour(), churchId: ids.churchId, year: year === 2027 ? 2026 : 2027 })).requests.received).toBe(0);
    }
  });
});

describe("partial payments, reversals and the closed year", () => {
  test("odd cents paid in parts settle exactly; a reversal in the new year leaves the closed year as it was", async () => {
    const zone = "Pacific/Honolulu";
    pin("2026-09-30T20:00:00Z"); // 10:00 on September 30 in Honolulu
    const { owner, ids, request, t } = await conference(zone);
    await t.run((ctx) => ctx.db.insert("ledgerEntries", { churchId: ids.churchId, kind: "income", amount: 50000, date: "2026-09-01", category: "Parish collection", payee: "Parish", memo: "", recordedBy: ids.memberId, createdAt: 0 }));
    const requestId = await request(at("2026-09-02T12:00", zone), 10001);
    const status = async () => (await t.run((ctx) => ctx.db.get("assistanceRequests", requestId)))?.status;
    await owner.mutation(api.treasury.recordPayment, { churchId: ids.churchId, requestId, paidSeen: 0, amount: 3333, date: "2026-09-29" });
    expect(await status()).toBe("approved");
    await expect(owner.mutation(api.treasury.recordPayment, { churchId: ids.churchId, requestId, paidSeen: 3333, amount: 6669, date: "2026-09-30" })).rejects.toThrow("more than what is left");
    const last = await owner.mutation(api.treasury.recordPayment, { churchId: ids.churchId, requestId, paidSeen: 3333, amount: 6668, date: "2026-09-30" });
    expect(await status()).toBe("paid");
    const closed = await owner.query(api.reports.year, { at: hour(), churchId: ids.churchId, year: 2026 });
    expect(closed.helpPaid).toBe(10001);
    expect(closed.money).toMatchObject({ beginningBalance: 0, received: 50000, spent: 10001, endingBalance: 39999 });
    expect(closed.months.find((line) => line.month === "2026-09")).toMatchObject({ paid: 10001, moneyIn: 50000 });

    pin("2026-10-01T10:00:00Z"); // 00:00 on October 1 in Honolulu: a new fiscal year
    await owner.mutation(api.treasury.reverseEntry, { churchId: ids.churchId, entryId: last, reason: "Check returned" });
    expect((await t.run((ctx) => ctx.db.query("ledgerEntries").collect())).find((entry) => entry.reverses === last)?.date).toBe("2026-10-01");
    expect(await status()).toBe("approved");
    // The money of the closed year stays put; only the request counts follow where each request stands today, by design.
    const money = (report: typeof closed) => ({ money: report.money, helpPaid: report.helpPaid, months: report.months, kinds: report.kinds, households: report.households });
    expect(money(await owner.query(api.reports.year, { at: hour(), churchId: ids.churchId, year: 2026 }))).toEqual(money(closed));
    // Money that came back counts in the year it came back, and the treasury's own views agree.
    const next = await owner.query(api.reports.year, { at: hour(), churchId: ids.churchId, year: 2027 });
    expect(next.money).toMatchObject({ beginningBalance: 39999, received: 0, spent: -6668, endingBalance: 46667 });
    expect(next.helpPaid).toBe(-6668);
    expect(await owner.query(api.treasury.cashFlow, { churchId: ids.churchId, from: next.firstDay, to: next.lastDay })).toMatchObject({ opening: 39999, closing: 46667, moneyIn: 0, moneyOut: -6668 });
    expect(await owner.query(api.treasury.ledger, { churchId: ids.churchId, month: "2026-10" })).toMatchObject({ opening: 39999, balance: 46667, moneyIn: 0, moneyOut: -6668 });

    // Paying what was taken back again finishes the request without passing the approved amount.
    await expect(owner.mutation(api.treasury.recordPayment, { churchId: ids.churchId, requestId, paidSeen: 3333, amount: 6669, date: "2026-10-01" })).rejects.toThrow("more than what is left");
    await owner.mutation(api.treasury.recordPayment, { churchId: ids.churchId, requestId, paidSeen: 3333, amount: 6668, date: "2026-10-01" });
    expect(await status()).toBe("paid");
    expect((await owner.query(api.reports.year, { at: hour(), churchId: ids.churchId, year: 2027 })).helpPaid).toBe(0);
    expect(money(await owner.query(api.reports.year, { at: hour(), churchId: ids.churchId, year: 2026 }))).toEqual(money(closed));
  });

  test("negative, zero, fractional and unsafe amounts are refused before they reach the ledger", async () => {
    pin("2026-11-15T15:00:00Z");
    const { owner, ids } = await conference("America/New_York");
    for (const amount of [-100, 0, 10.5, Number.MAX_SAFE_INTEGER + 2, Number.NaN, Number.POSITIVE_INFINITY])
      await expect(owner.mutation(api.treasury.recordIncome, { churchId: ids.churchId, source: "collection", amount, date: "2026-11-01", from: "Parish" })).rejects.toThrow("more than zero");
  });

  test("an entry cannot be dated tomorrow in the group's zone, even when it is already tomorrow in UTC", async () => {
    pin("2026-11-16T08:00:00Z"); // 22:00 on November 15 in Honolulu
    const { owner, ids } = await conference("Pacific/Honolulu");
    await expect(owner.mutation(api.treasury.recordIncome, { churchId: ids.churchId, source: "collection", amount: 100, date: "2026-11-16", from: "Parish" })).rejects.toThrow("future");
    await owner.mutation(api.treasury.recordIncome, { churchId: ids.churchId, source: "collection", amount: 100, date: "2026-11-15", from: "Parish" });
  });
});

describe("deposits", () => {
  test("a gift already marked cleared on its own, or an opening balance, cannot go into a deposit", async () => {
    pin("2026-11-15T15:00:00Z");
    const { owner, ids, t } = await conference("America/New_York");
    const gift = (category: string, clearedOn?: string) =>
      t.run((ctx) => ctx.db.insert("ledgerEntries", { churchId: ids.churchId, kind: "income", amount: 2500, date: "2026-11-01", category, payee: "Parish", memo: "", clearedOn, recordedBy: ids.memberId, createdAt: 0 }));
    const cleared = await gift("Parish collection", "2026-11-03"), opening = await gift("Opening balance"), fine = await gift("Parish collection");
    await expect(owner.mutation(api.treasury.recordDeposit, { churchId: ids.churchId, entryIds: [fine, cleared], date: "2026-11-05" })).rejects.toThrow("already cleared");
    await expect(owner.mutation(api.treasury.recordDeposit, { churchId: ids.churchId, entryIds: [opening], date: "2026-11-05" })).rejects.toThrow("Only money that came in");
    const depositId = await owner.mutation(api.treasury.recordDeposit, { churchId: ids.churchId, entryIds: [fine], date: "2026-11-05" });
    expect((await t.run((ctx) => ctx.db.get("deposits", depositId)))?.total).toBe(2500);
  });
});
