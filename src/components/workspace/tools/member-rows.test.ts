import { describe, expect, test } from "bun:test";
import { invitationLinksCsv, readMemberRows } from "./member-rows";

describe("reading a members spreadsheet", () => {
  test("finds the columns whatever their order or capitals, and keeps the spreadsheet's line numbers", () => {
    const sheet = readMemberRows('﻿E-mail , Phone,NAME,Role\r\nhannah@neighborly.example,(100) 555-0101,"Lindqvist, Hannah",\r\n,,,\r\nvictor@neighborly.example,(100) 555-0102,Victor Salgado,Coordinator\r\n');
    expect(sheet).toEqual({ rows: [
      { line: 2, name: "Lindqvist, Hannah", email: "hannah@neighborly.example", role: "" },
      { line: 4, name: "Victor Salgado", email: "victor@neighborly.example", role: "Coordinator" },
    ] });
  });
  test("joins first and last name columns", () => {
    expect(readMemberRows("First Name,Last Name,Email\nPriya,Raman,priya@neighborly.example")).toEqual({ rows: [{ line: 2, name: "Priya Raman", email: "priya@neighborly.example", role: "" }] });
  });
  test("says plainly when the file cannot be used", () => {
    expect(readMemberRows("Name,Phone\nPriya Raman,(100) 555-0103")).toEqual({ error: expect.stringContaining("Email column") });
    expect(readMemberRows("Email\npriya@neighborly.example")).toEqual({ error: expect.stringContaining("Name column") });
    expect(readMemberRows("Name,Email\n")).toEqual({ error: expect.stringContaining("no people") });
  });
  test("writes the links file so a spreadsheet opens it cleanly", () => {
    expect(invitationLinksCsv([{ name: "Lindqvist, Hannah", email: "hannah@neighborly.example", token: "ab12" }], "https://neighborly.example")).toBe('Name,Email,Private invitation link\r\n"Lindqvist, Hannah",hannah@neighborly.example,https://neighborly.example/app?invite=ab12');
  });
});
