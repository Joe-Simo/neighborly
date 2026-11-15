import { describe, expect, it } from "vitest";
import { dotsFor, dotUnit, figureDots } from "@/lib/figure";

describe("neighborhood figure", () => {
  it("picks a round unit that keeps the field readable", () => {
    expect(dotUnit(29585)).toBe(50);
    expect(dotUnit(400)).toBe(1);
    expect(dotUnit(95000)).toBe(200);
  });

  it("never drops a small group to zero dots", () => {
    expect(dotsFor(12, 50)).toBe(1);
    expect(dotsFor(0, 50)).toBe(0);
  });

  it("keeps the layers nested", () => {
    const d = figureDots(29585, 3943, 1249);
    expect(d).toEqual({ unit: 50, all: 592, other: 79, limited: 25 });
    const tiny = figureDots(30, 30, 30);
    expect(tiny.limited).toBeLessThanOrEqual(tiny.other);
    expect(tiny.other).toBeLessThanOrEqual(tiny.all);
  });
});
