import { describe, expect, test } from "bun:test";
import { csvText } from "./csv";

describe("csvText", () => {
  test("a cell that begins like a formula is kept as text", () => {
    const text = csvText([["=HYPERLINK(\"http://x\")", "+1", "@SUM(A1)", "-2+3", "\t=1"]]);
    for (const cell of text.split(",")) expect(cell.replace(/^"/, "")).toMatch(/^'/);
  });
  test("plain words and negative amounts are left alone", () => {
    expect(csvText([["Rosa", "-12.50", "-3", 4]])).toBe("Rosa,-12.50,-3,4");
  });
  test("fields and data are both escaped", () => {
    expect(csvText({ fields: ["=a"], data: [["@b"]] })).toBe(`"'=a"\r\n"'@b"`);
  });
});
