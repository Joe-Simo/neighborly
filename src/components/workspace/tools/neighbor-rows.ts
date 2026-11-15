import Papa from "papaparse";
import { mostLines } from "@/components/workspace/tools/member-rows";

export type NeighborRow = { line: number; name: string; phone: string; email: string; address: string; adults: string; children: string; language: string; notes: string };
export type NeighborSheet = { rows: NeighborRow[] } | { error: string };

const columns = {
  name: ["name", "full name", "neighbor", "neighbor name", "client", "client name", "head of household"],
  first: ["first name", "first", "given name"],
  last: ["last name", "last", "surname", "family name"],
  phone: ["phone", "phone number", "telephone", "mobile phone", "cell", "mobile", "cell phone", "home phone", "work phone"],
  email: ["email", "e-mail", "email address", "e-mail address"],
  address: ["address", "street address", "home address", "street address line 1", "address line 1", "address 1"],
  address2: ["street address line 2", "address line 2", "address 2", "apt", "apartment", "unit"],
  city: ["city"],
  state: ["state", "state code"],
  zip: ["zip", "zip code", "postal code"],
  adults: ["adults", "number of adults"],
  children: ["children", "number of children", "kids"],
  language: ["language", "preferred language"],
  notes: ["notes", "note", "comments", "neighbor notes"],
} as const;

/**
 * Reads a spreadsheet of neighbors saved as CSV. Only a name is needed (one Name column, or First name
 * and Last name); phone, email, address, adults, children, language and notes are taken when present.
 * The column names of ServWare's neighbor file (First Name, Last Name, Street Address Line 1, City, State Code,
 * Zip Code, Home Phone, Mobile Phone, Neighbor Notes) are read as they are; the first phone a line has is kept.
 */
export function readNeighborRows(text: string): NeighborSheet {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ""), { header: true, transformHeader: (header) => header.trim().toLowerCase() });
  const present = parsed.meta.fields ?? [];
  const find = (wanted: readonly string[]) => wanted.map((name) => present.find((column) => column === name)).find(Boolean);
  const phones = columns.phone.filter((name) => present.includes(name));
  const found = { name: find(columns.name), first: find(columns.first), last: find(columns.last), email: find(columns.email), address: find(columns.address), address2: find(columns.address2), city: find(columns.city), state: find(columns.state), zip: find(columns.zip), adults: find(columns.adults), children: find(columns.children), language: find(columns.language), notes: find(columns.notes) };
  if (!found.name && !found.first) return { error: "We could not find a Name column. The first line of the file should name the columns, such as Name, Phone and Address." };
  const rows = parsed.data.flatMap((row, index) => {
    if (Object.values(row).every((value) => !value?.trim())) return [];
    const cell = (column: string | undefined) => (column ? (row[column] ?? "").trim() : "");
    return [{ line: index + 2, name: found.name ? cell(found.name) : `${cell(found.first)} ${cell(found.last)}`.trim(), phone: phones.map(cell).find(Boolean) ?? "", email: cell(found.email), address: [[cell(found.address), cell(found.address2)].filter(Boolean).join(" "), cell(found.city), [cell(found.state), cell(found.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", "), adults: cell(found.adults), children: cell(found.children), language: cell(found.language), notes: cell(found.notes) }];
  });
  if (!rows.length) return { error: "This file has column names but nobody in it." };
  if (rows.length > mostLines) return { error: `This file has ${rows.length} lines. Bring in up to ${mostLines} at a time.` };
  return { rows };
}
