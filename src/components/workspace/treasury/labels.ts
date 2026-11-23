import type { FunctionReturnType } from "convex/server";
import { treasuryWords } from "@/lib/words/rooms/treasury";
import type { api } from "../../../../convex/_generated/api";
import { formatDate, type Language } from "@/lib/words";
import { fill } from "@/lib/words/fill";

export type Ledger = FunctionReturnType<typeof api.treasury.ledger>;
export type LedgerEntry = Ledger["entries"][number];
export type Payable = FunctionReturnType<typeof api.treasury.payable>[number];
export type Bank = FunctionReturnType<typeof api.treasury.reconciliation>;
/** One entry as every treasury list shows it; the bank screen adds the deposit it went in. */
export type BankEntry = Omit<Bank["waiting"][number], "depositId" | "depositDate" | "depositTotal" | "depositCount">;
export type Statement = FunctionReturnType<typeof api.treasury.statements>[number];
export type Gift = FunctionReturnType<typeof api.treasury.undeposited>[number];
export type Kind = FunctionReturnType<typeof api.treasury.kinds>[number];
export type Shelf = FunctionReturnType<typeof api.treasury.voucherShelf>;

/** The category a twinning gift is stored under: read to tell one apart, never shown as written. */
export const TWINNING_GIFT = "Twinning gift";
export const incomeSources = ["collection", "walk", "donation", "twinning", "opening"] as const;
export type IncomeSource = (typeof incomeSources)[number];
export const spendingKinds = ["pantry", "supplies", "dues", "fee", "twinning", "other"] as const;
export type SpendingKind = (typeof spendingKinds)[number];

/** The treasury's own words, in the person's language. */
export type TreasuryWords = ReturnType<typeof treasuryWords>;

/** The ledger stores its own kinds under these names; each is said in the person's language. A kind a person named is not here. */
const stored: Record<string, (words: TreasuryWords) => string> = {
  rent: (words) => words.kinds.rent,
  utility: (words) => words.kinds.utility,
  food: (words) => words.kinds.food,
  voucher: (words) => words.kinds.voucher,
  other: (words) => words.kinds.other,
  "Parish collection": (words) => words.sources.collection,
  "Friends of the Poor Walk": (words) => words.sources.walk,
  Donation: (words) => words.sources.donation,
  "Twinning received": (words) => words.sources.twinning,
  "Opening balance": (words) => words.sources.opening,
  "Pantry purchase": (words) => words.spending.pantry,
  Supplies: (words) => words.spending.supplies,
  "Council dues": (words) => words.spending.dues,
  "Bank fee": (words) => words.spending.fee,
  "Other spending": (words) => words.spending.other,
  [TWINNING_GIFT]: (words) => words.twinningGift,
};
const said = new Map(Object.entries(stored));
/** Payments carry the request's kind as their category; money in carries its source as written. */
/** A name the conference typed itself is said as typed; `say` is the sample's own (sample-names.ts). */
type Say = (typed: string) => string;
const asTyped: Say = (typed) => typed;
export const categoryLabel = (words: TreasuryWords, category: string, say: Say = asTyped) => said.get(category)?.(words) ?? say(category);

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** "$214.60 to Demo Power & Light", the way a statement line reads. `amount` is already written as money. */
export const amountLine = (words: TreasuryWords, entry: Pick<BankEntry, "kind" | "payee">, amount: string, typed: Say = asTyped) =>
  fill(entry.kind === "income" ? words.lines.amountFrom : words.lines.amountTo, { amount, name: typed(entry.payee) });

/** The two lines a ledger row reads as: what it was, then who was paid or where it came from. */
export function entryLines(words: TreasuryWords, given: BankEntry, typed: Say = asTyped) {
  const entry = { ...given, payee: typed(given.payee), memo: typed(given.memo), summary: given.summary && typed(given.summary) };
  const say = words.lines;
  const check = entry.checkNumber ? say.check(entry.checkNumber) : "";
  const note = [check, entry.memo]
    .filter(Boolean)
    .map((part) => `\u00a0· ${part}`)
    .join("");
  if (entry.reverses)
    return {
      title: fill(say.reversedTitle, { what: lowerFirst(entry.summary ?? categoryLabel(words, entry.category, typed)), why: lowerFirst(entry.memo) }),
      detail: entry.kind === "income" ? say.backFrom(entry.payee) : say.takenBackFrom(entry.payee),
    };
  if (entry.summary)
    return { title: entry.summary, detail: `${say.paidTo(entry.payee)}${note}` };
  if (entry.category === TWINNING_GIFT)
    return { title: words.twinningGift, detail: `${say.to(entry.payee)}${note}` };
  const who = `${entry.kind === "income" ? say.from(entry.payee) : say.paidTo(entry.payee)}${check ? `\u00a0· ${check}` : ""}`;
  const category = categoryLabel(words, entry.category, typed);
  return entry.memo
    ? { title: entry.memo, detail: `${category}\u00a0· ${who}` }
    : { title: category, detail: who };
}

// Ledger days are calendar days, not moments, so they are formatted at noon UTC and never shift.
const at = (day: string) => Date.parse(`${day}T12:00:00Z`);
const write = (locale: Language, day: string, options: Intl.DateTimeFormatOptions) =>
  formatDate(locale, at(day), { ...options, timeZone: "UTC" });
/** Where a heading or a line begins with a month, which Spanish writes small. */
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const dayLabel = (locale: Language, day: string) => write(locale, day, { month: "short", day: "numeric" });
/** The two pieces of a date leaf: the short month and the day's number. */
export const dayParts = (locale: Language, day: string) => ({
  month: write(locale, day, { month: "short" }),
  date: write(locale, day, { day: "numeric" }),
});
export const weekDayLabel = (locale: Language, day: string) =>
  write(locale, day, { weekday: "long", month: "short", day: "numeric" });
/** "November", or "November 2025" when it is not this year. */
export const monthLabel = (locale: Language, month: string, today: string) =>
  write(locale, `${month}-01`, month.slice(0, 4) === today.slice(0, 4) ? { month: "long" } : { month: "long", year: "numeric" });
/** The same month where it stands alone or opens a line: "Noviembre". */
export const monthTitle = (locale: Language, month: string, today: string) => upperFirst(monthLabel(locale, month, today));
