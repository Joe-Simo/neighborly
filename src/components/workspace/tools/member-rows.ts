import Papa from "papaparse";

export type MemberRow = { line: number; name: string; email: string; role: string };
export type MemberSheet = { rows: MemberRow[] } | { error: string };

const nameColumns = ["name", "full name", "member", "member name"];
const firstColumns = ["first name", "first", "given name"];
const lastColumns = ["last name", "last", "surname", "family name"];
const emailColumns = ["email", "e-mail", "email address", "e-mail address"];
export const mostRows = 300;

/**
 * Reads a members spreadsheet saved as CSV. The first line names the columns; a Name column
 * (or First name and Last name) and an Email column are needed, Role is optional.
 * Line numbers match the spreadsheet, so a problem can be found again.
 */
export function readMemberRows(text: string): MemberSheet {
  const parsed = Papa.parse<Record<string, string | undefined>>(text.replace(/^﻿/, ""), {
    header: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });
  const columns = parsed.meta.fields ?? [];
  const find = (wanted: string[]) => columns.find((column) => wanted.includes(column));
  const name = find(nameColumns), first = find(firstColumns), last = find(lastColumns), email = find(emailColumns);
  if (!email) return { error: "We could not find an Email column. The first line of the file should name the columns, such as Name and Email." };
  if (!name && !first) return { error: "We could not find a Name column. The first line of the file should name the columns, such as Name and Email." };
  const rows = parsed.data.flatMap((row, index) => {
    if (Object.values(row).every((value) => !value?.trim())) return [];
    const cell = (column: string | undefined) => (column ? (row[column] ?? "").trim() : "");
    return [{ line: index + 2, name: name ? cell(name) : `${cell(first)} ${cell(last)}`.trim(), email: cell(email), role: cell("role") }];
  });
  if (!rows.length) return { error: "This file has column names but no people in it." };
  if (rows.length > mostRows) return { error: `This file has ${rows.length} people. Bring in up to ${mostRows} at a time.` };
  return { rows };
}

/** The private invitation links as a spreadsheet, for the owner to pass on by hand. */
export function invitationLinksCsv(people: { name: string; email: string; token: string }[], origin: string) {
  return Papa.unparse({
    fields: ["Name", "Email", "Private invitation link"],
    data: people.map((person) => [person.name, person.email, `${origin}/app?invite=${encodeURIComponent(person.token)}`]),
  });
}
