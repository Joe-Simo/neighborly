import Papa from "papaparse";
import { mostRows } from "@/components/workspace/tools/member-rows";

export type NeighborRow = { line: number; name: string; phone: string; email: string; address: string; adults: string; children: string; language: string; notes: string };
export type NeighborSheet = { rows: NeighborRow[] } | { error: string };

const columns = {
  name: ["name", "full name", "neighbor", "neighbor name", "client", "client name", "head of household"],
  first: ["first name", "first", "given name"],
  last: ["last name", "last", "surname", "family name"],
  phone: ["phone", "phone number", "telephone", "cell", "mobile"],
  email: ["email", "e-mail", "email address", "e-mail address"],
  address: ["address", "street address", "home address"],
  adults: ["adults", "number of adults"],
  children: ["children", "number of children", "kids"],
  language: ["language", "preferred language"],
  notes: ["notes", "note", "comments"],
} as const;

/**
 * Reads a spreadsheet of neighbors saved as CSV. Only a name is needed (one Name column, or First name
 * and Last name); phone, email, address, adults, children, language and notes are taken when present.
 */
export function readNeighborRows(text: string): NeighborSheet {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ""), { header: true, transformHeader: (header) => header.trim().toLowerCase() });
  const present = parsed.meta.fields ?? [];
  const find = (wanted: readonly string[]) => present.find((column) => wanted.includes(column));
  const found = { name: find(columns.name), first: find(columns.first), last: find(columns.last), phone: find(columns.phone), email: find(columns.email), address: find(columns.address), adults: find(columns.adults), children: find(columns.children), language: find(columns.language), notes: find(columns.notes) };
  if (!found.name && !found.first) return { error: "We could not find a Name column. The first line of the file should name the columns, such as Name, Phone and Address." };
  const rows = parsed.data.flatMap((row, index) => {
    if (Object.values(row).every((value) => !value?.trim())) return [];
    const cell = (column: string | undefined) => (column ? (row[column] ?? "").trim() : "");
    return [{ line: index + 2, name: found.name ? cell(found.name) : `${cell(found.first)} ${cell(found.last)}`.trim(), phone: cell(found.phone), email: cell(found.email), address: cell(found.address), adults: cell(found.adults), children: cell(found.children), language: cell(found.language), notes: cell(found.notes) }];
  });
  if (!rows.length) return { error: "This file has column names but nobody in it." };
  if (rows.length > mostRows) return { error: `This file has ${rows.length} lines. Bring in up to ${mostRows} at a time.` };
  return { rows };
}
