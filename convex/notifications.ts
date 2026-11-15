import { user } from "./access";
import { Resend, vStatus, type EmailId } from "@convex-dev/resend";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Real delivery requires an explicit deployment switch and verified sender configuration.
export const resend = new Resend(components.resend, { testMode: false });
/** Sender readiness for user-requested account emails, independent of group notifications. */
export function accountEmailConfiguration() {
  const site = process.env.SITE_URL;
  const sender = process.env.SENDER_EMAIL;
  if (!process.env.RESEND_API_KEY || !sender || !site) return null;
  try {
    const url = new URL(site);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return { site: url.origin, sender };
  } catch { return null; }
}

export function deliveryConfiguration() {
  if (process.env.EMAIL_DELIVERY_ENABLED !== "true") return null;
  return accountEmailConfiguration();
}

/** Enqueue atomically with the outbox record; the provider owns retries and deduplication. */
export async function enqueueInvitation(ctx: MutationCtx, invitation: Doc<"invitations">, token: string) {
  const outbox = await ctx.db.query("outbox").withIndex("by_invitation", q => q.eq("invitationId", invitation._id)).unique();
  if (!outbox) throw new Error("Delivery record not found.");
  if (outbox.providerId) return "queued" as const;
  const config = deliveryConfiguration();
  if (!config) return "not_sent" as const;
  const link = new URL("/app", config.site);
  link.searchParams.set("invite", token);
  const emailId = await resend.sendEmail(ctx, { from: config.sender, to: invitation.email, subject: "You have been invited to Kind Helps", text: `You have been invited to join a church on Kind Helps. Open this private link to review and accept the invitation:\n\n${link.toString()}\n\nThis invitation expires after seven days.`, idempotencyKey: `invitation:${invitation._id}` });
  await ctx.db.patch("outbox", outbox._id, { state: "queued", providerId: emailId });
  return "queued" as const;
}

export const invitationDelivery = query({
  args: { invitationId: v.id("invitations") },
  returns: v.object({ state: v.union(v.literal("awaiting_configuration"), v.literal("queued"), v.literal("cancelled")), providerStatus: v.union(vStatus, v.null()), failed: v.boolean() }),
  handler: async (ctx, args) => {
    const { id: userId } = await user(ctx);
    const invitation = await ctx.db.get("invitations", args.invitationId);
    if (!invitation) throw new Error("Invitation not found.");
    const member = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", invitation.churchId).eq("userId", userId)).unique();
    if (!member?.active || member.role !== "owner") throw new Error("Church owner access required.");
    const record = await ctx.db.query("outbox").withIndex("by_invitation", q => q.eq("invitationId", invitation._id)).unique();
    if (!record) throw new Error("Delivery record not found.");
    const status = record.providerId ? await resend.status(ctx, record.providerId as EmailId) : null;
    return { state: record.state, providerStatus: status?.status ?? null, failed: status?.failed ?? false };
  },
});
