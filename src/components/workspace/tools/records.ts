import Papa from "papaparse";
import { formulaStart } from "@/lib/csv";

/** Every record a conference keeps here, in the order a person would look for them: the people helped, the money, then the conference itself. */
export const recordFiles = [
  { key: "neighbors", holds: "Each household: name, phone, address, who lives there and their work, language and notes.", title: "Neighbors", gathering: "neighbors" },
  { key: "notes", holds: "Every note written on a neighbor’s record, with who wrote it and when.", title: "Notes on neighbors", gathering: "notes on neighbors" },
  { key: "calls", holds: "The help line’s log: who called, what they said, and when the call was returned.", title: "Help line calls", gathering: "help line calls" },
  { key: "requests", holds: "Every request for help, what was asked, what was decided and what was given.", title: "Requests and their outcomes", gathering: "requests" },
  { key: "visits", holds: "Each home visit: when it was, who went and what was written up.", title: "Home visits", gathering: "home visits" },
  { key: "ledger", holds: "Money in and money out, line by line, in dollars and cents.", title: "The ledger", gathering: "the ledger" },
  { key: "deposits", holds: "Each deposit taken to the bank.", title: "Deposits", gathering: "deposits" },
  { key: "statements", holds: "Each bank statement the treasurer agreed with the books.", title: "Bank statements", gathering: "bank statements" },
  { key: "vouchers", holds: "Vouchers received and given, line by line.", title: "Vouchers", gathering: "vouchers" },
  { key: "payees", holds: "The landlords, utilities and stores you pay. Account numbers show their last four digits only.", title: "Who you pay", gathering: "who you pay" },
  { key: "referrals", holds: "The places you send people on to, and what each helps with.", title: "Where you refer", gathering: "where you refer" },
  { key: "members", holds: "Your members, their roles and how to reach them.", title: "Members", gathering: "members" },
  { key: "teams", holds: "Each team and who serves on it.", title: "Teams", gathering: "teams" },
  { key: "commitments", holds: "Every shift and commitment: when, where and who served.", title: "Commitments", gathering: "commitments" },
  { key: "history", holds: "Who did what and when: approvals, invitations and each time records were taken out.", title: "History", gathering: "the history" },
] as const;
export type RecordFileKey = (typeof recordFiles)[number]["key"];

/** A spreadsheet program runs a cell that begins like a formula. A leading apostrophe makes it plain text again. */
const plain = (cell: string) => (formulaStart.test(cell) ? `'${cell}` : cell);

/** One file as CSV text, with a byte-order mark so Excel reads accents correctly. */
export function recordsCsv(columns: string[], rows: string[][]) {
  return `﻿${Papa.unparse({ fields: columns, data: rows.map((row) => row.map(plain)) })}`;
}
const fileNames: Partial<Record<RecordFileKey, string>> = { payees: "who-you-pay", notes: "neighbor-notes", calls: "help-line-calls", statements: "bank-statements", referrals: "where-you-refer" };
export const recordsFileName = (key: RecordFileKey, sample: boolean | undefined) => `${sample ? "sample-" : ""}${fileNames[key] ?? key}.csv`;

/** The one download: the conference's short name and the day on this device, as in st-example-records-2026-11-15.zip. */
export function recordsZipName(conference: string, sample: boolean | undefined, day: Date) {
  const short = conference.toLowerCase().replace(/\bconference\b/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "conference";
  const date = [day.getFullYear(), day.getMonth() + 1, day.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
  return `${sample ? "sample-" : ""}${short}-records-${date}.zip`;
}

const escaped = (text: string) => text.replace(/[&<>"]/g, (mark) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[mark] ?? mark);

/**
 * The sheet on top of the folder: one page that opens in any browser and prints on Letter or A4,
 * saying whose records these are, when they were gathered, what each file holds and how to keep them.
 * It stands alone: no pictures, scripts or addresses, and the two typefaces travel inside it (as data, in `faces`)
 * so it prints the same on a computer that has never seen the site.
 */
export function recordsCover({ conference, sample, day, by, files, faces }: { conference: string; sample: boolean | undefined; day: string; by: string; files: { title: string; fileName: string; holds: string; lines: number }[]; faces?: { serif: string; sans: string } }) {
  const rows = files.map((file) => `<tr><td><b>${escaped(file.title)}</b><small>${escaped(file.fileName)}</small></td><td>${escaped(file.holds)}</td><td class="n">${file.lines ? file.lines.toLocaleString("en-US") : "None yet"}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaped(conference)} records, ${escaped(day)}</title>
<style>
${faces ? `@font-face { font-family: "Newsreader"; font-weight: 200 800; src: url(${faces.serif}) format("woff2"); }
@font-face { font-family: "Source Sans 3"; font-weight: 200 900; src: url(${faces.sans}) format("woff2"); }
` : ""}@page { margin: 16mm 16mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0 auto; padding: 40px 24px; max-width: 720px; color: #000; background: #fff; font: 12pt/1.45 "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
.over { margin: 0; font-size: 8.5pt; letter-spacing: 0.1em; text-transform: uppercase; }
h1 { margin: 6px 0 0; font: 400 30pt/1.05 "Newsreader", "Iowan Old Style", Georgia, serif; letter-spacing: -0.015em; }
.when { max-width: none; margin: 8px 0 0; padding-bottom: 16px; border-bottom: 1.5pt solid #000; font-size: 13pt; }
table { width: 100%; margin-top: 8px; border-collapse: collapse; }
th { padding: 10px 14px 6px 0; text-align: left; font-size: 7.5pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
td { padding: 9px 14px 9px 0; vertical-align: top; border-top: 0.35pt solid #8a8a8a; }
tr:first-child td { border-top: 0.75pt solid #000; }
td:first-child { width: 34%; }
b { display: block; font: 400 14pt/1.2 "Newsreader", "Iowan Old Style", Georgia, serif; }
small { display: block; margin-top: 2px; font-size: 9pt; }
.n { padding-right: 0; text-align: right; white-space: nowrap; font-weight: 600; font-variant-numeric: tabular-nums; }
th.n { font-weight: 600; }
h2 { margin: 28px 0 4px; font: 400 14pt/1.2 "Newsreader", "Iowan Old Style", Georgia, serif; }
p { margin: 0 0 6px; max-width: 62ch; }
footer { display: flex; justify-content: space-between; align-items: baseline; margin-top: 36px; padding-top: 10px; border-top: 0.5pt solid #000; font-size: 9pt; }
footer span:first-child { font: 400 12pt/1 "Newsreader", "Iowan Old Style", Georgia, serif; }
@media print { body { padding: 0; max-width: none; } tr, h2, p { break-inside: avoid; } }
</style>
</head>
<body>
<p class="over">${escaped(conference)}${sample ? " · Sample, made-up people" : ""}</p>
<h1>Your records</h1>
<p class="when">Gathered ${escaped(day)} by ${escaped(by)}.</p>
<table>
<thead><tr><th>File</th><th>What it holds</th><th class="n">Lines</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>Keeping them</h2>
<p>These files hold your neighbors’ private details. Keep them where only your conference’s officers can reach them, and do not send them by email.</p>
<h2>Opening them</h2>
<p>Each file opens in Excel, Numbers or Google Sheets. The column names are the ones Kind Helps reads, so any file can be brought back in from Your files.</p>
<h2>Lines that read “Record removed”</h2>
<p>When an owner removes a neighbor’s record, the name and every word written about the household are erased, and the dates and amounts stay under “Record removed” so the year’s totals still add up.</p>
<footer><span>kind helps</span><span>${sample ? "Sample · " : ""}Gathered ${escaped(day)}</span></footer>
</body>
</html>
`;
}
export const recordsCoverName = (sample: boolean | undefined) => `${sample ? "sample-" : ""}read-me-first.html`;
