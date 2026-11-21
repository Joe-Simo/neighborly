import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./functions";
import type { Id } from "./_generated/dataModel";
import { mayOpenNeighborRecords, neighborAccess } from "./access";
import { deliveryConfiguration, resend } from "./notifications";
import { isSampleChurch } from "./demo";
import { emailLanguage, paperEmail } from "../src/lib/email/paper-email";

/**
 * "2 new requests for help": an email to a team's owners and coordinators when requests reach its Help line (from the
 * web form, a partner, the unverified door, a coordinator letting held ones in, or another team passing one on). The
 * first one starts a 15-minute wait; everything that lands meanwhile joins the same email, so a team gets at most one
 * every 15 minutes. Counts and a link only: never a name, words, contact or place.
 */
const BATCH_MS = 15 * 60 * 1000;

export async function noteLanded(ctx: MutationCtx, churchId: Id<"churches">, now: number) {
  const waiting = await ctx.db.query("webNotices").withIndex("by_church", (q) => q.eq("churchId", churchId)).unique();
  if (waiting) {
    await ctx.db.patch("webNotices", waiting._id, { count: waiting.count + 1 });
    return;
  }
  await ctx.db.insert("webNotices", { churchId, count: 1, since: now });
  await ctx.scheduler.runAfter(BATCH_MS, internal.intakeNotify.flush, { churchId });
}

/** Sends the waiting count to everyone who may open the Help line and has not turned the email off, each in their language. */
export const flush = internalMutation({
  args: { churchId: v.id("churches") },
  returns: v.null(),
  handler: async (ctx, { churchId }) => {
    const waiting = await ctx.db.query("webNotices").withIndex("by_church", (q) => q.eq("churchId", churchId)).unique();
    if (!waiting) return null;
    await ctx.db.delete("webNotices", waiting._id);
    const church = await ctx.db.get("churches", churchId);
    if (!church || (await isSampleChurch(ctx, churchId))) return null;
    const members = await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(500);
    const to = members.filter((member) => !member.removedAt && mayOpenNeighborRecords(member) && member.email && member.newRequestEmail !== false);
    // Nothing goes out unless EMAIL_DELIVERY_ENABLED is "true" (deliveryConfiguration); the outbox row says so.
    const config = deliveryConfiguration();
    for (const member of to) {
      const eventKey = `intake_new:${member._id}:${waiting._id}`;
      const outboxId = await ctx.db.insert("outbox", { churchId, memberId: member._id, eventKey, kind: "intake_new", recipient: member.email, state: "awaiting_configuration", createdAt: Date.now() });
      if (!config) continue;
      const email = paperEmail({ kind: "intake_new", language: emailLanguage(member.language), set: church.wordSet ?? "general", place: church.name, link: new URL("/app/help-line", config.site).toString(), count: waiting.count });
      const providerId = await resend.sendEmail(ctx, { from: config.sender, to: member.email, ...email, idempotencyKey: eventKey });
      await ctx.db.patch("outbox", outboxId, { state: "queued", providerId });
    }
    return null;
  },
});

/** This person's own choice: the email about new web requests, on (the default) or off. */
export const setNewRequestEmail = mutation({
  args: { churchId: v.id("churches"), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { churchId, on }) => {
    const member = await neighborAccess(ctx, churchId);
    await ctx.db.patch("memberships", member._id, { newRequestEmail: on ? undefined : false });
    return null;
  },
});
