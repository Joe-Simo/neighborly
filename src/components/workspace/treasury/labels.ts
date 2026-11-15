import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type Ledger = FunctionReturnType<typeof api.treasury.ledger>;
export type Payable = FunctionReturnType<typeof api.treasury.payable>[number];

const kinds: Record<string, string> = {
  rent: "Rent",
  utility: "Utilities",
  food: "Food",
  voucher: "Thrift store voucher",
  other: "Other help",
};
/** Payments carry the request's kind as their category; money in carries its source as written. */
export const categoryLabel = (category: string) => kinds[category] ?? category;

// Ledger days are calendar days, not moments, so they are formatted at noon UTC and never shift.
const at = (day: string) => new Date(`${day}T12:00:00Z`);
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
const shortDay = format({ month: "short", day: "numeric" });
const longDay = format({ month: "short", day: "numeric", year: "numeric" });
const monthOnly = format({ month: "long" });
const monthAndYear = format({ month: "long", year: "numeric" });

export const dayLabel = (day: string) => shortDay.format(at(day));
export const fullDayLabel = (day: string) => longDay.format(at(day));
/** "November", or "November 2025" when it is not this year. */
export const monthLabel = (month: string, today: string) =>
  (month.slice(0, 4) === today.slice(0, 4) ? monthOnly : monthAndYear).format(
    at(`${month}-01`),
  );
