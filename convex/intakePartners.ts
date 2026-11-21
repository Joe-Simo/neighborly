import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { neighborAccess } from "./access";
import { LIMITS, bump, sendCode } from "./intake";

/**
 * A team's partners (a shelter, a parish office). The link only names the partner: opening it sends a code to the
 * partner's own confirmed email, and the device is remembered for 30 days (a hashed cookie). A forwarded link alone
 * sends nothing anywhere but that mailbox. Each partner has its own limit (10 a day), the team can revoke it or issue
 * a new link in one tap, and every request it sends carries the partner.
 */
const DAY = 86_400_000;
const SESSION_DAYS = 30;

export const list = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({ id: v.id("webPartners"), name: v.string(), email: v.string(), language: v.union(v.literal("en"), v.literal("es")), active: v.boolean() })),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const rows = await ctx.db.query("webPartners").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(100);
    return rows.map((row) => ({ id: row._id, name: row.name, email: row.email, language: row.language ?? "en", active: row.active }));
  },
});

/** Called by intakeActions.createPartner, which makes the link (an action has real randomness); auth passes through. */
export const add = internalMutation({
  args: { churchId: v.id("churches"), name: v.string(), email: v.string(), language: v.optional(v.union(v.literal("en"), v.literal("es"))), linkHash: v.string() },
  returns: v.id("webPartners"),
  handler: async (ctx, { churchId, name, email, language, linkHash }) => {
    const member = await neighborAccess(ctx, churchId);
    const named = name.replace(/\s+/g, " ").trim();
    const address = email.trim().toLowerCase();
    if (!named || named.length > 80) throw new ConvexError("Give the partner a name.");
    if (address.length > 254 || !/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(address)) throw new ConvexError("Check the email address.");
    const id = await ctx.db.insert("webPartners", { churchId, name: named, email: address, language: language ?? "en", linkHash, active: true, createdBy: member._id, createdAt: Date.now() });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.partner_added", targetId: id, at: Date.now() });
    return id;
  },
});
/** A new link for a partner: the old one stops, and every signed-in device signs in again. */
export const relink = internalMutation({
  args: { churchId: v.id("churches"), partnerId: v.id("webPartners"), linkHash: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, partnerId, linkHash }) => {
    const member = await neighborAccess(ctx, churchId);
    const partner = await ctx.db.get("webPartners", partnerId);
    if (!partner || partner.churchId !== churchId) throw new ConvexError("Partner not found.");
    await ctx.db.patch("webPartners", partnerId, { linkHash, active: true });
    for (const session of await ctx.db.query("webPartnerSessions").withIndex("by_partner", (q) => q.eq("partnerId", partnerId)).take(200)) await ctx.db.delete("webPartnerSessions", session._id);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.partner_relinked", targetId: partnerId, at: Date.now() });
    return null;
  },
});
export const revoke = mutation({
  args: { churchId: v.id("churches"), partnerId: v.id("webPartners") },
  returns: v.null(),
  handler: async (ctx, { churchId, partnerId }) => {
    const member = await neighborAccess(ctx, churchId);
    const partner = await ctx.db.get("webPartners", partnerId);
    if (!partner || partner.churchId !== churchId) throw new ConvexError("Partner not found.");
    await ctx.db.patch("webPartners", partnerId, { active: false });
    for (const session of await ctx.db.query("webPartnerSessions").withIndex("by_partner", (q) => q.eq("partnerId", partnerId)).take(200)) await ctx.db.delete("webPartnerSessions", session._id);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.partner_revoked", targetId: partnerId, at: Date.now() });
    return null;
  },
});

const masked = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, "$1•••$2");

/** Opening a partner link: a code to the partner's email (5 a day). Answers the masked address, or null for a dead link. */
export const startSignIn = internalMutation({
  args: { linkHash: v.string(), codeHash: v.string(), code: v.string(), link: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { linkHash, codeHash, code, link }) => {
    const partner = await ctx.db.query("webPartners").withIndex("by_link", (q) => q.eq("linkHash", linkHash)).unique();
    if (!partner?.active) return null;
    const now = Date.now();
    if (await bump(ctx, `partner-code:${partner._id}`, DAY, LIMITS.partnerCodesPerDay, now)) {
      for (const old of await ctx.db.query("webPartnerCodes").withIndex("by_partner", (q) => q.eq("partnerId", partner._id)).take(20)) await ctx.db.delete("webPartnerCodes", old._id);
      await ctx.db.insert("webPartnerCodes", { partnerId: partner._id, codeHash, tries: 0, expiresAt: now + DAY });
      await sendCode(ctx, undefined, partner.churchId, { by: "email", to: partner.email }, partner.language ?? "en", code, link, now);
    }
    return masked(partner.email);
  },
});
export const finishSignIn = internalMutation({
  args: { linkHash: v.string(), codeHash: v.string(), sessionHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { linkHash, codeHash, sessionHash }) => {
    const partner = await ctx.db.query("webPartners").withIndex("by_link", (q) => q.eq("linkHash", linkHash)).unique();
    if (!partner?.active) return false;
    const waiting = await ctx.db.query("webPartnerCodes").withIndex("by_partner", (q) => q.eq("partnerId", partner._id)).first();
    if (!waiting || waiting.expiresAt < Date.now() || waiting.tries >= LIMITS.codeTries) return false;
    if (waiting.codeHash !== codeHash) {
      await ctx.db.patch("webPartnerCodes", waiting._id, { tries: waiting.tries + 1 });
      return false;
    }
    await ctx.db.delete("webPartnerCodes", waiting._id);
    await ctx.db.insert("webPartnerSessions", { partnerId: partner._id, sessionHash, expiresAt: Date.now() + SESSION_DAYS * DAY });
    return true;
  },
});
/** The partner a signed-in device speaks for, only through its own current link. */
export const signedIn = internalQuery({
  args: { linkHash: v.string(), sessionHash: v.string() },
  returns: v.union(v.null(), v.id("webPartners")),
  handler: async (ctx, { linkHash, sessionHash }) => {
    const session = await ctx.db.query("webPartnerSessions").withIndex("by_session", (q) => q.eq("sessionHash", sessionHash)).unique();
    if (!session || session.expiresAt < Date.now()) return null;
    const partner = await ctx.db.get("webPartners", session.partnerId);
    return partner?.active && partner.linkHash === linkHash ? partner._id : null;
  },
});
