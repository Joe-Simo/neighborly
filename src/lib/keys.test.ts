import { describe, expect, test } from "bun:test";
import { phoneLine } from "./keys";

describe("a phone as the app shows it", () => {
  test("ten numbers, with or without a leading 1, read as (313) 555-0100", () => {
    expect(phoneLine("3135550100")).toBe("(313) 555-0100");
    expect(phoneLine("+1 313 555 0100")).toBe("(313) 555-0100");
  });
  test("anything else is shown as it was typed", () => {
    expect(phoneLine("555-0100")).toBe("555-0100");
    expect(phoneLine("")).toBe("");
  });
});
