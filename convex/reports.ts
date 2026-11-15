import { v, type Infer } from "convex/values";
import { DateTime } from "luxon";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { neighborAccess } from "./access";

/**
 * The year's counts, read straight from the records. Nothing here writes, and nothing here
 * returns a neighbor's name, phone or address: only counts and sums.
 *
 * A year is the Society's fiscal year, October 1 to September 30 in the group's time zone,
 * named for the calendar year it ends in. What each count means is written beside it below
 * and in /mnt/project-files/stream-4/reports.md.
 */
const LIMIT = 5000;
const LEDGER_LIMIT = 10000;
const kinds = ["rent", "utility", "food", "voucher", "other"] as const;
type Kind = (typeof kinds)[number];
const isKind = (value: string): value is Kind => kinds.some((kind) => kind === value);

/** Reads a bounded range in full, and refuses to add up a year it could only see part of. */
async function whole<T>(rows: { take: (n: number) => Promise<T[]> }, limit = LIMIT) {
  const read = await rows.take(limit + 1);
  if (read.length > limit) throw new Error("This year holds more records than one report can add up.");
  return read;
}

export function fiscalYear(year: number, zone: string) {
  const start = DateTime.fromObject({ year: year - 1, month: 10, day: 1 }, { zone });
  const end = start.plus({ years: 1 });
  return {
    start: start.toMillis(),
    end: end.toMillis(),
    firstDay: start.toFormat("yyyy-MM-dd"),
    lastDay: end.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
    dayAfter: end.toFormat("yyyy-MM-dd"),
    months: Array.from({ length: 12 }, (_, index) => start.plus({ months: index }).toFormat("yyyy-MM")),
  };
}
/** The fiscal year a moment falls in. */
export function fiscalYearOf(time: number, zone: string) {
  const at = DateTime.fromMillis(time, { zone });
  return at.month >= 10 ? at.year + 1 : at.year;
}

const kind = v.union(...kinds.map((value) => v.literal(value)));
const kindLine = v.object({
  kind,
  /** Requests of this kind received in the year, whatever became of them. */
  requests: v.number(),
  /** Requests of this kind that money went toward in the year. */
  requestsPaid: v.number(),
  /** Different households that money of this kind went toward, and the people in them. */
  households: v.number(),
  people: v.number(),
  /** Cents paid in the year, less anything reversed in the year. */
  paid: v.number(),
});
const monthLine = v.object({
  /** "yyyy-MM" */
  month: v.string(),
  calls: v.number(),
  requests: v.number(),
  visits: v.number(),
  households: v.number(),
  paid: v.number(),
  moneyIn: v.number(),
});
const moneyLine = v.object({ label: v.string(), amount: v.number() });
const teamLine = v.object({ teamId: v.id("teams"), name: v.string(), shifts: v.number(), people: v.number(), hours: v.number() });

export const yearReport = v.object({
  year: v.number(),
  firstDay: v.string(),
  lastDay: v.string(),
  timeZone: v.string(),
  /** False while the year is still running, so the page can say "so far". */
  closed: v.boolean(),
  /** Different households that had a completed home visit or money paid toward a request in the year. */
  households: v.number(),
  /** The people living in those households, each counted once. */
  people: v.number(),
  adults: v.number(),
  children: v.number(),
  householdsByLanguage: v.object({ en: v.number(), es: v.number(), ht: v.number() }),
  /** Completed home visits whose planned time falls in the year. */
  visits: v.number(),
  /** The people in the household at each completed visit, counted once per visit, as the national report counts. */
  peopleVisited: v.number(),
  /** Hours and miles as each visitor logged them; a pair is two people's hours. */
  visitHours: v.number(),
  visitMiles: v.number(),
  /** Cents paid toward requests in the year, less reversals. Always to a landlord, utility or vendor. */
  helpPaid: v.number(),
  kinds: v.array(kindLine),
  requests: v.object({
    received: v.number(),
    open: v.number(),
    approved: v.number(),
    paid: v.number(),
    declined: v.number(),
    closed: v.number(),
    /** Requests that carry a referral to another place of help. */
    referred: v.number(),
    amountRequested: v.number(),
    amountApproved: v.number(),
  }),
  calls: v.object({ taken: v.number(), returned: v.number(), waiting: v.number() }),
  time: v.object({
    /** Visit hours plus the hours of finished, assigned shifts. */
    hours: v.number(),
    shiftHours: v.number(),
    /** Members marked active today. */
    activeMembers: v.number(),
    /** Different members who made a visit or served a shift in the year. */
    membersServing: v.number(),
    teams: v.array(teamLine),
  }),
  money: v.object({
    beginningBalance: v.number(),
    received: v.number(),
    /** Money in by source, largest first. */
    sources: v.array(moneyLine),
    /** Spending that is not help toward a request, such as a twinning gift, by category. */
    otherSpending: v.array(moneyLine),
    spent: v.number(),
    endingBalance: v.number(),
  }),
  months: v.array(monthLine),
});
export type YearReport = Infer<typeof yearReport>;

const round = (value: number) => Math.round(value * 100) / 100;
const lines = (totals: Map<string, number>) =>
  [...totals].filter(([, amount]) => amount !== 0).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
const add = <K>(totals: Map<K, number>, key: K, amount: number) => totals.set(key, (totals.get(key) ?? 0) + amount);

/** The fiscal years that hold any record, newest first, and the one today falls in. */
export const years = query({
  args: { churchId: v.id("churches") },
  returns: v.object({ current: v.number(), years: v.array(v.number()) }),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church) throw new Error("Group not found.");
    const current = fiscalYearOf(Date.now(), church.timeZone);
    const [call, request, visit, entry] = await Promise.all([
      ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", churchId)).first(),
      ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", churchId)).first(),
      ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", churchId)).first(),
      ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", churchId)).first(),
    ]);
    const starts = [call?.takenAt, request?.createdAt, visit?.scheduledAt, entry && DateTime.fromISO(entry.date, { zone: church.timeZone }).toMillis()].flatMap((time) => (time === undefined || time === null ? [] : [time]));
    const first = Math.min(current, ...starts.map((time) => fiscalYearOf(time, church.timeZone)));
    return { current, years: Array.from({ length: current - first + 1 }, (_, index) => current - index) };
  },
});

export const year = query({
  args: { churchId: v.id("churches"), year: v.number() },
  returns: yearReport,
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const church = await ctx.db.get("churches", args.churchId);
    if (!church) throw new Error("Group not found.");
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2200) throw new Error("Choose a year.");
    const zone = church.timeZone;
    const span = fiscalYear(args.year, zone);
    const now = Date.now();
    const monthOf = (time: number) => DateTime.fromMillis(time, { zone }).toFormat("yyyy-MM");
    const inChurch = { churchId: args.churchId };

    const [calls, requests, plannedVisits, ledger, memberships, teams] = await Promise.all([
      whole(ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", args.churchId).gte("takenAt", span.start).lt("takenAt", span.end))),
      whole(ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", args.churchId).gte("createdAt", span.start).lt("createdAt", span.end))),
      whole(ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", args.churchId).gte("scheduledAt", span.start).lt("scheduledAt", span.end))),
      // The ledger from its first day to the end of the year: what came before is the beginning balance.
      whole(ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", args.churchId).lt("date", span.dayAfter)), LEDGER_LIMIT),
      whole(ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", inChurch.churchId))),
      whole(ctx.db.query("teams").withIndex("by_church", (q) => q.eq("churchId", inChurch.churchId)), 200),
    ]);
    const visits = plannedVisits.filter((visit) => visit.status === "completed");

    const months = new Map(span.months.map((month) => [month, { month, calls: 0, requests: 0, visits: 0, households: 0, paid: 0, moneyIn: 0 }]));
    const monthHouseholds = new Map(span.months.map((month) => [month, new Set<Id<"neighbors">>()]));
    const month = (key: string) => {
      const line = months.get(key);
      if (!line) throw new Error("A record fell outside the year it was read for.");
      return line;
    };
    const helpedIn = (key: string, neighborId: Id<"neighbors">) => monthHouseholds.get(key)?.add(neighborId);

    // Money. A reversal is a new opposite entry, so an entry belongs to the side of the one it undoes.
    let beginningBalance = 0, received = 0, spent = 0;
    const sources = new Map<string, number>(), otherSpending = new Map<string, number>();
    const paidByRequest = new Map<Id<"assistanceRequests">, { kind: Kind; neighborId: Id<"neighbors"> | undefined; paid: number; month: string }>();
    for (const entry of ledger) {
      const signed = entry.kind === "income" ? entry.amount : -entry.amount;
      if (entry.date < span.firstDay) { beginningBalance += signed; continue; }
      const moneyIn = (entry.kind === "income") !== Boolean(entry.reverses);
      if (entry.requestId) {
        // Help toward a request: expenses less income among the entries carrying its id.
        const toward = paidByRequest.get(entry.requestId) ?? { kind: isKind(entry.category) ? entry.category : "other", neighborId: entry.neighborId, paid: 0, month: entry.date.slice(0, 7) };
        toward.paid -= signed;
        paidByRequest.set(entry.requestId, toward);
        month(entry.date.slice(0, 7)).paid -= signed;
        spent -= signed;
      } else if (moneyIn) {
        add(sources, entry.category, signed);
        month(entry.date.slice(0, 7)).moneyIn += signed;
        received += signed;
      } else {
        add(otherSpending, entry.category, -signed);
        spent -= signed;
      }
    }

    const byKind = new Map(kinds.map((value) => [value, { kind: value, requests: 0, requestsPaid: 0, paid: 0, neighbors: new Set<Id<"neighbors">>() }]));
    const kindLineFor = (value: Kind) => {
      const line = byKind.get(value);
      if (!line) throw new Error("Unknown kind of help.");
      return line;
    };
    const helped = new Set<Id<"neighbors">>();
    let helpPaid = 0;
    for (const toward of paidByRequest.values()) {
      const line = kindLineFor(toward.kind);
      line.paid += toward.paid;
      helpPaid += toward.paid;
      if (toward.paid <= 0) continue;
      line.requestsPaid += 1;
      if (!toward.neighborId) continue;
      line.neighbors.add(toward.neighborId);
      helped.add(toward.neighborId);
      helpedIn(toward.month, toward.neighborId);
    }

    const status = { open: 0, approved: 0, paid: 0, declined: 0, closed: 0 };
    let referred = 0, amountRequested = 0, amountApproved = 0;
    for (const request of requests) {
      kindLineFor(request.kind).requests += 1;
      status[request.status] += 1;
      month(monthOf(request.createdAt)).requests += 1;
      if (request.referral) referred += 1;
      amountRequested += request.amountRequested;
      if (request.status === "approved" || request.status === "paid") amountApproved += request.amountApproved ?? 0;
    }

    for (const call of calls) month(monthOf(call.takenAt)).calls += 1;

    const serving = new Set<Id<"memberships">>();
    let visitHours = 0, visitMiles = 0;
    for (const visit of visits) {
      helped.add(visit.neighborId);
      const key = monthOf(visit.scheduledAt);
      month(key).visits += 1;
      helpedIn(key, visit.neighborId);
      for (const visitor of visit.visitors) {
        serving.add(visitor.memberId);
        visitHours += visitor.hours;
        visitMiles += visitor.miles;
      }
    }

    // Household sizes, read once per household and never returned.
    const households = new Map<Id<"neighbors">, Doc<"neighbors">>();
    for (const neighbor of await Promise.all([...helped].map((id) => ctx.db.get("neighbors", id))))
      if (neighbor && neighbor.churchId === args.churchId) households.set(neighbor._id, neighbor);
    const size = (id: Id<"neighbors">) => {
      const neighbor = households.get(id);
      return neighbor ? neighbor.adults + neighbor.children : 0;
    };
    const householdsByLanguage = { en: 0, es: 0, ht: 0 };
    let adults = 0, children = 0;
    for (const neighbor of households.values()) {
      adults += neighbor.adults;
      children += neighbor.children;
      householdsByLanguage[neighbor.language] += 1;
    }
    for (const [key, set] of monthHouseholds) month(key).households = set.size;

    // Time on shifts: assigned, not cancelled, begun in the year and already over.
    const shiftEnd = Math.min(span.end, now);
    const teamLines = await Promise.all(teams.map(async (team) => {
      const shifts = (await whole(ctx.db.query("commitments").withIndex("by_team_start", (q) => q.eq("teamId", team._id).gte("start", span.start).lt("start", shiftEnd))))
        .filter((shift) => shift.assigneeId && !shift.cancelled && shift.end <= now);
      const people = new Set(shifts.flatMap((shift) => (shift.assigneeId ? [shift.assigneeId] : [])));
      for (const person of people) serving.add(person);
      return { teamId: team._id, name: team.name, shifts: shifts.length, people: people.size, hours: round(shifts.reduce((hours, shift) => hours + (shift.end - shift.start) / 3600000, 0)) };
    }));
    const shiftHours = round(teamLines.reduce((hours, team) => hours + team.hours, 0));

    return {
      year: args.year,
      firstDay: span.firstDay,
      lastDay: span.lastDay,
      timeZone: zone,
      closed: now >= span.end,
      households: households.size,
      people: adults + children,
      adults,
      children,
      householdsByLanguage,
      visits: visits.length,
      peopleVisited: visits.reduce((people, visit) => people + size(visit.neighborId), 0),
      visitHours: round(visitHours),
      visitMiles: round(visitMiles),
      helpPaid,
      kinds: kinds.map((value) => {
        const line = kindLineFor(value);
        return { kind: value, requests: line.requests, requestsPaid: line.requestsPaid, households: line.neighbors.size, people: [...line.neighbors].reduce((people, id) => people + size(id), 0), paid: line.paid };
      }),
      requests: { received: requests.length, ...status, referred, amountRequested, amountApproved },
      calls: { taken: calls.length, returned: calls.filter((call) => call.callback === "done").length, waiting: calls.filter((call) => call.callback === "needed").length },
      time: {
        hours: round(visitHours + shiftHours),
        shiftHours,
        activeMembers: memberships.filter((member) => member.active).length,
        membersServing: serving.size,
        teams: teamLines.filter((team) => team.shifts > 0).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name)),
      },
      money: { beginningBalance, received, sources: lines(sources), otherSpending: lines(otherSpending), spent, endingBalance: beginningBalance + received - spent },
      months: span.months.map(month),
    };
  },
});
