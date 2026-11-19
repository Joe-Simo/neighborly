import Papa from "papaparse";
import { mostLines } from "@/components/workspace/tools/member-rows";

export type PayeeRow = { line: number; name: string; type: string; address: string; phone: string; email: string; notes: string };
type PayeeSheet = { rows: PayeeRow[] } | { error: string };

const columns = {
  name: ["name", "vendor", "vendor name", "payee", "payee name", "landlord name", "landlord", "company", "company name"],
  type: ["type", "vendor type", "kind", "category"],
  address: ["address", "contact address", "street address", "street address line 1", "address line 1", "address 1"],
  address2: ["street address line 2", "address line 2", "address 2"],
  city: ["city"],
  state: ["state", "state code"],
  zip: ["zip", "zip code", "postal code"],
  phone: ["phone", "phone number", "telephone", "work phone", "office phone"],
  email: ["email", "e-mail", "email address", "e-mail address"],
  notes: ["notes", "note", "comments"],
} as const;

/**
 * Reads a list of payees saved as CSV, such as ServWare's vendor export: the landlords, utilities and stores
 * a conference pays. Only a name is needed; the rest is taken when present. Each line stays as text; the backend judges it.
 */
export function readPayeeRows(text: string): PayeeSheet {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ""), { header: true, transformHeader: (header) => header.trim().toLowerCase() });
  const present = parsed.meta.fields ?? [];
  const find = (wanted: readonly string[]) => wanted.find((name) => present.includes(name));
  const found = { name: find(columns.name), type: find(columns.type), address: find(columns.address), address2: find(columns.address2), city: find(columns.city), state: find(columns.state), zip: find(columns.zip), phone: find(columns.phone), email: find(columns.email), notes: find(columns.notes) };
  if (!found.name) return { error: "This file has no Name column. Its first line should name the columns, such as Name, Type and Phone." };
  const rows = parsed.data.flatMap((row, index) => {
    if (Object.values(row).every((value) => !value?.trim())) return [];
    const cell = (column: string | undefined) => (column ? (row[column] ?? "").trim() : "");
    return [{ line: index + 2, name: cell(found.name), type: cell(found.type), address: [[cell(found.address), cell(found.address2)].filter(Boolean).join(" "), cell(found.city), [cell(found.state), cell(found.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", "), phone: cell(found.phone), email: cell(found.email), notes: cell(found.notes) }];
  });
  if (!rows.length) return { error: "This file has column names but no payees in it." };
  if (rows.length > mostLines) return { error: `This file has ${rows.length} lines. Bring in up to ${mostLines} at a time.` };
  return { rows };
}
