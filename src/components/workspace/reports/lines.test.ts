import { describe, expect, test } from "bun:test";
import Papa from "papaparse";
import { csvFileName, isBlank, longSpanLabel, money, reportCsv, reportLines, spanLabel, type YearReport } from "./lines";

const report = {
  year: 2026, quarter: null, firstDay: "2025-10-01", lastDay: "2026-09-30", timeZone: "America/New_York", closed: true,
  households: 2, people: 7, adults: 3, children: 4, householdsHelpedAgain: 1, householdsByLanguage: { en: 1, es: 1 }, householdsByOtherLanguage: [],
  visits: 3, peopleVisited: 11, visitHours: 7.5, visitMiles: 64, helpPaid: 45050,
  kinds: [
    { kind: "rent", requests: 1, requestsPaid: 1, households: 1, people: 4, paid: 40000 },
    { kind: "utility", requests: 2, requestsPaid: 1, households: 1, people: 3, paid: 5050 },
    { kind: "food", requests: 0, requestsPaid: 0, households: 0, people: 0, paid: 0 },
    { kind: "voucher", requests: 0, requestsPaid: 0, households: 0, people: 0, paid: 0 },
    { kind: "other", requests: 0, requestsPaid: 0, households: 0, people: 0, paid: 0 },
  ],
  requests: { received: 3, open: 0, approved: 0, paid: 2, declined: 1, closed: 0, referred: 1, amountRequested: 70000, amountApproved: 45050, paidTowardThese: 45050, paidLater: { requests: 0, amount: 0 }, closedAfterPart: { requests: 0, paid: 0, approved: 0 }, paidTowardEarlier: 0 },
  vouchers: { given: 0, takenBack: 0, requests: 0, households: 0 },
  visitsByPlace: { home: { visits: 3, people: 7 }, prison: { visits: 0, people: 0 }, hospital: { visits: 0, people: 0 }, eldercare: { visits: 0, people: 0 }, other: { visits: 0, people: 0 } },
  guestHours: 0,
  goods: { food: { times: 0, items: 0 }, furniture: { times: 0, items: 0 }, clothing: { times: 0, items: 0 } },
  calls: { taken: 5, returned: 4, waiting: 1 },
  history: { requests: 0, households: 0, people: 0, amount: 0, kinds: [], householdsInAll: 2, peopleInAll: 7 },
  time: { hours: 13.5, shiftHours: 6, activeMembers: 4, membersServing: 3, teams: [{ teamId: "team" as YearReport["time"]["teams"][number]["teamId"], name: "Help line", shifts: 2, people: 2, hours: 6 }], members: [{ memberId: "member" as YearReport["time"]["members"][number]["memberId"], name: "Sample Helper", visits: 3, shifts: 2, hours: 9.75, miles: 32 }] },
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
    expect([...new Set(lines.map((line) => line.section))]).toEqual(["Neighbors helped", "Home visits", "Requests for help", "Help paid", "Help line", "Time given", "Cash in and out"]);
    expect(lines.filter((line) => line.total).map((line) => [line.line, line.value])).toEqual([["All help paid", "$450.50"], ["Ending balance", "$899.50"]]);
    expect(lines.find((line) => line.line === "Hours on shifts, Help line")).toMatchObject({ value: "6", number: 6 });
    // A household speaks what it speaks: each other language recorded has its own line.
    const more = reportLines({ ...report, householdsByOtherLanguage: [{ name: "Mandarin", households: 2 }] });
    expect(more.find((line) => line.line === "Households speaking Mandarin")).toMatchObject({ number: 2 });
    expect(lines.find((line) => line.line === "Spent: Twinning gift")).toMatchObject({ value: "$150", number: 150 });
    // Help brought over from ServWare is listed apart, and only when there is some.
    const moved = reportLines({ ...report, history: { requests: 3, households: 2, people: 6, amount: 61000, kinds: [{ kind: "rent", requests: 2, amount: 61000 }, { kind: "food", requests: 1, amount: 0 }], householdsInAll: 3, peopleInAll: 10 } }).filter((line) => line.section === "From ServWare history");
    expect(moved.map((line) => [line.line, line.value])).toEqual([["Requests in the history", "3"], ["Households in the history", "2"], ["Rent, in the history", "$610"], ["All help in the history", "$610"], ["Households helped in all, each counted once", "3"], ["People in those households", "10"]]);
    expect(lines.find((line) => line.line === "All help paid")?.value).toBe("$450.50");
    // A language nobody spoke this year has no line.
    expect(lines.some((line) => line.line.includes("Haitian"))).toBe(false);
  });

  test("the spreadsheet holds plain numbers a person can add up, then the twelve months", () => {
    const rows = Papa.parse<string[]>(reportCsv(report, "St. Example Conference")).data;
    expect(rows[0]).toEqual(["St. Example Conference", "Fiscal year 2026", "October 1, 2025 to September 30, 2026"]);
    expect(rows).toContainEqual(["Help paid", "All help paid", "450.50"]);
    expect(rows).toContainEqual(["Cash in and out", "Ending balance", "899.50"]);
    const months = rows.slice(rows.findIndex((row) => row[0] === "Month"), rows.findIndex((row) => row[0] === "Member") - 1);
    expect(months).toHaveLength(13);
    expect(rows.slice(-2)).toEqual([["Member", "Home visits made", "Shifts", "Hours", "Miles"], ["Sample Helper", "3", "2", "9.75", "32"]]);
    const quarter = { ...report, quarter: 2 as const, firstDay: "2026-01-01", lastDay: "2026-03-31" };
    expect(Papa.parse<string[]>(reportCsv(quarter, "St. Example Conference")).data[0]).toEqual(["St. Example Conference", "Fiscal year 2026, second quarter", "January 1, 2026 to March 31, 2026"]);
    expect(csvFileName(quarter, "St. Example")).toBe("st-example-year-2026-quarter-2.csv");
    expect(months[5]).toEqual(["February 2026", "0", "0", "0", "0", "450.50", "0.00"]);
    expect(Papa.parse<string[]>(reportCsv(report, "St. Example Conference", true)).data[1]).toEqual(["Sample"]);
    expect(csvFileName(report, "St. Example Conference (sample)")).toBe("st-example-conference-sample-year-2026.csv");
  });

  test("the $210 story: the screen, the printed lines and the spreadsheet show the same money", () => {
    // The figures convex/story.test.ts reads back from the server after one $210 utility payment from a $500 collection.
    const story = {
      ...report, year: 2027, firstDay: "2026-10-01", lastDay: "2027-09-30", closed: false,
      households: 1, people: 5, adults: 2, children: 3, householdsHelpedAgain: 0, householdsByLanguage: { en: 0, es: 1 },
      visits: 1, peopleVisited: 5, visitHours: 3, visitMiles: 8, helpPaid: 21000,
      kinds: report.kinds.map((kind) => (kind.kind === "utility" ? { ...kind, requests: 1, requestsPaid: 1, households: 1, people: 5, paid: 21000 } : { ...kind, requests: 0, requestsPaid: 0, households: 0, people: 0, paid: 0 })),
      requests: { ...report.requests, received: 1, paid: 1, declined: 0, referred: 0, amountRequested: 24000, amountApproved: 21000, paidTowardThese: 21000 },
      calls: { taken: 1, returned: 0, waiting: 1 },
      money: { beginningBalance: 0, received: 50000, sources: [{ label: "Parish collection", amount: 50000 }], otherSpending: [], spent: 21000, endingBalance: 29000 },
      months: Array.from({ length: 12 }, (_, index) => ({ month: index < 3 ? `2026-${10 + index}` : `2027-0${index - 2}`, calls: index === 1 ? 1 : 0, requests: index === 1 ? 1 : 0, visits: index === 1 ? 1 : 0, households: index === 1 ? 1 : 0, paid: index === 1 ? 21000 : 0, moneyIn: index === 1 ? 50000 : 0 })),
    } satisfies YearReport;
    const lines = reportLines(story);
    const shown = (line: string) => lines.filter((row) => row.line === line).map((row) => [row.value, row.number]);
    // On screen and on paper the money reads $210, $240, $500 and $290; in the spreadsheet as dollars to add up.
    expect(shown("All help paid")).toEqual([["$210", 210]]);
    expect(shown("Spent: help paid")).toEqual([["$210", 210]]);
    expect(shown("Ending balance")).toEqual([["$290", 290]]);
    expect(lines.filter((row) => row.money).every((row) => row.value === money(Math.round(row.number * 100)))).toBe(true);
    const rows = Papa.parse<string[]>(reportCsv(story, "St. Example Conference")).data;
    expect(rows).toContainEqual(["Help paid", "All help paid", "210.00"]);
    expect(rows).toContainEqual(["Cash in and out", "All money received", "500.00"]);
    expect(rows).toContainEqual(["Cash in and out", "Ending balance", "290.00"]);
    // The kinds of help add up to the total, and the twelve months' payments to the same.
    const paidSection = rows.filter((row) => row[0] === "Help paid" && row[1] !== "All help paid");
    expect(paidSection.reduce((sum, row) => sum + Math.round(Number(row[2]) * 100), 0)).toBe(story.helpPaid);
    const months = rows.slice(rows.findIndex((row) => row[0] === "Month") + 1, rows.findIndex((row) => row[0] === "Month") + 13);
    expect(months[1]).toEqual(["November 2026", "1", "1", "1", "1", "210.00", "500.00"]);
    expect(months.reduce((sum, row) => sum + Math.round(Number(row[5]) * 100), 0)).toBe(story.helpPaid);
  });

  test("a year is blank only when nothing at all was recorded", () => {
    expect(isBlank(report)).toBe(false);
    const nothing = { ...report, households: 0, visits: 0, calls: { taken: 0, returned: 0, waiting: 0 }, requests: { ...report.requests, received: 0 }, time: { ...report.time, shiftHours: 0 }, money: { ...report.money, beginningBalance: 0, received: 0, spent: 0 } };
    expect(isBlank(nothing)).toBe(true);
    expect(isBlank({ ...nothing, money: { ...nothing.money, beginningBalance: 100 } })).toBe(false);
  });
});
