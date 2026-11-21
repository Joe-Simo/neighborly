import { expect, test } from "bun:test";
import run6 from "../../eval/jev/run-6.json";
import run7 from "../../eval/jev/run-7.json";
import { jevSet, measured } from "./jev-set";

type Mark = "right" | "blank" | "wrong";
const fresh = jevSet.filter((note) => note.fresh);
const heldOut = (run: typeof run6) => run.rows.filter((row) => fresh.some((note) => note.id === row.id));
const runs = { 6: run6, 7: run7 as typeof run6 };

for (const [n, run] of Object.entries(runs)) test(`run ${n}'s own rows give the figure the screens quote: 36 right, 4 blank, 0 wrong on the 10 held-out notes`, () => {
  const rows = heldOut(run);
  expect(run.model).toBe("jev-1.14.0");
  expect(rows.length).toBe(10);
  const marks = rows.flatMap((row) => Object.values(row.mix ?? {}) as Mark[]);
  const count = (mark: Mark) => marks.filter((each) => each === mark).length;
  expect({ right: count("right"), blank: count("blank"), wrong: count("wrong") }).toEqual({ right: 36, blank: 4, wrong: 0 });
  // The file's own total also counts the two Creole notes the set no longer holds (English and Spanish only since 2026-11-21).
  expect(run.fresh.mix).toMatchObject({ right: 42, blank: 6, wrong: 0 });
  expect({ notes: measured.notes, right: measured.right, blank: measured.blank, wrong: measured.wrong }).toEqual({ notes: 10, right: 36, blank: 4, wrong: 0 });
});

test("the 10 held-out notes are 8 in English and 2 in Spanish", () => {
  // The set names each note's language in its id: fresh-es-… is Spanish, the rest are English.
  const language = (id: string) => (id.startsWith("fresh-es-") ? "es" : "en");
  const split = { en: 0, es: 0 };
  for (const row of heldOut(run7 as typeof run6)) split[language(row.id)]++;
  expect(split).toEqual({ en: 8, es: 2 });
});
