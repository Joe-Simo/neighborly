import type { Language } from "@/lib/words";

/**
 * Sentences the backend itself writes into a record (not a refusal, and not anything a member typed): a call closed
 * from the web requests (convex/intake.ts), a request moved on when its team paused the web form (convex/intakeCare.ts).
 * They are kept in English in the record, so a Spanish reader is shown them in Spanish. Keyed by the exact English,
 * so a key must change with the backend's own words (system-sentences.test.ts holds them the same).
 */
export const systemSentencesEs: Record<string, string> = {
  "Closed from the web requests.": "Cerrada desde las peticiones de la web.",
  "The team that had it paused its web form.": "El equipo que la tenía pausó su formulario web.",
};

/** A record's line in the reader's language when the backend wrote it; anything a person typed is shown as typed. */
export function systemSaid(language: Language, text: string): string {
  return language === "es" ? (systemSentencesEs[text] ?? text) : text;
}
