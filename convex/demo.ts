import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { hour, hourAsked } from "./access";
import { seeded } from "./sampleData";

/** The made-up owner every visitor shares. It exists in Clerk with no password and belongs only to the sample conference. */
export const sampleOwner = { name: "Sample Owner", email: "demo@kindhelps.com" };

/** True for the one shared visitor account, named by the deployment. Off when the variable is unset. */
export function isSampleVisitor(clerkId: string | undefined) {
  return Boolean(clerkId) && clerkId === process.env.DEMO_CLERK_USER_ID;
}

/** Nothing a visitor types may leave a sample conference: no email, no invitation, whoever asks. */
export async function isSampleChurch(ctx: QueryCtx | MutationCtx, churchId: Id<"churches">) {
  return (await ctx.db.get("churches", churchId))?.sample === true;
}

/** Whether the person signed in came by the sample link, so the shell can say "Leave the sample". */
export const visiting = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => isSampleVisitor((await ctx.auth.getUserIdentity())?.subject),
});

const entries = new RateLimiter(components.rateLimiter, {
  // One network address: a room of judges may share it, so thirty a minute. Each entry is only a short ticket.
  sampleEntryByVisitor: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  // Everyone together: a ceiling on how many sessions the shared account can be asked for.
  sampleEntry: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 120 },
});

/**
 * The website asks this before it hands out an entry ticket, and is told which account the ticket is for.
 * `visitor` is a hash of the caller's address, never the address itself. Null means wait a little.
 * The account's id is not a secret, and lives only here, so replacing a lost visitor account is one
 * variable on this backend and no new build of the website.
 */
export const admit = mutation({
  args: { visitor: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { visitor }) => {
    const account = process.env.DEMO_CLERK_USER_ID;
    if (!account || !/^[0-9a-f]{64}$/.test(visitor)) return null;
    if (!(await entries.limit(ctx, "sampleEntryByVisitor", { key: visitor })).ok) return null;
    return (await entries.limit(ctx, "sampleEntry")).ok ? account : null;
  },
});

/**
 * Nightly, and once by hand at set-up: brings the visitor's sample conference back to the made-up year,
 * so whatever a visitor typed is gone by morning. Only rows that differ are written (see sampleData.renew). Touches only sample conferences that the
 * visitor account belongs to. Does nothing until the deployment names the visitor account.
 */
export const refresh = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const clerkId = process.env.DEMO_CLERK_USER_ID;
    if (!clerkId) return null;
    const known = await ctx.db.query("users").withIndex("by_clerk", (q) => q.eq("clerkId", clerkId)).unique();
    const userId = known?._id ?? (await ctx.db.insert("users", { clerkId }));
    const memberships = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).take(100);
    const owner = { userId, ...sampleOwner };
    let samples = 0;
    for (const member of memberships) {
      if (!(await isSampleChurch(ctx, member.churchId))) continue;
      samples++;
      // Only what differs from the made-up year is written; the closed year is kept as it is.
      await ctx.runMutation(internal.sampleData.renew, { churchId: member.churchId, owner });
    }
    if (!samples) await ctx.runMutation(internal.sampleData.load, { owner });
    return null;
  },
});

/**
 * What the nightly schedule runs. One reset reads the whole sample, about 1 MB of the month's database
 * allowance, and writes what moved, so a deployment nobody is shown, a development one, can turn the nightly reset
 * off with SAMPLE_NIGHTLY=off and be reset by hand (demo:refresh) when its sample is wanted fresh.
 * Unset, as on the live site, the sample is reset every night.
 */
export const nightly = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (process.env.SAMPLE_NIGHTLY !== "off") await ctx.runMutation(internal.demo.refresh, {});
    // Yesterday's per-visitor AI counts are spent: each night clears them (a few hundred at most, so in one go).
    const today = new Date().toISOString().slice(0, 10);
    for (const row of await ctx.db.query("aiUsageBySession").withIndex("by_day", q => q.lt("day", today)).take(1000)) await ctx.db.delete("aiUsageBySession", row._id);
    return null;
  },
});

const HOUR = 3_600_000, DAY = 24 * HOUR;
const seedKey = v.string();
const firstRoomCommitment = v.object({ id: seedKey, teamId: seedKey, title: v.string(), start: v.number(), end: v.number(), location: v.string(), preparation: v.string(), assigneeId: v.union(seedKey, v.null()), version: v.number(), status: v.string(), coordinatorName: v.string() });
const firstRoomAnnouncement = v.object({ id: seedKey, title: v.string(), body: v.string(), authorName: v.string(), createdAt: v.number() });
/**
 * This week of the sample conference, for anyone, before any sign-in: what the room draws while the visitor's
 * session is still being made. It is built from the seed alone for the hour asked (see sampleData.seeded):
 * it reads no database row, takes no id, and can be pointed at no conference. So it holds only made-up data,
 * never what a visitor typed, and costs no database allowance however many visitors ask. Each row carries a
 * seed key where the signed-in room has an id: a key opens nothing, and every act still needs the session.
 * The fields are those of workspace.dashboard as the sample's owner sees it, with the first requests and
 * announcements as pages.requestsPage and pages.announcementsPage give them, newest first.
 */
export const firstRoom = query({
  args: { at: hour },
  returns: v.union(v.null(), v.object({
    church: v.object({ id: seedKey, name: v.string(), timeZone: v.string(), sample: v.boolean(), wordSet: v.union(v.literal("general"), v.literal("vincentian")) }),
    user: v.object({ id: seedKey, name: v.string(), email: v.string(), language: v.union(v.literal("en"), v.literal("es")) }),
    canCoordinate: v.boolean(),
    truncated: v.array(v.string()),
    teams: v.array(v.object({ id: seedKey, name: v.string(), description: v.string(), memberIds: v.array(seedKey), approvedMemberIds: v.array(seedKey), myInvitation: v.boolean(), canCoordinate: v.boolean(), memberRoles: v.array(v.object({ personId: seedKey, role: v.union(v.literal("coordinator"), v.literal("member")) })) })),
    people: v.array(v.object({ id: seedKey, name: v.string(), email: v.string(), role: v.string(), active: v.boolean(), approved: v.boolean(), coverOptIn: v.boolean() })),
    commitments: v.array(firstRoomCommitment),
    requests: v.array(v.object({ id: seedKey, commitmentId: seedKey, recipientId: seedKey, status: v.string() })),
    availability: v.array(v.object({ id: seedKey, personId: seedKey, start: v.string(), end: v.string() })),
    timeOff: v.array(v.object({ id: seedKey, personId: seedKey, start: v.string(), end: v.string(), note: v.string() })),
    tasks: v.array(v.object({ id: seedKey, title: v.string(), dueAt: v.union(v.number(), v.null()), assigneeId: v.union(seedKey, v.null()), complete: v.boolean() })),
    meetings: v.array(v.object({ id: seedKey, title: v.string(), start: v.number(), end: v.number(), location: v.string(), fanoutStatus: v.union(v.literal("processing"), v.literal("complete")), responsesLimitedToSelf: v.boolean(), responses: v.array(v.object({ personId: seedKey, response: v.string() })) })),
    announcements: v.array(firstRoomAnnouncement),
    invitations: v.array(v.object({ id: seedKey, email: v.string(), role: v.string(), status: v.string() })),
    firstRequests: v.array(v.object({ id: seedKey, commitmentId: seedKey, recipientId: seedKey, status: v.string(), commitment: v.union(firstRoomCommitment, v.null()) })),
    firstAnnouncements: v.array(firstRoomAnnouncement),
    /** What drafts.weekNote answers the sample's owner for the hour asked. */
    weekNote: v.object({
      callsWaiting: v.number(), callsFirstByAssistant: v.number(), callsFirstByPerson: v.number(), oldestWaitingDays: v.number(),
      visitsPlanned: v.number(), requestsOpen: v.number(), approvedUnpaid: v.number(), approvedUnpaidCents: v.number(),
      openPlaces: v.number(), away: v.number(),
    }),
    /** How many drafts wait for a yes: the number of rows assistance.drafts answers. */
    draftsWaiting: v.number(),
  })),
  handler: async (_ctx, { at }) => {
    if (!process.env.DEMO_CLERK_USER_ID) return null;
    // The sample was last made at the nightly reset, 09:00 UTC, so the seed is asked for that moment and
    // matches the rows a visitor meets once signed in.
    const asked = hourAsked(at), reset = Math.floor((asked - 9 * HOUR) / DAY) * DAY + 9 * HOUR;
    const rows = await seeded(reset, sampleOwner);
    const [church] = rows("churches"), members = rows("memberships"), [me] = members;
    const teamMembers = rows("teamMembers").filter((relation) => relation.status === "active");
    const name = (id: string) => members.find((member) => member._id === id)?.name ?? "A former member";
    const most = <Row>(table: string, found: Row[]) => ({ table, rows: found.slice(0, 200), over: found.length > 200 });
    const shown = { commitments: most("commitments", rows("commitments")), requests: most("requests", rows("requests")), announcements: most("announcements", rows("announcements")) };
    const commitment = (shift: (typeof shown.commitments.rows)[number]) => ({ id: shift._id, teamId: shift.teamId, title: shift.title, start: shift.start, end: shift.end, location: shift.location, preparation: shift.preparation, assigneeId: shift.assigneeId, version: shift.version, status: shift.cancelled ? "cancelled" : shift.assigneeId ? "accepted" : "open", coordinatorName: name(shift.coordinatorId) });
    const announcement = (note: (typeof shown.announcements.rows)[number]) => ({ id: note._id, title: note.title, body: note.body, authorName: name(note.authorId), createdAt: note.createdAt });
    const request = (asking: (typeof shown.requests.rows)[number]) => ({ id: asking._id, commitmentId: asking.commitmentId, recipientId: asking.recipientId, status: asking.status });
    const responses = rows("meetingResponses");
    // The week note, worked out as drafts.weekNote does, from the hour asked to seven days on.
    const weekEnd = asked + 7 * DAY;
    const day = (time: number) => new Intl.DateTimeFormat("en-CA", { timeZone: church.timeZone }).format(time);
    const waiting = rows("calls").filter((call) => call.callback === "needed");
    const approved = rows("assistanceRequests").filter((asking) => asking.status === "approved");
    const ledger = rows("ledgerEntries");
    const paidToward = (requestId: string) => ledger.filter((entry) => entry.requestId === requestId).reduce((paid, entry) => paid + (entry.kind === "expense" ? entry.amount : -entry.amount), 0);
    const callIds = new Set(rows("calls").map((call) => call._id as string));
    return {
      church: { id: church._id, name: church.name, timeZone: church.timeZone, sample: true, wordSet: church.wordSet ?? "general" },
      user: { id: me._id, name: me.name, email: me.email, language: me.language === "es" ? "es" as const : "en" as const },
      canCoordinate: true,
      truncated: Object.values(shown).filter((kind) => kind.over).map((kind) => kind.table),
      teams: rows("teams").map((team) => {
        const on = teamMembers.filter((relation) => relation.teamId === team._id);
        return { id: team._id, name: team.name, description: team.description, memberIds: on.map((relation) => relation.memberId), approvedMemberIds: on.filter((relation) => relation.approved).map((relation) => relation.memberId), myInvitation: false, canCoordinate: true, memberRoles: on.map((relation) => ({ personId: relation.memberId, role: relation.teamRole })) };
      }),
      people: members.map((member) => ({ id: member._id, name: member.name, email: member.email, role: member.role, active: member.active, approved: member.approved, coverOptIn: member.coverOptIn })),
      commitments: shown.commitments.rows.map(commitment),
      requests: shown.requests.rows.map(request),
      availability: rows("availability").map((free) => ({ id: free._id, personId: free.memberId, start: free.start, end: free.end })),
      timeOff: rows("timeOff").map((away) => ({ id: away._id, personId: away.memberId, start: away.start, end: away.end, note: away.memberId === me._id ? away.note : "" })),
      tasks: rows("tasks").map((task) => ({ id: task._id, title: task.title, dueAt: task.dueAt, assigneeId: task.assigneeId, complete: task.complete })),
      meetings: rows("meetings").map((meeting) => ({ id: meeting._id, title: meeting.title, start: meeting.start, end: meeting.end, location: meeting.location, fanoutStatus: meeting.fanoutStatus, responsesLimitedToSelf: true, responses: responses.filter((response) => response.meetingId === meeting._id && response.memberId === me._id).map((response) => ({ personId: response.memberId, response: response.response })) })),
      announcements: shown.announcements.rows.map(announcement),
      invitations: rows("invitations").map((invitation) => ({ id: invitation._id, email: invitation.email, role: invitation.role, status: invitation.status })),
      firstRequests: rows("requests").reverse().slice(0, 25).map((asking) => {
        const shift = rows("commitments").find((found) => found._id === asking.commitmentId);
        return { ...request(asking), commitment: shift ? commitment(shift) : null };
      }),
      firstAnnouncements: rows("announcements").reverse().slice(0, 25).map(announcement),
      weekNote: {
        callsWaiting: waiting.length,
        callsFirstByAssistant: waiting.filter((call) => call.urgent?.reasons.length && call.urgent.by !== "person").length,
        callsFirstByPerson: waiting.filter((call) => call.urgent?.reasons.length && call.urgent.by === "person").length,
        oldestWaitingDays: waiting.length ? Math.max(0, Math.floor((asked - Math.min(...waiting.map((call) => call.takenAt))) / DAY)) : 0,
        visitsPlanned: rows("visits").filter((visit) => visit.status === "scheduled" && visit.scheduledAt >= asked && visit.scheduledAt < weekEnd).length,
        requestsOpen: rows("assistanceRequests").filter((asking) => asking.status === "open").length,
        approvedUnpaid: approved.length,
        approvedUnpaidCents: approved.reduce((owed, asking) => owed + Math.max(0, (asking.amountApproved ?? asking.amountRequested) - paidToward(asking._id)), 0),
        openPlaces: rows("commitments").filter((shift) => !shift.cancelled && !shift.assigneeId && shift.start >= asked && shift.start < weekEnd).length,
        away: new Set(rows("timeOff").filter((away) => away.start <= day(weekEnd) && away.end >= day(asked)).map((away) => away.memberId)).size,
      },
      draftsWaiting: rows("requestDrafts").filter((draft) => callIds.has(draft.callId)).length,
    };
  },
});
