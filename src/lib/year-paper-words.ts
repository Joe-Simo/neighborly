import type { Language } from "@/lib/words";

/** Every word of the year in paper (year-paper.tsx). English is the source; the home page renders in English, Spanish says the same. */
const en = {
  title: "A year of requests",
  lead: "One slip for each request for help, October to September.",
  waiting: "still waiting",
  walk: "A year of requests. Arrow keys go month by month.",
};
const es: typeof en = {
  title: "Un año de pedidos",
  lead: "Una hoja por cada pedido de ayuda, de octubre a septiembre.",
  waiting: "todavía en espera",
  walk: "Un año de pedidos. Las flechas van mes por mes.",
};
export const yearPaperWords: Record<Language, typeof en> = { en, es };
