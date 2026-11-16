import { ConvexError, v, type Infer } from "convex/values";
import { DateTime } from "luxon";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { neighborAccess } from "./access";
import { incomeSources, paidTowardRequest } from "./treasury";

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
  if (read.length > limit) throw new ConvexError("This year holds more records than one report can add up.");
  return read;
}

/** A whole fiscal year, or one of its quarters: 1 is October to December, 4 is July to September. */
export function fiscalYear(year: number, zone: string, quarter?: number) {
  const first = DateTime.fromObject({ year: year - 1, month: 10, day: 1 }, { zone });
  const start = quarter ? first.plus({ months: 3 * (quarter - 1) }) : first;
  const end = start.plus({ months: quarter ? 3 : 12 });
  return {
    start: start.toMillis(),
    end: end.toMillis(),
    firstDay: start.toFormat("yyyy-MM-dd"),
    lastDay: end.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
    dayAfter: end.toFormat("yyyy-MM-dd"),
    months: Array.from({ length: quarter ? 3 : 12 }, (_, index) => start.plus({ months: index }).toFormat("yyyy-MM")),
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
const memberLine = v.object({
  memberId: v.id("memberships"),
  name: v.string(),
  visits: v.number(),
  shifts: v.number(),
  /** Visit hours plus finished shift hours. */
  hours: v.number(),
  miles: v.number(),
});
const teamLine = v.object({ teamId: v.id("teams"), name: v.string(), shifts: v.number(), people: v.number(), hours: v.number() });

export const yearReport = v.object({
  year: v.number(),
  /** 1 to 4 when the report covers one quarter, null for the whole year. */
  quarter: v.union(v.null(), v.number()),
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
  /** Households that money went toward for more than one request in the period. */
  householdsHelpedAgain: v.number(),
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
    /** Approved amounts of the requests received in the period that stand approved or paid today. */
    amountApproved: v.number(),
    /** Of the help paid in the period: the part toward requests received in the period, and the part toward earlier ones. Together they are helpPaid. */
    paidTowardThese: v.number(),
    /** Requests received in the period and marked paid whose payment is dated after the period: how many, and how much of the approved amount. */
    paidLater: v.object({ requests: v.number(), amount: v.number() }),
    /** Closed after part of the approved amount was paid: how many, what was paid in all, and what had been approved. They are not "closed without help". */
    closedAfterPart: v.object({ requests: v.number(), paid: v.number(), approved: v.number() }),
    paidTowardEarlier: v.number(),
  }),
  /** Vouchers from the shelf in the period. Given is net of those taken back; households are those left holding at least one. */
  vouchers: v.object({ given: v.number(), takenBack: v.number(), requests: v.number(), households: v.number() }),
  calls: v.object({ taken: v.number(), returned: v.number(), waiting: v.number() }),
  /**
   * Help recorded in ServWare before the group moved over, brought in as requests with source "import".
   * It has no ledger entries, so it is kept apart: none of it is in helpPaid, kinds, requests or money.
   */
  history: v.object({
    requests: v.number(),
    households: v.number(),
    people: v.number(),
    amount: v.number(),
    kinds: v.array(v.object({ kind, requests: v.number(), amount: v.number() })),
    /** Households helped here or in the history, each counted once, and the people in them. */
    householdsInAll: v.number(),
    peopleInAll: v.number(),
  }),
  time: v.object({
    /** Visit hours plus the hours of finished, assigned shifts. */
    hours: v.number(),
    shiftHours: v.number(),
    /** Members marked active today. */
    activeMembers: v.number(),
    /** Different members who made a visit or served a shift in the year. */
    membersServing: v.number(),
    teams: v.array(teamLine),
    /** Each member who served, most hours first. Members are volunteers, never neighbors. */
    members: v.array(memberLine),
  }),
  money: v.object({
    /** Every ledger entry before the first day, plus any "Opening balance" entered in the period. */
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
    if (!church) throw new ConvexError("Group not found.");
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

/**
 * What each flagged record is, so the check before sending can say it in a line and open it:
 * the kind, amount and dates, and the neighbor record that holds a request. Never a name.
 * A record from another group, or one that is gone, is left out.
 */
export const flagged = query({
  args: { churchId: v.id("churches"), requestIds: v.array(v.id("assistanceRequests")), visitIds: v.array(v.id("visits")) },
  returns: v.object({
    requests: v.array(v.object({ id: v.id("assistanceRequests"), neighborId: v.union(v.id("neighbors"), v.null()), kind, amount: v.number(), status: v.string(), at: v.number() })),
    visits: v.array(v.object({ id: v.id("visits"), status: v.string(), at: v.number() })),
  }),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    if (args.requestIds.length + args.visitIds.length > 500) throw new ConvexError("Too many records to open at once.");
    const [requests, visits] = await Promise.all([
      Promise.all(args.requestIds.map((id) => ctx.db.get("assistanceRequests", id))),
      Promise.all(args.visitIds.map((id) => ctx.db.get("visits", id))),
    ]);
    // A removed record is kept without a name so the year still adds up, and has no page to open: its
    // neighbor row has an empty name key, which no live record can have. Such a request names no neighbor here.
    const holders = new Map(await Promise.all([...new Set(requests.flatMap((request) => (request?.neighborId ? [request.neighborId] : [])))].map(async (id) => [id, await ctx.db.get("neighbors", id)] as const)));
    const opens = (neighborId: Id<"neighbors"> | undefined) => (neighborId && holders.get(neighborId)?.nameKey ? neighborId : null);
    return {
      requests: requests.flatMap((request) =>
        request?.churchId === args.churchId
          ? [{ id: request._id, neighborId: opens(request.neighborId), kind: request.kind, amount: request.amountApproved ?? request.amountRequested, status: request.status, at: request.decidedAt ?? request.createdAt }]
          : [],
      ),
      visits: visits.flatMap((visit) => (visit?.churchId === args.churchId ? [{ id: visit._id, status: visit.status, at: visit.scheduledAt }] : [])),
    };
  },
});

export const year = query({
  args: { churchId: v.id("churches"), year: v.number(), quarter: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4))) },
  returns: yearReport,
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const church = await ctx.db.get("churches", args.churchId);
    if (!church) throw new ConvexError("Group not found.");
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2200) throw new ConvexError("Choose a year.");
    const zone = church.timeZone;
    const span = fiscalYear(args.year, zone, args.quarter);
    const now = Date.now();
    const monthOf = (time: number) => DateTime.fromMillis(time, { zone }).toFormat("yyyy-MM");
    const inChurch = { churchId: args.churchId };

    const [calls, everyRequest, plannedVisits, ledger, memberships, teams, shelf] = await Promise.all([
      whole(ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", args.churchId).gte("takenAt", span.start).lt("takenAt", span.end))),
      whole(ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", args.churchId).gte("createdAt", span.start).lt("createdAt", span.end))),
      whole(ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", args.churchId).gte("scheduledAt", span.start).lt("scheduledAt", span.end))),
      // The ledger from its first day to the end of the year: what came before is the beginning balance.
      whole(ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", args.churchId).lt("date", span.dayAfter)), LEDGER_LIMIT),
      whole(ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", inChurch.churchId))),
      whole(ctx.db.query("teams").withIndex("by_church", (q) => q.eq("churchId", inChurch.churchId)), 200),
      whole(ctx.db.query("voucherStock").withIndex("by_church", (q) => q.eq("churchId", args.churchId).gte("date", span.firstDay).lt("date", span.dayAfter))),
    ]);
    const visits = plannedVisits.filter((visit) => visit.status === "completed");
    const requests = everyRequest.filter((request) => request.source !== "import");
    const imported = everyRequest.filter((request) => request.source === "import");

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
      // What the group began with is a balance, not money received, even when it was entered inside the period.
      if (entry.date < span.firstDay || (entry.category === incomeSources.opening && !entry.requestId)) { beginningBalance += signed; continue; }
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
    const requestsPaidFor = new Map<Id<"neighbors">, number>();
    let helpPaid = 0;
    for (const toward of paidByRequest.values()) {
      const line = kindLineFor(toward.kind);
      line.paid += toward.paid;
      helpPaid += toward.paid;
      if (toward.paid <= 0) continue;
      line.requestsPaid += 1;
      if (!toward.neighborId) continue;
      line.neighbors.add(toward.neighborId);
      add(requestsPaidFor, toward.neighborId, 1);
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

    // A request closed after money went out was helped in part; what was paid stays counted as paid.
    const closedAfterPart = { requests: 0, paid: 0, approved: 0 };
    await Promise.all(
      requests.filter((request) => request.status === "closed").map(async (request) => {
        const paid = await paidTowardRequest(ctx, request._id);
        if (paid <= 0) return;
        closedAfterPart.requests += 1;
        closedAfterPart.paid += paid;
        closedAfterPart.approved += request.amountApproved ?? 0;
      }),
    );

    // Vouchers from the shelf. A line tied to a request goes down when given and up when taken back.
    const vouchers = { given: 0, takenBack: 0 };
    const heldByRequest = new Map<Id<"assistanceRequests">, { held: number; month: string }>();
    for (const line of shelf) {
      if (!line.requestId) continue;
      // Given is what stayed given: a voucher taken back comes off it.
      vouchers.given -= line.change;
      if (line.change > 0) vouchers.takenBack += line.change;
      const held = heldByRequest.get(line.requestId) ?? { held: 0, month: line.date.slice(0, 7) };
      held.held -= line.change;
      heldByRequest.set(line.requestId, held);
    }
    const voucherLine = kindLineFor("voucher");
    const voucherHouseholds = new Set<Id<"neighbors">>();
    let voucherRequests = 0;
    const requestById = new Map(everyRequest.map((request) => [request._id, request]));
    await Promise.all(
      [...heldByRequest].map(async ([requestId, { held, month: key }]) => {
        if (held <= 0) return;
        const request = requestById.get(requestId) ?? (await ctx.db.get("assistanceRequests", requestId));
        if (!request || request.churchId !== args.churchId) return;
        voucherRequests += 1;
        voucherHouseholds.add(request.neighborId);
        voucherLine.neighbors.add(request.neighborId);
        helped.add(request.neighborId);
        helpedIn(key, request.neighborId);
      }),
    );

    for (const call of calls) month(monthOf(call.takenAt)).calls += 1;

    const receivedIds = new Set(requests.map((request) => request._id));
    let paidTowardThese = 0;
    for (const [requestId, toward] of paidByRequest) if (receivedIds.has(requestId)) paidTowardThese += toward.paid;
    const paidLater = { requests: 0, amount: 0 };
    for (const request of requests) {
      // A voucher from the shelf is marked paid and owes no money, so no payment is ever coming for it.
      if (request.status !== "paid" || !request.amountApproved) continue;
      const paid = paidByRequest.get(request._id)?.paid ?? 0;
      if (paid <= 0) paidLater.requests += 1;
      paidLater.amount += Math.max(0, (request.amountApproved ?? 0) - paid);
    }

    const serving = new Map<Id<"memberships">, { visits: number; shifts: number; hours: number; miles: number }>();
    const served = (memberId: Id<"memberships">) => {
      const line = serving.get(memberId) ?? { visits: 0, shifts: 0, hours: 0, miles: 0 };
      serving.set(memberId, line);
      return line;
    };
    let visitHours = 0, visitMiles = 0;
    for (const visit of visits) {
      helped.add(visit.neighborId);
      const key = monthOf(visit.scheduledAt);
      month(key).visits += 1;
      helpedIn(key, visit.neighborId);
      for (const visitor of visit.visitors) {
        const line = served(visitor.memberId);
        line.visits += 1;
        line.hours += visitor.hours;
        line.miles += visitor.miles;
        visitHours += visitor.hours;
        visitMiles += visitor.miles;
      }
    }

    // Household sizes, read once per household and never returned.
    const inHistory = new Set(imported.map((request) => request.neighborId));
    const known = new Map<Id<"neighbors">, Doc<"neighbors">>();
    for (const neighbor of await Promise.all([...new Set([...helped, ...inHistory])].map((id) => ctx.db.get("neighbors", id))))
      if (neighbor && neighbor.churchId === args.churchId) known.set(neighbor._id, neighbor);
    const size = (id: Id<"neighbors">) => {
      const neighbor = known.get(id);
      return neighbor ? neighbor.adults + neighbor.children : 0;
    };
    const peopleIn = (ids: Iterable<Id<"neighbors">>) => [...ids].reduce((people, id) => people + size(id), 0);
    const households = new Map([...known].filter(([id]) => helped.has(id)));
    const historyHouseholds = [...inHistory].filter((id) => known.has(id));
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
      const people = new Set<Id<"memberships">>();
      for (const shift of shifts) {
        if (!shift.assigneeId) continue;
        people.add(shift.assigneeId);
        const line = served(shift.assigneeId);
        line.shifts += 1;
        line.hours += (shift.end - shift.start) / 3600000;
      }
      return { teamId: team._id, name: team.name, shifts: shifts.length, people: people.size, hours: round(shifts.reduce((hours, shift) => hours + (shift.end - shift.start) / 3600000, 0)) };
    }));
    const shiftHours = round(teamLines.reduce((hours, team) => hours + team.hours, 0));

    const names = new Map(memberships.map((member) => [member._id, member.name]));

    return {
      year: args.year,
      quarter: args.quarter ?? null,
      firstDay: span.firstDay,
      lastDay: span.lastDay,
      timeZone: zone,
      closed: now >= span.end,
      households: households.size,
      people: adults + children,
      adults,
      children,
      householdsHelpedAgain: [...requestsPaidFor.values()].filter((paid) => paid > 1).length,
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
      requests: { received: requests.length, ...status, referred, amountRequested, amountApproved, paidTowardThese, paidLater, closedAfterPart, paidTowardEarlier: helpPaid - paidTowardThese },
      history: {
        requests: imported.length,
        households: historyHouseholds.length,
        people: peopleIn(historyHouseholds),
        amount: imported.reduce((amount, request) => amount + (request.importedAmount ?? 0), 0),
        kinds: kinds.map((value) => {
          const ofKind = imported.filter((request) => request.kind === value);
          return { kind: value, requests: ofKind.length, amount: ofKind.reduce((amount, request) => amount + (request.importedAmount ?? 0), 0) };
        }),
        householdsInAll: known.size,
        peopleInAll: peopleIn(known.keys()),
      },
      vouchers: { ...vouchers, requests: voucherRequests, households: voucherHouseholds.size },
      calls: { taken: calls.length, returned: calls.filter((call) => call.callback === "done").length, waiting: calls.filter((call) => call.callback === "needed").length },
      time: {
        hours: round(visitHours + shiftHours),
        shiftHours,
        // The council's report counts the people who can serve: with access, and marked ready to serve.
        activeMembers: memberships.filter((member) => member.active && member.approved).length,
        membersServing: serving.size,
        teams: teamLines.filter((team) => team.shifts > 0).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name)),
        members: [...serving]
          .map(([memberId, line]) => ({ memberId, name: names.get(memberId) ?? "A former member", visits: line.visits, shifts: line.shifts, hours: round(line.hours), miles: round(line.miles) }))
          .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name)),
      },
      money: { beginningBalance, received, sources: lines(sources), otherSpending: lines(otherSpending), spent, endingBalance: beginningBalance + received - spent },
      months: span.months.map(month),
    };
  },
});
