import { formatDay } from "@/lib/words";
import { referralsMeasured as r } from "@/lib/referral-set";
import { visitsMeasured as v } from "@/lib/visit-set";
import { nextStepMeasured as x } from "@/lib/next-step-set";
import { spanishMeasured as e } from "@/lib/spanish-set";
import { repeatsMeasured as q } from "@/lib/repeat-set";


/**
 * Said only in this sheet, so its words load with the sheet and not in every room. Numbers are the last measuring run's.
 */
/** Each row's label and its sentence, joined by "|"; rows joined by "||". */
export function referralWords(locale: Parameters<typeof formatDay>[0]) {
  const date = formatDay(locale, r.day);
  const n = new Intl.NumberFormat(locale).format;
  return locale.startsWith("es")
    ? `A dónde más enviar a alguien|Sugiere cuáles de tus lugares sirven para una petición, y lee la nota de una visita por si muestra otra necesidad. Con ${n(r.notes)} notas inventadas apartadas, cada una comparada con seis lugares inventados, acertó en ${n(r.right)} de ${n(r.right + r.missed + r.wrong)}, dejó fuera ${n(r.missed)} que servían y ofreció ${n(r.wrong)} que no servían (medido el ${date}). Al leer una visita, con ${n(v.notes)} notas apartadas acertó en ${n(v.right)} de ${n(v.right + v.missed + v.wrong)} datos, dejó fuera ${n(v.missed)} y mostró ${n(v.wrong)} falsos. Al sugerir el siguiente paso tras una llamada acertó en ${n(x.right)} de ${n(x.notes)} resultados apartados, y al notar quién necesita español, en ${n(e.right)} de ${n(e.notes)}, sin ningún falso. Una persona elige.||Antes de decidir|Muestra, desde los registros, la ayuda del mismo tipo de los últimos 90 días, el gasto del mes y una cantidad fuera de lo común. Además señala si una petición parece la misma necesidad otra vez o si un registro anterior dice otra cosa. Con ${n(q.cases)} casos inventados apartados acertó en ${n(q.right)} de ${n(q.right + q.missed + q.wrong)} marcas, dejó fuera ${n(q.missed)} y mostró ${n(q.wrong)} falsas (medido el ${formatDay(locale, q.day)}). Solo señala: una persona lee ambos registros y decide.`
    : `Where else to send someone|It suggests which of your own places fit a request, and reads a written-up visit for needs it was not for. On ${n(r.notes)} made-up notes kept apart, each held against six made-up places, it was right on ${n(r.right)} of ${n(r.right + r.missed + r.wrong)}, left ${n(r.missed)} out that fit, and offered ${n(r.wrong)} that did not (measured ${date}). Reading visits, on ${n(v.notes)} notes kept apart it was right on ${n(v.right)} of ${n(v.right + v.missed + v.wrong)} details, left ${n(v.missed)} out and showed ${n(v.wrong)} untrue. Suggesting the next step after a call, it was right on ${n(x.right)} of ${n(x.notes)} outcomes kept apart, and noticing who needs Spanish, on ${n(e.right)} of ${n(e.notes)}, with none untrue. A person chooses.||Before a decision|From the records it shows same-kind help in the last 90 days, the month's spending and an amount that stands out. It also flags when a request reads as the same need again, or an earlier record says otherwise. On ${n(q.cases)} made-up cases kept apart it was right on ${n(q.right)} of ${n(q.right + q.missed + q.wrong)} marks, left ${n(q.missed)} out and showed ${n(q.wrong)} untrue (measured ${formatDay(locale, q.day)}). It only flags: a person reads both records and decides.`;
}
