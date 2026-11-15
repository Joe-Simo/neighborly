import Papa from "papaparse";

export const recordFiles = [
  { key: "neighbors", title: "Neighbors", gathering: "neighbors" },
  { key: "requests", title: "Requests and their outcomes", gathering: "requests" },
  { key: "visits", title: "Home visits", gathering: "home visits" },
  { key: "ledger", title: "The ledger", gathering: "the ledger" },
  { key: "payees", title: "Who you pay", gathering: "who you pay" },
  { key: "members", title: "Members", gathering: "members" },
] as const;
export type RecordFileKey = (typeof recordFiles)[number]["key"];

/** A spreadsheet program runs a cell that begins like a formula. A leading apostrophe makes it plain text again. */
const plain = (cell: string) => (/^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell);

/** One file as CSV text, with a byte-order mark so Excel reads accents and Creole letters correctly. */
export function recordsCsv(columns: string[], rows: string[][]) {
  return `﻿${Papa.unparse({ fields: columns, data: rows.map((row) => row.map(plain)) })}`;
}
export const recordsFileName = (key: RecordFileKey, sample: boolean | undefined) => `${sample ? "sample-" : ""}${key === "payees" ? "who-you-pay" : key}.csv`;
