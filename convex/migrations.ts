import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Kind Helps speaks English and Spanish only. Haitian Creole ("ht") is taken out of the stored records in three steps:
 * this file lands while the schema still accepts "ht" (widen), it is run once in each deployment (migrate), and only
 * then does the schema stop accepting it (narrow). A neighbor who was marked "ht" becomes "other" with no name
 * written, so the record says "Another language"; a member's "ht" is cleared, so they read the app in English until
 * they choose. Nothing else on either row is touched.
 *
 * Run: `npx convex run migrations:creoleToOther` (add `--prod` for production). It works through each table in
 * pages and schedules its own next page, so one run covers everything; running it again changes nothing.
 */
const PAGE = 200;

export const creoleToOther = internalMutation({
  args: { table: v.optional(v.union(v.literal("neighbors"), v.literal("memberships"))), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ table: v.string(), changed: v.number(), done: v.boolean() }),
  handler: async (ctx, { table = "neighbors", cursor = null }) => {
    let changed = 0;
    if (table === "neighbors") {
      const page = await ctx.db.query("neighbors").paginate({ numItems: PAGE, cursor });
      for (const neighbor of page.page)
        if (neighbor.language === "ht") {
          await ctx.db.patch("neighbors", neighbor._id, { language: "other", languageName: undefined });
          changed++;
        }
      if (!page.isDone) await ctx.scheduler.runAfter(0, internal.migrations.creoleToOther, { table, cursor: page.continueCursor });
      else await ctx.scheduler.runAfter(0, internal.migrations.creoleToOther, { table: "memberships", cursor: null });
      return { table, changed, done: false };
    }
    const page = await ctx.db.query("memberships").paginate({ numItems: PAGE, cursor });
    for (const member of page.page)
      if (member.language === "ht") {
        await ctx.db.patch("memberships", member._id, { language: undefined });
        changed++;
      }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.migrations.creoleToOther, { table, cursor: page.continueCursor });
    return { table, changed, done: page.isDone };
  },
});

/** What is still to change: both counts are 0 once the migration has run, and the schema may then be narrowed. */
export const creoleLeft = internalQuery({
  args: {},
  returns: v.object({ neighbors: v.number(), memberships: v.number() }),
  handler: async (ctx) => {
    let neighbors = 0;
    let memberships = 0;
    for await (const neighbor of ctx.db.query("neighbors")) if (neighbor.language === "ht") neighbors++;
    for await (const member of ctx.db.query("memberships")) if (member.language === "ht") memberships++;
    return { neighbors, memberships };
  },
});
