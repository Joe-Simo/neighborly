import type { Language } from "@/lib/words";

/** Every word of the year in paper (year-paper.tsx). English is the source; the home page renders in English, Spanish says the same. */
const en = {
  title: "A year of requests.",
  lead: "Each slip is one request for help the sample conference took, October to September. Together they become its yearly report.",
  waiting: "still waiting",
  walk: "A year of requests. Arrow keys go month by month.",
};
const es: typeof en = {
  title: "Un año de pedidos.",
  lead: "Cada hoja es un pedido de ayuda que recibió la conferencia de ejemplo, de octubre a septiembre. Juntas forman su informe anual.",
  waiting: "todavía en espera",
  walk: "Un año de pedidos. Las flechas van mes por mes.",
};
export const yearPaperWords: Record<Language, typeof en> = { en, es };
