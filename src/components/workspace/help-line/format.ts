import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type Calls = FunctionReturnType<typeof api.assistance.calls>;
export type Call = Calls["waiting"][number];
export type HelpRequest = FunctionReturnType<typeof api.assistance.request>;
export type NeighborList = FunctionReturnType<typeof api.neighbors.list>;
export type NeighborRecord = FunctionReturnType<typeof api.neighbors.record>;
export type Neighbor = NeighborRecord["neighbor"];

export const kindLabels: Record<HelpRequest["kind"], string> = {
  rent: "Rent",
  utility: "Utility bill",
  food: "Food",
  voucher: "Thrift store voucher",
  other: "Other help",
};
export const payeeLabels = {
  landlord: "Landlord",
  utility: "Utility company",
  vendor: "Store or other business",
} as const;
export const languageLabels: Record<Neighbor["language"], string> = {
  en: "English",
  es: "Spanish",
  ht: "Haitian Creole",
};
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const wholeDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
/** Whole cents as "$310.00". */
export const money = (cents: number) => dollars.format(cents / 100);
/** Whole cents as "$450" when there are no cents to show, for headings. */
export const shortMoney = (cents: number) =>
  (cents % 100 === 0 ? wholeDollars : dollars).format(cents / 100);
/** What a person typed, such as "$1,250.50", as whole cents; null when it is not an amount. */
export function cents(typed: string) {
  const cleaned = typed.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
export function household(adults: number, children: number) {
  const size = adults + children;
  return size === 1 ? "Lives alone" : `Household of ${size}`;
}
export function householdDetail(adults: number, children: number) {
  return children
    ? `${count(adults, "adult", "adults")}, ${count(children, "child", "children")}`
    : count(adults, "adult", "adults");
}
export const requestTitle = (request: HelpRequest) =>
  `${kindLabels[request.kind]}, ${shortMoney(request.amountApproved ?? request.amountRequested)}${request.payeeName ? ` to ${request.payeeName}` : ""}`;
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
/** "Mother, 41 · Son, 12": the household without anyone's name. */
export const livesHere = (people: NeighborRecord["household"]) =>
  people
    .map((person) =>
      person.age === null ? person.relationship : `${person.relationship}, ${person.age}`,
    )
    .join(" · ");
export const total = (lines: { amount: number }[]) =>
  lines.reduce((sum, line) => sum + line.amount, 0);
export const accountKinds = {
  landlord: "Landlord",
  utility: "Utility",
  other: "Other",
} as const;
