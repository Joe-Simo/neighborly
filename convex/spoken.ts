import { v, type Infer } from "convex/values";

/**
 * The language a neighbor's household speaks. It is a fact about the household, not one of the languages the
 * app itself speaks: English and Spanish, the two the app speaks, have a code, and any other is "other" with its name as
 * the person wrote it (languageName). The name never goes to the assistant.
 */
export const spoken = v.union(v.literal("en"), v.literal("es"), v.literal("other"));
export type Spoken = Infer<typeof spoken>;
export const spokenNames = { en: "English", es: "Spanish" } as const;
export const longestLanguageName = 40;

/** The language said in words: "Spanish", or the name that was written for another language. */
export const spokenName = (neighbor: { language: Spoken; languageName?: string }) =>
  neighbor.language === "other" ? neighbor.languageName?.trim() || "Another language" : spokenNames[neighbor.language];

const known = new Map<string, Spoken>([
  ["", "en"], ["en", "en"], ["english", "en"],
  ["es", "es"], ["spanish", "es"], ["espanol", "es"], ["español", "es"],
]);
/** A language as written in a file or a field. Empty is English; a name that is neither is kept as it was written. */
export function readSpoken(written: string): { language: Spoken; languageName?: string } {
  const text = written.trim().replace(/\s+/g, " ");
  const language = known.get(text.toLowerCase());
  if (language) return { language };
  return { language: "other", languageName: text.charAt(0).toUpperCase() + text.slice(1) };
}
