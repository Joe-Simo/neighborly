import { ConvexError, v, type Infer } from "convex/values";
import { IANAZone } from "luxon";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { hour, hourAsked, membership, user } from "./access";
import { yearFigures, type YearReport } from "./reports";

/**
 * District and particular councils: a council links its member conferences and adds up their year together, as
 * ServWare's council features do for the annual report. A council owner invites a conference by its code; the
 * conference's owner accepts in Your files; either side can end the link.
 *
 * Only counts and money totals cross a link. A council never receives a neighbor, a call, a request, a note, a
 * member's name or a team's name: `figures` below picks plain numbers out of the conference's year report and
 * nothing else. Each conference's year is counted in its own time zone, as its own report counts it.
 */
const MOST_CONFERENCES = 200;

export const councilFigures = v.object({
  households: v.number(),
  people: v.number(),
  adults: v.number(),
  children: v.number(),
  visits: v.number(),
  peopleVisited: v.number(),
  visitHours: v.number(),
  visitMiles: v.number(),
  requestsReceived: v.number(),
  amountRequested: v.number(),
  helpPaid: v.number(),
  callsTaken: v.number(),
  hoursOfService: v.number(),
  activeMembers: v.number(),
  membersServing: v.number(),
  moneyReceived: v.number(),
  moneySpent: v.number(),
  endingBalance: v.number(),
});
export type CouncilFigures = Infer<typeof councilFigures>;
const figureKeys = Object.keys(councilFigures.fields) as (keyof CouncilFigures)[];

/** The numbers, and only the numbers, of one conference's year. */
export function figures(report: YearReport): CouncilFigures {
  return {
    households: report.households,
    people: report.people,
    adults: report.adults,
    children: report.children,
    visits: report.visits,
    peopleVisited: report.peopleVisited,
    visitHours: report.visitHours,
    visitMiles: report.visitMiles,
    requestsReceived: report.requests.received,
    amountRequested: report.requests.amountRequested,
    helpPaid: report.helpPaid,
    callsTaken: report.calls.taken,
    hoursOfService: report.time.hours,
    activeMembers: report.time.activeMembers,
    membersServing: report.time.membersServing,
    moneyReceived: report.money.received,
    moneySpent: report.money.spent,
    endingBalance: report.money.endingBalance,
  };
}

/** Adds conference figures together. A household helped by two conferences is two households, as each reports it. */
export function sum(rows: CouncilFigures[]): CouncilFigures {
  const total = Object.fromEntries(figureKeys.map((key) => [key, 0])) as CouncilFigures;
  for (const row of rows) for (const key of figureKeys) total[key] += row[key];
  for (const key of ["visitHours", "visitMiles", "hoursOfService"] as const) total[key] = Math.round(total[key] * 100) / 100;
  return total;
}

async function councilOwner(ctx: QueryCtx | MutationCtx, councilId: Id<"councils">) {
  const account = await user(ctx);
  const seat = await ctx.db.query("councilMembers").withIndex("by_council_user", (q) => q.eq("councilId", councilId).eq("userId", account.id)).unique();
  if (seat?.role !== "owner") throw new ConvexError("Council owner access required.");
  const council = await ctx.db.get("councils", councilId);
  if (!council) throw new ConvexError("Council not found.");
  return { account, council };
}

async function conferenceOwner(ctx: QueryCtx | MutationCtx, churchId: Id<"churches">) {
  const member = await membership(ctx, churchId);
  if (member.role !== "owner") throw new ConvexError("Church owner access required.");
  return member;
}

async function linksOf(ctx: QueryCtx, councilId: Id<"councils">) {
  return ctx.db.query("councilLinks").withIndex("by_council", (q) => q.eq("councilId", councilId)).take(MOST_CONFERENCES);
}

export const create = mutation({
  args: { name: v.string(), timeZone: v.string() },
  returns: v.id("councils"),
  handler: async (ctx, args) => {
    const account = await user(ctx);
    const name = args.name.trim();
    if (!name || name.length > 120) throw new ConvexError("Name the council.");
    if (!IANAZone.isValidZone(args.timeZone)) throw new ConvexError("Choose a time zone.");
    const councilId = await ctx.db.insert("councils", { name, timeZone: args.timeZone, createdAt: Date.now() });
    await ctx.db.insert("councilMembers", { councilId, userId: account.id, role: "owner" });
    return councilId;
  },
});

const linkLine = v.object({ id: v.id("councilLinks"), name: v.string(), status: v.union(v.literal("pending"), v.literal("accepted")) });

/** The councils the signed-in person owns, with the conferences each has invited. Empty for nearly everyone. */
export const mine = query({
  args: {},
  returns: v.array(v.object({ id: v.id("councils"), name: v.string(), conferences: v.array(linkLine) })),
  handler: async (ctx) => {
    const account = await user(ctx);
    const seats = await ctx.db.query("councilMembers").withIndex("by_user", (q) => q.eq("userId", account.id)).take(20);
    const councils = await Promise.all(
      seats.filter((seat) => seat.role === "owner").map(async (seat) => {
        const council = await ctx.db.get("councils", seat.councilId);
        if (!council) return null;
        const links = await linksOf(ctx, council._id);
        const conferences = await Promise.all(
          links.map(async (link) => ({ id: link._id, name: (await ctx.db.get("churches", link.churchId))?.name ?? "", status: link.status })),
        );
        return { id: council._id, name: council.name, conferences: conferences.sort((a, b) => a.name.localeCompare(b.name)) };
      }),
    );
    return councils.flatMap((council) => (council ? [council] : []));
  },
});

/** A council owner invites a conference by the code its owner reads them from Your files. */
export const invite = mutation({
  args: { councilId: v.id("councils"), code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await councilOwner(ctx, args.councilId);
    const churchId = ctx.db.normalizeId("churches", args.code.trim());
    const church = churchId && (await ctx.db.get("churches", churchId));
    if (!church || church.sample) throw new ConvexError("No conference has that code.");
    const already = await ctx.db.query("councilLinks").withIndex("by_council_church", (q) => q.eq("councilId", args.councilId).eq("churchId", church._id)).first();
    if (already) throw new ConvexError("That conference is already invited.");
    if ((await linksOf(ctx, args.councilId)).length >= MOST_CONFERENCES) throw new ConvexError("A council can hold 200 conferences.");
    await ctx.db.insert("councilLinks", { councilId: args.councilId, churchId: church._id, status: "pending", createdAt: Date.now() });
    return null;
  },
});

/** For a conference's owner: its code, and the councils that invited it or count it. */
export const forConference = query({
  args: { churchId: v.id("churches") },
  returns: v.object({ code: v.string(), councils: v.array(linkLine) }),
  handler: async (ctx, args) => {
    await conferenceOwner(ctx, args.churchId);
    const links = await ctx.db.query("councilLinks").withIndex("by_church", (q) => q.eq("churchId", args.churchId)).take(50);
    const councils = await Promise.all(
      links.map(async (link) => ({ id: link._id, name: (await ctx.db.get("councils", link.councilId))?.name ?? "", status: link.status })),
    );
    return { code: args.churchId, councils };
  },
});

async function linkOf(ctx: MutationCtx, linkId: Id<"councilLinks">): Promise<Doc<"councilLinks">> {
  const link = await ctx.db.get("councilLinks", linkId);
  if (!link) throw new ConvexError("Invitation not found.");
  return link;
}

/** The conference's owner accepts a council's invitation: from now on its year's counts add into the council's. */
export const accept = mutation({
  args: { linkId: v.id("councilLinks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await linkOf(ctx, args.linkId);
    await conferenceOwner(ctx, link.churchId);
    if (link.status !== "accepted") await ctx.db.patch("councilLinks", link._id, { status: "accepted" });
    return null;
  },
});

/** Either side ends a link, or turns down an invitation. */
export const unlink = mutation({
  args: { linkId: v.id("councilLinks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await linkOf(ctx, args.linkId);
    const account = await user(ctx);
    const seat = await ctx.db.query("councilMembers").withIndex("by_council_user", (q) => q.eq("councilId", link.councilId).eq("userId", account.id)).unique();
    if (seat?.role !== "owner") await conferenceOwner(ctx, link.churchId);
    await ctx.db.delete("councilLinks", link._id);
    return null;
  },
});

export const councilYear = v.object({
  council: v.string(),
  year: v.number(),
  /** False while any conference's year is still running. */
  closed: v.boolean(),
  total: councilFigures,
  conferences: v.array(v.object({ name: v.string(), figures: councilFigures })),
});
export type CouncilYear = Infer<typeof councilYear>;

/** The council's year: each accepted conference's counts and sums, and all of them added up. Council owners only. */
export const yearReport = query({
  args: { councilId: v.id("councils"), year: v.number(), at: hour },
  returns: councilYear,
  handler: async (ctx, args) => {
    const { council } = await councilOwner(ctx, args.councilId);
    const now = hourAsked(args.at);
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2200) throw new ConvexError("Choose a year.");
    const accepted = (await linksOf(ctx, args.councilId)).filter((link) => link.status === "accepted");
    const rows = await Promise.all(
      accepted.map(async (link) => {
        const church = await ctx.db.get("churches", link.churchId);
        if (!church) return null;
        const report = await yearFigures(ctx, { churchId: church._id, year: args.year }, now);
        return { name: church.name, closed: report.closed, figures: figures(report) };
      }),
    );
    const conferences = rows.flatMap((row) => (row ? [row] : [])).sort((a, b) => a.name.localeCompare(b.name));
    return {
      council: council.name,
      year: args.year,
      closed: conferences.every((row) => row.closed),
      total: sum(conferences.map((row) => row.figures)),
      conferences: conferences.map(({ name, figures: numbers }) => ({ name, figures: numbers })),
    };
  },
});
