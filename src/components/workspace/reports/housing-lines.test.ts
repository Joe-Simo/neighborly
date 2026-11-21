import { describe, expect, test } from "bun:test";
import Papa from "papaparse";
import { words } from "@/lib/words";
import { housingCsv, housingFileName, type HousingReport } from "./housing-lines";
import { longSpanLabel, money, monthLabel } from "./lines";

const lines = { money, monthLabel, longSpanLabel };

const months = Array.from({ length: 12 }, (_, index) => (index < 3 ? `2025-${10 + index}` : `2026-0${index - 2}`));
const report = {
  year: 2026, firstDay: "2025-10-01", lastDay: "2026-09-30", months,
  landlords: [{ name: "Orchard Street Apartments", months: months.map((_, index) => (index === 0 ? 45050 : 0)), total: 45050, payments: 1 }],
  monthTotals: months.map((_, index) => (index === 0 ? 45050 : 0)),
  total: 45050,
} satisfies HousingReport;

describe("the housing provider summary as a spreadsheet", () => {
  test("has a column per month and the year to date, in English and Spanish", () => {
    const rows = Papa.parse<string[]>(housingCsv(report, "Sample Conference", true, words(), lines)).data;
    expect(rows[0]).toEqual(["Sample Conference", "Housing Provider Summary, fiscal year 2026", "October 1, 2025 to September 30, 2026"]);
    expect(rows[3]?.[0]).toBe("Landlord");
    expect(rows[3]?.at(-1)).toBe("Year to date");
    expect(rows[3]).toHaveLength(14);
    expect(rows[4]).toEqual(["Orchard Street Apartments", "450.50", ...Array(11).fill("0.00"), "450.50"]);
    expect(rows[5]?.[0]).toBe("All landlords");
    const spanish = Papa.parse<string[]>(housingCsv(report, "Sample Conference", false, words("es"), lines)).data;
    expect(spanish[0]?.[1]).toBe("Resumen de arrendadores, año fiscal 2026");
    expect(spanish[2]?.[0]).toBe("Arrendador");
    expect(housingFileName(report, "St. Ann Conference")).toBe("st-ann-conference-housing-providers-2026.csv");
  });
});
