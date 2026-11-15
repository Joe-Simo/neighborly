export const languages = ["en", "es", "ht"] as const;
export type Language = (typeof languages)[number];

/** Each language named in itself, for the place where a person chooses theirs. */
export const languageNames: Record<Language, string> = {
  en: "English",
  es: "Español",
  ht: "Kreyòl ayisyen",
};

/**
 * The group chooses its word set once, at setup. A St. Vincent de Paul
 * conference reads "conference", "Vincentian" and "Home Visit"; any other
 * group reads plain words. The person helped is a neighbor in both.
 */
export const wordSets = ["general", "vincentian"] as const;
export type WordSet = (typeof wordSets)[number];

export type Terms = {
  group: string;
  member: string;
  members: string;
  neighbor: string;
  neighbors: string;
  visit: string;
  visits: string;
};
