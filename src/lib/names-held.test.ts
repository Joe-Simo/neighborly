import { expect, test } from "bun:test";
import { madeWords } from "./made-words";
import { privacyWords } from "./privacy-words";
import { weekWords } from "./week-words";

// Names the public pages say in running prose. Each is joined with no-break spaces, so it never parts across lines.
const names = ["Kind Helps", "Reduce Motion", "Reducir movimiento", "Vincent de Paul", "San Vicente de Paúl"];

/** Every string in a words table, with where it sits. */
function* said(value: unknown, at: string): Generator<[string, string]> {
  if (typeof value === "string") yield [at, value];
  else if (value && typeof value === "object") for (const [key, one] of Object.entries(value)) yield* said(one, `${at}.${key}`);
}

test("the public pages never say a name with a space it could break at", () => {
  const loose: string[] = [];
  for (const [table, words] of Object.entries({ madeWords, privacyWords, weekWords }))
    for (const [at, text] of said(words, table)) for (const name of names) if (text.includes(name)) loose.push(`${at}: "${name}"`);
  expect(loose).toEqual([]);
});
