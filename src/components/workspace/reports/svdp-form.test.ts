import { describe, expect, test } from "bun:test";
import type { YearReport } from "@/components/workspace/reports/lines";
import { svdpForm } from "@/components/workspace/reports/svdp-form";

// Only the fields the form reads; the rest of the year's report plays no part here.
const report = {
  helpPaid: 90000, visits: 12, peopleVisited: 31, visitMiles: 140, households: 9, people: 24,
  kinds: [{ kind: "rent", paid: 60000 }, { kind: "utility", paid: 20000 }, { kind: "food", paid: 10000 }],
  vouchers: { given: 7 }, time: { hours: 210.5, activeMembers: 11 },
  money: {
    beginningBalance: 100000, received: 150000, spent: 120000, endingBalance: 130000,
    sources: [{ label: "Parish collection", amount: 80000 }, { label: "Friends of the Poor Walk", amount: 30000 }, { label: "Twinning received", amount: 10000 }, { label: "Donation", amount: 25000 }, { label: "Bake sale", amount: 5000 }],
    otherSpending: [{ label: "Pantry purchase", amount: 8000 }, { label: "Twinning gift", amount: 15000 }, { label: "Council dues", amount: 4000 }, { label: "Supplies", amount: 2500 }, { label: "Bank fee", amount: 500 }],
  },
} as unknown as YearReport;
const value = (line: { value: { cents: number } | { count: number } | null }) => (line.value && "cents" in line.value ? line.value.cents : 0);

describe("the national annual form", () => {
  test("receipts and expenses add back to the year's totals, and nothing untracked is guessed", () => {
    const [, receipts, expenses, visits] = svdpForm(report, "en");
    const coded = (lines: typeof receipts.lines) => lines.filter((line) => line.code).reduce((sum, line) => sum + value(line), 0);
    expect(coded(receipts.lines)).toBe(report.money.received);
    expect(coded(expenses.lines)).toBe(report.money.spent);
    expect(receipts.lines.find((line) => line.code === "5E")?.value).toEqual({ cents: 30000 });
    expect(expenses.lines.find((line) => line.code === "11D")?.value).toEqual({ cents: 3000 });
    expect(visits.lines.filter((line) => line.value === null).map((line) => line.code)).toEqual(["B", "C", "D", "E"]);
    expect(receipts.lines.find((line) => line.code === "1")).toMatchObject({ value: null, note: expect.stringContaining("miscellaneous") });
  });
  test("reads in Spanish", () => {
    expect(svdpForm(report, "es")[3].lines[0].line).toBe("Visitas a domicilio");
  });
});
