import { describe, expect, test } from "bun:test";
import { keepTitle } from "./titles";
import { sampleSayer } from "./sample-names";

describe("a title stays with its name", () => {
  test("joins St., Mr., Dr., Sr. and Sra. to the name after them", () => {
    expect(keepTitle("De St. Example Parish")).toBe("De St. Example Parish");
    expect(keepTitle("Mr. Brown and Dr. Ruiz")).toBe("Mr. Brown and Dr. Ruiz");
    expect(keepTitle("Sr. Gómez y Sra. Álvarez")).toBe("Sr. Gómez y Sra. Álvarez");
  });
  test("leaves a sentence's full stop alone", () => {
    expect(keepTitle("Paid first. Then the rest.")).toBe("Paid first. Then the rest.");
    expect(keepTitle("Main St. was closed")).toBe("Main St. was closed".replace(" ", " "));
  });
  test("every name the rooms say keeps its title", () => {
    expect(sampleSayer(false, "en")("St. Example Parish")).toBe("St. Example Parish");
    expect(sampleSayer(true, "es")("St. Example Parish")).toContain("St. ");
  });
});
