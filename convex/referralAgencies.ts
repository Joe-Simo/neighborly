import { ConvexError, v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import { mutation } from "./functions";
import type { Id } from "./_generated/dataModel";
import { neighborAccess } from "./access";
import { nameKey } from "./assistance";

/**
 * The places a group refers neighbors to, kept by hand: the way ServWare lets a conference keep its own local
 * referral agencies. Coordinators and owners only, through the same gate as every neighbor record. Each refusal
 * says exactly what was wrong, and refusals-es.ts says it in Spanish.
 */
const agency = v.object({ id: v.id("referralAgencies"), name: v.string(), phone: v.string(), helpsWith: v.string() });
const fields = { name: v.string(), phone: v.string(), helpsWith: v.string() };
const most = 200;

function cleaned(args: { name: string; phone: string; helpsWith: string }) {
  const name = args.name.trim(), phone = args.phone.trim(), helpsWith = args.helpsWith.trim();
  if (!name) throw new ConvexError("An agency needs a name.");
  if (name.length > 120) throw new ConvexError("An agency's name can be at most 120 characters.");
  if (phone.length > 40) throw new ConvexError("An agency's phone number can be at most 40 characters.");
  if (helpsWith.length > 300) throw new ConvexError("What an agency helps with can be at most 300 characters.");
  return { name, phone, helpsWith };
}

async function nameTaken(ctx: MutationCtx, churchId: Id<"churches">, name: string, except?: Id<"referralAgencies">) {
  const rows = await ctx.db.query("referralAgencies").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(most);
  return rows.some((row) => row._id !== except && nameKey(row.name) === nameKey(name));
}

/** The whole list, by name, for the room that keeps it. */
export const list = query({
  args: { churchId: v.id("churches") },
  returns: v.array(agency),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const rows = await ctx.db.query("referralAgencies").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(most);
    return rows.map((row) => ({ id: row._id, name: row.name, phone: row.phone, helpsWith: row.helpsWith }));
  },
});

export const add = mutation({
  args: { churchId: v.id("churches"), ...fields },
  returns: v.id("referralAgencies"),
  handler: async (ctx, { churchId, ...rest }) => {
    const member = await neighborAccess(ctx, churchId);
    const row = cleaned(rest);
    const count = (await ctx.db.query("referralAgencies").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(most)).length;
    if (count >= most) throw new ConvexError("The list holds 200 agencies; remove one first.");
    if (await nameTaken(ctx, churchId, row.name)) throw new ConvexError(`${row.name} is already on the list of agencies.`);
    const id = await ctx.db.insert("referralAgencies", { churchId, ...row });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "referral_agency_added", targetId: id, at: Date.now() });
    return id;
  },
});

export const edit = mutation({
  args: { churchId: v.id("churches"), id: v.id("referralAgencies"), ...fields },
  returns: v.null(),
  handler: async (ctx, { churchId, id, ...rest }) => {
    const member = await neighborAccess(ctx, churchId);
    const found = await ctx.db.get(id);
    if (!found || found.churchId !== churchId) throw new ConvexError("That agency was not found.");
    const row = cleaned(rest);
    if (await nameTaken(ctx, churchId, row.name, id)) throw new ConvexError(`${row.name} is already on the list of agencies.`);
    await ctx.db.patch(id, row);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "referral_agency_edited", targetId: id, at: Date.now() });
    return null;
  },
});

/** Takes the agency off the list. Requests that already named it keep the name they were written with. */
export const remove = mutation({
  args: { churchId: v.id("churches"), id: v.id("referralAgencies") },
  returns: v.null(),
  handler: async (ctx, { churchId, id }) => {
    const member = await neighborAccess(ctx, churchId);
    const found = await ctx.db.get(id);
    if (!found || found.churchId !== churchId) throw new ConvexError("That agency was not found.");
    await ctx.db.delete(id);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "referral_agency_removed", targetId: id, at: Date.now() });
    return null;
  },
});
