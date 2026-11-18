import { en, type Words } from "./en";
import { es } from "./es";
import type { Language, WordSet } from "./sets";

export { counter, formatCount, formatMoney, numberLocales } from "./numbers";
export { formatDate, formatDay, formatDays } from "./dates";
export { languageNames, languages, wordSets } from "./sets";
export type { Language, Terms, WordSet } from "./sets";
export type { Words };

const books: Record<Language, (set: WordSet) => Words> = { en, es };
// One book per language and word set, written once: the same object every time it is asked for, so a room can
// name its words among an effect's needs without the effect running again on every draw.
const written = new Map<string, Words>();

/**
 * The words for one person: their own language (memberships.language) in
 * their group's word set. Someone with no language chosen reads English.
 */
export function words(language: Language = "en", set: WordSet = "general"): Words {
  const key = `${language}:${set}`;
  const book = written.get(key) ?? books[language](set);
  written.set(key, book);
  return book;
}
