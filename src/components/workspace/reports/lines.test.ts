import { describe, expect, test } from "bun:test";
import Papa from "papaparse";
import { csvFileName, isBlank, longSpanLabel, money, reportCsv, reportLines, spanLabel, type YearReport } from "./lines";

const report = {
  year: 2026, firstDay: "2025-10-01", lastDay: "2026-09-30", timeZone: "America/New_York", closed: true,
  households: 2, people: 7, adults: 3, children: 4, householdsByLanguage: { en: 1, es: 1, ht: 0 },
  visits: 3, peopleVisited: 11, visitHours: 7.5, visitMiles: 64, helpPaid: 45050,
  kinds: [
    { kind: "rent", requests: 1, requestsPaid: 1, households: 1, people: 4, paid: 40000 },
    { kind: "utility", requests: 2, requestsPaid: 1, households: 1, people: 3, paid: 5050 },
    { kind: "food", requests: 0, requestsPaid: 0, households: 0, people: 0, paid: 0 },
    { kind: "voucher", requests: 0, requestsPaid: 0, households: 0, people: 0, paid: 0 },
    { kind: "other", requests: 0, requestsPaid: 0, households: 0, people: 0, paid: 0 },
  ],
  requests: { received: 3, open: 0, approved: 0, paid: 2, declined: 1, closed: 0, referred: 1, amountRequested: 70000, amountApproved: 45050 },
  calls: { taken: 5, returned: 4, waiting: 1 },
  time: { hours: 13.5, shiftHours: 6, activeMembers: 4, membersServing: 3, teams: [{ teamId: "team" as YearReport["time"]["teams"][number]["teamId"], name: "Help line", shifts: 2, people: 2, hours: 6 }] },
  money: { beginningBalance: 100000, received: 50000, sources: [{ label: "Parish collection", amount: 50000 }], otherSpending: [{ label: "Twinning gift", amount: 15000 }], spent: 60050, endingBalance: 89950 },
  months: Array.from({ length: 12 }, (_, index) => ({ month: index < 3 ? `2025-${10 + index}` : `2026-0${index - 2}`, calls: 0, requests: 0, visits: 0, households: 0, paid: index === 4 ? 45050 : 0, moneyIn: 0 })),
} satisfies YearReport;

describe("the year, line by line", () => {
  test("money and dates are written the way people read them", () => {
    expect([money(467500), money(45050), money(0)]).toEqual(["$4,675", "$450.50", "$0"]);
    expect(spanLabel(report)).toBe("Oct 2025 to Sep 2026");
    expect(longSpanLabel(report)).toBe("October 1, 2025 to September 30, 2026");
  });

  test("every section is there, in order, and the totals close their sections", () => {
    const lines = reportLines(report);
    expect([...new Set(lines.map((line) => line.section))]).toEqual(["Neighbors helped", "Home visits", "Requests for help", "Help paid", "Help line", "Time given", "Money"]);
    expect(lines.filter((line) => line.total).map((line) => [line.line, line.value])).toEqual([["All help paid", "$450.50"], ["Ending balance", "$899.50"]]);
    expect(lines.find((line) => line.line === "Hours on shifts, Help line")).toMatchObject({ value: "6", number: 6 });
    expect(lines.find((line) => line.line === "Spent: Twinning gift")).toMatchObject({ value: "$150", number: 150 });
    // A language nobody spoke this year has no line.
    expect(lines.some((line) => line.line.includes("Haitian"))).toBe(false);
  });

  test("the spreadsheet holds plain numbers a person can add up, then the twelve months", () => {
    const rows = Papa.parse<string[]>(reportCsv(report, "St. Example Conference")).data;
    expect(rows[0]).toEqual(["St. Example Conference", "Fiscal year 2026", "October 1, 2025 to September 30, 2026"]);
    expect(rows).toContainEqual(["Help paid", "All help paid", "450.5"]);
    expect(rows).toContainEqual(["Money", "Ending balance", "899.5"]);
    const months = rows.slice(rows.findIndex((row) => row[0] === "Month"));
    expect(months).toHaveLength(13);
    expect(months[5]).toEqual(["February 2026", "0", "0", "0", "0", "450.5", "0"]);
    expect(csvFileName(report, "St. Example Conference (sample)")).toBe("st-example-conference-sample-year-2026.csv");
  });

  test("a year is blank only when nothing at all was recorded", () => {
    expect(isBlank(report)).toBe(false);
    const nothing = { ...report, households: 0, visits: 0, calls: { taken: 0, returned: 0, waiting: 0 }, requests: { ...report.requests, received: 0 }, time: { ...report.time, shiftHours: 0 }, money: { ...report.money, beginningBalance: 0, received: 0, spent: 0 } };
    expect(isBlank(nothing)).toBe(true);
    expect(isBlank({ ...nothing, money: { ...nothing.money, beginningBalance: 100 } })).toBe(false);
  });
});
