import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { neighborAccess } from "./access";
import { helpKind } from "./schema";

/**
 * The owner's review of "not genuine" marks, in the Help line. Two lists, both for the owner's own conference only:
 * its own requests the team marked not genuine, and the shared cases (the same contact marked by two or more teams)
 * that one of its marks is part of. A shared case shows a short piece of the contact's hash and how many teams marked
 * it: never another team's name, request or words. intakeCare.reviews / settle stay as internal commands.
 */
async function ownerOf(ctx: QueryCtx | MutationCtx, churchId: Id<"churches">) {
  const member = await neighborAccess(ctx, churchId);
  if (member.role !== "owner") throw new ConvexError("Only an owner can review these.");
  return member;
}

export const forOwner = query({
  args: { churchId: v.id("churches") },
  returns: v.union(v.null(), v.object({
    marked: v.array(v.object({ id: v.id("webRequests"), kinds: v.array(helpKind), at: v.number(), referredBy: v.union(v.string(), v.null()) })),
    shared: v.array(v.object({ id: v.id("webFlags"), hash: v.string(), teams: v.number(), at: v.number() })),
  })),
  handler: async (ctx, { churchId }) => {
    const member = await neighborAccess(ctx, churchId);
    if (member.role !== "owner") return null;
    const marked = await ctx.db.query("webRequests").withIndex("by_church_not_genuine", (q) => q.eq("churchId", churchId).gt("notGenuineAt", 0)).order("desc").take(50);
    const flags = (await ctx.db.query("webFlags").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(200)).filter((flag) => !flag.decided);
    const shared = [];
    for (const flag of flags) {
      const review = await ctx.db.query("webReviews").withIndex("by_contact", (q) => q.eq("contactHash", flag.contactHash)).unique();
      if (review && !review.settled && review.teams >= 2) shared.push({ id: flag._id, hash: flag.contactHash.slice(0, 8), teams: review.teams, at: review.at });
    }
    return {
      marked: marked.map((row) => ({ id: row._id, kinds: row.kinds ?? [row.kind], at: row.notGenuineAt ?? row.createdAt, referredBy: row.referredBy ?? null })),
      shared: shared.sort((a, b) => b.at - a.at),
    };
  },
});

/** The number of teams still marking a contact, written back to its shared case (settled under two). */
async function recount(ctx: MutationCtx, contactHash: string) {
  const left = (await ctx.db.query("webFlags").withIndex("by_contact", (q) => q.eq("contactHash", contactHash)).take(50)).length;
  const review = await ctx.db.query("webReviews").withIndex("by_contact", (q) => q.eq("contactHash", contactHash)).unique();
  if (review) await ctx.db.patch("webReviews", review._id, left >= 2 ? { teams: left } : { teams: left, settled: true });
}
async function unflag(ctx: MutationCtx, churchId: Id<"churches">, contactHash: string) {
  const flag = await ctx.db.query("webFlags").withIndex("by_contact", (q) => q.eq("contactHash", contactHash).eq("churchId", churchId)).unique();
  if (flag) await ctx.db.delete("webFlags", flag._id);
  await recount(ctx, contactHash);
}

/** One of the team's own requests: "Genuine" takes back the mark and the blocks it made. The request stays closed. */
export const decideMarked = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests"), genuine: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId, genuine }) => {
    const member = await ownerOf(ctx, churchId);
    const request = await ctx.db.get("webRequests", requestId);
    if (!request || request.churchId !== churchId || request.notGenuineAt === undefined) throw new ConvexError("That request is not waiting for a review.");
    if (genuine) {
      for (const hash of [request.contactHash, request.phoneHash, request.ipHash]) {
        if (!hash) continue;
        const made = await ctx.db.query("webBlocks").withIndex("by_church_hash", (q) => q.eq("churchId", churchId).eq("hash", hash)).take(20);
        for (const row of made) if (row.at === request.notGenuineAt) await ctx.db.delete("webBlocks", row._id);
      }
      await unflag(ctx, churchId, request.contactHash);
    }
    // Either way it leaves the list: "Not genuine" keeps the mark and the blocks as they are.
    await ctx.db.patch("webRequests", requestId, { notGenuineAt: undefined });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: genuine ? "intake.review_genuine" : "intake.review_kept", targetId: requestId, at: Date.now() });
    return null;
  },
});

/** A shared case this team is part of: "Genuine" takes back this team's own mark and blocks on that contact; "Not genuine" keeps them. */
export const decideShared = mutation({
  args: { churchId: v.id("churches"), flagId: v.id("webFlags"), genuine: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { churchId, flagId, genuine }) => {
    const member = await ownerOf(ctx, churchId);
    const flag = await ctx.db.get("webFlags", flagId);
    if (!flag || flag.churchId !== churchId) throw new ConvexError("That case is not waiting for a review.");
    if (genuine) {
      const made = await ctx.db.query("webBlocks").withIndex("by_church_hash", (q) => q.eq("churchId", churchId).eq("hash", flag.contactHash)).take(20);
      for (const row of made) await ctx.db.delete("webBlocks", row._id);
      await unflag(ctx, churchId, flag.contactHash);
    } else await ctx.db.patch("webFlags", flagId, { decided: true });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: genuine ? "intake.shared_genuine" : "intake.shared_kept", targetId: flagId, at: Date.now() });
    return null;
  },
});
