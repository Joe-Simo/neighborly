import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { nameKey } from "./assistance";

const tables = ["neighbors", "payees", "ledgerKinds"] as const;
const PAGE = 200;

/**
 * Once, after names began to be matched with their accents set aside: every stored nameKey is written again from
 * its name, so "José" is found by "jose" in lists and lookups. Run as `npx convex run nameKeys:refold`; it goes
 * table by table, a page at a time, each page scheduling the next. A removed record keeps its empty key.
 */
export const refold = internalMutation({
  args: { table: v.optional(v.union(...tables.map((name) => v.literal(name)))), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.number(),
  handler: async (ctx, { table = tables[0], cursor = null }) => {
    const page = await ctx.db.query(table).paginate({ cursor, numItems: PAGE });
    let changed = 0;
    for (const row of page.page) {
      if (!row.nameKey) continue;
      const key = nameKey(row.name);
      if (key === row.nameKey) continue;
      await ctx.db.patch(table, row._id, { nameKey: key });
      changed++;
    }
    const next = page.isDone ? tables[tables.indexOf(table) + 1] : table;
    if (next) await ctx.scheduler.runAfter(0, internal.nameKeys.refold, { table: next, cursor: page.isDone ? null : page.continueCursor });
    return changed;
  },
});
