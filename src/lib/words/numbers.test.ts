import { describe, expect, test } from "bun:test";
import { formatCount, formatMoney, words } from ".";

describe("numbers are written the reader's way", () => {
  test("a count groups its thousands in both languages", () => {
    expect(formatCount(27400, "en")).toBe("27,400");
    expect(formatCount(27400, "es")).toBe("27,400");
    expect(formatCount(1589, "es")).toBe("1,589");
  });
  test("money reads as dollars and cents in both languages", () => {
    expect(formatMoney(52435, "en")).toBe("$52,435.00");
    expect(formatMoney(52435, "es")).toBe("$52,435.00");
    expect(formatMoney(450, "es", true)).toBe("$450");
  });
  test("the neighbors room counts households with a separator", () => {
    expect(words("es").rooms.neighbors.list.households(27400)).toBe("27,400 hogares");
    expect(words("en").rooms.neighbors.list.households(27400)).toBe("27,400 households");
  });
});
