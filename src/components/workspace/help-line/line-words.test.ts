import { describe, expect, test } from "bun:test";
import { lineWords } from "./line-words";

describe("help-line words", () => {
  test("Spanish has every line English has, translated", () => {
    const en = lineWords("en"), es = lineWords("es");
    expect(Object.keys(es.calls).sort()).toEqual(Object.keys(en.calls).sort());
    expect(Object.keys(es.nextStep).sort()).toEqual(Object.keys(en.nextStep).sort());
    for (const key of Object.keys(en.nextStep) as (keyof typeof en.nextStep)[]) expect(es.nextStep[key]).not.toBe(en.nextStep[key]);
    expect(en.calls.quietTitle).not.toBe(es.calls.quietTitle);
  });

  test("the Spanish line names who speaks it, whole in each language", () => {
    expect(lineWords("en").spanish("", false)).toBe("Speaks Spanish.");
    expect(lineWords("en").spanish("Ana", false)).toBe("Speaks Spanish. Ana speaks Spanish.");
    expect(lineWords("en").spanish("Ana and Luis", true)).toBe("Speaks Spanish. Ana and Luis speak Spanish.");
    expect(lineWords("es").spanish("Ana y Luis", true)).toBe("Habla español. Ana y Luis hablan español.");
  });
});
