import { expect, test } from "bun:test";
import { evalTable } from "./made-proof";
import { measured } from "./jev-set";

test("the case study's eval table adds up to the figure the screens quote", () => {
  const sum = (key: "right" | "blank" | "wrong") => evalTable.fields.reduce((total, row) => total + row[key], 0);
  expect(evalTable.notes).toBe(measured.notes);
  expect({ right: sum("right"), blank: sum("blank"), wrong: sum("wrong") }).toEqual({ right: measured.right, blank: measured.blank, wrong: measured.wrong });
});
