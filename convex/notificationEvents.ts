import { user } from "./access";
import { vStatus, type EmailId } from "@convex-dev/resend";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { deliveryConfiguration, resend } from "./notifications";
import { isSampleChurch } from "./demo";
import { overlapsTimeOff, parseCalendarDate } from "../src/lib/scheduling";

async function deliver(ctx: MutationCtx, row: Doc<"outbox">) {
  if (row.state !== "awaiting_configuration") return;
  const member = row.memberId ? await ctx.db.get("memberships", row.memberId) : null;
  if (!member?.active || member.churchId !== row.churchId || member.email.toLowerCase() !== row.recipient.toLowerCase()) {
    await ctx.db.patch("outbox", row._id, { state: "cancelled" }); return;
  }
  if (row.kind === "cover_request") {
    const request = row.requestId ? await ctx.db.get("requests", row.requestId) : null;
    if (!request || request.status !== "pending" || request.recipientId !== member._id || request.churchId !== row.churchId) {
      await ctx.db.patch("outbox", row._id, { state: "cancelled" }); return;
    }
    const commitment = await ctx.db.get("commitments", request.commitmentId);
    const church = await ctx.db.get("churches", row.churchId);
    const teamMember = commitment ? await ctx.db.query("teamMembers").withIndex("by_team_member", q => q.eq("teamId", commitment.teamId).eq("memberId", member._id)).unique() : null;
    let valid = Boolean(commitment && church && commitment.churchId === row.churchId && !commitment.cancelled && !commitment.assigneeId && commitment.version === request.commitmentVersion && commitment.start > Date.now() && member.approved && member.coverOptIn && teamMember?.status === "active" && teamMember.approved);
    if (valid && commitment && church) {
      const parts = new Intl.DateTimeFormat("en", { timeZone: church.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(commitment.start);
      const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
      const startDay = `${part("year")}-${part("month")}-${part("day")}`;
      let available = false;
      for await (const x of ctx.db.query("availability").withIndex("by_member_end", q => q.eq("memberId", member._id).gte("end", startDay))) {
        if (x.churchId === row.churchId && parseCalendarDate(x.start, church.timeZone).toMillis() <= commitment.start && parseCalendarDate(x.end, church.timeZone).plus({ days: 1 }).toMillis() >= commitment.end) { available = true; break; }
      }
      valid = available;
      if (valid) for await (const x of ctx.db.query("timeOff").withIndex("by_member_end", q => q.eq("memberId", member._id).gte("end", startDay))) {
        if (x.churchId === row.churchId && overlapsTimeOff(commitment.start, commitment.end, x.start, x.end, church.timeZone)) { valid = false; break; }
      }
      if (valid) for await (const x of ctx.db.query("commitments").withIndex("by_assignee_end", q => q.eq("assigneeId", member._id).gt("end", commitment.start))) {
        if (x._id !== commitment._id && x.start < commitment.end) { valid = false; break; }
      }
    }
    if (!valid) { await ctx.db.patch("outbox", row._id, { state: "cancelled" }); return; }
  } else if (row.kind === "meeting") {
    const meeting = row.meetingId ? await ctx.db.get("meetings", row.meetingId) : null;
    const invitee = meeting ? await ctx.db.query("meetingInvitees").withIndex("by_meeting_member", q => q.eq("meetingId", meeting._id).eq("memberId", member._id)).unique() : null;
    const response = meeting ? await ctx.db.query("meetingResponses").withIndex("by_meeting_member", q => q.eq("meetingId", meeting._id).eq("memberId", member._id)).unique() : null;
    if (!meeting || meeting.churchId !== row.churchId || !invitee || invitee.churchId !== row.churchId || meeting.start <= Date.now() || response) {
      await ctx.db.patch("outbox", row._id, { state: "cancelled" }); return;
    }
  } else return;
  const config = deliveryConfiguration();
  if (!config || (await isSampleChurch(ctx, row.churchId))) return;
  const subject = row.kind === "cover_request" ? "A cover request on Kind Helps" : "A meeting invitation on Kind Helps";
  const link = new URL("/app", config.site).toString();
  const text = row.kind === "cover_request" ? `A coordinator has asked if you can cover a commitment. Sign in to review and choose whether to accept:\n\n${link}` : `You have a meeting invitation. Sign in to review the details and respond:\n\n${link}`;
  const emailId = await resend.sendEmail(ctx, { from: config.sender, to: row.recipient, subject, text, idempotencyKey: `notification:${row.eventKey}` });
  await ctx.db.patch("outbox", row._id, { state: "queued", providerId: emailId });
}
async function record(ctx: MutationCtx, row: Omit<Doc<"outbox">, "_id" | "_creationTime"> & { eventKey: string }) {
  const prior = await ctx.db.query("outbox").withIndex("by_church_event", q => q.eq("churchId", row.churchId).eq("eventKey", row.eventKey)).unique();
  if (prior) return;
  const id = await ctx.db.insert("outbox", row);
  const created = await ctx.db.get("outbox", id);
  if (created) await deliver(ctx, created);
}
export async function queueCoverRequest(ctx: MutationCtx, requestId: Id<"requests">) {
  const request = await ctx.db.get("requests", requestId);
  if (!request || request.status !== "pending") throw new ConvexError("Pending request not found.");
  const member = await ctx.db.get("memberships", request.recipientId);
  if (!member || !member.active || member.churchId !== request.churchId) throw new Error("Recipient not found.");
  await record(ctx, { churchId: request.churchId, requestId, memberId: member._id, eventKey: `cover:${requestId}`, kind: "cover_request", recipient: member.email, state: "awaiting_configuration", createdAt: Date.now() });
}
export async function queueMeetingInvitation(ctx: MutationCtx, meetingId: Id<"meetings">, memberId: Id<"memberships">) {
  const meeting = await ctx.db.get("meetings", meetingId);
  const member = await ctx.db.get("memberships", memberId);
  const invitee = await ctx.db.query("meetingInvitees").withIndex("by_meeting_member", q => q.eq("meetingId", meetingId).eq("memberId", memberId)).unique();
  if (!meeting || !member || !member.active || member.churchId !== meeting.churchId || !invitee || invitee.churchId !== meeting.churchId) throw new Error("Meeting recipient not found.");
  await record(ctx, { churchId: meeting.churchId, meetingId, memberId, eventKey: `meeting:${meetingId}:${memberId}`, kind: "meeting", recipient: member.email, state: "awaiting_configuration", createdAt: Date.now() });
}
/** Cancellation prevents delivery only while the provider still has the message queued. */
export async function cancelPendingNotification(ctx: MutationCtx, churchId: Id<"churches">, eventKey: string) {
  const row = await ctx.db.query("outbox").withIndex("by_church_event", q => q.eq("churchId", churchId).eq("eventKey", eventKey)).unique();
  if (!row || row.state === "cancelled") return;
  if (row.providerId) {
    const emailId = row.providerId as EmailId;
    const status = await resend.status(ctx, emailId);
    if (status?.status !== "waiting" && status?.status !== "queued") return;
    await resend.cancelEmail(ctx, emailId);
  }
  await ctx.db.patch("outbox", row._id, { state: "cancelled" });
}
async function owner(ctx: MutationCtx, churchId: Id<"churches">) {
  const { id: userId } = await user(ctx);
  const member = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", churchId).eq("userId", userId)).unique();
  if (!member?.active || member.role !== "owner") throw new ConvexError("Church owner access required.");
}
/** Bounded explicit retry after configuration; invitations require their retained secret separately. */
export const queuePending = mutation({ args: { churchId: v.id("churches") }, returns: v.number(), handler: async (ctx, { churchId }) => {
  await owner(ctx, churchId);
  if (!deliveryConfiguration()) throw new Error("Email delivery is not configured.");
  const batches = await Promise.all((["cover_request", "meeting"] as const).map(kind => ctx.db.query("outbox").withIndex("by_church_kind_state", q => q.eq("churchId", churchId).eq("kind", kind).eq("state", "awaiting_configuration")).take(25)));
  const rows = batches.flat();
  let processed = 0;
  for (const row of rows) if (row.kind !== "invitation") { await deliver(ctx, row); processed++; }
  return processed;
} });
export const status = query({ args: { churchId: v.id("churches") }, returns: v.array(v.object({ id: v.id("outbox"), kind: v.union(v.literal("invitation"), v.literal("cover_request"), v.literal("meeting")), recipient: v.string(), state: v.union(v.literal("awaiting_configuration"), v.literal("queued"), v.literal("cancelled")), providerStatus: v.union(vStatus, v.null()), failed: v.boolean() })), handler: async (ctx, { churchId }) => {
  const { id: userId } = await user(ctx);
  const member = await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", churchId).eq("userId", userId)).unique();
  if (!member?.active || member.role !== "owner") throw new ConvexError("Church owner access required.");
  const rows = await ctx.db.query("outbox").withIndex("by_church", q => q.eq("churchId", churchId)).order("desc").take(100);
  return Promise.all(rows.map(async row => { const state = row.providerId ? await resend.status(ctx, row.providerId as EmailId) : null; return { id: row._id, kind: row.kind, recipient: row.recipient, state: row.state, providerStatus: state?.status ?? null, failed: state?.failed ?? false }; }));
} });
