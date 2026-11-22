import { counter } from "@/lib/words/numbers";
import type { Language } from "@/lib/words/sets";

/**
 * The Housing Provider Summary's words, kept with its own chunk (not in the shared words book) so no room's first
 * load carries them. Every sentence is written whole in each language.
 */
const en = {
  title: "Housing Provider Summary",
  show: "Show what each landlord was paid",
  hide: "Hide the landlord summary",
  deck: "Rent paid to each landlord, month by month, and the year to date.",
  loading: "Adding up the landlord payments",
  empty: "No rent was paid to a landlord in this year.",
  landlord: "Landlord",
  yearToDate: "Year to date",
  payments: (count: number) => (count === 1 ? "1 payment" : `${counter("en")(count)} payments`),
  total: "All landlords",
  download: "Download the landlord summary",
  fileTitle: (year: number) => `Housing Provider Summary, fiscal year ${year}`,
};

const es: typeof en = {
  title: "Resumen de arrendadores",
  show: "Ver lo que se pagó a cada arrendador",
  hide: "Ocultar el resumen de arrendadores",
  deck: "Alquiler pagado a cada arrendador, mes por mes, y lo que va del año.",
  loading: "Sumando los pagos a arrendadores",
  empty: "Este año no se pagó alquiler a ningún arrendador.",
  landlord: "Arrendador",
  yearToDate: "En lo que va del año",
  payments: (count) => (count === 1 ? "1 pago" : `${counter("es")(count)} pagos`),
  total: "Todos los arrendadores",
  download: "Descargar el resumen de arrendadores",
  fileTitle: (year) => `Resumen de arrendadores, año fiscal ${year}`,
};

/** The summary's words in the reader's language. */
export const housingWords = (language: Language) => (language === "es" ? es : en);
