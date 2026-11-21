import { formatDay } from "@/lib/words";
import { referralsMeasured as r } from "@/lib/referral-set";


/**
 * Said only in this sheet, so its words load with the sheet and not in every room. Numbers are the last measuring run's.
 */
/** The row's label and its sentence, joined by "|". */
export function referralWords(locale: Parameters<typeof formatDay>[0]) {
  const date = formatDay(locale, r.day);
  const n = new Intl.NumberFormat(locale).format;
  return locale.startsWith("es")
    ? `A dónde más enviar a alguien|Sugiere cuáles de tus lugares sirven para una petición, y lee la nota de una visita por si muestra otra necesidad. Con ${n(r.notes)} notas inventadas apartadas, cada una comparada con seis lugares inventados, acertó en ${n(r.right)} de ${n(r.right + r.missed + r.wrong)}, dejó fuera ${n(r.missed)} que servían y ofreció ${n(r.wrong)} que no servían (medido el ${date}). Una persona elige.`
    : `Where else to send someone|It suggests which of your own places fit a request, and reads a written-up visit for needs it was not for. On ${n(r.notes)} made-up notes kept apart, each held against six made-up places, it was right on ${n(r.right)} of ${n(r.right + r.missed + r.wrong)}, left ${n(r.missed)} out that fit, and offered ${n(r.wrong)} that did not (measured ${date}). A person chooses.`;
}
