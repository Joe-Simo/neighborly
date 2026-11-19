import type { Language } from "@/lib/words";

/** Every word of the year in paper (year-paper.tsx). English is the source; the home page renders in English, Spanish says the same. */
const en = {
  title: "The year in paper.",
  lead: "One slip for every request for help, October to September.",
  requests: "Requests for help",
  calls: "Calls taken",
  visits: "Home visits, in pairs",
  paid: "Paid direct, never in cash",
  note: "From the sample conference. Every person in it is made up.",
};
const es: typeof en = {
  title: "El año en papel.",
  lead: "Una hoja por cada pedido de ayuda, de octubre a septiembre.",
  requests: "Pedidos de ayuda",
  calls: "Llamadas atendidas",
  visits: "Visitas a domicilio, en pareja",
  paid: "Pagado directamente, nunca en efectivo",
  note: "De la conferencia de muestra. Todas las personas son inventadas.",
};
export const yearPaperWords: Record<Language, typeof en> = { en, es };
