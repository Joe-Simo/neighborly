import { describe, expect, test } from "bun:test";
import { centsToInput, formatCents, parseCents } from "./money";

describe("money typed by a person", () => {
  test("is read as whole cents", () => {
    expect(parseCents("214.60")).toBe(21460);
    expect(parseCents(" $1,875.60 ")).toBe(187560);
    expect(parseCents("48")).toBe(4800);
    expect(parseCents("12.5")).toBe(1250);
    expect(parseCents("0.07")).toBe(7);
    // The amounts that go wrong when dollars are multiplied by 100 as decimals.
    expect(parseCents("1.15")).toBe(115);
    expect(parseCents("19.99")).toBe(1999);
    expect(parseCents("8.20")).toBe(820);
  });

  test("is refused when it is not an amount of money", () => {
    for (const text of ["", "0", "0.00", "-5", "1.005", "12.", ".50", "1,50", "1e3", "ten", "5 5"])
      expect(parseCents(text)).toBeNull();
  });

  test("goes back to the same text it was read from", () => {
    for (const cents of [1, 7, 100, 21460, 187560, 421840]) {
      expect(parseCents(centsToInput(cents))).toBe(cents);
      expect(parseCents(formatCents(cents))).toBe(cents);
    }
    expect(formatCents(421840)).toBe("$4,218.40");
  });
});
