import { getAuthUserId } from "@convex-dev/auth/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/** The signed-in account. Every workspace function starts here. */
export async function user(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Sign in required.");
  const email = await ctx.runQuery(components.authEmail.verifiedEmails.getPrimaryEmail, { userId: id });
  if (!email) throw new Error("A verified email is required.");
  return { id, email };
}
/** The caller's active membership in this group, or an error. */
export async function membership(ctx: QueryCtx | MutationCtx, church: Id<"churches">) {
  const account = await user(ctx);
  const member = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", church).eq("userId", account.id)).unique();
  if (!member?.active) throw new Error("Workspace access required.");
  return member;
}

/**
 * The one rule for who may open a neighbor's record: an active coordinator or owner of the group.
 * Team coordinators and members do not qualify. Every function that reads or writes neighbors,
 * calls, assistance requests, visits or the ledger starts with neighborAccess().
 */
export function mayOpenNeighborRecords(member: Pick<Doc<"memberships">, "active" | "role">) {
  return member.active && (member.role === "owner" || member.role === "coordinator");
}
export async function neighborAccess(ctx: QueryCtx | MutationCtx, church: Id<"churches">) {
  const member = await membership(ctx, church);
  if (!mayOpenNeighborRecords(member)) throw new Error("Neighbor records are open to coordinators and owners only.");
  return member;
}
/** One neighbor's record, only for a caller allowed to open it and only inside their own group. */
export async function neighborRecord(ctx: QueryCtx | MutationCtx, church: Id<"churches">, neighborId: Id<"neighbors">) {
  const member = await neighborAccess(ctx, church);
  const neighbor = await ctx.db.get("neighbors", neighborId);
  if (!neighbor || neighbor.churchId !== church) throw new Error("Record not found.");
  return { member, neighbor };
}
/** Writes the audit line for opening a record. Queries cannot write, so the screen calls a mutation that calls this. */
export async function logNeighborOpening(ctx: MutationCtx, member: Doc<"memberships">, neighborId: Id<"neighbors">) {
  await ctx.db.insert("auditEvents", { churchId: member.churchId, actorId: member.userId, action: "neighbor.opened", targetId: neighborId, at: Date.now() });
}
/** For the screens: whether to offer neighbor records at all. The backend check above is the real gate. */
export const canOpenNeighborRecords = query({
  args: { churchId: v.id("churches") },
  returns: v.boolean(),
  handler: async (ctx, args) => mayOpenNeighborRecords(await membership(ctx, args.churchId)),
});
