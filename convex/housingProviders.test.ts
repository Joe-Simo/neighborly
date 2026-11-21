/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { fiscalYear, housingProviders } from "./reports";
import { nameKey } from "./assistance";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const HOUR = 3600000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T15:00:00Z"));
});
afterEach(() => void vi.useRealTimers());

const span = fiscalYear(2026, "America/New_York");
const id = (value: string) => value as Id<"ledgerEntries">;
const entry = (value: string, extra: Partial<Parameters<typeof housingProviders>[2][number]>) => ({
  _id: id(value), kind: "expense" as const, amount: 10000, date: "2025-10-05", payee: "Mill Road Rentals", requestId: undefined, voidedAt: undefined, reverses: undefined, ...extra,
});

describe("the housing provider summary", () => {
  test("adds up landlord payments by month and leaves out voided, reversed and other payees", () => {
    const request = "request1" as Id<"assistanceRequests">;
    const report = housingProviders(2026, span, [
      entry("a", { requestId: request }),
      entry("b", { date: "2026-03-02", amount: 2500, payee: " mill road rentals " }),
      entry("c", { payee: "Orchard Street Apartments", date: "2026-09-30", amount: 50000 }),
      entry("d", { payee: "Orchard Street Apartments", voidedAt: 1 }),
      entry("e", { payee: "Orchard Street Apartments", amount: 7000 }),
      entry("f", { kind: "income", payee: "Orchard Street Apartments", amount: 7000, reverses: id("e") }),
      entry("g", { payee: "City Power & Light" }),
      entry("h", { kind: "income", payee: "Orchard Street Apartments" }),
      entry("i", { payee: "Orchard Street Apartments", date: "2026-10-01" }),
    ], new Set([request]), new Set([nameKey("Orchard Street Apartments"), nameKey("Mill Road Rentals")]), nameKey);
    expect(report.landlords.map((line) => [line.name, line.total, line.payments])).toEqual([["Orchard Street Apartments", 50000, 1], ["Mill Road Rentals", 12500, 2]]);
    expect(report.landlords[1]?.months[0]).toBe(10000);
    expect(report.landlords[1]?.months[5]).toBe(2500);
    expect(report.monthTotals[11]).toBe(50000);
    expect(report.total).toBe(62500);
  });

  test("matches the sample conference's landlord payments, and is closed to members", async () => {
    const t = convexTest(schema, modules);
    const churchId = await t.mutation(internal.sampleData.load, {});
    const { members, ledger, requests } = await t.run(async (ctx) => ({
      members: await ctx.db.query("memberships").collect(),
      ledger: await ctx.db.query("ledgerEntries").collect(),
      requests: await ctx.db.query("assistanceRequests").collect(),
    }));
    const owner = members.find((member) => member.role === "owner");
    const member = members.find((one) => one.role === "member");
    if (!owner || !member) throw new Error("The sample has no owner or member.");
    const at = Math.floor(Date.now() / HOUR) * HOUR;
    const report = await signedIn(t, owner.userId).query(api.reports.housingProviderSummary, { churchId, at, year: 2026 });
    const landlord = new Set(requests.filter((request) => request.payeeKind === "landlord").map((request) => request._id));
    const reversed = new Set(ledger.flatMap((line) => (line.reverses ? [line.reverses] : [])));
    const hand = ledger
      .filter((line) => line.kind === "expense" && !line.voidedAt && !line.reverses && !reversed.has(line._id) && line.requestId && landlord.has(line.requestId))
      .filter((line) => line.date >= "2025-10-01" && line.date <= "2026-09-30")
      .reduce((sum, line) => sum + line.amount, 0);
    expect(hand).toBeGreaterThan(0);
    expect(report.total).toBe(hand);
    expect(report.months).toHaveLength(12);
    await expect(signedIn(t, member.userId).query(api.reports.housingProviderSummary, { churchId, at, year: 2026 })).rejects.toThrow();
  });
});
