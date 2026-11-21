import { v } from "convex/values";
import { type MutationCtx, type QueryCtx } from "./_generated/server";
import { internalMutation } from "./functions";
import type { Id } from "./_generated/dataModel";

/**
 * The names the assistant's scrub takes out of every note: each neighbor's and member's in the conference.
 * Kept on one document per conference, written in the same mutation as any name it holds, so it is never behind.
 * A removed record (no nameKey) and a removed member (removedAt) are not in it.
 */
async function everyName(ctx: QueryCtx, churchId: Id<"churches">) {
  const [neighbors, members] = await Promise.all([
    ctx.db.query("neighbors").withIndex("by_church", q => q.eq("churchId", churchId)).take(5000),
    ctx.db.query("memberships").withIndex("by_church", q => q.eq("churchId", churchId)).take(1000),
  ]);
  return [...new Set([...neighbors.filter(row => row.nameKey).map(row => row.name), ...members.filter(row => !row.removedAt).map(row => row.name)].map(name => name.trim()).filter(Boolean))];
}

/** The scrub's list. With no document yet (before the backfill), it reads the records themselves: never an empty list. */
export async function namesFor(ctx: QueryCtx, churchId: Id<"churches">) {
  const kept = await ctx.db.query("knownNames").withIndex("by_church", q => q.eq("churchId", churchId)).unique();
  return kept ? kept.names : await everyName(ctx, churchId);
}

/** Writes the list again from the records: after a rename, a removal, an import or the sample's reset. */
export async function rebuildNames(ctx: MutationCtx, churchId: Id<"churches">) {
  const names = await everyName(ctx, churchId);
  const kept = await ctx.db.query("knownNames").withIndex("by_church", q => q.eq("churchId", churchId)).unique();
  if (kept) await ctx.db.patch("knownNames", kept._id, { names });
  else await ctx.db.insert("knownNames", { churchId, names });
}

/** One new name (a neighbor added, a member joined): appended without reading every record. */
export async function addName(ctx: MutationCtx, churchId: Id<"churches">, name: string) {
  const kept = await ctx.db.query("knownNames").withIndex("by_church", q => q.eq("churchId", churchId)).unique();
  if (!kept) return rebuildNames(ctx, churchId);
  const clean = name.trim();
  if (clean && !kept.names.includes(clean)) await ctx.db.patch("knownNames", kept._id, { names: [...kept.names, clean] });
}

/** Once, on each deployment, before the code that reads the list: `bunx convex run knownNames:backfill`. Safe to run again. */
export const backfill = internalMutation({
  args: {}, returns: v.number(),
  handler: async ctx => {
    const churches = await ctx.db.query("churches").take(1000);
    for (const church of churches) await rebuildNames(ctx, church._id);
    return churches.length;
  },
});
