import { describe, expect, test } from "bun:test";
import { languages, words, wordSets } from "./index";

type Leaf = string | ((count: number) => string) | ((section: string) => string);
type Book = { [key: string]: Leaf | Book };

/** Every phrase in a book, with counted phrases written out for 0, 1 and 4. */
function phrases(book: Book, path = ""): [string, string][] {
  return Object.entries(book).flatMap(([key, value]) => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === "string") return [[at, value] as [string, string]];
    if (typeof value === "function")
      return [0, 1, 4].map((count) => [`${at}(${count})`, (value as (count: number) => string)(count)] as [string, string]);
    return phrases(value, at);
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

  test("Spanish and Creole are translated, not English left in place", () => {
    const english = new Map(phrases(words("en")));
    for (const language of ["es", "ht"] as const) {
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
    expect(words("en", "vincentian").terms.visit).toBe("Home Visit");
    expect(words("es", "vincentian").terms.member).toBe("vicentino");
    expect(words("ht", "vincentian").terms.group).toBe("konferans");
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
    expect(words("en").urgent.eviction(0)).toBe("Eviction notice");
    expect(words("es").urgent.shutoff(21)).toBe("Corte de servicio el día 21");
    expect(words("es").timeOffForm.affected(0)).toBe("Ningún compromiso afectado");
  });

  test("no language is asked for and English is given", () => {
    expect(words().menu.week).toBe("This week");
  });
});
