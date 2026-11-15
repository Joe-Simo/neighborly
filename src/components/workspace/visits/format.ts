import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import {
  kindLabels,
  shortMoney,
} from "@/components/workspace/help-line/format";

export type Board = FunctionReturnType<typeof api.visits.board>;
export type Visit = Board["scheduled"][number];
export type Suggestion = NonNullable<Board["suggested"]>;
export type Waiting = Board["toArrange"][number];
export type Visitors = FunctionReturnType<typeof api.visits.visitors>;
export type Sheet = FunctionReturnType<typeof api.visits.sheet>;
export type OwnVisit = FunctionReturnType<typeof api.visits.mine>[number];

/** "Rent, $450": what the visit is about, in the words of the request. */
export const need = (kind: Waiting["kind"], cents: number) =>
  `${kindLabels[kind]}, ${shortMoney(cents)}`;
export const firstName = (name: string) => name.split(/\s+/)[0];
/** The neighbor's record with one request open, where it is approved or declined. Stream 1's address. */
export const requestHref = (neighborId: string, requestId: string) =>
  `/app/neighbors?neighbor=${neighborId}&request=${requestId}`;
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
