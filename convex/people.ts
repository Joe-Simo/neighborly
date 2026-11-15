import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { membership } from "./access";
import { cancelPendingNotification } from "./notificationEvents";

/** The name left on the work a removed person did, so the year's counts still add up. */
export const formerMember = "A former member";
const MOST = 500;

/**
 * Removes a person from a conference for good. Their name, address, language and sign-in link go;
 * the membership row stays as "A former member" so visits, hours and decisions they logged still
 * count. Owner only, never the owner themself, and only when the owner has typed the person's name.
 * What a mutation can reach by index goes at once; the rest of the conference is swept right after.
 */
export const remove = mutation({
  args: { churchId: v.id("churches"), personId: v.id("memberships"), typedName: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, personId, typedName }) => {
    const me = await membership(ctx, churchId);
    if (me.role !== "owner") throw new ConvexError("Only the owner can remove a person.");
    const person = await ctx.db.get("memberships", personId);
    if (!person || person.churchId !== churchId || person.removedAt) throw new ConvexError("This person is not in the conference.");
    if (person._id === me._id || person.role === "owner") throw new ConvexError("The owner cannot be removed.");
    if (typedName.trim().toLowerCase() !== person.name.trim().toLowerCase()) throw new ConvexError("Type the person’s name exactly to remove them.");
    const now = Date.now();
    const all = async <Row>(rows: Promise<Row[]>) => {
      const found = await rows;
      if (found.length > MOST) throw new ConvexError("This person has too many records to remove at once. Please write to us.");
      return found;
    };

    // Their places and plans: gone.
    for (const row of await all(ctx.db.query("teamMembers").withIndex("by_member", (q) => q.eq("memberId", personId)).take(MOST + 1))) await ctx.db.delete("teamMembers", row._id);
    for (const row of await all(ctx.db.query("availability").withIndex("by_member", (q) => q.eq("memberId", personId)).take(MOST + 1))) await ctx.db.delete("availability", row._id);
    for (const row of await all(ctx.db.query("timeOff").withIndex("by_member", (q) => q.eq("memberId", personId)).take(MOST + 1))) await ctx.db.delete("timeOff", row._id);
    for (const row of await all(ctx.db.query("meetingInvitees").withIndex("by_member", (q) => q.eq("memberId", personId)).take(MOST + 1))) await ctx.db.delete("meetingInvitees", row._id);
    for (const row of await all(ctx.db.query("calendarFeeds").withIndex("by_member", (q) => q.eq("memberId", personId)).take(MOST + 1))) await ctx.db.delete("calendarFeeds", row._id);
    // Requests still waiting on their yes are withdrawn, and the message is stopped if it has not left.
    for (const request of await all(ctx.db.query("requests").withIndex("by_recipient_status", (q) => q.eq("recipientId", personId).eq("status", "pending")).take(MOST + 1))) {
      await ctx.db.patch("requests", request._id, { status: "withdrawn" });
      await cancelPendingNotification(ctx, churchId, `cover:${request._id}`);
    }
    // What they had promised to do from now on is open again.
    for (const slot of await all(ctx.db.query("commitments").withIndex("by_assignee_end", (q) => q.eq("assigneeId", personId).gt("end", now)).take(MOST + 1))) {
      if (!slot.cancelled) await ctx.db.patch("commitments", slot._id, { assigneeId: null, version: slot.version + 1 });
    }
    // Invitations sent to their address carry the address, so they go too, with any message queued for them.
    const invitations = await ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(2001);
    if (invitations.length > 2000) throw new ConvexError("This conference has too many invitations to search at once. Please write to us.");
    for (const invitation of invitations) {
      if (invitation.email !== person.email.trim().toLowerCase() && invitation.email !== person.email) continue;
      for (const message of await ctx.db.query("outbox").withIndex("by_invitation", (q) => q.eq("invitationId", invitation._id)).take(20)) await ctx.db.delete("outbox", message._id);
      await ctx.db.delete("invitations", invitation._id);
    }

    // The row that remains says nothing about who they were and no longer leads to their account.
    const nobody = await ctx.db.insert("users", {});
    await ctx.db.patch("memberships", personId, { userId: nobody, name: formerMember, email: "", role: "member", active: false, approved: false, coverOptIn: false, language: undefined, removedAt: now });
    await ctx.db.insert("auditEvents", { churchId, actorId: me.userId, action: "removePerson", targetId: personId, at: now });
    await ctx.scheduler.runAfter(0, internal.people.sweep, { churchId, personId, was: person.userId, nobody, stage: "outbox", cursor: null });
    return null;
  },
});

const stages = ["outbox", "responses", "tasks", "audit", "history"] as const;
/**
 * The tables that can only be read a page at a time: messages addressed to them, their meeting
 * answers, tasks still theirs, and who-did-what lines, which are moved from their account to nobody's.
 */
export const sweep = internalMutation({
  args: { churchId: v.id("churches"), personId: v.id("memberships"), was: v.id("users"), nobody: v.id("users"), stage: v.union(...stages.map((stage) => v.literal(stage))), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { churchId, personId, was, nobody, stage } = args;
    const page = { cursor: args.cursor, numItems: 200 };
    let next: { isDone: boolean; continueCursor: string };
    if (stage === "outbox") {
      const rows = (next = await ctx.db.query("outbox").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page)).page;
      for (const row of rows) if (row.memberId === personId) await ctx.db.delete("outbox", row._id);
    } else if (stage === "responses") {
      const rows = (next = await ctx.db.query("meetingResponses").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page)).page;
      for (const row of rows) if (row.memberId === personId) await ctx.db.delete("meetingResponses", row._id);
    } else if (stage === "tasks") {
      const rows = (next = await ctx.db.query("tasks").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page)).page;
      for (const row of rows) if (row.assigneeId === personId && !row.complete) await ctx.db.patch("tasks", row._id, { assigneeId: null });
    } else if (stage === "audit") {
      const rows = (next = await ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page)).page;
      for (const row of rows) if (row.actorId === was) await ctx.db.patch("auditEvents", row._id, { actorId: nobody });
    } else {
      const rows = (next = await ctx.db.query("commitments").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate({ ...page, numItems: 50 })).page;
      for (const slot of rows) {
        for (const line of await ctx.db.query("commitmentHistory").withIndex("by_commitment", (q) => q.eq("commitmentId", slot._id)).take(100)) {
          if (line.actorId === was) await ctx.db.patch("commitmentHistory", line._id, { actorId: nobody });
        }
      }
    }
    const following = next.isDone ? stages[stages.indexOf(stage) + 1] : stage;
    if (following) await ctx.scheduler.runAfter(0, internal.people.sweep, { churchId, personId, was, nobody, stage: following, cursor: next.isDone ? null : next.continueCursor });
    return null;
  },
});
