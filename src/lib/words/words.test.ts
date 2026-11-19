import { describe, expect, test } from "bun:test";
import { languages, words, wordSets } from "./index";

type Leaf = string | ((count: number) => string) | ((section: string) => string);
// A refusal pattern sits in a book too: its regular expression holds no phrase, its saying is one.
type Book = { readonly [key: string]: Leaf | Book | RegExp | ReadonlyArray<unknown> | ((...parts: string[]) => string) };

/** Every phrase in a book, with counted phrases written out for 0, 1 and 4. */
function phrases(book: Book, path = ""): [string, string][] {
  return Object.entries(book).flatMap(([key, value]) => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === "string") return [[at, value] as [string, string]];
    if (typeof value === "function")
      return [0, 1, 4].map((count) => [`${at}(${count})`, (value as (count: number) => string)(count)] as [string, string]);
    return phrases(value as Book, at);
  });
}

describe("words", () => {
  test("every language says every phrase, in both word sets", () => {
    for (const set of wordSets) {
      const source = phrases(words("en", set)).map(([at]) => at);
      for (const language of languages) {
        const book = phrases(words(language, set));
        expect(book.map(([at]) => at)).toEqual(source);
        for (const [at, phrase] of book) {
          expect(phrase.trim(), `${language} ${at}`).not.toBe("");
          expect(phrase, `${language} ${at}`).not.toMatch(/undefined|\[object|\$\{/);
        }
      }
    }
  });

  test("Spanish is translated, not English left in place", () => {
    const english = new Map(phrases(words("en")));
    for (const language of ["es"] as const) {
      const same = phrases(words(language))
        .filter(([at, phrase]) => at !== "locale" && english.get(at) === phrase)
        .map(([at]) => at);
      expect(same, language).toEqual([]);
    }
  });

  test("the group chooses conference words or plain words", () => {
    expect(words("en", "vincentian").week.fromGroup).toBe("From your conference");
    expect(words("en", "general").week.fromGroup).toBe("From your group");
    expect(words("es", "vincentian").week.fromGroup).toBe("De tu conferencia");
    expect(words("en", "vincentian").terms.visit).toBe("home visit");
    expect(words("es", "vincentian").terms.member).toBe("vicentino");
  });

  test("the person helped is a neighbor in every set, and the volunteer never is", () => {
    for (const set of wordSets) {
      expect(words("en", set).terms.neighbor).toBe("neighbor");
      expect(words("en", set).terms.member).not.toMatch(/neighbor/i);
    }
  });

  test("counted phrases read naturally at one and at many", () => {
    expect(words("en").requests.awaiting(2)).toBe("2 awaiting your reply");
    expect(words("es").requests.awaiting(1)).toBe("1 espera tu respuesta");
    expect(words("es").requests.awaiting(3)).toBe("3 esperan tu respuesta");
    expect(words("en").timeOffForm.affected(1)).toBe("1 commitment affected");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map((day) => words("en").urgent.shutoff(day).split(" ").pop())).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
    expect(words("en").urgent.eviction(0)).toBe("Eviction");
    expect(words("es").urgent.shutoff(21)).toBe("Corte de servicio el día 21");
    expect(words("es").timeOffForm.affected(0)).toBe("Ningún compromiso afectado");
  });

  test("no language is asked for and English is given", () => {
    expect(words().menu.week).toBe("This week");
  });
});

describe("refusals a member can meet", () => {
  test("each one is said in both languages, and the backend throws it by name, never written out", async () => {
    const { refusals } = await import("../refusals");
    const backend = (await Promise.all(["workspace.ts", "pages.ts"].map((file) => Bun.file(`${import.meta.dir}/../../../convex/${file}`).text()))).join("\n");
    for (const [key, sentence] of Object.entries(refusals)) {
      expect(words("en").notices.refused[sentence], `en ${key}`).toBe(sentence);
      for (const language of ["es"] as const) {
        const said = words(language).notices.refused[sentence];
        expect(said, `${language} ${key}`).toBeTruthy();
        expect(said).not.toBe(sentence);
      }
      expect(new RegExp(`refusals\\.${key}\\b`).test(backend), `${key} is thrown`).toBe(true);
      expect(backend.includes(`"${sentence}"`), `${key} is written out`).toBe(false);
    }
    // Every name the backend throws is in the table: a sentence added there cannot miss its translations.
    for (const [, key] of backend.matchAll(/refusals\.(\w+)/g)) expect(Object.keys(refusals), key).toContain(key);
  });
});

describe("refusals the backend writes out", () => {
  test("each one is said in Spanish, matched exactly or by its pattern", async () => {
    const { sayRefused } = await import("../refusals");
    const root = `${import.meta.dir}/../../../convex`;
    const sentences = new Set<string>();
    for await (const file of new Bun.Glob("**/*.ts").scan(root)) {
      if (file.includes(".test.") || file.startsWith("_generated")) continue;
      const source = await Bun.file(`${root}/${file}`).text();
      for (const [, quoted] of source.matchAll(/ConvexError\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) sentences.add(quoted);
      // A dynamic part stands in as a sample name or number; a choice between two words is tried both ways.
      for (const [, built] of source.matchAll(/ConvexError\(\s*`([^`]*)`\s*\)/g)) {
        const choice = /\$\{[^}]*\?\s*"([^"]+)"\s*:\s*"([^"]+)"\s*\}/.exec(built);
        const forms = choice ? [choice[1], choice[2]].map((word) => built.replace(choice[0], word)) : [built];
        for (const form of forms) sentences.add(form.replace(/\$\{[^}]*\}/g, (part) => (/[A-Z_]{3,}|most/.test(part) ? "25" : "Rosa")));
      }
    }
    expect(sentences.size).toBeGreaterThanOrEqual(155);
    // Every field name the backend puts into a built refusal has its Spanish name.
    const { fieldLabelsEs } = await import("../refusals-es");
    for await (const file of new Bun.Glob("{assistance,neighbors}.ts").scan(root)) {
      const source = await Bun.file(`${root}/${file}`).text();
      for (const [, label] of source.matchAll(/\b(?:text|wholeCents|short|count)\([^;]*?"([A-Z][^"]*)"/g)) {
        expect(fieldLabelsEs[label], label).toBeDefined();
      }
    }
    const es = words("es").notices;
    for (const sentence of sentences) {
      expect(sayRefused(words("en").notices, sentence), sentence).toBe(sentence);
      const said = sayRefused(es, sentence);
      expect(said, sentence).not.toBe(sentence);
      expect(said.includes("${"), sentence).toBe(false);
    }
  });
});

describe("refusals the backend writes out", () => {
  test("every sentence thrown in English has its Spanish, so no English shows in a Spanish room", async () => {
    const { Glob } = await import("bun");
    const convex = `${import.meta.dir}/../../../convex`;
    const thrown: string[] = [];
    for await (const file of new Glob("*.ts").scan(convex)) {
      if (file.endsWith(".test.ts") || file.startsWith("_")) continue;
      const text = await Bun.file(`${convex}/${file}`).text();
      for (const [, sentence] of text.matchAll(/(?:ConvexError|new Error)\("([^"]+)"\)/g)) thrown.push(sentence);
    }
    expect(thrown.length).toBeGreaterThan(50);
    const es = words("es").notices;
    for (const sentence of thrown) {
      const said = es.refused[sentence] ?? es.refusedLike.find(([pattern]) => pattern.test(sentence))?.[0];
      expect(said, sentence).toBeTruthy();
    }
  });
});

