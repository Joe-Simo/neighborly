import { describe, expect, test } from "bun:test";
import { readNeighborRows } from "./neighbor-rows";
import { recordsCsv, recordsFileName } from "./records";

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
});
