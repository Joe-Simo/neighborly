import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { neighborAccess } from "./access";
import { isSampleChurch } from "./demo";
import { deliveryConfiguration, resend } from "./notifications";
import { withoutIdentity, withoutNearNames } from "../src/lib/request-draft";
import { emailLanguage, minutesEmail } from "../src/lib/email/paper-email";

const DAY = 86_400_000;
const kind = v.union(v.literal("rent"), v.literal("utility"), v.literal("food"), v.literal("voucher"), v.literal("other"));
const place = v.union(v.literal("home"), v.literal("prison"), v.literal("hospital"), v.literal("eldercare"), v.literal("other"));

async function ownMeeting(ctx: QueryCtx, churchId: Id<"churches">, meetingId: Id<"meetings">) {
  const meeting = await ctx.db.get("meetings", meetingId);
  if (!meeting || meeting.churchId !== churchId) throw new ConvexError("Meeting not found.");
  return meeting;
}
/** The meeting before this one: what "since the last meeting" counts from. With none, two weeks back. */
async function since(ctx: QueryCtx, meeting: Doc<"meetings">) {
  const before = await ctx.db.query("meetings").withIndex("by_church", q => q.eq("churchId", meeting.churchId)).take(1000);
  return before.filter(one => one.start < meeting.start).reduce((latest, one) => Math.max(latest, one.start), meeting.start - 14 * DAY);
}

/**
 * A conference meeting's sheet, for the owner and approved coordinators: the agenda from the records (requests waiting
 * on a decision, requests decided and visits written up since the meeting before, the books' balance) and what was
 * kept at the meeting (reflection, minutes, who came). A decision is made on the request itself, from its record.
 */
export const sheet = query({
  args: { churchId: v.id("churches"), meetingId: v.id("meetings") },
  returns: v.object({
    title: v.string(), start: v.number(), since: v.number(),
    waiting: v.array(v.object({ requestId: v.id("assistanceRequests"), neighborId: v.id("neighbors"), name: v.string(), kind, amount: v.number(), summary: v.string() })),
    decided: v.array(v.object({ requestId: v.id("assistanceRequests"), neighborId: v.id("neighbors"), name: v.string(), kind, status: v.string(), amount: v.number() })),
    visits: v.array(v.object({ visitId: v.id("visits"), neighborId: v.id("neighbors"), name: v.string(), place, at: v.number() })),
    balance: v.number(),
    members: v.array(v.object({ id: v.id("memberships"), name: v.string() })),
    kept: v.object({ reflection: v.string(), minutes: v.string(), attended: v.array(v.id("memberships")), savedAt: v.union(v.number(), v.null()), sentAt: v.union(v.number(), v.null()) }),
  }),
  handler: async (ctx, { churchId, meetingId }) => {
    await neighborAccess(ctx, churchId);
    const meeting = await ownMeeting(ctx, churchId, meetingId);
    const from = await since(ctx, meeting);
    const [open, recent, visits, ledger, members] = await Promise.all([
      ctx.db.query("assistanceRequests").withIndex("by_church_status", q => q.eq("churchId", churchId).eq("status", "open")).take(200),
      ctx.db.query("assistanceRequests").withIndex("by_church", q => q.eq("churchId", churchId).gte("createdAt", from - 120 * DAY)).take(2000),
      ctx.db.query("visits").withIndex("by_church_status_completed", q => q.eq("churchId", churchId).eq("status", "completed").gte("completedAt", from).lte("completedAt", meeting.end)).take(200),
      ctx.db.query("ledgerEntries").withIndex("by_church", q => q.eq("churchId", churchId)).take(20000),
      ctx.db.query("memberships").withIndex("by_church", q => q.eq("churchId", churchId)).take(1000),
    ]);
    const name = async (neighborId: Id<"neighbors">) => (await ctx.db.get("neighbors", neighborId))?.name ?? "";
    const decidedRows = recent.filter(one => one.decidedAt !== undefined && one.decidedAt >= from && one.decidedAt <= meeting.end && one.source !== "import");
    return {
      title: meeting.title, start: meeting.start, since: from,
      waiting: await Promise.all(open.sort((a, b) => a.createdAt - b.createdAt).map(async one => ({ requestId: one._id, neighborId: one.neighborId, name: await name(one.neighborId), kind: one.kind, amount: one.amountRequested, summary: one.summary.slice(0, 200) }))),
      decided: await Promise.all(decidedRows.map(async one => ({ requestId: one._id, neighborId: one.neighborId, name: await name(one.neighborId), kind: one.kind, status: one.status, amount: one.amountApproved ?? 0 }))),
      visits: await Promise.all(visits.map(async one => ({ visitId: one._id, neighborId: one.neighborId, name: await name(one.neighborId), place: one.place ?? "home" as const, at: one.completedAt ?? one.scheduledAt }))),
      balance: ledger.reduce((sum, entry) => sum + (entry.kind === "income" ? entry.amount : -entry.amount), 0),
      members: members.filter(one => one.active && !one.removedAt).map(one => ({ id: one._id, name: one.name })).sort((a, b) => a.name.localeCompare(b.name)),
      kept: { reflection: meeting.reflection ?? "", minutes: meeting.minutes ?? "", attended: meeting.attended ?? [], savedAt: meeting.minutesSavedAt ?? null, sentAt: meeting.minutesSentAt ?? null },
    };
  },
});

const short = (value: string, max: number, refusal: string) => {
  const text = value.trim();
  if (text.length > max) throw new ConvexError(refusal);
  return text;
};

/** Keeps the meeting's reflection, minutes and attendance. Saved again as often as needed. */
export const keep = mutation({
  args: { churchId: v.id("churches"), meetingId: v.id("meetings"), reflection: v.string(), minutes: v.string(), attended: v.array(v.id("memberships")) },
  returns: v.null(),
  handler: async (ctx, { churchId, meetingId, reflection, minutes, attended }) => {
    await neighborAccess(ctx, churchId);
    await ownMeeting(ctx, churchId, meetingId);
    const present = [];
    for (const id of new Set(attended)) {
      const member = await ctx.db.get("memberships", id);
      if (member?.churchId === churchId) present.push(id);
    }
    await ctx.db.patch("meetings", meetingId, { reflection: short(reflection, 2000, "Keep the reflection under 2,000 characters."), minutes: short(minutes, 8000, "Keep the minutes under 8,000 characters."), attended: present, minutesSavedAt: Date.now() });
    return null;
  },
});

/** The minutes as they may leave in an email: every neighbor's name in the conference taken out of the typed text. */
export async function minutesForEmail(ctx: QueryCtx, meeting: Doc<"meetings">) {
  const neighbors = await ctx.db.query("neighbors").withIndex("by_church", q => q.eq("churchId", meeting.churchId)).take(5000);
  const known = { names: neighbors.filter(one => one.nameKey).map(one => one.name), addresses: neighbors.map(one => one.address).filter(Boolean) };
  // Misspelled names go too, in any case: a lost word in the minutes costs less than a family's name in every mailbox.
  const scrub = (text: string) => withoutNearNames(withoutIdentity(text, known), known.names, true);
  return { reflection: scrub(meeting.reflection ?? ""), minutes: scrub(meeting.minutes ?? "") };
}

/**
 * Emails the kept minutes to every active member, each in their own language. Neighbors' names and addresses are taken
 * out of the text first, since members who are not coordinators may not open records; decisions go as counts.
 */
export const send = mutation({
  args: { churchId: v.id("churches"), meetingId: v.id("meetings") },
  returns: v.union(v.literal("sent"), v.literal("not_sent")),
  handler: async (ctx, { churchId, meetingId }) => {
    await neighborAccess(ctx, churchId);
    const meeting = await ownMeeting(ctx, churchId, meetingId);
    if (!meeting.minutesSavedAt) throw new ConvexError("Save the minutes before sending them.");
    const config = deliveryConfiguration();
    if (!config || (await isSampleChurch(ctx, churchId))) return "not_sent" as const;
    await ctx.scheduler.runAfter(0, internal.minutes.deliver, { meetingId });
    await ctx.db.patch("meetings", meetingId, { minutesSentAt: Date.now() });
    return "sent" as const;
  },
});

export const deliver = internalMutation({
  args: { meetingId: v.id("meetings") },
  returns: v.null(),
  handler: async (ctx, { meetingId }) => {
    const config = deliveryConfiguration();
    const meeting = await ctx.db.get("meetings", meetingId);
    if (!config || !meeting) return null;
    const church = await ctx.db.get("churches", meeting.churchId);
    if (!church) return null;
    const from = await since(ctx, meeting);
    const decided = (await ctx.db.query("assistanceRequests").withIndex("by_church", q => q.eq("churchId", meeting.churchId).gte("createdAt", from - 120 * DAY)).take(2000))
      .filter(one => one.decidedAt !== undefined && one.decidedAt >= from && one.decidedAt <= meeting.end && one.source !== "import");
    const text = await minutesForEmail(ctx, meeting);
    const members = (await ctx.db.query("memberships").withIndex("by_church", q => q.eq("churchId", meeting.churchId)).take(1000)).filter(one => one.active && !one.removedAt && one.email);
    for (const member of members) {
      const email = minutesEmail({
        language: emailLanguage(member.language), set: church.wordSet ?? "general", place: church.name, title: meeting.title, start: meeting.start, timeZone: church.timeZone,
        attended: meeting.attended?.length ?? 0, approved: decided.filter(one => one.status !== "declined").length, declined: decided.filter(one => one.status === "declined").length,
        ...text, link: new URL("/app/tasks", config.site).toString(),
      });
      await resend.sendEmail(ctx, { from: config.sender, to: member.email, ...email, idempotencyKey: `minutes:${meetingId}:${member._id}:${meeting.minutesSavedAt ?? 0}` });
    }
    return null;
  },
});
