import type { Language } from "@/lib/words";

/** Every word of the year in paper (year-paper.tsx). English is the source; the home page renders in English, Spanish says the same. */
const en = {
  title: "The year in paper.",
  lead: "One slip for every request for help, October to September.",
};
const es: typeof en = {
  title: "El año en papel.",
  lead: "Una hoja por cada pedido de ayuda, de octubre a septiembre.",
};
export const yearPaperWords: Record<Language, typeof en> = { en, es };
