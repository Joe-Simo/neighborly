import { v, type Infer } from "convex/values";
import { DateTime } from "luxon";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { logNeighborOpening, neighborAccess, neighborRecord } from "./access";
import { callRow, lookups, nameKey, phoneKey, requestRow, toCallRow, toRequestRow } from "./assistance";
import schema from "./schema";

/** Neighbor records: the people a group helps. Never the volunteers. */
const fields = schema.tables.neighbors.validator.fields;
const PAGE = 50;

const details = {
  name: v.string(),
  phone: v.string(),
  email: v.string(),
  address: v.string(),
  adults: v.number(),
  children: v.number(),
  language: fields.language,
  notes: v.string(),
};
const neighborRow = v.object({ id: v.id("neighbors"), ...details, createdAt: v.number() });
const toRow = (neighbor: Doc<"neighbors">): Infer<typeof neighborRow> => ({
  id: neighbor._id,
  name: neighbor.name,
  phone: neighbor.phone,
  email: neighbor.email,
  address: neighbor.address,
  adults: neighbor.adults,
  children: neighbor.children,
  language: neighbor.language,
  notes: neighbor.notes,
  createdAt: neighbor.createdAt,
});

function clean(args: Infer<ReturnType<typeof v.object<typeof details>>>) {
  const name = args.name.trim();
  if (!name || !nameKey(name)) throw new Error("A name is needed.");
  const count = (value: number, label: string, min: number) => {
    if (!Number.isInteger(value) || value < min || value > 30) throw new Error(`${label} must be a whole number.`);
    return value;
  };
  const short = (value: string, label: string, max: number) => {
    const trimmed = value.trim();
    if (trimmed.length > max) throw new Error(`${label} is too long.`);
    return trimmed;
  };
  return {
    name: short(name, "The name", 120),
    nameKey: nameKey(name),
    phone: short(args.phone, "The phone number", 40),
    phoneKey: phoneKey(args.phone),
    email: short(args.email, "The email", 200),
    address: short(args.address, "The address", 300),
    adults: count(args.adults, "Adults", 1),
    children: count(args.children, "Children", 0),
    language: args.language,
    notes: short(args.notes, "The note", 2000),
  };
}

/**
 * The neighbor list, by name. `search` finds names that start with the words typed, streets and
 * addresses that contain them, or phone numbers that start with the digits typed.
 */
export const list = query({
  args: { churchId: v.id("churches"), search: v.optional(v.string()) },
  returns: v.object({
    rows: v.array(v.object({ ...neighborRow.fields, openRequest: v.boolean(), visitPlanned: v.boolean(), lastHelpedAt: v.union(v.number(), v.null()) })),
    more: v.boolean(),
  }),
  handler: async (ctx, { churchId, search = "" }) => {
    await neighborAccess(ctx, churchId);
    const digits = phoneKey(search), words = nameKey(search);
    const byPhone = digits.length >= 3 && !/[a-z]/i.test(search);
    const byAddress = !byPhone && words ? await ctx.db.query("neighbors").withSearchIndex("search_address", (q) => q.search("address", search).eq("churchId", churchId)).take(PAGE) : [];
    const listed = byPhone
      ? await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).gte("phoneKey", digits).lt("phoneKey", `${digits}:`)).take(PAGE + 1)
      : words
        ? await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).gte("nameKey", words).lt("nameKey", `${words}￿`)).take(PAGE + 1)
        : await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId)).take(PAGE + 1);
    const found = [...listed, ...byAddress.filter((neighbor) => !listed.some((other) => other._id === neighbor._id))];
    const rows = await Promise.all(found.slice(0, PAGE).map(async (neighbor) => {
      const requests = await ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighbor._id)).order("desc").take(50);
      const visits = await ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", neighbor._id)).order("desc").take(20);
      const helped = requests.filter((request) => request.status === "paid" || request.status === "approved").map((request) => request.decidedAt ?? request.createdAt);
      return {
        ...toRow(neighbor),
        openRequest: requests.some((request) => request.status === "open" || request.status === "approved"),
        visitPlanned: visits.some((visit) => visit.status === "scheduled"),
        lastHelpedAt: helped.length ? Math.max(...helped) : null,
      };
    }));
    return { rows, more: found.length > PAGE };
  },
});

/** Before adding someone: neighbors already on file with the same phone number or the same name. */
export const matches = query({
  args: { churchId: v.id("churches"), name: v.string(), phone: v.string() },
  returns: v.array(v.object({ ...neighborRow.fields, same: v.union(v.literal("phone"), v.literal("name")) })),
  handler: async (ctx, { churchId, name, phone }) => {
    await neighborAccess(ctx, churchId);
    const digits = phoneKey(phone), words = nameKey(name);
    const samePhone = digits ? await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", digits)).take(5) : [];
    const sameName = words ? await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", words)).take(5) : [];
    return [
      ...samePhone.map((neighbor) => ({ ...toRow(neighbor), same: "phone" as const })),
      ...sameName.filter((neighbor) => !samePhone.some((other) => other._id === neighbor._id)).map((neighbor) => ({ ...toRow(neighbor), same: "name" as const })),
    ];
  },
});

/**
 * Adds a neighbor. A phone number or name already on file is refused, so a household is not entered
 * twice; pass `confirmedNew` after a person has looked at the matches and said this is someone else.
 * Give `callId` to tie the call that brought them to the new record.
 */
export const create = mutation({
  args: { churchId: v.id("churches"), ...details, callId: v.optional(v.id("calls")), confirmedNew: v.optional(v.boolean()) },
  returns: v.id("neighbors"),
  handler: async (ctx, { churchId, callId, confirmedNew, ...input }) => {
    const member = await neighborAccess(ctx, churchId);
    const record = clean(input);
    if (!confirmedNew) {
      const samePhone = record.phoneKey ? await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", record.phoneKey)).first() : null;
      const existing = samePhone ?? (await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", record.nameKey)).first());
      if (existing) throw new Error(`${existing.name} is already on file with this ${samePhone ? "phone number" : "name"}.`);
    }
    const neighborId = await ctx.db.insert("neighbors", { churchId, ...record, createdBy: member._id, createdAt: Date.now() });
    if (callId) {
      const call = await ctx.db.get("calls", callId);
      if (!call || call.churchId !== churchId) throw new Error("Call not found.");
      if (!call.neighborId) await ctx.db.patch("calls", callId, { neighborId });
    }
    return neighborId;
  },
});

export const update = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), ...details },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId, ...input }) => {
    await neighborRecord(ctx, churchId, neighborId);
    await ctx.db.patch("neighbors", neighborId, clean(input));
    return null;
  },
});

/** Opening a record is written to the audit trail. The screen calls this, then reads `record`. */
export const open = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors") },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId }) => {
    const { member, neighbor } = await neighborRecord(ctx, churchId, neighborId);
    await logNeighborOpening(ctx, member, neighbor._id);
    return null;
  },
});

const historyEvent = v.union(
  v.object({ type: v.literal("call"), at: v.number(), note: v.string(), who: v.string() }),
  v.object({ type: v.literal("visit"), at: v.number(), who: v.array(v.string()) }),
  v.object({ type: v.literal("payment"), at: v.number(), category: v.string(), payee: v.string(), amount: v.number(), who: v.string() }),
  v.object({ type: v.literal("decision"), at: v.number(), kind: schema.tables.assistanceRequests.validator.fields.kind, status: v.union(v.literal("declined"), v.literal("closed")), note: v.string(), who: v.string() }),
);

/**
 * One neighbor's record: who they are, what is open, and everything that has happened, newest first.
 * Payments are read from the ledger; nothing here writes to it.
 */
export const record = query({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors") },
  returns: v.object({
    neighbor: neighborRow,
    paidThisYear: v.number(),
    requestsThisYear: v.number(),
    visitsDone: v.number(),
    lastVisitAt: v.union(v.number(), v.null()),
    since: v.number(),
    open: v.array(requestRow),
    requests: v.array(requestRow),
    calls: v.array(callRow),
    history: v.array(historyEvent),
    openings: v.array(v.object({ who: v.string(), at: v.number() })),
  }),
  handler: async (ctx, { churchId, neighborId }) => {
    const { neighbor } = await neighborRecord(ctx, churchId, neighborId);
    const church = await ctx.db.get("churches", churchId);
    const yearStart = DateTime.now().setZone(church?.timeZone ?? "UTC").startOf("year");
    const found = lookups(ctx);
    const [requestDocs, callDocs, visitDocs, entries] = await Promise.all([
      ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
      ctx.db.query("calls").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
      ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
      ctx.db.query("ledgerEntries").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
    ]);
    const requests = await Promise.all(requestDocs.map((request) => toRequestRow(found, request)));
    const calls = await Promise.all(callDocs.map((call) => toCallRow(found, call)));
    const payments = entries.filter((entry) => entry.kind === "expense" && !entry.voidedAt);
    const visitsDone = visitDocs.filter((visit) => visit.status === "completed");
    const history: Infer<typeof historyEvent>[] = [
      ...calls.map((call) => ({ type: "call" as const, at: call.takenAt, note: call.note, who: call.takenByName })),
      ...(await Promise.all(visitsDone.map(async (visit) => ({ type: "visit" as const, at: visit.completedAt ?? visit.scheduledAt, who: await Promise.all(visit.visitors.map((visitor) => found.memberName(visitor.memberId))) })))),
      ...(await Promise.all(payments.map(async (entry) => ({ type: "payment" as const, at: DateTime.fromISO(entry.date, { zone: church?.timeZone ?? "UTC" }).toMillis(), category: entry.category, payee: entry.payee, amount: entry.amount, who: await found.memberName(entry.recordedBy) })))),
      ...requests.flatMap((request) => (request.status === "declined" || request.status === "closed" ? [{ type: "decision" as const, at: request.decidedAt ?? request.createdAt, kind: request.kind, status: request.status, note: request.decisionNote, who: request.decidedByName ?? request.createdByName }] : [])),
    ].sort((a, b) => b.at - a.at);
    const opened = await ctx.db.query("auditEvents").withIndex("by_church_action_target", (q) => q.eq("churchId", churchId).eq("action", "neighbor.opened").eq("targetId", neighborId)).order("desc").take(20);
    const openers = new Map<string, Promise<string>>();
    const opener = (userId: (typeof opened)[number]["actorId"]) => {
      const known = openers.get(userId) ?? ctx.db.query("memberships").withIndex("by_church_user", (q) => q.eq("churchId", churchId).eq("userId", userId)).unique().then((member) => member?.name ?? "Former member");
      openers.set(userId, known);
      return known;
    };
    return {
      openings: await Promise.all(opened.map(async (event) => ({ who: await opener(event.actorId), at: event.at }))),
      neighbor: toRow(neighbor),
      paidThisYear: payments.filter((entry) => entry.date >= yearStart.toFormat("yyyy-MM-dd")).reduce((sum, entry) => sum + entry.amount, 0),
      requestsThisYear: requests.filter((request) => request.createdAt >= yearStart.toMillis()).length,
      visitsDone: visitsDone.length,
      lastVisitAt: visitsDone.length ? Math.max(...visitsDone.map((visit) => visit.completedAt ?? visit.scheduledAt)) : null,
      since: Math.min(neighbor.createdAt, ...history.map((event) => event.at)),
      open: requests.filter((request) => request.status === "open" || request.status === "approved"),
      requests,
      calls,
      history,
    };
  },
});
