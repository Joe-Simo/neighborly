import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * A conference keeps two running figures on its own row: how many households are on file and how many requests
 * wait for a decision. The neighbor list reads them with the conference, so it can say the whole number without
 * counting the households each time. Every write that adds a household or moves a request into or out of "open"
 * changes them here, in the same step.
 */
export async function tally(
  ctx: Pick<MutationCtx, "db">,
  churchId: Id<"churches">,
  change: {
    households?: number;
    waiting?: number;
    /** A request for this household is now waiting for a decision. */
    opened?: Id<"neighbors">;
    /** One of this household's waiting requests was decided or closed. */
    settled?: Id<"neighbors">;
    /** The household left the records: none of its requests waits any more. */
    gone?: Id<"neighbors">;
  },
) {
  if (!change.households && !change.waiting && !change.opened && !change.settled && !change.gone) return;
  const church = await ctx.db.get("churches", churchId);
  if (!church) return;
  // One entry per waiting request, so a household with two waits until both are settled; the list shows each household once.
  let ids = [...(church.waitingHouseholdIds ?? [])];
  if (change.opened && ids.length < WAITING_KEPT) ids.push(change.opened);
  if (change.settled) {
    const at = ids.indexOf(change.settled);
    if (at >= 0) ids.splice(at, 1);
  }
  if (change.gone) ids = ids.filter((id) => id !== change.gone);
  await ctx.db.patch("churches", churchId, {
    householdCount: Math.max(0, (church.householdCount ?? 0) + (change.households ?? 0)),
    waitingCount: Math.max(0, (church.waitingCount ?? 0) + (change.waiting ?? 0)),
    waitingHouseholdIds: ids,
  });
}

/** How many waiting requests the conference keeps by household, to lead the neighbor list. */
export const WAITING_KEPT = 50;

/** Once, for conferences that were there before the figures were kept: counts each and writes both. */
export const backfill = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let done = 0;
    for (const church of await ctx.db.query("churches").collect()) {
      if (church.householdCount !== undefined && church.waitingCount !== undefined && church.waitingHouseholdIds !== undefined) continue;
      const households = (await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", church._id).gt("nameKey", "")).collect()).length;
      const open = (await ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", church._id)).collect()).filter((request) => request.status === "open");
      await ctx.db.patch("churches", church._id, { householdCount: households, waitingCount: open.length, waitingHouseholdIds: open.slice(0, WAITING_KEPT).map((request) => request.neighborId) });
      done++;
    }
    return done;
  },
});
