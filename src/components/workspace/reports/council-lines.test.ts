import { describe, expect, test } from "bun:test";
import { councilCsv, councilFileName, figureOrder } from "@/components/workspace/reports/council-lines";
import { councilWords } from "@/components/workspace/reports/council-words";

const figures = { households: 2, people: 5, adults: 3, children: 2, visits: 1, peopleVisited: 5, visitHours: 1.5, visitMiles: 4, requestsReceived: 2, amountRequested: 10050, helpPaid: 5000, callsTaken: 3, hoursOfService: 2.5, activeMembers: 4, membersServing: 2, moneyReceived: 9000, moneySpent: 5000, endingBalance: 4000 };
const report = { council: "Sample District Council", year: 2026, closed: true, total: figures, conferences: [{ name: "St. Example Conference", figures }] };

describe("the council report's spreadsheet", () => {
  test("has a row per figure, a column per conference and the total, money in dollars", () => {
    const rows = councilCsv(report, councilWords("en")).split("\r\n");
    expect(rows[2]).toBe(",St. Example Conference,All conferences");
    expect(rows).toContain("Amount requested,100.50,100.50");
    expect(rows).toContain("Households helped,2,2");
    expect(rows).toHaveLength(3 + figureOrder.length);
    expect(councilFileName(report)).toBe("sample-district-council-report-2026.csv");
  });
  test("says every figure in both languages", () => {
    for (const language of ["en", "es"] as const) for (const key of figureOrder) expect(councilWords(language).lines[key]).toBeTruthy();
    expect(councilWords("es").lines.households).not.toBe(councilWords("en").lines.households);
  });
});
