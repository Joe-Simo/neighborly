import { describe, expect, test } from "bun:test";
import { readNeighborRows } from "./neighbor-rows";
import { recordsCsv, recordsFileName, recordsZipName } from "./records";

describe("the files a conference takes away", () => {
  test("a cell that looks like a formula is made plain, and the file reads back in", () => {
    const csv = recordsCsv(["Name", "Phone", "Notes"], [["Celeste Hyppolite", "(100) 555-0142", "=HYPERLINK(1)"], ["Fabrice Greenhalgh", "", "Prefers Kreyòl, calls after 5"]]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(readNeighborRows(csv)).toMatchObject({ rows: [{ line: 2, name: "Celeste Hyppolite", phone: "(100) 555-0142" }, { line: 3, name: "Fabrice Greenhalgh", notes: "Prefers Kreyòl, calls after 5" }] });
  });
  test("a sample conference's files say so in their names", () => {
    expect(recordsFileName("payees", true)).toBe("sample-who-you-pay.csv");
    expect(recordsFileName("ledger", false)).toBe("ledger.csv");
  });
  test("the one download is named for the conference and the day", () => {
    expect(recordsZipName("St. Example Conference", false, new Date(2026, 10, 15))).toBe("st-example-records-2026-11-15.zip");
    expect(recordsZipName("St. Example Conference", true, new Date(2026, 0, 5))).toBe("sample-st-example-records-2026-01-05.zip");
  });
});
