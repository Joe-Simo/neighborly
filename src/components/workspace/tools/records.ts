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

/** The one download: the conference's short name and the day on this device, as in st-example-records-2026-11-15.zip. */
export function recordsZipName(conference: string, sample: boolean | undefined, day: Date) {
  const short = conference.toLowerCase().replace(/\bconference\b/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "conference";
  const date = [day.getFullYear(), day.getMonth() + 1, day.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
  return `${sample ? "sample-" : ""}${short}-records-${date}.zip`;
}
