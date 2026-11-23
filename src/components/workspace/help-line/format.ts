import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { formatMoney } from "@/lib/words/numbers";
import type { Language, Words } from "@/lib/words";

export type Calls = FunctionReturnType<typeof api.assistance.calls>;
export type Call = Calls["waiting"][number];
export type HelpRequest = FunctionReturnType<typeof api.assistance.request>;
export type NeighborList = FunctionReturnType<typeof api.neighbors.list>;
export type NeighborRecord = FunctionReturnType<typeof api.neighbors.record>;
export type Neighbor = NeighborRecord["neighbor"];

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
export const recordHref = (neighborId: string) =>
  `/app/neighbors?neighbor=${neighborId}`;
/** "Mother, 41 · Son, 12": the household without anyone's name. */
export const livesHere = (people: NeighborRecord["household"], said: (typed: string) => string = (typed) => typed) =>
  people
    .map((person) =>
      person.age === null ? said(person.relationship) : `${said(person.relationship)},\u00a0${person.age}`,
    )
    // The dot holds to the person before it, so a turned line never opens on one.
    .join("\u00a0· ");
export const total = (lines: { amount: number }[]) =>
  lines.reduce((sum, line) => sum + line.amount, 0);
export const accountKinds = {
  landlord: "Landlord",
  utility: "Utility",
  other: "Other",
} as const;

/** Why a call is first, in the reader's language. An unknown reason from a newer backend is left out. */
export function whyFirst(urgent: Pick<NonNullable<Call["urgent"]>, "reasons" | "day">, words: Words) {
  const text = words.urgent;
  const day = urgent.day ?? 0;
  const known = new Map<string, string | ((day: number) => string)>(
    Object.entries(text),
  );
  return urgent.reasons.flatMap((reason) => {
    const say = ["label", "origin", "notUrgent"].includes(reason)
      ? undefined
      : known.get(reason);
    return say === undefined ? [] : [typeof say === "string" ? say : say(day)];
  });
}
