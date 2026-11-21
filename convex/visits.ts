import { ConvexError, v, type Infer } from "convex/values";
import { DateTime } from "luxon";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { hour, hourAsked, logNeighborOpening, membership, neighborAccess, neighborRecord, openedBy, opening } from "./access";
import { streetOnly } from "./calendar";
import { mayUndo } from "./undo";
import { formerMember } from "./people";
import { spoken, spokenName, type Spoken } from "./spoken";
import { overlapsTimeOff, parseCalendarDate, parseScheduledTime } from "../src/lib/scheduling";

/**
 * Home visits: two visitors go to a neighbor together, then one of them writes down what they found.
 * Every function starts with neighborAccess(): coordinators and owners only.
 * Two exceptions, for the visitors themselves, who are mostly members: mine() and respond()
 * are open to the two people named on a visit, and show the time and the street, never a name or a reason.
 * The suggested pair is worked out here in plain code from availability, time off and the
 * Home visitors team. No model is asked, and this file writes to none of those tables.
 */

const HOUR = 3600000;
const DAY = 24 * HOUR;
/** How long a visit is taken to last when checking who is free or away. */
export const VISIT_LENGTH = 2 * HOUR;
const language = v.union(v.literal("en"), v.literal("es"));
type Language = Infer<typeof language>;
const kind = v.union(v.literal("rent"), v.literal("utility"), v.literal("food"), v.literal("voucher"), v.literal("other"));

/**
 * A neighbor's record removed for good stays as a nameless row (empty nameKey) so the visits made
 * still count. Such a visit keeps its date, pair, hours and miles, and says nothing of who it was to.
 */
const RECORD_REMOVED = "Record removed";
const recordRemoved = (neighbor: Doc<"neighbors"> | null | undefined) => !neighbor || neighbor.nameKey === "";

const response = v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"));
const person = v.object({ memberId: v.id("memberships"), name: v.string() });
const visitRow = v.object({
  id: v.id("visits"),
  neighborId: v.id("neighbors"),
  neighborName: v.string(),
  address: v.string(),
  requestId: v.union(v.id("assistanceRequests"), v.null()),
  kind: v.union(kind, v.null()),
  amount: v.union(v.number(), v.null()),
  scheduledAt: v.number(),
  status: v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled")),
  /** removed: the owner removed this person for good, so on a visit still planned their seat is empty. */
  visitors: v.array(v.object({ memberId: v.id("memberships"), name: v.string(), hours: v.number(), miles: v.number(), response, removed: v.boolean() })),
  notes: v.string(),
  completedAt: v.union(v.number(), v.null()),
  /** What the assistant read in the written-up note, for a person to act on; null when it found nothing or was not asked. */
  found: v.union(v.object({ kind: v.union(kind, v.null()), signs: v.array(v.string()) }), v.null()),
  /** The neighbor's record was removed for good: no name, street, reason or note is carried. */
  recordRemoved: v.boolean(),
});
const arrangeRow = v.object({
  requestId: v.id("assistanceRequests"),
  neighborId: v.id("neighbors"),
  neighborName: v.string(),
  address: v.string(),
  language: spoken,
  languageName: v.optional(v.string()),
  kind,
  amount: v.number(),
  askedAt: v.number(),
});
const suggestion = v.object({
  request: arrangeRow,
  /** The suggested time, as the group's own wall clock ("yyyy-MM-ddTHH:mm") and as a moment. */
  at: v.string(),
  scheduledAt: v.number(),
  /** Two people, or null when no two home visitors are free in the coming week. */
  pair: v.union(v.array(person), v.null()),
  reason: v.string(),
});
export type VisitRow = Infer<typeof visitRow>;

// ── The pair suggestion: plain code, no model ───────────────────────────

export type Candidate = {
  memberId: string;
  name: string;
  language: Language;
  active: boolean;
  approved: boolean;
  /** Day ranges ("yyyy-MM-dd") the person has said they are free, and is away. */
  free: { start: string; end: string }[];
  away: { start: string; end: string }[];
  /** Start times of visits the person is already going on. */
  busy: number[];
  /** Visits in the last 30 days, so the work is shared. */
  recent: number;
};

/** Who could go at this time: approved, said they are free that day, not away, not on another visit. */
export function freeToVisit<Person extends Candidate>(candidates: Person[], visit: { start: number; timeZone: string }) {
  const end = visit.start + VISIT_LENGTH;
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.memberId) || !candidate.active || !candidate.approved) return false;
    seen.add(candidate.memberId);
    const free = candidate.free.some((range) =>
      parseCalendarDate(range.start, visit.timeZone).toMillis() <= visit.start &&
      parseCalendarDate(range.end, visit.timeZone).plus({ days: 1 }).toMillis() >= end);
    const away = candidate.away.some((range) => overlapsTimeOff(visit.start, end, range.start, range.end, visit.timeZone));
    const busy = candidate.busy.some((start) => Math.abs(start - visit.start) < VISIT_LENGTH);
    return free && !away && !busy;
  });
}

/**
 * Two different people for one visit, or null when fewer than two are free.
 * Someone who speaks the neighbor's language goes first when there is one;
 * after that, whoever has visited least lately.
 */
export function suggestPair<Person extends Candidate>(candidates: Person[], visit: { start: number; timeZone: string; language: Spoken; languageName?: string }) {
  const lightest = (a: Person, b: Person) => a.recent - b.recent || a.name.localeCompare(b.name);
  const free = freeToVisit(candidates, visit).sort(lightest);
  if (free.length < 2) return null;
  const speaker = visit.language === "en" ? undefined : free.find((candidate) => candidate.language === visit.language);
  const first = speaker ?? free[0];
  const second = free.find((candidate) => candidate.memberId !== first.memberId);
  if (!second) return null;
  const day = DateTime.fromMillis(visit.start, { zone: visit.timeZone }).toFormat("cccc");
  const firstName = (candidate: Person) => candidate.name.split(/\s+/)[0];
  const said = spokenName(visit);
  const words =
    visit.language === "en" ? "" :
    speaker && second.language === visit.language ? ` Both speak ${said}.` :
    speaker ? ` ${firstName(speaker)} speaks ${said}.` :
    ` No one free that day speaks ${said}.`;
  const pair: [Person, Person] = first.name.localeCompare(second.name) <= 0 ? [first, second] : [second, first];
  return { pair, reason: `Both are free ${day} and neither is away.${words}` };
}

// ── Reading ──────────────────────────────────────────────────────────────

type Ctx = QueryCtx | MutationCtx;

/** The people who may be sent: the Home visitors team when the group has one, otherwise every approved member. */
async function visitorPool(ctx: Ctx, churchId: Id<"churches">) {
  const [members, teams] = await Promise.all([
    ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(200),
    ctx.db.query("teams").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(100),
  ]);
  const approved = members.filter((member) => member.active && member.approved && !member.removedAt);
  const team = teams.find((candidate) => /^home visit/i.test(candidate.name.trim()));
  if (!team) return { approved, team: new Set(approved.map((member) => member._id)) };
  const onTeam = await ctx.db.query("teamMembers").withIndex("by_team_member", (q) => q.eq("teamId", team._id)).take(200);
  return { approved, team: new Set(onTeam.filter((row) => row.approved && row.status === "active").map((row) => row.memberId)) };
}

async function names(ctx: Ctx, visits: Doc<"visits">[], requests: Doc<"assistanceRequests">[] = []) {
  const neighborIds = [...new Set([...visits, ...requests].map((row) => row.neighborId))];
  const memberIds = [...new Set(visits.flatMap((visit) => visit.visitors.map((visitor) => visitor.memberId)))];
  const requestIds = [...new Set(visits.flatMap((visit) => (visit.requestId ? [visit.requestId] : [])))];
  const [neighbors, members, linked] = await Promise.all([
    Promise.all(neighborIds.map((id) => ctx.db.get("neighbors", id))),
    Promise.all(memberIds.map((id) => ctx.db.get("memberships", id))),
    Promise.all(requestIds.map((id) => ctx.db.get("assistanceRequests", id))),
  ]);
  return {
    neighbor: new Map(neighbors.flatMap((row) => (row ? [[row._id, row] as const] : []))),
    member: new Map(members.flatMap((row) => (row && !row.removedAt ? [[row._id, row.name] as const] : []))),
    request: new Map([...linked, ...requests].flatMap((row) => (row ? [[row._id, row] as const] : []))),
  };
}

function toVisitRow(found: Awaited<ReturnType<typeof names>>, visit: Doc<"visits">): VisitRow {
  const neighbor = found.neighbor.get(visit.neighborId);
  const request = visit.requestId ? found.request.get(visit.requestId) : undefined;
  if (recordRemoved(neighbor))
    return {
      id: visit._id, neighborId: visit.neighborId, neighborName: RECORD_REMOVED, address: "", requestId: null, kind: null, amount: null,
      scheduledAt: visit.scheduledAt, status: visit.status, notes: "", completedAt: visit.completedAt ?? null, found: null, recordRemoved: true,
      visitors: visit.visitors.map((visitor) => ({ ...visitor, response: visitor.response ?? "accepted", name: found.member.get(visitor.memberId) ?? formerMember, removed: !found.member.has(visitor.memberId) })),
    };
  return {
    id: visit._id,
    neighborId: visit.neighborId,
    neighborName: neighbor?.name ?? "",
    address: neighbor?.address ?? "",
    requestId: visit.requestId ?? null,
    kind: request?.kind ?? null,
    amount: request ? (request.amountApproved ?? request.amountRequested) : null,
    scheduledAt: visit.scheduledAt,
    status: visit.status,
    // Visits recorded before people were asked carry no answer: they went, so they count as accepted.
    visitors: visit.visitors.map((visitor) => ({ ...visitor, response: visitor.response ?? "accepted", name: found.member.get(visitor.memberId) ?? formerMember, removed: !found.member.has(visitor.memberId) })),
    notes: visit.notes,
    completedAt: visit.completedAt ?? null,
    found: visit.found && (visit.found.kind || visit.found.signs.length) ? { kind: visit.found.kind ?? null, signs: visit.found.signs } : null,
    recordRemoved: false,
  };
}

/** The first weekday mornings to try, at ten in the group's own time. */
function comingMornings(now: number, timeZone: string) {
  const today = DateTime.fromMillis(now, { zone: timeZone }).startOf("day");
  return Array.from({ length: 9 }, (_, index) => today.plus({ days: index + 1, hours: 10 }))
    .filter((time) => time.weekday <= 5)
    .slice(0, 5);
}

/**
 * The visits screen in one read: the request waiting longest for a pair with a suggestion,
 * the other requests with no visit yet, the visits still to make or to write up, and the last ones written up.
 */
export const board = query({
  args: { churchId: v.id("churches"), at: hour },
  returns: v.object({
    suggested: v.union(suggestion, v.null()),
    toArrange: v.array(arrangeRow),
    scheduled: v.array(visitRow),
    writtenUp: v.array(visitRow),
  }),
  handler: async (ctx, { churchId, at }) => {
    await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church) throw new ConvexError("Group not found.");
    const now = hourAsked(at);
    const [recent, open] = await Promise.all([
      ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", churchId).gte("scheduledAt", now - 90 * DAY)).take(400),
      ctx.db.query("assistanceRequests").withIndex("by_church_status", (q) => q.eq("churchId", churchId).eq("status", "open")).take(100),
    ]);
    const visitsOf = await Promise.all(open.map((request) => ctx.db.query("visits").withIndex("by_request", (q) => q.eq("requestId", request._id)).take(10)));
    const waiting = open.filter((_, index) => visitsOf[index].every((visit) => visit.status === "cancelled")).sort((a, b) => a.createdAt - b.createdAt);
    const planned = recent.filter((visit) => visit.status === "scheduled");
    // The latest written up come first, so a visit written up late is seen where it was just laid.
    const writtenUp = recent.filter((visit) => visit.status === "completed").sort((a, b) => (b.completedAt ?? b.scheduledAt) - (a.completedAt ?? a.scheduledAt)).slice(0, 8);
    const found = await names(ctx, [...planned, ...writtenUp], waiting);
    // A visit still planned to a record since removed is no visit to make: it leaves the board.
    const scheduled = planned.filter((visit) => !recordRemoved(found.neighbor.get(visit.neighborId)));
    const toArrange = waiting.flatMap((request) => {
      const neighbor = found.neighbor.get(request.neighborId);
      return neighbor && !recordRemoved(neighbor) ? [{ requestId: request._id, neighborId: neighbor._id, neighborName: neighbor.name, address: neighbor.address, language: neighbor.language, ...(neighbor.language === "other" ? { languageName: spokenName(neighbor) } : {}), kind: request.kind, amount: request.amountRequested, askedAt: request.createdAt }] : [];
    });

    const [first, ...rest] = toArrange;
    if (!first) return { suggested: null, toArrange, scheduled: scheduled.map((visit) => toVisitRow(found, visit)), writtenUp: writtenUp.map((visit) => toVisitRow(found, visit)) };

    const mornings = comingMornings(now, church.timeZone);
    const firstDay = mornings[0].toISODate() ?? "";
    const pool = await visitorPool(ctx, churchId);
    const candidates = await Promise.all(pool.approved.filter((member) => pool.team.has(member._id)).slice(0, 60).map(async (member) => {
      const [free, away] = await Promise.all([
        ctx.db.query("availability").withIndex("by_member_end", (q) => q.eq("memberId", member._id).gte("end", firstDay)).take(20),
        ctx.db.query("timeOff").withIndex("by_member_end", (q) => q.eq("memberId", member._id).gte("end", firstDay)).take(20),
      ]);
      const going = recent.filter((visit) => visit.status !== "cancelled" && visit.visitors.some((visitor) => visitor.memberId === member._id));
      return {
        memberId: member._id,
        name: member.name,
        language: member.language ?? "en",
        active: member.active,
        approved: member.approved,
        free,
        away,
        busy: going.filter((visit) => visit.status === "scheduled").map((visit) => visit.scheduledAt),
        recent: going.filter((visit) => visit.scheduledAt > now - 30 * DAY).length,
      };
    }));
    let suggested: Infer<typeof suggestion> = {
      request: first,
      at: mornings[0].toFormat("yyyy-MM-dd'T'HH:mm"),
      scheduledAt: mornings[0].toMillis(),
      pair: null,
      reason: "No two home visitors are free on a weekday morning this coming week. Choose a time and a pair yourself.",
    };
    for (const morning of mornings) {
      const match = suggestPair(candidates, { start: morning.toMillis(), timeZone: church.timeZone, language: first.language, languageName: first.languageName });
      if (!match) continue;
      suggested = {
        request: first,
        at: morning.toFormat("yyyy-MM-dd'T'HH:mm"),
        scheduledAt: morning.toMillis(),
        pair: match.pair.map((candidate) => ({ memberId: candidate.memberId, name: candidate.name })),
        reason: match.reason,
      };
      break;
    }
    return { suggested, toArrange: rest, scheduled: scheduled.map((visit) => toVisitRow(found, visit)), writtenUp: writtenUp.map((visit) => toVisitRow(found, visit)) };
  },
});

/** Everyone who may be sent on a visit, home visitors first, for choosing a pair by hand. */
export const visitors = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({ memberId: v.id("memberships"), name: v.string(), language, homeVisitor: v.boolean() })),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const pool = await visitorPool(ctx, churchId);
    return pool.approved
      .map((member) => ({ memberId: member._id, name: member.name, language: member.language ?? "en", homeVisitor: pool.team.has(member._id) }))
      .sort((a, b) => Number(b.homeVisitor) - Number(a.homeVisitor) || a.name.localeCompare(b.name));
  },
});

/** What the pair carries to the door. Read it with the audit line openSheet() wrote and returned; refused without one. */
export const sheet = query({
  args: { churchId: v.id("churches"), visitId: v.id("visits"), opening },
  returns: v.object({
    group: v.string(),
    scheduledAt: v.number(),
    status: visitRow.fields.status,
    visitors: v.array(v.string()),
    neighbor: v.object({ name: v.string(), phone: v.string(), address: v.string(), adults: v.number(), children: v.number(), language: spoken, languageName: v.optional(v.string()), notes: v.string() }),
    request: v.union(v.object({ kind, summary: v.string(), amount: v.number(), payeeName: v.string() }), v.null()),
    /** What the pair before them found, so nobody asks the neighbor to tell it all again. */
    lastVisit: v.union(v.object({ at: v.number(), visitors: v.array(v.string()), notes: v.string() }), v.null()),
  }),
  handler: async (ctx, { churchId, visitId, opening: line }) => {
    const member = await neighborAccess(ctx, churchId);
    const visit = await ownVisit(ctx, churchId, visitId);
    await openedBy(ctx, member, visit.neighborId, line);
    const [church, neighbor, request, found] = await Promise.all([
      ctx.db.get("churches", churchId),
      ctx.db.get("neighbors", visit.neighborId),
      visit.requestId ? ctx.db.get("assistanceRequests", visit.requestId) : null,
      names(ctx, [visit]),
    ]);
    if (!church || !neighbor) throw new ConvexError("Visit not found.");
    if (recordRemoved(neighbor)) throw new ConvexError("Record not found.");
    const earlier = await ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", visit.neighborId)).order("desc").take(50);
    const last = earlier
      .filter((other) => other.status === "completed" && other._id !== visit._id && (other.completedAt ?? other.scheduledAt) < visit.scheduledAt)
      .sort((a, b) => (b.completedAt ?? b.scheduledAt) - (a.completedAt ?? a.scheduledAt))[0];
    return {
      group: church.name,
      scheduledAt: visit.scheduledAt,
      status: visit.status,
      // On a visit still planned, a removed member is not going: only the one who is, is named.
      visitors: toVisitRow(found, visit).visitors.filter((visitor) => visit.status !== "scheduled" || !visitor.removed).map((visitor) => visitor.name),
      neighbor: { name: neighbor.name, phone: neighbor.phone, address: neighbor.address, adults: neighbor.adults, children: neighbor.children, language: neighbor.language, ...(neighbor.language === "other" ? { languageName: spokenName(neighbor) } : {}), notes: neighbor.notes },
      request: request ? { kind: request.kind, summary: request.summary, amount: request.amountRequested, payeeName: request.payeeName } : null,
      lastVisit: last ? { at: last.completedAt ?? last.scheduledAt, visitors: toVisitRow(await names(ctx, [last]), last).visitors.map((visitor) => visitor.name), notes: last.notes } : null,
    };
  },
});

// ── Writing ──────────────────────────────────────────────────────────────

async function ownVisit(ctx: Ctx, churchId: Id<"churches">, visitId: Id<"visits">) {
  const visit = await ctx.db.get("visits", visitId);
  if (!visit || visit.churchId !== churchId) throw new ConvexError("Visit not found.");
  return visit;
}

/** A visit that can still be changed: its neighbor's record has not been removed. */
async function openVisit(ctx: Ctx, churchId: Id<"churches">, visitId: Id<"visits">) {
  const visit = await ownVisit(ctx, churchId, visitId);
  if (recordRemoved(await ctx.db.get("neighbors", visit.neighborId))) throw new ConvexError("Record not found.");
  return visit;
}

/** A visit is made by two different approved members of this group, neither of them away. */
async function checkedPair(ctx: Ctx, church: Doc<"churches">, visitorIds: Id<"memberships">[], start: number) {
  if (visitorIds.length !== 2) throw new ConvexError("A home visit needs two people.");
  if (visitorIds[0] === visitorIds[1]) throw new ConvexError("Choose two different people.");
  const day = DateTime.fromMillis(start, { zone: church.timeZone }).toISODate() ?? "";
  for (const memberId of visitorIds) {
    const member = await ctx.db.get("memberships", memberId);
    if (!member || member.churchId !== church._id) throw new ConvexError("Choose people from this group.");
    if (member.removedAt) throw new ConvexError("One of the two is no longer in the conference. Ask a second visitor first.");
    if (!member.active || !member.approved) throw new ConvexError(`${member.name} is not an approved member yet.`);
    const away = await ctx.db.query("timeOff").withIndex("by_member_end", (q) => q.eq("memberId", memberId).gte("end", day)).take(50);
    if (away.some((range) => overlapsTimeOff(start, start + VISIT_LENGTH, range.start, range.end, church.timeZone)))
      throw new ConvexError(`${member.name} is away that day.`);
  }
  return visitorIds.map((memberId) => ({ memberId, hours: 0, miles: 0, response: "pending" as const }));
}

/** Ask two people to visit a neighbor at a time, written as the group's own wall clock ("yyyy-MM-ddTHH:mm"). */
export const plan = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), requestId: v.optional(v.id("assistanceRequests")), at: v.string(), visitorIds: v.array(v.id("memberships")) },
  returns: v.id("visits"),
  handler: async (ctx, args) => {
    const { member, neighbor } = await neighborRecord(ctx, args.churchId, args.neighborId);
    const church = await ctx.db.get("churches", args.churchId);
    if (!church) throw new ConvexError("Group not found.");
    const scheduledAt = parseScheduledTime(args.at, church.timeZone);
    if (scheduledAt <= Date.now()) throw new ConvexError("Choose a time that is still to come.");
    if (args.requestId) {
      const request = await ctx.db.get("assistanceRequests", args.requestId);
      if (!request || request.churchId !== args.churchId || request.neighborId !== neighbor._id) throw new ConvexError("Request not found.");
      const planned = await ctx.db.query("visits").withIndex("by_request", (q) => q.eq("requestId", request._id)).take(20);
      if (planned.some((visit) => visit.status === "scheduled")) throw new ConvexError("A visit for this request is already planned.");
    }
    const pair = await checkedPair(ctx, church, args.visitorIds, scheduledAt);
    return await ctx.db.insert("visits", { churchId: args.churchId, neighborId: neighbor._id, requestId: args.requestId, scheduledAt, status: "scheduled", visitors: pair, notes: "", createdBy: member._id, createdAt: Date.now() });
  },
});

/** Move a planned visit to another time. Both visitors are asked again, since their yes was for the old time. */
export const reschedule = mutation({
  args: { churchId: v.id("churches"), visitId: v.id("visits"), at: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const visit = await openVisit(ctx, args.churchId, args.visitId);
    const church = await ctx.db.get("churches", args.churchId);
    if (!church) throw new ConvexError("Group not found.");
    if (visit.status !== "scheduled") throw new ConvexError("Only a planned visit can change its time.");
    const scheduledAt = parseScheduledTime(args.at, church.timeZone);
    if (scheduledAt <= Date.now()) throw new ConvexError("Choose a time that is still to come.");
    if (scheduledAt === visit.scheduledAt) return null;
    const pair = await checkedPair(ctx, church, visit.visitors.map((visitor) => visitor.memberId), scheduledAt);
    await ctx.db.patch("visits", visit._id, { scheduledAt, visitors: pair });
    return null;
  },
});

/** One of the pair cannot go: someone else is asked in their place, and the one staying keeps their answer. */
export const replaceVisitor = mutation({
  args: { churchId: v.id("churches"), visitId: v.id("visits"), leavingId: v.id("memberships"), joiningId: v.id("memberships") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const visit = await openVisit(ctx, args.churchId, args.visitId);
    const church = await ctx.db.get("churches", args.churchId);
    if (!church) throw new ConvexError("Group not found.");
    if (visit.status !== "scheduled") throw new ConvexError("Only a planned visit can change its pair.");
    const staying = visit.visitors.filter((visitor) => visitor.memberId !== args.leavingId);
    if (staying.length !== 1) throw new ConvexError("Choose which of the two is being replaced.");
    const [, joining] = await checkedPair(ctx, church, [staying[0].memberId, args.joiningId], visit.scheduledAt);
    await ctx.db.patch("visits", visit._id, { visitors: [staying[0], joining] });
    return null;
  },
});

/**
 * The signed-in member's own visits still to come. Open to any member, and so it carries
 * the time, the street and the other visitor only: never the neighbor's name or the reason.
 */
export const mine = query({
  args: { churchId: v.id("churches"), at: hour },
  returns: v.array(v.object({ id: v.id("visits"), scheduledAt: v.number(), street: v.string(), partner: v.string(), response })),
  handler: async (ctx, { churchId, at }) => {
    const me = await membership(ctx, churchId);
    const coming = await ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", churchId).gte("scheduledAt", hourAsked(at) - VISIT_LENGTH)).take(400);
    const own = coming.filter((visit) => visit.status === "scheduled" && visit.visitors.some((visitor) => visitor.memberId === me._id)).slice(0, 20);
    return (await Promise.all(own.map(async (visit) => {
      const partnerId = visit.visitors.find((visitor) => visitor.memberId !== me._id)?.memberId;
      const [neighbor, partner] = await Promise.all([ctx.db.get("neighbors", visit.neighborId), partnerId ? ctx.db.get("memberships", partnerId) : null]);
      // A partner removed for good leaves the seat empty until the coordinator asks someone else.
      if (recordRemoved(neighbor)) return [];
      return [{ id: visit._id, scheduledAt: visit.scheduledAt, street: streetOnly(neighbor?.address ?? ""), partner: partner && !partner.removedAt ? partner.name : "", response: visit.visitors.find((visitor) => visitor.memberId === me._id)?.response ?? "accepted" }];
    }))).flat();
  },
});

/** A visitor says yes or no to a visit they were asked to make. Only the two people asked may answer. */
export const respond = mutation({
  args: { churchId: v.id("churches"), visitId: v.id("visits"), response: v.union(v.literal("accepted"), v.literal("declined")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await membership(ctx, args.churchId);
    const visit = await openVisit(ctx, args.churchId, args.visitId);
    if (!visit.visitors.some((visitor) => visitor.memberId === me._id)) throw new ConvexError("Visit not found.");
    if (visit.status !== "scheduled") throw new ConvexError("This visit is no longer planned.");
    await ctx.db.patch("visits", visit._id, { visitors: visit.visitors.map((visitor) => (visitor.memberId === me._id ? { ...visitor, response: args.response } : visitor)) });
    return null;
  },
});

/**
 * After the visit: what the pair found, the hours each of them gave, and the miles driven.
 * Miles go to the one who drove, so a pair in one car is not counted twice in the yearly totals.
 * With no driver named, each drove their own car and each is given the miles.
 */
export const writeUp = mutation({
  args: { churchId: v.id("churches"), visitId: v.id("visits"), notes: v.string(), hours: v.number(), miles: v.number(), driverId: v.optional(v.id("memberships")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const visit = await openVisit(ctx, args.churchId, args.visitId);
    if (visit.status !== "scheduled") throw new ConvexError("This visit is already written up or was canceled.");
    const notes = args.notes.trim();
    if (!notes) throw new ConvexError("Write a few words about what you found.");
    if (!Number.isFinite(args.hours) || args.hours <= 0 || args.hours > 24) throw new ConvexError("Enter the hours the visit took, such as 1.5.");
    if (!Number.isFinite(args.miles) || args.miles < 0 || args.miles > 1000) throw new ConvexError("Enter the miles driven, or 0.");
    if (args.driverId && !visit.visitors.some((visitor) => visitor.memberId === args.driverId)) throw new ConvexError("The driver must be one of the two visitors.");
    await ctx.db.patch("visits", visit._id, { status: "completed", notes, completedAt: Date.now(), visitors: visit.visitors.map((visitor) => ({ ...visitor, hours: args.hours, miles: !args.driverId || visitor.memberId === args.driverId ? args.miles : 0 })) });
    return null;
  },
});

/** Call off a visit that has not been written up. The request goes back to waiting for a pair. */
export const cancel = mutation({
  args: { churchId: v.id("churches"), visitId: v.id("visits") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const visit = await openVisit(ctx, args.churchId, args.visitId);
    if (visit.status !== "scheduled") throw new ConvexError("Only a planned visit can be called off.");
    await ctx.db.patch("visits", visit._id, { status: "cancelled", cancelledBy: member._id, cancelledAt: Date.now() });
    return null;
  },
});

/** Undoes calling a visit off, from the line that said so: it is planned again, as it was. */
export const reinstate = mutation({
  args: { churchId: v.id("churches"), visitId: v.id("visits") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const visit = await openVisit(ctx, args.churchId, args.visitId);
    if (visit.status !== "cancelled") throw new ConvexError("This visit is not called off.");
    mayUndo({ by: visit.cancelledBy, at: visit.cancelledAt }, member._id, Date.now());
    await ctx.db.patch("visits", visit._id, { status: "scheduled", cancelledBy: undefined, cancelledAt: undefined });
    return null;
  },
});

/** Opening the visit sheet shows a neighbor's details, so it is written down like opening the record. */
export const openSheet = mutation({
  args: { churchId: v.id("churches"), visitId: v.id("visits") },
  returns: opening,
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const visit = await openVisit(ctx, args.churchId, args.visitId);
    return logNeighborOpening(ctx, member, visit.neighborId);
  },
});
