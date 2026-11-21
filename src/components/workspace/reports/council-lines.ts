import Papa from "papaparse";
import type { CouncilFigures, CouncilYear } from "../../../../convex/councils";
import type { CouncilWords } from "@/components/workspace/reports/council-words";

/** The figures in the order the report lists them, and which of them are money (whole cents). */
export const figureOrder: (keyof CouncilFigures)[] = [
  "households", "people", "adults", "children", "visits", "peopleVisited", "visitHours", "visitMiles", "requestsReceived",
  "amountRequested", "helpPaid", "callsTaken", "hoursOfService", "activeMembers", "membersServing", "moneyReceived", "moneySpent", "endingBalance",
];
const moneyFigures = new Set<keyof CouncilFigures>(["amountRequested", "helpPaid", "moneyReceived", "moneySpent", "endingBalance"]);
export const isMoney = (key: keyof CouncilFigures) => moneyFigures.has(key);

/** The council's year as a spreadsheet: a row per figure, a column per conference, all conferences last. Money in dollars. */
export function councilCsv(report: CouncilYear, w: CouncilWords) {
  const cell = (key: keyof CouncilFigures, value: number) => (isMoney(key) ? (value / 100).toFixed(2) : String(value));
  return Papa.unparse([
    [w.fileTitle(report.council, report.year)],
    [],
    ["", ...report.conferences.map((row) => row.name), w.total],
    ...figureOrder.map((key) => [w.lines[key], ...report.conferences.map((row) => cell(key, row.figures[key])), cell(key, report.total[key])]),
  ]);
}

export const councilFileName = (report: CouncilYear) =>
  `${report.council.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "council"}-report-${report.year}.csv`;
