import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** The made-up owner every visitor shares. It exists in Clerk with no password and belongs only to the sample conference. */
export const sampleOwner = { name: "Sample Owner", email: "demo@kindhelps.com" };

/** True for the one shared visitor account, named by the deployment. Off when the variable is unset. */
export function isSampleVisitor(clerkId: string | undefined) {
  return Boolean(clerkId) && clerkId === process.env.DEMO_CLERK_USER_ID;
}

/** Nothing a visitor types may leave a sample conference: no email, no invitation, whoever asks. */
export async function isSampleChurch(ctx: QueryCtx | MutationCtx, churchId: Id<"churches">) {
  return (await ctx.db.get("churches", churchId))?.sample === true;
}

/** Whether the person signed in came by the sample link, so the shell can say "Leave the sample". */
export const visiting = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => isSampleVisitor((await ctx.auth.getUserIdentity())?.subject),
});

const entries = new RateLimiter(components.rateLimiter, {
  // One person opening the sample: a handful of tries a minute is plenty.
  sampleEntryByVisitor: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  // Everyone together: a ceiling on how many sessions the shared account can be asked for.
  sampleEntry: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
});

/**
 * The website asks this before it hands out an entry ticket, and is told which account the ticket is for.
 * `visitor` is a hash of the caller's address, never the address itself. Null means wait a little.
 * The account's id is not a secret, and lives only here, so replacing a lost visitor account is one
 * variable on this backend and no new build of the website.
 */
export const admit = mutation({
  args: { visitor: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { visitor }) => {
    const account = process.env.DEMO_CLERK_USER_ID;
    if (!account || !/^[0-9a-f]{64}$/.test(visitor)) return null;
    if (!(await entries.limit(ctx, "sampleEntryByVisitor", { key: visitor })).ok) return null;
    return (await entries.limit(ctx, "sampleEntry")).ok ? account : null;
  },
});

/**
 * Nightly, and once by hand at set-up: throws away the visitor's sample conference and loads the made-up
 * year again, so whatever a visitor typed is gone by morning. Touches only sample conferences that the
 * visitor account belongs to. Does nothing until the deployment names the visitor account.
 */
export const refresh = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const clerkId = process.env.DEMO_CLERK_USER_ID;
    if (!clerkId) return null;
    const known = await ctx.db.query("users").withIndex("by_clerk", (q) => q.eq("clerkId", clerkId)).unique();
    const userId = known?._id ?? (await ctx.db.insert("users", { clerkId }));
    const memberships = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).take(100);
    // The month's AI allowance belongs to the sample as a whole, so a fresh conference does not get a fresh one.
    const month = new Date().toISOString().slice(0, 7);
    let aiUsed = 0;
    for (const member of memberships) {
      if (!(await isSampleChurch(ctx, member.churchId))) continue;
      const used = await ctx.db.query("aiUsageByChurch").withIndex("by_church_month", (q) => q.eq("churchId", member.churchId).eq("month", month)).unique();
      aiUsed += used?.count ?? 0;
      await ctx.runMutation(internal.sampleData.clear, { churchId: member.churchId });
    }
    // Loaded in its own step, so clearing a year and writing a year never share one transaction's limits.
    await ctx.scheduler.runAfter(0, internal.demo.reload, { userId, month, aiUsed });
    return null;
  },
});

export const reload = internalMutation({
  args: { userId: v.id("users"), month: v.string(), aiUsed: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, month, aiUsed }) => {
    const churchId: Id<"churches"> = await ctx.runMutation(internal.sampleData.load, { owner: { userId, ...sampleOwner } });
    if (aiUsed > 0) await ctx.db.insert("aiUsageByChurch", { churchId, month, count: aiUsed });
    return null;
  },
});
