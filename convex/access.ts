import { ConvexError, v } from "convex/values";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Who Clerk says is calling: their Clerk id and their email, only once Clerk has verified it.
 * Convex has already checked the token's signature against auth.config.ts before this runs.
 */
export async function verifiedIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Sign in required.");
  if (!identity.email || identity.emailVerified !== true) throw new ConvexError("A verified email is required.");
  return { clerkId: identity.subject, email: identity.email.trim().toLowerCase() };
}
/** The signed-in account. Every workspace function starts here. */
export async function user(ctx: QueryCtx | MutationCtx) {
  const { clerkId, email } = await verifiedIdentity(ctx);
  const account = await ctx.db.query("users").withIndex("by_clerk", q => q.eq("clerkId", clerkId)).unique();
  if (!account) throw new ConvexError("Sign in required.");
  return { id: account._id, email };
}
/** The caller's active membership in this group, or an error. */
export async function firstMembership(ctx: QueryCtx | MutationCtx) {
  const account = await user(ctx);
  const member = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", account.id)).filter(q => q.eq(q.field("active"), true)).first();
  if (!member) throw new ConvexError("Workspace access required.");
  return member;
}
export async function membership(ctx: QueryCtx | MutationCtx, church: Id<"churches">) {
  const account = await user(ctx);
  const member = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", church).eq("userId", account.id)).unique();
  if (!member?.active) throw new ConvexError("Workspace access required.");
  return member;
}

/**
 * The one rule for who may open a neighbor's record: the owner, or an active coordinator of the group whom the
 * owner has approved. A coordinator who has just accepted an invitation waits for that approval, so a mistyped
 * address never opens a family's file. Team coordinators and members do not qualify. Every function that reads or
 * writes neighbors, calls, assistance requests, visits or the ledger starts with neighborAccess().
 */
export function mayOpenNeighborRecords(member: Pick<Doc<"memberships">, "active" | "role" | "approved">) {
  return member.active && (member.role === "owner" || (member.role === "coordinator" && member.approved));
}
export async function neighborAccess(ctx: QueryCtx | MutationCtx, church: Id<"churches">) {
  const member = await membership(ctx, church);
  if (!mayOpenNeighborRecords(member)) throw new ConvexError("Neighbor records are open to coordinators and owners only.");
  return member;
}
/** One neighbor's record, only for a caller allowed to open it and only inside their own group. */
export async function neighborRecord(ctx: QueryCtx | MutationCtx, church: Id<"churches">, neighborId: Id<"neighbors">) {
  const member = await neighborAccess(ctx, church);
  const neighbor = await ctx.db.get("neighbors", neighborId);
  // A removed record keeps a nameless row for the year's counts (see neighbors.remove); nobody can open it.
  if (!neighbor || neighbor.churchId !== church || !neighbor.nameKey) throw new ConvexError("Record not found.");
  return { member, neighbor };
}
/**
 * Writes the audit line for opening a record and returns it. Queries cannot write, so the screen calls a
 * mutation that calls this, and every query that shows one neighbor's detail takes the returned line as
 * `opening` and checks it with `openedBy`. A read without an opening line of the caller's own is refused.
 */
export async function logNeighborOpening(ctx: MutationCtx, member: Doc<"memberships">, neighborId: Id<"neighbors">) {
  return ctx.db.insert("auditEvents", { churchId: member.churchId, actorId: member.userId, action: "neighbor.opened", targetId: neighborId, at: Date.now() });
}
/** The audit line an opening mutation returned, handed back to the query that reads what was opened. */
export const opening = v.id("auditEvents");
/** Refuses unless `line` is the caller's own audit line of `action` (on `targetId`, when given) in this group. One read. */
export async function auditedBy(ctx: QueryCtx | MutationCtx, member: Doc<"memberships">, line: Id<"auditEvents">, action: "neighbor.opened" | "records_exported", targetId?: string) {
  const event = await ctx.db.get("auditEvents", line);
  if (!event || event.churchId !== member.churchId || event.actorId !== member.userId || event.action !== action || event.targetId !== targetId) {
    throw new ConvexError(action === "records_exported" ? "Start the export again." : "Open the record again.");
  }
}
/** Refuses a read of one neighbor's detail that this caller did not open, and so write down, first. */
export function openedBy(ctx: QueryCtx | MutationCtx, member: Doc<"memberships">, neighborId: Id<"neighbors">, line: Id<"auditEvents">) {
  return auditedBy(ctx, member, line, "neighbor.opened", neighborId);
}
/**
 * The time a screen is asking about: the start of the hour on the reader's clock. A query that needs "now"
 * takes it as this argument and never reads the clock itself. Convex keeps an answer for everyone who asks
 * the same question, and a query that reads the clock loses that: it is run again and again while a page
 * sits open. With the hour as an argument, one answer serves the whole hour, or until a record changes.
 */
export const hour = v.number();
const HOUR = 3_600_000;
/**
 * The hour a query was asked about. Only a whole hour is taken, so the answers Convex keeps are one per
 * hour and never one per odd value a page might send. The hour comes from the reader's own clock: a wrong
 * one changes only what that reader is shown, never what they may open.
 */
export function hourAsked(at: number) {
  if (!Number.isInteger(at) || at % HOUR !== 0 || at < 0 || at > 8.64e15) throw new ConvexError("Reload the page to see this room.");
  return at;
}
/** For the screens: whether to offer neighbor records at all. The backend check above is the real gate. */
export const canOpenNeighborRecords = query({
  args: { churchId: v.id("churches") },
  returns: v.boolean(),
  handler: async (ctx, args) => mayOpenNeighborRecords(await membership(ctx, args.churchId)),
});
