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
  // One network address: a room of judges may share it, so thirty a minute. Each entry is only a short ticket.
  sampleEntryByVisitor: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  // Everyone together: a ceiling on how many sessions the shared account can be asked for.
  sampleEntry: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 120 },
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
 * Nightly, and once by hand at set-up: brings the visitor's sample conference back to the made-up year,
 * so whatever a visitor typed is gone by morning. Only rows that differ are written (see sampleData.renew). Touches only sample conferences that the
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
    const owner = { userId, ...sampleOwner };
    let samples = 0;
    for (const member of memberships) {
      if (!(await isSampleChurch(ctx, member.churchId))) continue;
      samples++;
      // Only what differs from the made-up year is written; the closed year is kept as it is.
      await ctx.runMutation(internal.sampleData.renew, { churchId: member.churchId, owner });
    }
    if (!samples) await ctx.runMutation(internal.sampleData.load, { owner });
    return null;
  },
});

/**
 * What the nightly schedule runs. One reset reads the whole sample, about 1 MB of the month's database
 * allowance, and writes what moved, so a deployment nobody is shown, a development one, can turn the nightly reset
 * off with SAMPLE_NIGHTLY=off and be reset by hand (demo:refresh) when its sample is wanted fresh.
 * Unset, as on the live site, the sample is reset every night.
 */
export const nightly = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (process.env.SAMPLE_NIGHTLY !== "off") await ctx.runMutation(internal.demo.refresh, {});
    return null;
  },
});
