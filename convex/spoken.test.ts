import { describe, expect, test } from "vitest";
import { readSpoken, spokenName } from "./spoken";

describe("the language a household speaks", () => {
  test("English and Spanish keep their code; any other is kept by the name written; empty is English", () => {
    expect(readSpoken("")).toEqual({ language: "en" });
    expect(readSpoken(" Español ")).toEqual({ language: "es" });
    expect(readSpoken("Spanish")).toEqual({ language: "es" });
    expect(readSpoken("  mandarin  chinese ")).toEqual({ language: "other", languageName: "Mandarin chinese" });
  });
  test("what is written out comes back in as the same language", () => {
    for (const neighbor of [{ language: "es" as const }, { language: "other" as const, languageName: "German" }])
      expect(readSpoken(spokenName(neighbor))).toEqual(neighbor);
  });
});
