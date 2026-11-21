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
