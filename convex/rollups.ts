import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { CouncilFigures } from "./councilFigures";

/**
 * The stored years a council reads (table yearRollups): one row per conference and fiscal year, so a council's
 * report reads one row per conference and never a conference's records. A row is kept only while the conference
 * is counted by a council. Any write to a table its year is counted from marks the conference's rows dirty and
 * schedules one recompute per row (convex/councils.ts `recompute`); further writes before it runs schedule
 * nothing more. The hourly cron picks up anything still dirty.
 */

/** Every table `yearFigures` (convex/reports.ts) reads. convex/functions.ts watches each one. */
export const rollupSources = [
  "churches", "neighbors", "calls", "assistanceRequests", "visits", "ledgerEntries", "memberships", "teams", "voucherStock", "commitments",
] as const satisfies readonly TableNames[];

/** How long a recompute waits, so a burst of writes (an import, a busy evening) is added up once. */
export const RECOMPUTE_AFTER_MS = 30_000;
const MOST_YEARS = 50;

const zero: CouncilFigures = {
  households: 0, people: 0, adults: 0, children: 0, visits: 0, peopleVisited: 0, visitHours: 0, visitMiles: 0, requestsReceived: 0,
  amountRequested: 0, helpPaid: 0, callsTaken: 0, hoursOfService: 0, activeMembers: 0, membersServing: 0, moneyReceived: 0, moneySpent: 0, endingBalance: 0,
};

const rowsOf = (ctx: MutationCtx, churchId: Id<"churches">) =>
  ctx.db.query("yearRollups").withIndex("by_church_year", (q) => q.eq("churchId", churchId)).take(MOST_YEARS);

/** A record of this conference changed: every stored year of it is stale. Each row schedules its recompute once. */
export async function markDirty(ctx: MutationCtx, churchId: Id<"churches">) {
  for (const row of await rowsOf(ctx, churchId)) {
    if (row.dirty) continue;
    await ctx.db.patch("yearRollups", row._id, { dirty: true });
    await ctx.scheduler.runAfter(RECOMPUTE_AFTER_MS, internal.councils.recompute, { churchId, year: row.year });
  }
}

/** Makes sure these years have a row, and has any missing or stale one added up now. */
export async function ensureYears(ctx: MutationCtx, churchId: Id<"churches">, years: number[]) {
  for (const year of years) {
    const row = await ctx.db.query("yearRollups").withIndex("by_church_year", (q) => q.eq("churchId", churchId).eq("year", year)).unique();
    if (row?.dirty) continue;
    if (row) await ctx.db.patch("yearRollups", row._id, { dirty: true });
    else await ctx.db.insert("yearRollups", { churchId, year, figures: zero, computedAt: 0, dirty: true });
    await ctx.scheduler.runAfter(0, internal.councils.recompute, { churchId, year });
  }
}

/** The conference is no longer counted by any council: its stored years go. */
export async function dropYears(ctx: MutationCtx, churchId: Id<"churches">) {
  for (const row of await rowsOf(ctx, churchId)) await ctx.db.delete("yearRollups", row._id);
}
