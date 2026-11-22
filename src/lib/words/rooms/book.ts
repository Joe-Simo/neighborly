import type { Language, Terms } from "../sets";

/** What a room's table is written from: a reader's language, their group's terms, and what they call the place. */
type Reader = { locale: Language; terms: Terms; place: string };

/**
 * A room's own words, read from the reader's book (`words()` in ../index.ts). The table lives with the room's code,
 * so a room's words arrive with the room and not with every page. One table per book, written once: the same
 * object every time it is asked for, as the book itself is.
 */
export function roomBook<T extends object>(en: (t: Terms, place: string) => T, es: (t: Terms, place: string) => T) {
  const written = new WeakMap<Reader, T>();
  return (book: Reader): T => {
    const kept = written.get(book);
    if (kept) return kept;
    const table = (book.locale === "es" ? es : en)(book.terms, book.place);
    written.set(book, table);
    return table;
  };
}
