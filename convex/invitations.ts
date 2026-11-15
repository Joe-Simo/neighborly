import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { enqueueInvitation, resend } from "./notifications";
import type { EmailId } from "@convex-dev/resend";

const role = v.union(v.literal("member"), v.literal("coordinator"));
const delivery = v.union(v.literal("not_sent"), v.literal("queued"));
const created = v.object({ invitationId: v.id("invitations"), token: v.union(v.string(), v.null()), delivery });
const normalizeEmail = (value: string) => value.trim().toLowerCase();
async function account(ctx: MutationCtx) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Sign in required.");
  const email = await ctx.runQuery(components.authEmail.verifiedEmails.getPrimaryEmail, { userId: id });
  if (!email) throw new Error("A verified email is required.");
  return { id, email: normalizeEmail(email) };
}
async function coordinator(ctx: MutationCtx, churchId: Id<"churches">, userId: Id<"users">) {
  const member = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", churchId).eq("userId", userId)).unique();
  if (!member?.active || member.role !== "owner") throw new Error("Church owner access required.");
  return member;
}
async function digest(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

/** A token is returned once for manual delivery. No email is sent. */
export const create = action({
  args: { churchId: v.id("churches"), email: v.string(), role, requestId: v.string() },
  returns: created,
  handler: async (ctx, args): Promise<{ invitationId: Id<"invitations">; token: string | null; delivery: "not_sent" | "queued" }> => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    const result = await ctx.runMutation(internal.invitations.createRecord, { ...args, tokenHash: await digest(token), token });
    return { invitationId: result.invitationId, token: result.created ? token : null, delivery: result.delivery };
  },
});
export const createRecord = internalMutation({
  args: { churchId: v.id("churches"), email: v.string(), role, requestId: v.string(), tokenHash: v.string(), token: v.string() },
  returns: v.object({ invitationId: v.id("invitations"), created: v.boolean(), delivery }),
  handler: async (ctx, args) => {
    const user = await account(ctx);
    const actor = await coordinator(ctx, args.churchId, user.id);
    const email = normalizeEmail(args.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(args.requestId)) throw new Error("Invalid request identifier.");
    const prior = await ctx.db.query("invitations").withIndex("by_church_request", q => q.eq("churchId", args.churchId).eq("requestId", args.requestId)).unique();
    if (prior) {
      if (prior.email !== email || prior.role !== args.role || prior.createdBy !== actor._id) throw new Error("Request identifier already used.");
      const outbox = await ctx.db.query("outbox").withIndex("by_invitation", q => q.eq("invitationId", prior._id)).unique();
      return { invitationId: prior._id, created: false, delivery: outbox?.state === "queued" ? "queued" as const : "not_sent" as const };
    }
    const now = Date.now();
    const invitationId = await ctx.db.insert("invitations", { churchId: args.churchId, email, role: args.role, tokenHash: args.tokenHash, expiresAt: now + 7 * 24 * 60 * 60 * 1000, status: "pending", createdBy: actor._id, createdAt: now, requestId: args.requestId });
    await ctx.db.insert("outbox", { churchId: args.churchId, invitationId, kind: "invitation", recipient: email, state: "awaiting_configuration", createdAt: now });
    await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: user.id, action: "invitation_created", invitationId, at: now });
    const invitation = await ctx.db.get("invitations", invitationId);
    if (!invitation) throw new Error("Invitation not found.");
    return { invitationId, created: true, delivery: await enqueueInvitation(ctx, invitation, args.token) };
  },
});
export const accept = action({
  args: { token: v.string(), displayName: v.string() },
  returns: v.id("churches"),
  handler: async (ctx, args): Promise<Id<"churches">> => {
    if (!/^[0-9a-f]{64}$/.test(args.token)) throw new Error("Invitation is invalid or expired.");
    return ctx.runMutation(internal.invitations.acceptRecord, { tokenHash: await digest(args.token), displayName: args.displayName });
  },
});
/** Retry enqueue after sender configuration using the retained private invitation token. */
export const queueEmail = action({
  args: { invitationId: v.id("invitations"), token: v.string() }, returns: delivery,
  handler: async (ctx, args): Promise<"not_sent" | "queued"> => {
    if (!/^[0-9a-f]{64}$/.test(args.token)) throw new Error("Invitation is invalid or expired.");
    return ctx.runMutation(internal.invitations.queueRecord, { ...args, tokenHash: await digest(args.token) });
  },
});
export const queueRecord = internalMutation({
  args: { invitationId: v.id("invitations"), token: v.string(), tokenHash: v.string() }, returns: delivery,
  handler: async (ctx, args) => {
    const user = await account(ctx);
    const invite = await ctx.db.get("invitations", args.invitationId);
    if (!invite) throw new Error("Invitation not found.");
    await coordinator(ctx, invite.churchId, user.id);
    if (invite.tokenHash !== args.tokenHash || invite.status !== "pending" || invite.expiresAt <= Date.now()) throw new Error("Invitation is invalid or expired.");
    return enqueueInvitation(ctx, invite, args.token);
  },
});
export const acceptRecord = internalMutation({
  args: { tokenHash: v.string(), displayName: v.string() }, returns: v.id("churches"),
  handler: async (ctx, args) => {
    const user = await account(ctx);
    const invite = await ctx.db.query("invitations").withIndex("by_token", q => q.eq("tokenHash", args.tokenHash)).unique();
    if (!invite || invite.email !== user.email || invite.status === "revoked") throw new Error("Invitation is invalid or expired.");
    if (invite.status === "accepted") {
      if (invite.acceptedBy === user.id) return invite.churchId;
      throw new Error("Invitation is invalid or expired.");
    }
    if (invite.expiresAt <= Date.now()) throw new Error("Invitation is invalid or expired.");
    const name = args.displayName.trim();
    if (!name || name.length > 200) throw new Error("Enter a valid name.");
    const existing = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", invite.churchId).eq("userId", user.id)).unique();
    if (existing && !existing.active) throw new Error("Contact the church coordinator to restore access.");
    if (!existing) await ctx.db.insert("memberships", { churchId: invite.churchId, userId: user.id, name, email: user.email, role: invite.role, active: true, approved: false, coverOptIn: false });
    await ctx.db.patch("invitations", invite._id, { status: "accepted", acceptedBy: user.id });
    await ctx.db.insert("auditEvents", { churchId: invite.churchId, actorId: user.id, action: "invitation_accepted", invitationId: invite._id, at: Date.now() });
    return invite.churchId;
  },
});
export const revoke = mutation({
  args: { invitationId: v.id("invitations") }, returns: v.null(),
  handler: async (ctx, args) => {
    const user = await account(ctx);
    const invite = await ctx.db.get("invitations", args.invitationId);
    if (!invite) throw new Error("Invitation not found.");
    await coordinator(ctx, invite.churchId, user.id);
    if (invite.status === "accepted") throw new Error("An accepted invitation cannot be revoked.");
    if (invite.status === "revoked") return null;
    const outbox = await ctx.db.query("outbox").withIndex("by_invitation", q => q.eq("invitationId", invite._id)).unique();
    if (outbox?.providerId) {
      const emailId = outbox.providerId as EmailId;
      const status = await resend.status(ctx, emailId);
      if (status?.status === "waiting" || status?.status === "queued") await resend.cancelEmail(ctx, emailId);
    }
    await ctx.db.patch("invitations", invite._id, { status: "revoked" });
    await ctx.db.insert("auditEvents", { churchId: invite.churchId, actorId: user.id, action: "invitation_revoked", invitationId: invite._id, at: Date.now() });
    return null;
  },
});
