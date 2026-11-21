import { describe, expect, test } from "bun:test";
import { addressKey, nameLikeness, needsNotes, sameBy } from "./duplicates";

describe("duplicate households, by what code compares", () => {
  test("an address written two ways is one address, and its unit counts", () => {
    expect(addressKey("1402 Palm Avenue, Apt 3, Fort Myers, FL 33901")).toBe(addressKey("1402 palm ave #3"));
    expect(addressKey("1402 Palm Ave Apt 3")).not.toBe(addressKey("1402 Palm Ave Apt 4"));
    expect(addressKey("88 Calle Norte")).toBe(addressKey("88 calle n"));
  });
  test("names alike in any order, with a second family name or a typo", () => {
    expect(nameLikeness("María García López", "Maria Garcia")).toBeGreaterThan(0.95);
    expect(nameLikeness("Denise Walker", "Walker, Denise")).toBe(1);
    expect(nameLikeness("Denise Walker", "Denice Walker")).toBeGreaterThan(0.9);
    expect(nameLikeness("Denise Walker", "Marcus Bellamy")).toBeLessThan(0.6);
  });
  test("two shared things ask a person; one waits for the notes", () => {
    const a = { name: "Rosa Fontaine", phone: "(100) 555-0101", address: "12 Oak St" };
    const shared = sameBy(a, { name: "Rosa Fontain", phone: "1-100-555-0101", address: "12 Oak Street, Fort Myers" });
    expect(shared).toEqual(["phone", "address", "name"]);
    expect(needsNotes(shared)).toBe(false);
    const phoneOnly = sameBy(a, { name: "Yolanda Price", phone: "100.555.0101", address: "" });
    expect(phoneOnly).toEqual(["phone"]);
    expect(needsNotes(phoneOnly)).toBe(true);
    expect(sameBy(a, { name: "Marcus Bellamy", phone: "", address: "" })).toEqual([]);
  });
});

describe("the notes rule, against runs 1 and 2", () => {
  test("the line set on the pairs not held out gets them all right, and the held-out figure is what run 1 says", async () => {
    const run = (await import("../../eval/duplicates/run-1.json")).default;
    const { duplicateSet, heldOutFigure, notesSayOne } = await import("./duplicate-set");
    for (const item of duplicateSet.filter((pair) => !pair.heldOut))
      expect(notesSayOne(run.rows.find((row) => row.id === item.id)?.same ?? 0, item.a, item.b), item.id).toBe(item.same);
    const run2 = (await import("../../eval/duplicates/run-2.json")).default;
    for (const item of duplicateSet.filter((pair) => !pair.heldOut))
      expect(notesSayOne(run2.rows.find((row) => row.id === item.id)?.people ?? 0, item.a, item.b), item.id).toBe(item.same);
    expect(heldOutFigure(run2)).toEqual({ pairs: 5, right: 5, missed: 0, wrong: 0 });
    // Run 3 asked the live question alone, after it went live: the figure the record quotes.
    expect(heldOutFigure((await import("../../eval/duplicates/run-3.json")).default)).toEqual({ pairs: 5, right: 5, missed: 0, wrong: 0 });
  });
});
