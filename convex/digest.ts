import { ConvexError, v } from "convex/values";
import { DateTime } from "luxon";
import { internalAction, internalQuery, query, type QueryCtx } from "./_generated/server";
import { internalMutation, mutation } from "./functions";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { hour, hourAsked, mayOpenNeighborRecords, neighborAccess } from "./access";
import { approvedBetween, monthToDate, sumApproved } from "./treasury";
import { deliveryConfiguration, resend } from "./notifications";
import { emailLanguage, paperEmail } from "../src/lib/email/paper-email";

const DAY = 86_400_000;
/** A callback still owed after this long is overdue. */
export const callbackDays = 2;
/** At most this many rows of each kind are listed; the counts are always whole. */
const listed = 20;
const kind = v.union(v.literal("rent"), v.literal("utility"), v.literal("food"), v.literal("voucher"), v.literal("other"));

const digestValidator = v.object({
  waiting: v.object({ count: v.number(), rows: v.array(v.object({ requestId: v.id("assistanceRequests"), neighborId: v.id("neighbors"), name: v.string(), kind, amount: v.number(), days: v.number(), repeat: v.union(v.literal("recent"), v.literal("sameAmount"), v.null()) })) }),
  month: v.object({ month: v.number(), approved: v.number(), budget: v.union(v.number(), v.null()), lastYear: v.number() }),
  overdue: v.object({ count: v.number(), rows: v.array(v.object({ callId: v.id("calls"), name: v.string(), web: v.boolean(), days: v.number(), owner: v.string() })) }),
});

/**
 * The week for the people who decide, all from the records: requests waiting on a decision (oldest first, each marked when
 * the household had same-kind help approved or paid in the 90 days before, or asked the same amount in the 60 before),
 * the month's approved help against the budget and the same month last year, and callbacks owed for two days or more.
 * No model is asked. The caller has already passed neighborAccess.
 */
async function digestOf(ctx: QueryCtx, churchId: Id<"churches">, at: number) {
  const church = await ctx.db.get("churches", churchId);
  if (!church) throw new ConvexError("Workspace access required.");
  const open = await ctx.db.query("assistanceRequests").withIndex("by_church_status", q => q.eq("churchId", churchId).eq("status", "open")).take(500);
  open.sort((a, b) => a.createdAt - b.createdAt);
  const rows = await Promise.all(open.slice(0, listed).map(async request => {
    const [neighbor, history] = await Promise.all([
      ctx.db.get("neighbors", request.neighborId),
      ctx.db.query("assistanceRequests").withIndex("by_neighbor", q => q.eq("neighborId", request.neighborId)).take(100),
    ]);
    const earlier = history.filter(other => other._id !== request._id && other.kind === request.kind && other.createdAt <= request.createdAt);
    const recent = earlier.some(other => (other.status === "approved" || other.status === "paid") && request.createdAt - (other.decidedAt ?? other.createdAt) <= 90 * DAY);
    const sameAmount = earlier.some(other => request.amountRequested > 0 && other.amountRequested === request.amountRequested && request.createdAt - other.createdAt <= 60 * DAY);
    return {
      requestId: request._id, neighborId: request.neighborId, name: neighbor?.name ?? "", kind: request.kind, amount: request.amountRequested,
      days: Math.max(0, Math.floor((at - request.createdAt) / DAY)),
      repeat: recent ? "recent" as const : sameAmount ? "sameAmount" as const : null,
    };
  }));
  const start = DateTime.fromMillis(at, { zone: church.timeZone }).startOf("month");
  const before = start.minus({ years: 1 });
  const [thisMonth, lastYear, owed] = await Promise.all([
    monthToDate(ctx, church, at),
    approvedBetween(ctx, churchId, before.toMillis(), before.endOf("month").toMillis()),
    ctx.db.query("calls").withIndex("by_church_callback", q => q.eq("churchId", churchId).eq("callback", "needed")).take(500),
  ]);
  const late = owed.filter(call => at - call.takenAt >= callbackDays * DAY).sort((a, b) => a.takenAt - b.takenAt);
  const overdue = await Promise.all(late.slice(0, listed).map(async call => {
    const owner = call.ownerId ? await ctx.db.get("memberships", call.ownerId) : null;
    return { callId: call._id, name: call.callerName, web: call.fromWeb === true, days: Math.floor((at - call.takenAt) / DAY), owner: owner?.removedAt ? "" : owner?.name ?? "" };
  }));
  return {
    waiting: { count: open.length, rows },
    month: { month: thisMonth.month, approved: thisMonth.approved, budget: thisMonth.budget, lastYear: sumApproved(lastYear) },
    overdue: { count: late.length, rows: overdue },
  };
}

/** The week's page, for an owner or an approved coordinator. `at` is the reader's whole hour, as other rooms ask. */
export const week = query({
  args: { churchId: v.id("churches"), at: hour },
  returns: v.object({ digest: digestValidator, emailed: v.boolean() }),
  handler: async (ctx, { churchId, at }) => {
    const member = await neighborAccess(ctx, churchId);
    return { digest: await digestOf(ctx, churchId, hourAsked(at)), emailed: member.digestEmail === true };
  },
});

/** Whether this person gets the week by email on Monday morning. Their own choice, for themselves only. */
export const setDigestEmail = mutation({
  args: { churchId: v.id("churches"), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { churchId, on }) => {
    const member = await neighborAccess(ctx, churchId);
    await ctx.db.patch("memberships", member._id, { digestEmail: on || undefined });
    return null;
  },
});

/** Everyone who asked for the email and may still open records, with what their email says. Counts only: no names. */
export const toSend = internalQuery({
  args: { at: v.number() },
  returns: v.array(v.object({ memberId: v.id("memberships"), email: v.string(), language: v.union(v.literal("en"), v.literal("es")), set: v.union(v.literal("general"), v.literal("vincentian")), place: v.string(), waiting: v.number(), overdue: v.number(), approved: v.number(), budget: v.union(v.number(), v.null()) })),
  handler: async (ctx, { at }) => {
    const asked = (await ctx.db.query("memberships").collect()).filter(member => member.digestEmail && !member.removedAt && mayOpenNeighborRecords(member) && member.email);
    const byChurch = new Map<Id<"churches">, Awaited<ReturnType<typeof digestOf>> | null>();
    const out = [];
    for (const member of asked) {
      const church = await ctx.db.get("churches", member.churchId);
      if (!church || church.sample) continue;
      if (!byChurch.has(member.churchId)) byChurch.set(member.churchId, await digestOf(ctx, member.churchId, at));
      const digest = byChurch.get(member.churchId);
      if (!digest) continue;
      out.push({ memberId: member._id, email: member.email, language: emailLanguage(member.language), set: church.wordSet ?? "general", place: church.name, waiting: digest.waiting.count, overdue: digest.overdue.count, approved: digest.month.approved, budget: digest.month.budget });
    }
    return out;
  },
});

export const sendOne = internalMutation({
  args: { memberId: v.id("memberships"), email: v.string(), language: v.union(v.literal("en"), v.literal("es")), set: v.union(v.literal("general"), v.literal("vincentian")), place: v.string(), waiting: v.number(), overdue: v.number(), approved: v.number(), budget: v.union(v.number(), v.null()), week: v.string() },
  returns: v.null(),
  handler: async (ctx, { memberId, email: to, week, ...said }) => {
    const config = deliveryConfiguration();
    if (!config) return null;
    const { waiting, overdue, approved, budget, ...about } = said;
    const email = paperEmail({ kind: "digest", ...about, week: { waiting, overdue, approved, budget }, link: new URL("/app/reports", config.site).toString() });
    await resend.sendEmail(ctx, { from: config.sender, to, ...email, idempotencyKey: `digest:${memberId}:${week}` });
    return null;
  },
});

/** Monday morning: the week, by email, to each person who asked for it. Nothing is sent while delivery is switched off. */
export const monday = internalAction({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    if (!deliveryConfiguration()) return null;
    const at = Date.now();
    const week = new Date(at).toISOString().slice(0, 10);
    for (const one of await ctx.runQuery(internal.digest.toSend, { at })) await ctx.runMutation(internal.digest.sendOne, { ...one, week });
    return null;
  },
});
