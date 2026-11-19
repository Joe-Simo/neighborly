import { expect, test } from "bun:test";
import run6 from "../../eval/jev/run-6.json";
import { jevSet, measured } from "./jev-set";

type Mark = "right" | "blank" | "wrong";
const fresh = jevSet.filter((note) => note.fresh);
const rows = run6.rows.filter((row) => fresh.some((note) => note.id === row.id));

test("run 6's own rows give the figure the screens quote: 42 right, 6 blank, 0 wrong on the 12 held-out notes", () => {
  expect(run6.model).toBe("jev-1.14.0");
  expect(rows.length).toBe(12);
  const marks = rows.flatMap((row) => Object.values(row.mix ?? {}) as Mark[]);
  const count = (mark: Mark) => marks.filter((each) => each === mark).length;
  expect({ right: count("right"), blank: count("blank"), wrong: count("wrong") }).toEqual({ right: 42, blank: 6, wrong: 0 });
  expect(run6.fresh.mix).toMatchObject({ right: 42, blank: 6, wrong: 0 });
  expect({ notes: measured.notes, right: measured.right, blank: measured.blank, wrong: measured.wrong }).toEqual({ notes: 12, right: 42, blank: 6, wrong: 0 });
});

test("the 12 held-out notes are 8 in English, 2 in Spanish and 2 in Haitian Creole", () => {
  // The set names each note's language in its id: fresh-es-… is Spanish, fresh-ht-… is Creole, the rest are English.
  const language = (id: string) => (id.startsWith("fresh-es-") ? "es" : id.startsWith("fresh-ht-") ? "ht" : "en");
  const split = { en: 0, es: 0, ht: 0 };
  for (const row of rows) split[language(row.id)]++;
  expect(split).toEqual({ en: 8, es: 2, ht: 2 });
});
