import { ConvexError, v } from "convex/values";
import { DateTime } from "luxon";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { hour, hourAsked, mayOpenNeighborRecords, membership, user } from "./access";
import { approvedBetween, balanceOf, monthToDate, sumApproved } from "./treasury";
import { fiscalYear, fiscalYearOf } from "./reports";
import { isLateCallback, keptForCount } from "../src/lib/late-callback";
import { notesSayOne } from "../src/lib/duplicate-set";

/**
 * The home's glance: one answer per signed-in person, holding only what their access allows. Everyone gets their own
 * asks: visits waiting for their answer and tasks given to them (their week's commitments the screen has already). Whoever may open neighbor records also gets the
 * whole conference: callbacks late, the money against last year and the budget, households served, visits, the volunteers,
 * the treasury and the assistant's marks waiting on a person. A council's owner gets the council's year as well.
 * Counts and sums only, from the records; no neighbor is named and no model is asked.
 */
const DAY = 86_400_000;
const money = v.object({ now: v.number(), before: v.number() });
const conference = v.object({
  callbacks: v.object({ owed: v.number(), late: v.number(), mine: v.number() }),
  month: v.object({ month: v.number(), approved: money, budget: v.union(v.number(), v.null()), day: v.number(), days: v.number() }),
  year: v.object({ fiscalYear: v.number(), approved: money, households: money }),
  visits: v.object({ due: v.number(), late: v.number() }),
  volunteers: v.object({ active: v.number(), away: v.array(v.string()) }),
  balance: v.union(v.number(), v.null()),
  flags: v.object({ urgent: v.number(), drafts: v.number(), doubles: v.number() }),
});
const council = v.object({ name: v.string(), conferences: v.number(), households: v.number(), helpPaid: v.number(), visits: v.number(), updating: v.boolean() });

/** The same span of the fiscal year before: from its first day to this moment's place in it. */
function yearSpans(at: number, zone: string) {
  const year = fiscalYearOf(at, zone);
  const now = fiscalYear(year, zone);
  const before = fiscalYear(year - 1, zone);
  // The same calendar day a year back, never past that year's end (29 February reads as the 28th).
  const back = Math.min(DateTime.fromMillis(at, { zone }).minus({ years: 1 }).toMillis(), before.end);
  return { year, now: { from: now.start, to: at }, before: { from: before.start, to: back } };
}
const households = (rows: Doc<"assistanceRequests">[]) => new Set(rows.map((row) => row.neighborId)).size;

async function wholeConference(ctx: QueryCtx, church: Doc<"churches">, me: Doc<"memberships">, at: number) {
  const churchId = church._id, zone = church.timeZone;
  const month = DateTime.fromMillis(at, { zone }).startOf("month");
  const monthBefore = month.minus({ years: 1 });
  const spans = yearSpans(at, zone);
  const today = DateTime.fromMillis(at, { zone }).toFormat("yyyy-MM-dd");
  const [owed, monthNow, monthThen, yearNow, yearThen, ahead, behind, members, timeOff, balance, drafts, pairs] = await Promise.all([
    ctx.db.query("calls").withIndex("by_church_callback", (q) => q.eq("churchId", churchId).eq("callback", "needed")).take(500).then((calls) => calls.filter((call) => !keptForCount(call))),
    monthToDate(ctx, church, at),
    approvedBetween(ctx, churchId, monthBefore.toMillis(), monthBefore.endOf("month").toMillis()),
    approvedBetween(ctx, churchId, spans.now.from, spans.now.to),
    approvedBetween(ctx, churchId, spans.before.from, spans.before.to),
    ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", churchId).gte("scheduledAt", at).lt("scheduledAt", at + 7 * DAY)).take(500),
    // Every visit still planned, however old: one stays late until it is written up or called off.
    ctx.db.query("visits").withIndex("by_church_status_completed", (q) => q.eq("churchId", churchId).eq("status", "scheduled")).take(1000),
    ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1000),
    ctx.db.query("timeOff").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1000),
    // A ledger too long to add up in one pass gives no balance, not a failed home.
    balanceOf(ctx, churchId).catch(() => null),
    ctx.db.query("requestDrafts").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(200),
    ctx.db.query("duplicatePairs").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(200),
  ]);
  const active = members.filter((member) => member.active && !member.removedAt);
  const awayIds = new Set(timeOff.filter((item) => item.start <= today && item.end >= today).map((item) => item.memberId));
  // A double the assistant read as one household, by the same rule a record uses to show it (duplicates.forRecord), not yet settled by a person.
  const doubles = await Promise.all(pairs.filter((pair) => pair.read && !pair.dismissedAt).map(async (pair) => {
    const [first, second] = await Promise.all([ctx.db.get("neighbors", pair.first), ctx.db.get("neighbors", pair.second)]);
    return !!first?.nameKey && !!second?.nameKey && notesSayOne(pair.read?.same ?? 0, first, second);
  }));
  return {
    callbacks: { owed: owed.length, late: owed.filter((call) => isLateCallback(call.takenAt, at)).length, mine: owed.filter((call) => call.ownerId === me._id).length },
    month: { month: monthNow.month, approved: { now: monthNow.approved, before: sumApproved(monthThen) }, budget: monthNow.budget, day: DateTime.fromMillis(at, { zone }).day, days: month.daysInMonth ?? 30 },
    year: { fiscalYear: spans.year, approved: { now: sumApproved(yearNow), before: sumApproved(yearThen) }, households: { now: households(yearNow), before: households(yearThen) } },
    visits: { due: ahead.filter((visit) => visit.status === "scheduled").length, late: behind.filter((visit) => visit.scheduledAt < at).length },
    volunteers: { active: active.length, away: active.filter((member) => awayIds.has(member._id)).map((member) => member.name).sort((a, b) => a.localeCompare(b)) },
    balance,
    flags: {
      urgent: owed.filter((call) => call.urgent?.by === "assistant" && call.urgent.reasons.length > 0).length,
      drafts: drafts.length,
      doubles: doubles.filter(Boolean).length,
    },
  };
}

/** The councils this person owns, each with its current fiscal year as its conferences' stored rows add it up. */
async function councilsOf(ctx: QueryCtx, userId: Id<"users">, at: number) {
  const seats = await ctx.db.query("councilMembers").withIndex("by_user", (q) => q.eq("userId", userId)).take(20);
  const found = await Promise.all(seats.filter((seat) => seat.role === "owner").map(async (seat) => {
    const owned = await ctx.db.get("councils", seat.councilId);
    if (!owned) return null;
    const year = fiscalYearOf(at, owned.timeZone);
    const links = (await ctx.db.query("councilLinks").withIndex("by_council", (q) => q.eq("councilId", owned._id)).take(200)).filter((link) => link.status === "accepted");
    const rows = await Promise.all(links.map((link) => ctx.db.query("yearRollups").withIndex("by_church_year", (q) => q.eq("churchId", link.churchId).eq("year", year)).unique()));
    const add = (pick: (row: Doc<"yearRollups">) => number) => rows.reduce((total, row) => total + (row ? pick(row) : 0), 0);
    return { name: owned.name, conferences: links.length, households: add((row) => row.figures.households), helpPaid: add((row) => row.figures.helpPaid), visits: add((row) => row.figures.visits), updating: rows.some((row) => !row || row.dirty) };
  }));
  return found.flatMap((one) => (one ? [one] : []));
}

export const home = query({
  args: { churchId: v.id("churches"), at: hour },
  returns: v.object({
    own: v.object({ visitAsks: v.number(), tasks: v.number(), tasksLate: v.number() }),
    conference: v.union(conference, v.null()),
    councils: v.array(council),
  }),
  handler: async (ctx, { churchId, at: asked }) => {
    const at = hourAsked(asked);
    const me = await membership(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church) throw new ConvexError("Workspace access required.");
    const [visits, tasks] = await Promise.all([
      ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", churchId).gte("scheduledAt", at).lt("scheduledAt", at + 14 * DAY)).take(500),
      ctx.db.query("tasks").withIndex("by_assignee_complete", (q) => q.eq("assigneeId", me._id).eq("complete", false)).take(500),
    ]);
    // Only this person's own: visits waiting for their answer (a count, never who), and the tasks given to them.
    const mine = visits.filter((visit) => visit.status === "scheduled" && visit.visitors.some((one) => one.memberId === me._id && one.response !== "declined"));
    const myTasks = tasks.filter((task) => task.churchId === churchId);
    return {
      own: {
        visitAsks: mine.filter((visit) => visit.visitors.some((one) => one.memberId === me._id && one.response === "pending")).length,
        tasks: myTasks.length,
        tasksLate: myTasks.filter((task) => task.dueAt !== null && task.dueAt < at).length,
      },
      conference: mayOpenNeighborRecords(me) ? await wholeConference(ctx, church, me, at) : null,
      councils: church.sample ? [] : await councilsOf(ctx, (await user(ctx)).id, at),
    };
  },
});
