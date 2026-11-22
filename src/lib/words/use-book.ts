import { useEffect, useSyncExternalStore } from "react";
import { knowsBook, learnBook, onBookLearned, type Language } from "./index";

/**
 * Whether every language here can be said now. One that cannot is fetched, and until it arrives the caller keeps
 * showing what it shows while it waits, so a Spanish reader never sees the screen in English first.
 */
export function useBook(languages: ReadonlyArray<Language | undefined>): boolean {
  const wanted = [...new Set(languages.filter((language): language is Language => language !== undefined))].sort().join(" ");
  const ready = useSyncExternalStore(
    onBookLearned,
    () => wanted.split(" ").every((language) => !language || knowsBook(language as Language)),
    () => true,
  );
  useEffect(() => {
    for (const language of wanted.split(" ")) if (language) void learnBook(language as Language);
  }, [wanted]);
  return ready;
}
