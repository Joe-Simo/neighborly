import { formatMoney } from "./words/numbers";
import type { Language } from "./words/sets";
import type { RequestKind } from "./request-draft";

type What = "request" | "note" | "visit";
/**
 * What the approve and decline sheets say about a household's own records, in the approver's language. Written on the
 * server so no room carries these words: the sheet only shows the lines it is sent.
 */
const said = {
  en: {
    kinds: { rent: "Rent", utility: "Utility", food: "Food", voucher: "Voucher", other: "Other" },
    records: { request: "request", note: "note", visit: "visit write-up" },
    recent: (kind: string, paid: boolean, date: string, amount: string) => `${kind} help was ${paid ? "paid" : "approved"} on ${date}${amount ? `: ${amount}` : ""}.`,
    same: (record: string, date: string) => `The assistant reads this as the same need as the ${record} from ${date}.`,
    differs: (record: string, date: string) => `The assistant reads the ${record} from ${date} as saying otherwise. Read both before you decide.`,
  },
  es: {
    kinds: { rent: "renta", utility: "servicios", food: "comida", voucher: "vales", other: "otro tipo" },
    records: { request: "la solicitud", note: "la nota", visit: "el informe de la visita" },
    recent: (kind: string, paid: boolean, date: string, amount: string) => `Se ${paid ? "pagó" : "aprobó"} ayuda de ${kind} el ${date}${amount ? `: ${amount}` : ""}.`,
    same: (record: string, date: string) => `El asistente lee esto como la misma necesidad que ${record} del ${date}.`,
    differs: (record: string, date: string) => `El asistente lee que ${record} del ${date} dice otra cosa. Lee ambos antes de decidir.`,
  },
} satisfies Record<Language, { kinds: Record<RequestKind, string>; records: Record<What, string>; [line: string]: unknown }>;

export type RepeatLine = { text: string; assistant: boolean };
type Flag = { at: number; what: What };

/** The records' own facts first, in plain ink; then the assistant's readings, which the sheet marks as the assistant's. */
export function repeatLines(language: Language, timeZone: string, found: { recent: { at: number; kind: RequestKind; status: "approved" | "paid"; amount: number }[]; same: Flag[]; differs: Flag[] }): RepeatLine[] {
  const w = said[language];
  const day = new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", { month: "long", day: "numeric", timeZone });
  const date = (at: number) => day.format(at);
  return [
    ...found.recent.map(item => ({ text: w.recent(w.kinds[item.kind], item.status === "paid", date(item.at), item.amount ? formatMoney(item.amount / 100, language, item.amount % 100 === 0) : ""), assistant: false })),
    ...found.same.map(item => ({ text: w.same(w.records[item.what], date(item.at)), assistant: true })),
    ...found.differs.map(item => ({ text: w.differs(w.records[item.what], date(item.at)), assistant: true })),
  ];
}

const months = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
} satisfies Record<Language, string[]>;
const pace = {
  en: {
    month: (month: string, spent: string, before: string, budget: string) => `Approved so far in ${month}: ${spent}${budget && ` of the ${budget} monthly budget`}. ${month} last year: ${before}.`,
    none: "none",
    highest: (kind: string, median: string) => `This amount is above every ${kind} approval in the past year. The middle amount was ${median}.`,
    amount: (above: number, kind: string, median: string) => `This amount is above ${above} of every 10 ${kind} approvals in the past year. The middle amount was ${median}.`,
    kinds: { rent: "rent", utility: "utility", food: "food", voucher: "voucher", other: "other" },
  },
  es: {
    month: (month: string, spent: string, before: string, budget: string) => `Aprobado hasta ahora en ${month}: ${spent}${budget && ` del presupuesto mensual de ${budget}`}. En ${month} del año pasado: ${before}.`,
    none: "nada",
    highest: (kind: string, median: string) => `Esta cantidad supera todas las aprobaciones de ${kind} del último año. La cantidad media fue ${median}.`,
    amount: (above: number, kind: string, median: string) => `Esta cantidad supera ${above} de cada 10 aprobaciones de ${kind} del último año. La cantidad media fue ${median}.`,
    kinds: said.es.kinds,
  },
} satisfies Record<Language, { kinds: Record<RequestKind, string>; [line: string]: unknown }>;

/**
 * The group's spending, from the records, ahead of the household lines: this month against the same month last year,
 * and, with enough earlier approvals of the kind, where the asked amount falls when it is above nine in ten of them.
 */
export function paceLines(language: Language, spent: { month: number; thisMonth: number; lastYear: number; budget?: number | null; kind: RequestKind; asked: number; approvals: number; median: number; above: number; baseline: number }): RepeatLine[] {
  const w = pace[language];
  const money = (cents: number) => formatMoney(cents / 100, language, cents % 100 === 0);
  const lines: RepeatLine[] = [];
  if (spent.thisMonth || spent.lastYear || spent.budget) lines.push({ text: w.month(months[language][spent.month - 1], money(spent.thisMonth), spent.lastYear ? money(spent.lastYear) : w.none, spent.budget ? money(spent.budget) : ""), assistant: false });
  const tenths = spent.approvals ? Math.floor((spent.above / spent.approvals) * 10) : 0;
  if (spent.kind !== "voucher" && spent.approvals >= spent.baseline && tenths >= 9) lines.push({ text: spent.above === spent.approvals ? w.highest(w.kinds[spent.kind], money(spent.median)) : w.amount(tenths, w.kinds[spent.kind], money(spent.median)), assistant: false });
  return lines;
}
