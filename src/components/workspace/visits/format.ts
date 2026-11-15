import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { shortMoney } from "@/components/workspace/help-line/format";

export type Board = FunctionReturnType<typeof api.visits.board>;
export type Visit = Board["scheduled"][number];
export type Suggestion = NonNullable<Board["suggested"]>;
export type Waiting = Board["toArrange"][number];
export type Visitors = FunctionReturnType<typeof api.visits.visitors>;
export type Sheet = FunctionReturnType<typeof api.visits.sheet>;
export type OwnVisit = FunctionReturnType<typeof api.visits.mine>[number];

export const kindLabels: Record<Waiting["kind"], string> = {
  rent: "rent",
  utility: "utility bill",
  food: "food",
  voucher: "thrift store voucher",
  other: "other help",
};
/** "rent, $450": what the visit is about, in the words of the request. */
export const need = (kind: Waiting["kind"], cents: number) =>
  `${kindLabels[kind]}, ${shortMoney(cents)}`;
export const firstName = (name: string) => name.split(/\s+/)[0];
/** What a person typed for hours or miles, as a number; null when it is not one. */
export function amount(typed: string) {
  const cleaned = typed.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}
export const sheetHref = (visitId: string) => `/app/visits?sheet=${visitId}`;
/** Where the pair stands: both said yes, someone cannot go, or someone has yet to answer. */
export function standing(visit: Visit) {
  const declined = visit.visitors.find(
    (visitor) => visitor.response === "declined",
  );
  if (declined)
    return {
      state: "declined" as const,
      who: declined,
      text: `${firstName(declined.name)} can’t go`,
    };
  const waiting = visit.visitors.filter(
    (visitor) => visitor.response === "pending",
  );
  if (!waiting.length)
    return { state: "accepted" as const, text: "Both accepted" };
  return {
    state: "waiting" as const,
    text:
      waiting.length === 2
        ? "Waiting on both"
        : `Waiting on ${firstName(waiting[0].name)}`,
  };
}
