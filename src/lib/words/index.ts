import { en, type Words } from "./en";
import { es } from "./es";
import { ht } from "./ht";
import type { Language, WordSet } from "./sets";

export { languageNames, languages, wordSets } from "./sets";
export type { Language, Terms, WordSet } from "./sets";
export type { Words };

const books: Record<Language, (set: WordSet) => Words> = { en, es, ht };

/**
 * The words for one person: their own language (memberships.language) in
 * their group's word set. Someone with no language chosen reads English.
 */
export function words(language: Language = "en", set: WordSet = "general"): Words {
  return books[language](set);
}
