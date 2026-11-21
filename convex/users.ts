import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation } from "./functions";
import { verifiedIdentity } from "./access";

/**
 * Called once after each sign-in, before anything else is read. Finds this person's row, or makes it.
 * Someone who had an account before Clerk gets their old row back, with every membership on it,
 * when Clerk has verified the same email. A row that already belongs to a Clerk account is never handed on.
 */
export const enter = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { clerkId, email } = await verifiedIdentity(ctx);
    const known = await ctx.db.query("users").withIndex("by_clerk", q => q.eq("clerkId", clerkId)).unique();
    if (known) return null;
    const earlier = await ctx.db.query("users").withIndex("by_legacy_email", q => q.eq("legacyEmail", email)).first();
    if (earlier) await ctx.db.patch("users", earlier._id, { clerkId, legacyEmail: undefined });
    else await ctx.db.insert("users", { clerkId });
    return null;
  },
});

/**
 * Run once at the switch to Clerk: copies each earlier account's verified email out of the old
 * sign-in store onto its row, so enter() can find it. Safe to run again. Goes away with the old store.
 */
export const keepLegacyEmails = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate({ cursor: args.cursor ?? null, numItems: 100 });
    for (const account of page.page) {
      if (account.clerkId || account.legacyEmail) continue;
      const email = await ctx.runQuery(components.authEmail.verifiedEmails.getPrimaryEmail, { userId: account._id });
      if (email) await ctx.db.patch("users", account._id, { legacyEmail: email.trim().toLowerCase() });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.users.keepLegacyEmails, { cursor: page.continueCursor });
    return null;
  },
});
