import { csvText } from "@/lib/csv";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import type { Words } from "@/lib/words";
import type { longSpanLabel, money, monthLabel } from "@/components/workspace/reports/lines";
import { housingWords } from "@/components/workspace/reports/housing-words";
import { reportsWords } from "@/lib/words/rooms/reports";

export type HousingReport = FunctionReturnType<typeof api.reports.housingProviderSummary>;
/**
 * The report room's own ways of saying a month, a span and an amount (lines.ts), handed in by the room rather than
 * imported, so the summary's chunk does not share that module with the room (which would split it out of the room's
 * own code on every first load of Reports).
 */
export type ReportLines = { money: typeof money; monthLabel: typeof monthLabel; longSpanLabel: typeof longSpanLabel };
const dollars = (cents: number) => (cents / 100).toFixed(2);

/** The landlord summary as a spreadsheet: one row per landlord, a column per month, the year to date last. */
export function housingCsv(report: HousingReport, groupName: string, sample: boolean, words: Words, lines: ReportLines) {
  const w = housingWords(words.locale);
  return csvText([
    [groupName, w.fileTitle(report.year), lines.longSpanLabel(report, words)],
    ...(sample ? [[reportsWords(words).rows.csv.sample]] : []),
    [],
    [w.landlord, ...report.months.map((month) => lines.monthLabel(month, false, words)), w.yearToDate],
    ...report.landlords.map((line) => [line.name, ...line.months.map(dollars), dollars(line.total)]),
    [w.total, ...report.monthTotals.map(dollars), dollars(report.total)],
  ]);
}

export const housingFileName = (report: HousingReport, groupName: string) =>
  `${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}-housing-providers-${report.year}.csv`;
