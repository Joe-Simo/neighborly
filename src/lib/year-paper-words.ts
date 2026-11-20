import type { Language } from "@/lib/words";

/** Every word of the year in paper (year-paper.tsx). English is the source; the home page renders in English, Spanish says the same. */
const en = {
  title: "The year in paper.",
  lead: "One slip for every request for help, October to September.",
  waiting: "still waiting",
  walk: "The year in paper. Arrow keys go month by month.",
};
const es: typeof en = {
  title: "El año en papel.",
  lead: "Una hoja por cada pedido de ayuda, de octubre a septiembre.",
  waiting: "todavía en espera",
  walk: "El año en papel. Las flechas van mes por mes.",
};
export const yearPaperWords: Record<Language, typeof en> = { en, es };
