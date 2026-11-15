import Papa from "papaparse";
import { mostRows } from "@/components/workspace/tools/member-rows";

export type RequestRow = { line: number; name: string; phone: string; date: string; status: string; type: string; amount: string; payee: string; notes: string };
export type RequestSheet = { rows: RequestRow[] } | { error: string };

const columns = {
  name: ["name", "full name", "neighbor", "neighbor name", "client", "client name", "head of household"],
  first: ["first name", "first", "given name"],
  last: ["last name", "last", "surname", "family name"],
  phone: ["phone", "phone number", "telephone", "mobile phone", "cell", "mobile", "cell phone", "home phone", "work phone"],
  date: ["request date", "date", "date of request", "date provided"],
  status: ["request status", "status"],
  type: ["assistance type", "type", "type of assistance", "kind"],
  amount: ["value", "amount", "assistance value", "amount provided", "total"],
  payee: ["payee", "payee name", "landlord name", "landlord", "vendor", "vendor name"],
  notes: ["request notes", "notes", "note", "comments"],
} as const;

/**
 * Reads a file of past requests saved as CSV, such as ServWare's request export. A name (one Name column, or
 * First Name and Last Name) and a Request Date are needed; the rest is taken when present, under the names
 * ServWare shows on its request screen. Each line stays as text; the backend judges it.
 */
export function readRequestRows(text: string): RequestSheet {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ""), { header: true, transformHeader: (header) => header.trim().toLowerCase() });
  const present = parsed.meta.fields ?? [];
  const find = (wanted: readonly string[]) => wanted.find((name) => present.includes(name));
  const found = { name: find(columns.name), first: find(columns.first), last: find(columns.last), date: find(columns.date), status: find(columns.status), type: find(columns.type), amount: find(columns.amount), payee: find(columns.payee), notes: find(columns.notes) };
  const phones = columns.phone.filter((name) => present.includes(name));
  if (!found.name && !found.first) return { error: "We could not find a Name column. The first line of the file should name the columns, such as First Name, Last Name and Request Date." };
  if (!found.date) return { error: "We could not find a Request Date column. Each past request needs the day it was made." };
  const rows = parsed.data.flatMap((row, index) => {
    if (Object.values(row).every((value) => !value?.trim())) return [];
    const cell = (column: string | undefined) => (column ? (row[column] ?? "").trim() : "");
    return [{ line: index + 2, name: found.name ? cell(found.name) : `${cell(found.first)} ${cell(found.last)}`.trim(), phone: phones.map(cell).find(Boolean) ?? "", date: cell(found.date), status: cell(found.status), type: cell(found.type), amount: cell(found.amount), payee: cell(found.payee), notes: cell(found.notes) }];
  });
  if (!rows.length) return { error: "This file has column names but no requests in it." };
  if (rows.length > mostRows) return { error: `This file has ${rows.length} lines. Bring in up to ${mostRows} at a time; ServWare can export one date range at a time.` };
  return { rows };
}
