/** A new member's first week: which slips there are, and what this device remembers of them. */

export type SlipId = "call" | "visit" | "yes" | "mine" | "away";
export type FirstWeek = { done: SlipId[]; closed: boolean };

/** The slips show only in a member's first two weeks, so a long-standing member on a new device never sees them. */
export const NEW_FOR = 14 * 86400000;
export const COMING_UP = "week-coming-up";

export function isNewMember(joinedAt: number | undefined, now: number) {
  return typeof joinedAt === "number" && now - joinedAt < NEW_FOR;
}

/** Leaders work the help line; a member's three are their own part of the week. */
export function firstWeekSlips(leads: boolean): { id: SlipId; href: string }[] {
  return leads
    ? [
        { id: "call", href: "/app/help-line" },
        { id: "visit", href: "/app/visits" },
        { id: "yes", href: "/app/help-line" },
      ]
    : [
        { id: "yes", href: `/app/week#${COMING_UP}` },
        { id: "mine", href: "/app/mine" },
        { id: "away", href: "/app/time-off" },
      ];
}

const key = (memberId: string) => `kh-first-week:${memberId}`;
const ids: readonly SlipId[] = ["call", "visit", "yes", "mine", "away"];

export function readFirstWeek(memberId: string): FirstWeek {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(key(memberId)) ?? "null");
    if (kept && typeof kept === "object" && "done" in kept && Array.isArray(kept.done)) {
      return { done: kept.done.filter((id): id is SlipId => ids.includes(id)), closed: "closed" in kept && kept.closed === true };
    }
  } catch {
    // Storage refused (a private window): the slips show, and are put away for this visit only.
  }
  return { done: [], closed: false };
}

export function writeFirstWeek(memberId: string, state: FirstWeek) {
  try {
    localStorage.setItem(key(memberId), JSON.stringify(state));
  } catch {
    // Kept for this visit only.
  }
}
