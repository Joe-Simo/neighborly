import { en, type Words } from "./en";
import type { Language, WordSet } from "./sets";

export { formatCount, formatMoney } from "./numbers";
export { dateFormatter, formatDate, formatDay } from "./dates";
export { languageNames, languages, wordSets } from "./sets";
export type { Language } from "./sets";
export type { Words };

/**
 * The books in hand. English is always here. The Spanish book, with its refusals, is fetched only for a reader who
 * reads Spanish (`learnBook`), so an English reader never downloads it; the server has it from the start.
 */
const books: Partial<Record<Language, (set: WordSet) => Words>> = { en };
const learning: Partial<Record<Language, Promise<void>>> = {};
const learned = new Set<() => void>();

/** Fetches a language's book, once; resolved when `words` can say it. Asked before anything is drawn in that language. */
export function learnBook(language: Language): Promise<void> {
  if (books[language]) return Promise.resolve();
  return (learning[language] ??= import("./es").then(({ es }) => {
    books.es = es;
    for (const told of learned) told();
  }));
}

/** Whether a language's book is in hand, so `words` says it at once. */
export const knowsBook = (language: Language) => books[language] !== undefined;

/** Hears once a book arrives (for useSyncExternalStore). */
export function onBookLearned(told: () => void) {
  learned.add(told);
  return () => void learned.delete(told);
}

if (typeof window === "undefined") {
  // The server draws pages in either language at once, so it holds both books from the start.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a synchronous load, on the server only
  books.es = (require("./es") as typeof import("./es")).es;
} else {
  // The page's head has already said the reader's language (first-language.ts), and the iOS app has handed over the room it
  // kept, in its member's language (kept-room.ts): that book is asked for with the app's own scripts, not after them.
  const kept: unknown = Reflect.get(window, "kindHelpsKept");
  const keptLanguage: unknown = Reflect.get(Object(Reflect.get(Object(Reflect.get(Object(kept), "room")), "user")), "language");
  if (document.documentElement.lang === "es" || keptLanguage === "es") void learnBook("es");
}

// One book per language and word set, written once: the same object every time it is asked for, so a room can
// name its words among an effect's needs without the effect running again on every draw.
const written = new Map<string, Words>();

/**
 * The words for one person: their own language (memberships.language) in
 * their group's word set. Someone with no language chosen reads English.
 * A book not yet in hand is never stood in for by English: whatever is drawn waits for it (as under Suspense),
 * though the app asks for it before drawing in it (useBook, live-app.tsx), so that wait is never met in practice.
 */
export function words(language: Language = "en", set: WordSet = "general"): Words {
  const key = `${language}:${set}`;
  const known = written.get(key);
  if (known) return known;
  const write = books[language];
  if (!write) throw learnBook(language);
  const book = write(set);
  written.set(key, book);
  return book;
}
