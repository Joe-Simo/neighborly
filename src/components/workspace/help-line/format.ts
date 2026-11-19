import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { fill } from "@/lib/words/fill";
import type { Words } from "@/lib/words";
import { formatMoney } from "@/lib/words/numbers";
import type { Language } from "@/lib/words";

export type Calls = FunctionReturnType<typeof api.assistance.calls>;
export type Call = Calls["waiting"][number];
export type HelpRequest = FunctionReturnType<typeof api.assistance.request>;
export type NeighborList = FunctionReturnType<typeof api.neighbors.list>;
export type NeighborRecord = FunctionReturnType<typeof api.neighbors.record>;
export type Neighbor = NeighborRecord["neighbor"];

export const payeeLabels = {
  landlord: "Landlord",
  utility: "Utility company",
  vendor: "Store or other business",
} as const;
export const languageLabels: Record<Neighbor["language"], string> = {
  en: "English",
  es: "Spanish",
  ht: "Haitian Creole",
  other: "Another language",
};
/** What a household speaks, in words: one of the three, or the name recorded for another language. */
export const spokenLabel = (neighbor: { language: Neighbor["language"]; languageName?: string }) =>
  neighbor.language === "other" ? neighbor.languageName || languageLabels.other : languageLabels[neighbor.language];
/** Whole cents as "$310.00". */
export const money = (cents: number, language: Language = "en") => formatMoney(cents / 100, language);
/** Whole cents as "$450" when there are no cents to show, for headings. */
export const shortMoney = (cents: number, language: Language = "en") => formatMoney(cents / 100, language, cents % 100 === 0);
/** What a person typed, such as "$1,250.50", as whole cents; null when it is not an amount. */
export function cents(typed: string) {
  const cleaned = typed.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
export const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
export const recordHref = (neighborId: string) =>
  `/app/neighbors?neighbor=${neighborId}`;
/** Opens the neighbor's record with this request on the sheet, ready to be decided. */
export const requestHref = (neighborId: string, requestId: string) =>
  `${recordHref(neighborId)}&request=${requestId}`;
/** "Mother, 41 · Son, 12": the household without anyone's name. */
export const livesHere = (people: NeighborRecord["household"], said: (typed: string) => string = (typed) => typed) =>
  people
    .map((person) =>
      person.age === null ? said(person.relationship) : `${said(person.relationship)}, ${person.age}`,
    )
    .join(" · ");
export const total = (lines: { amount: number }[]) =>
  lines.reduce((sum, line) => sum + line.amount, 0);
export const accountKinds = {
  landlord: "Landlord",
  utility: "Utility",
  other: "Other",
} as const;

/**
 * The same labels and lines as above, in a person's own language: a helper cannot ask for the person's words
 * itself, so the component that has them passes them here. The exports above stay as they are, in English, for
 * the places that have not yet been given words.
 */
type PayeeKind = keyof typeof payeeLabels;
type AccountKind = keyof typeof accountKinds;
export function formatIn(words: Words) {
  const text = words.rooms.helpLine.format;
  const kindLabels: Record<HelpRequest["kind"], string> = words.kinds;
  const payees: Record<PayeeKind, string> = text.payees;
  const spoken: Record<Neighbor["language"], string> = text.languages;
  const accounts: Record<AccountKind, string> = text.accounts;
  const vouchers = (voucher: { item: string; quantity: number }) => {
    // The shelf may name its item "Clothing voucher" already; it is said once. The item stays as it was typed.
    const item = voucher.item.toLowerCase().replace(/\s+vouchers?$/, "");
    return fill(text.vouchers(voucher.quantity), { item });
  };
  return {
    kindLabels,
    payeeLabels: payees,
    languageLabels: spoken,
    accountKinds: accounts,
    /** What a household speaks, in words: one of the three, or the name recorded for another language. */
    spokenLabel: (neighbor: { language: Neighbor["language"]; languageName?: string }) =>
      neighbor.language === "other" ? neighbor.languageName || spoken.other : spoken[neighbor.language],
    household: (adults: number, children: number) =>
      adults + children === 1 ? text.livesAlone : text.householdOf(adults + children),
    householdDetail: (adults: number, children: number) =>
      children ? fill(text.adultsAndChildren, { adults: text.adults(adults), children: text.children(children) }) : text.adults(adults),
    /** "2 winter coat vouchers": what a voucher request takes from the shelf. */
    vouchers,
    requestTitle: (request: HelpRequest) => {
      if (request.voucher) return vouchers(request.voucher);
      const kind = kindLabels[request.kind];
      const amount = shortMoney(request.amountApproved ?? request.amountRequested);
      return request.payeeName ? fill(text.requestTo, { kind, amount, payee: request.payeeName }) : fill(text.request, { kind, amount });
    },
  };
}
