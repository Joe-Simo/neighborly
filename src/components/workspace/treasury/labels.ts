import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type Ledger = FunctionReturnType<typeof api.treasury.ledger>;
export type LedgerEntry = Ledger["entries"][number];
export type Payable = FunctionReturnType<typeof api.treasury.payable>[number];
export type Bank = FunctionReturnType<typeof api.treasury.reconciliation>;
export type BankEntry = Bank["waiting"][number];

export const TWINNING_GIFT = "Twinning gift";
export const incomeSources = [
  ["collection", "Parish collection"],
  ["walk", "Friends of the Poor Walk"],
  ["donation", "Donation"],
  ["twinning", "Twinning received"],
  ["opening", "Opening balance"],
] as const;
export type IncomeSource = (typeof incomeSources)[number][0];
export const spendingKinds = [
  ["pantry", "Pantry purchase"],
  ["supplies", "Supplies"],
  ["dues", "Council dues"],
  ["fee", "Bank fee"],
  ["twinning", "Twinning gift to another conference"],
  ["other", "Other spending"],
] as const;
export type SpendingKind = (typeof spendingKinds)[number][0];

const kinds: Record<string, string> = {
  rent: "Rent",
  utility: "Utilities",
  food: "Food",
  voucher: "Thrift store voucher",
  other: "Other help",
};
/** Payments carry the request's kind as their category; money in carries its source as written. */
export const categoryLabel = (category: string) => kinds[category] ?? category;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The two lines a ledger row reads as: what it was, then who was paid or where it came from. */
export function entryLines(entry: BankEntry) {
  const note = [entry.checkNumber && `Check ${entry.checkNumber}`, entry.memo]
    .filter(Boolean)
    .map((part) => ` · ${part}`)
    .join("");
  if (entry.reverses)
    return {
      title: `Reversed: ${lowerFirst(entry.summary ?? categoryLabel(entry.category))}, ${lowerFirst(entry.memo)}`,
      detail: `${entry.kind === "income" ? "Back from" : "Taken back from"} ${entry.payee}`,
    };
  if (entry.summary)
    return { title: entry.summary, detail: `Paid to ${entry.payee}${note}` };
  if (entry.category === TWINNING_GIFT)
    return { title: TWINNING_GIFT, detail: `To ${entry.payee}${note}` };
  const who = `${entry.kind === "income" ? "From" : "Paid to"} ${entry.payee}${entry.checkNumber ? ` · Check ${entry.checkNumber}` : ""}`;
  return entry.memo
    ? { title: entry.memo, detail: `${entry.category} · ${who}` }
    : { title: entry.category, detail: who };
}

// Ledger days are calendar days, not moments, so they are formatted at noon UTC and never shift.
const at = (day: string) => new Date(`${day}T12:00:00Z`);
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
const shortDay = format({ month: "short", day: "numeric" });
const weekDay = format({ weekday: "long", month: "short", day: "numeric" });
const monthOnly = format({ month: "long" });
const monthAndYear = format({ month: "long", year: "numeric" });

export const dayLabel = (day: string) => shortDay.format(at(day));
export const weekDayLabel = (day: string) => weekDay.format(at(day));
/** "November", or "November 2025" when it is not this year. */
export const monthLabel = (month: string, today: string) =>
  (month.slice(0, 4) === today.slice(0, 4) ? monthOnly : monthAndYear).format(
    at(`${month}-01`),
  );
