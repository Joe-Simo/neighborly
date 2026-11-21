import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import { type MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./functions";
import { membership } from "./access";

/**
 * Closing a conference for good. An owner only, never the sample, and only after typing its name.
 * Nothing is kept: every row that belongs to the conference is deleted, in pages, and the conference last.
 * The members' places, the invitations and the calendar addresses go in the first step, so the door is
 * shut for everyone before the rest is swept. No audit line is left, because nothing is.
 */
const PAGE = 400;
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Every table that holds a conference's rows, in the order they are swept. The test holds this against the schema. */
export const swept = [
  "memberships", "invitations", "calendarFeeds",
  "webRequests", "webBlocks", "webFlags", "webPartners", "aiReads", "requestDrafts", "calls", "neighborNotes", "visits", "ledgerEntries", "voucherStock", "assistanceRequests", "duplicatePairs", "duplicateDismissals", "neighbors",
  "files", "referralAgencies", "payees", "deposits", "ledgerKinds", "bankStatements",
  "outbox", "meetingResponses", "meetingInvitees", "meetings", "requests", "commitmentHistory", "commitments", "series",
  "teamMembers", "teams", "availability", "timeOff", "tasks", "announcements", "aiUsageByChurch", "knownNames", "auditEvents", "councilLinks", "yearRollups",
] as const satisfies readonly TableNames[];
type Swept = (typeof swept)[number];

/** Up to `limit` of one table's rows for this conference. Two tables have no index by conference and are reached through their parent. */
async function rows<Table extends Swept>(ctx: MutationCtx, table: Table, churchId: Id<"churches">, limit: number): Promise<{ _id: Id<Table> }[]>;
async function rows(ctx: MutationCtx, table: Swept, churchId: Id<"churches">, limit: number) {
  switch (table) {
    case "aiUsageByChurch":
      return ctx.db.query(table).withIndex("by_church_month", (q) => q.eq("churchId", churchId)).take(limit);
    case "ledgerKinds":
      return ctx.db.query(table).withIndex("by_church_key", (q) => q.eq("churchId", churchId)).take(limit);
    case "yearRollups":
      return ctx.db.query(table).withIndex("by_church_year", (q) => q.eq("churchId", churchId)).take(limit);
    case "webRequests":
      return ctx.db.query(table).withIndex("by_church_stage", (q) => q.eq("churchId", churchId)).take(limit);
    case "webFlags":
    case "webPartners":
      return ctx.db.query(table).withIndex("by_church", (q) => q.eq("churchId", churchId)).take(limit);
    case "webBlocks":
      return ctx.db.query(table).withIndex("by_church_hash", (q) => q.eq("churchId", churchId)).take(limit);
    case "memberships":
      return ctx.db.query(table).withIndex("by_church", (q) => q.eq("churchId", churchId)).take(limit);
    case "commitmentHistory": {
      const found = [];
      for (const parent of await ctx.db.query("commitments").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(limit)) {
        if (found.length >= limit) break;
        found.push(...(await ctx.db.query(table).withIndex("by_commitment", (q) => q.eq("commitmentId", parent._id)).take(limit - found.length)));
      }
      return found;
    }
    case "meetingInvitees": {
      const found = [];
      for (const parent of await ctx.db.query("meetings").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(limit)) {
        if (found.length >= limit) break;
        found.push(...(await ctx.db.query(table).withIndex("by_meeting_member", (q) => q.eq("meetingId", parent._id)).take(limit - found.length)));
      }
      return found;
    }
    default:
      return ctx.db.query(table).withIndex("by_church", (q) => q.eq("churchId", churchId)).take(limit);
  }
}

/** Deletes up to a page of the conference's rows, table by table. True once nothing is left but the conference itself. */
async function sweepPage(ctx: MutationCtx, churchId: Id<"churches">, tables: readonly Swept[]) {
  let left = PAGE;
  for (const table of tables) {
    const found = await rows(ctx, table, churchId, left);
    for (const row of found) {
      // An uploaded file's stored bytes go with its row.
      if (table === "files") {
        const file = await ctx.db.get("files", row._id as Id<"files">);
        if (file) await ctx.storage.delete(file.storageId);
      }
      await ctx.db.delete(table, row._id);
    }
    left -= found.length;
    // A full page may hide more of the same table, so the next step starts here again.
    if (left <= 0) return false;
  }
  return true;
}

export const close = mutation({
  args: { churchId: v.id("churches"), typedName: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, typedName }) => {
    const member = await membership(ctx, churchId);
    if (member.role !== "owner") throw new ConvexError("Only an owner can close a conference.");
    const church = await ctx.db.get("churches", churchId);
    if (!church) throw new ConvexError("Workspace access required.");
    if (church.sample) throw new ConvexError("The sample conference cannot be closed. It is put back fresh every night.");
    if (nameKey(typedName) !== nameKey(church.name)) throw new ConvexError("Type the conference’s name as it is written.");
    // The door first: with no place, invitation or calendar address left, nobody can read or add a row while the rest goes.
    await sweepPage(ctx, churchId, swept.slice(0, 3));
    await ctx.scheduler.runAfter(0, internal.closing.sweep, { churchId });
    return null;
  },
});

export const sweep = internalMutation({
  args: { churchId: v.id("churches") },
  returns: v.null(),
  handler: async (ctx, { churchId }) => {
    const church = await ctx.db.get("churches", churchId);
    if (!church || church.sample) return null;
    if (await sweepPage(ctx, churchId, swept)) await ctx.db.delete("churches", churchId);
    else await ctx.scheduler.runAfter(0, internal.closing.sweep, { churchId });
    return null;
  },
});
