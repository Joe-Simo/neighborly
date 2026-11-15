import { v, type Infer } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { neighborAccess, neighborRecord } from "./access";
import { urgentReasons } from "../src/lib/urgency";
import schema from "./schema";

/**
 * The help line and requests for help.
 *
 * Other streams read requests through `requests`, `requestsForNeighbor` and `request`, which all
 * return `requestRow`. Treasury moves a request between "approved" and "paid" with `settleRequest`.
 */
const requestFields = schema.tables.assistanceRequests.validator.fields;
const callFields = schema.tables.calls.validator.fields;
const urgentBy = v.union(v.literal("assistant"), v.literal("person"));
/** A payment never goes to the neighbor, so the form offers only these. */
const payeeKind = v.union(v.literal("landlord"), v.literal("utility"), v.literal("vendor"));
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MAX_CENTS = 10_000_000;

export const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

function text(value: string, label: string, max: number, required = false) {
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${label} is needed.`);
  if (trimmed.length > max) throw new Error(`${label} is too long.`);
  return trimmed;
}
function wholeCents(amount: number, label: string, min = 0) {
  if (!Number.isInteger(amount) || amount < min || amount > MAX_CENTS) throw new Error(`${label} must be a dollar amount.`);
  return amount;
}

/** Looks up each member or neighbor once per function call, however many rows mention them. */
export function lookups(ctx: QueryCtx) {
  const members = new Map<Id<"memberships">, Promise<string>>();
  const neighbors = new Map<Id<"neighbors">, Promise<Doc<"neighbors"> | null>>();
  const waiting = new Map<Id<"neighbors">, Promise<boolean>>();
  return {
    openRequest(id: Id<"neighbors">) {
      const known = waiting.get(id) ?? ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", id)).order("desc").take(50).then((rows) => rows.some((row) => row.status === "open" || row.status === "approved"));
      waiting.set(id, known);
      return known;
    },
    memberName(id: Id<"memberships">) {
      const known = members.get(id) ?? ctx.db.get("memberships", id).then((member) => member?.name ?? "Former member");
      members.set(id, known);
      return known;
    },
    neighbor(id: Id<"neighbors">) {
      const known = neighbors.get(id) ?? ctx.db.get("neighbors", id);
      neighbors.set(id, known);
      return known;
    },
  };
}
type Lookups = ReturnType<typeof lookups>;

export const requestRow = v.object({
  id: v.id("assistanceRequests"),
  neighborId: v.id("neighbors"),
  neighborName: v.string(),
  neighborAddress: v.string(),
  neighborLanguage: schema.tables.neighbors.validator.fields.language,
  householdSize: v.number(),
  callId: v.union(v.id("calls"), v.null()),
  kind: requestFields.kind,
  summary: v.string(),
  amountRequested: v.number(),
  amountApproved: v.union(v.number(), v.null()),
  status: requestFields.status,
  decisionNote: v.string(),
  referral: v.string(),
  /** Other places the neighbor was pointed to, by name, at most four. */
  referrals: v.array(v.string()),
  decidedByName: v.union(v.string(), v.null()),
  decidedAt: v.union(v.number(), v.null()),
  payeeKind: requestFields.payeeKind,
  payeeName: v.string(),
  source: requestFields.source,
  createdByName: v.string(),
  createdAt: v.number(),
});
export type RequestRow = Infer<typeof requestRow>;

export async function toRequestRow(found: Lookups, request: Doc<"assistanceRequests">): Promise<RequestRow> {
  const neighbor = await found.neighbor(request.neighborId);
  return {
    id: request._id,
    neighborId: request.neighborId,
    neighborName: neighbor?.name ?? "",
    neighborAddress: neighbor?.address ?? "",
    neighborLanguage: neighbor?.language ?? "en",
    householdSize: neighbor ? neighbor.adults + neighbor.children : 0,
    callId: request.callId ?? null,
    kind: request.kind,
    summary: request.summary,
    amountRequested: request.amountRequested,
    amountApproved: request.amountApproved ?? null,
    status: request.status,
    decisionNote: request.decisionNote,
    referral: request.referral ?? "",
    referrals: request.referrals ?? [],
    decidedByName: request.decidedBy ? await found.memberName(request.decidedBy) : null,
    decidedAt: request.decidedAt ?? null,
    payeeKind: request.payeeKind,
    payeeName: request.payeeName,
    source: request.source,
    createdByName: await found.memberName(request.createdBy),
    createdAt: request.createdAt,
  };
}

async function ownRequest(ctx: QueryCtx | MutationCtx, churchId: Id<"churches">, requestId: Id<"assistanceRequests">) {
  const request = await ctx.db.get("assistanceRequests", requestId);
  if (!request || request.churchId !== churchId) throw new Error("Request not found.");
  return request;
}
async function ownCall(ctx: QueryCtx | MutationCtx, churchId: Id<"churches">, callId: Id<"calls">) {
  const call = await ctx.db.get("calls", callId);
  if (!call || call.churchId !== churchId) throw new Error("Call not found.");
  return call;
}

/** Requests for help, newest first. Pass a status to see only those, such as "approved" for what is waiting to be paid. */
export const requests = query({
  args: { churchId: v.id("churches"), status: v.optional(requestFields.status) },
  returns: v.array(requestRow),
  handler: async (ctx, { churchId, status }) => {
    await neighborAccess(ctx, churchId);
    const rows = status
      ? await ctx.db.query("assistanceRequests").withIndex("by_church_status", (q) => q.eq("churchId", churchId).eq("status", status)).order("desc").take(200)
      : await ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", churchId)).order("desc").take(200);
    const found = lookups(ctx);
    // Newest first by the day it was asked: a request brought over from older records keeps its own date.
    return Promise.all(rows.sort((a, b) => b.createdAt - a.createdAt).map((row) => toRequestRow(found, row)));
  },
});

/** Every request one neighbor has made, newest first. */
export const requestsForNeighbor = query({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors") },
  returns: v.array(requestRow),
  handler: async (ctx, { churchId, neighborId }) => {
    await neighborRecord(ctx, churchId, neighborId);
    const rows = await ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200);
    const found = lookups(ctx);
    return Promise.all(rows.map((row) => toRequestRow(found, row)));
  },
});

export const request = query({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests") },
  returns: requestRow,
  handler: async (ctx, { churchId, requestId }) => {
    await neighborAccess(ctx, churchId);
    return toRequestRow(lookups(ctx), await ownRequest(ctx, churchId, requestId));
  },
});

const requestDetails = {
  kind: requestFields.kind,
  summary: v.string(),
  amountRequested: v.number(),
  payeeKind,
  payeeName: v.string(),
};
function cleanDetails(args: { summary: string; amountRequested: number; payeeName: string }) {
  return {
    summary: text(args.summary, "What they need", 500, true),
    amountRequested: wholeCents(args.amountRequested, "The amount"),
    payeeName: text(args.payeeName, "Who is paid", 120),
  };
}

/** Records a request for help. `source` is "ai_draft" only when a person approved a draft the assistant wrote. */
export const createRequest = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), callId: v.optional(v.id("calls")), source: v.optional(requestFields.source), ...requestDetails },
  returns: v.id("assistanceRequests"),
  handler: async (ctx, { churchId, neighborId, callId, source, kind, payeeKind, ...details }) => {
    const { member } = await neighborRecord(ctx, churchId, neighborId);
    if (callId) {
      const call = await ownCall(ctx, churchId, callId);
      if (call.neighborId && call.neighborId !== neighborId) throw new Error("That call belongs to another neighbor.");
      if (!call.neighborId) await ctx.db.patch("calls", callId, { neighborId });
    }
    return ctx.db.insert("assistanceRequests", { churchId, neighborId, callId, kind, payeeKind, ...cleanDetails(details), status: "open", decisionNote: "", source: source ?? "person", createdBy: member._id, createdAt: Date.now() });
  },
});

/** Changes a request that has not been decided yet. */
export const updateRequest = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests"), ...requestDetails },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId, kind, payeeKind, ...details }) => {
    await neighborAccess(ctx, churchId);
    const existing = await ownRequest(ctx, churchId, requestId);
    if (existing.status !== "open") throw new Error("This request has already been decided.");
    await ctx.db.patch("assistanceRequests", requestId, { kind, payeeKind, ...cleanDetails(details) });
    return null;
  },
});

/** The places a group refers neighbors to, by name, for the decision form to offer. */
export const agencies = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({ id: v.id("referralAgencies"), name: v.string(), phone: v.string(), helpsWith: v.string() })),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const rows = await ctx.db.query("referralAgencies").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(100);
    return rows.map((row) => ({ id: row._id, name: row.name, phone: row.phone, helpsWith: row.helpsWith }));
  },
});

/** Up to four places, each kept on the group's list the first time it is named so it is offered next time. */
async function referredTo(ctx: MutationCtx, churchId: Id<"churches">, names: string[]) {
  const places = names.map((name) => text(name, "A referral", 120)).filter((name, index, all) => name && all.findIndex((other) => nameKey(other) === nameKey(name)) === index);
  if (places.length > 4) throw new Error("Name at most four places.");
  const known = await ctx.db.query("referralAgencies").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(100);
  return Promise.all(places.map(async (name) => {
    const onList = known.find((agency) => nameKey(agency.name) === nameKey(name));
    if (!onList) await ctx.db.insert("referralAgencies", { churchId, name, phone: "", helpsWith: "" });
    return onList?.name ?? name;
  }));
}

/** Approves or declines an open request, and keeps who decided and when. `referral` says where else the neighbor was pointed, such as 211. */
export const decide = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests"), decision: v.union(v.literal("approved"), v.literal("declined")), amountApproved: v.optional(v.number()), note: v.string(), referral: v.optional(v.string()), referrals: v.optional(v.array(v.string())) },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId, decision, amountApproved, note, referral, referrals }) => {
    const member = await neighborAccess(ctx, churchId);
    const existing = await ownRequest(ctx, churchId, requestId);
    if (existing.status !== "open") throw new Error("This request has already been decided.");
    const places = referrals === undefined ? existing.referrals : await referredTo(ctx, churchId, referrals);
    const decided = { decisionNote: text(note, "The note", 500), referrals: places, referral: referral === undefined ? existing.referral : text(referral, "The referral", 500), decidedBy: member._id, decidedAt: Date.now() };
    if (decision === "declined") {
      await ctx.db.patch("assistanceRequests", requestId, { status: "declined", ...decided });
      return null;
    }
    if (existing.payeeKind === "neighbor" || !existing.payeeName) throw new Error("Add who is paid before approving. Payments go to the landlord, utility or store.");
    if (amountApproved === undefined) throw new Error("The approved amount is needed.");
    await ctx.db.patch("assistanceRequests", requestId, { status: "approved", amountApproved: wholeCents(amountApproved, "The approved amount", 1), ...decided });
    return null;
  },
});

/** Closes a request that will go no further, such as when the neighbor resolved it. */
export const closeRequest = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId, note }) => {
    const member = await neighborAccess(ctx, churchId);
    const existing = await ownRequest(ctx, churchId, requestId);
    if (existing.status !== "open" && existing.status !== "approved") throw new Error("This request is already finished.");
    await ctx.db.patch("assistanceRequests", requestId, { status: "closed", decisionNote: text(note, "The note", 500), decidedBy: existing.decidedBy ?? member._id, decidedAt: existing.decidedAt ?? Date.now() });
    return null;
  },
});

/**
 * For treasury, inside its own payment mutation and after its own neighborAccess(): marks an approved
 * request paid once the payments reach the approved amount, or approved again when a reversal brings
 * them back under. Requests in any other state are refused.
 */
export async function settleRequest(ctx: MutationCtx, member: Doc<"memberships">, requestId: Id<"assistanceRequests">, fullyPaid: boolean): Promise<void> {
  const existing = await ownRequest(ctx, member.churchId, requestId);
  const from = fullyPaid ? "approved" : "paid";
  if (existing.status !== from) throw new Error(fullyPaid ? "Only an approved request can be paid." : "Only a paid request can be reopened for payment.");
  await ctx.db.patch("assistanceRequests", requestId, { status: fullyPaid ? "paid" : "approved" });
}

export const callRow = v.object({
  id: v.id("calls"),
  neighborId: v.union(v.id("neighbors"), v.null()),
  neighborName: v.union(v.string(), v.null()),
  callerName: v.string(),
  phone: v.string(),
  note: v.string(),
  callback: callFields.callback,
  takenAt: v.number(),
  takenByName: v.string(),
  ownerName: v.union(v.string(), v.null()),
  returnedAt: v.union(v.number(), v.null()),
  returnedByName: v.union(v.string(), v.null()),
  outcome: v.string(),
  /** True when the neighbor already has a request waiting, so a second one is not drafted from this call. */
  openRequest: v.boolean(),
  urgent: v.union(v.object({ reasons: v.array(v.string()), day: v.union(v.number(), v.null()), by: urgentBy }), v.null()),
});
export async function toCallRow(found: Lookups, call: Doc<"calls">): Promise<Infer<typeof callRow>> {
  return {
    id: call._id,
    neighborId: call.neighborId ?? null,
    neighborName: call.neighborId ? ((await found.neighbor(call.neighborId))?.name ?? null) : null,
    callerName: call.callerName,
    phone: call.phone,
    note: call.note,
    callback: call.callback,
    takenAt: call.takenAt,
    takenByName: await found.memberName(call.takenBy),
    ownerName: call.ownerId ? await found.memberName(call.ownerId) : null,
    returnedAt: call.returnedAt ?? null,
    returnedByName: call.returnedBy ? await found.memberName(call.returnedBy) : null,
    outcome: call.outcome ?? "",
    openRequest: call.neighborId ? await found.openRequest(call.neighborId) : false,
    urgent: call.urgent ? { reasons: call.urgent.reasons, day: call.urgent.day ?? null, by: call.urgent.by } : null,
  };
}

/** The help line: messages still to call back, oldest first, and the calls returned in the last seven days. */
export const calls = query({
  args: { churchId: v.id("churches") },
  returns: v.object({ waiting: v.array(callRow), returned: v.array(callRow) }),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const needed = await ctx.db.query("calls").withIndex("by_church_callback", (q) => q.eq("churchId", churchId).eq("callback", "needed")).take(100);
    // Calls to return first lead the list; within each group the one that has waited longest is first.
    const first = (call: Doc<"calls">) => (call.urgent?.reasons.length ? 0 : 1);
    const waiting = needed.sort((a, b) => first(a) - first(b) || a.takenAt - b.takenAt);
    const done = await ctx.db.query("calls").withIndex("by_church_callback", (q) => q.eq("churchId", churchId).eq("callback", "done")).order("desc").take(200);
    const since = Date.now() - WEEK;
    const returned = done.filter((call) => (call.returnedAt ?? call.takenAt) >= since).sort((a, b) => (b.returnedAt ?? b.takenAt) - (a.returnedAt ?? a.takenAt));
    const found = lookups(ctx);
    return {
      waiting: await Promise.all(waiting.map((call) => toCallRow(found, call))),
      returned: await Promise.all(returned.map((call) => toCallRow(found, call))),
    };
  },
});

/**
 * Who calls back: whoever holds the help-line team's commitment that is under way, or the next one
 * to start. The team is the one named "Help line". Nobody, when there is no such team or the
 * commitment is still open.
 */
async function callbackOwner(ctx: QueryCtx, churchId: Id<"churches">, now: number) {
  const teams = await ctx.db.query("teams").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(100);
  const helpLine = teams.find((team) => nameKey(team.name) === "help line");
  if (!helpLine) return undefined;
  const upcoming = await ctx.db.query("commitments").withIndex("by_team_start", (q) => q.eq("teamId", helpLine._id).gte("start", now - DAY)).take(20);
  return upcoming.find((commitment) => !commitment.cancelled && commitment.end > now)?.assigneeId ?? undefined;
}

/** Writes down a call or a voicemail. A call to return goes to whoever holds the help line next, unless `ownerId` names someone. A caller whose phone is on file for exactly one neighbor is matched to that neighbor. */
export const recordCall = mutation({
  args: { churchId: v.id("churches"), callerName: v.string(), phone: v.string(), note: v.string(), callback: callFields.callback, neighborId: v.optional(v.id("neighbors")), ownerId: v.optional(v.id("memberships")) },
  returns: v.object({ callId: v.id("calls"), neighborId: v.union(v.id("neighbors"), v.null()) }),
  handler: async (ctx, { churchId, callerName, phone, note, callback, neighborId, ownerId }) => {
    const member = neighborId ? (await neighborRecord(ctx, churchId, neighborId)).member : await neighborAccess(ctx, churchId);
    const key = phoneKey(phone), now = Date.now();
    if (!key && !callerName.trim()) throw new Error("A name or a phone number is needed.");
    if (ownerId && (await ctx.db.get("memberships", ownerId))?.churchId !== churchId) throw new Error("Member not found.");
    let matched = neighborId;
    if (!matched && key) {
      const sameNumber = await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", key)).take(2);
      if (sameNumber.length === 1) matched = sameNumber[0]._id;
    }
    const callId = await ctx.db.insert("calls", { churchId, neighborId: matched, callerName: text(callerName, "The name", 120), phone: text(phone, "The phone number", 40), note: text(note, "The note", 2000), callback, ownerId: ownerId ?? (callback === "needed" ? await callbackOwner(ctx, churchId, now) : undefined), takenBy: member._id, takenAt: now });
    return { callId, neighborId: matched ?? null };
  },
});

/**
 * Says a call should be returned first, or that it should not. The assistant proposes from the note
 * and a person can always overrule it: once a person has spoken, the assistant's reading is ignored.
 * No reasons means "not urgent"; "marked" is a person's own say-so.
 */
export const setUrgency = mutation({
  args: { churchId: v.id("churches"), callId: v.id("calls"), reasons: v.array(v.union(...urgentReasons.map((reason) => v.literal(reason)), v.literal("marked"))), day: v.optional(v.number()), by: urgentBy },
  returns: v.null(),
  handler: async (ctx, { churchId, callId, reasons, day, by }) => {
    await neighborAccess(ctx, churchId);
    const call = await ownCall(ctx, churchId, callId);
    if (by === "assistant" && call.urgent?.by === "person") return null;
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) throw new Error("The day should be a day of the month.");
    await ctx.db.patch("calls", callId, { urgent: { reasons: [...new Set(reasons)], day, by } });
    return null;
  },
});

/** Marks a message as called back, with who returned it, when, and what came of it. */
export const markReturned = mutation({
  args: { churchId: v.id("churches"), callId: v.id("calls"), outcome: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { churchId, callId, outcome }) => {
    const member = await neighborAccess(ctx, churchId);
    const call = await ownCall(ctx, churchId, callId);
    if (call.callback !== "needed") throw new Error("This call is not waiting for a callback.");
    await ctx.db.patch("calls", callId, { callback: "done", returnedBy: member._id, returnedAt: Date.now(), outcome: text(outcome ?? "", "The outcome", 500) });
    return null;
  },
});

/** Ties a call from an unknown caller to a neighbor's record once you know who it was. */
export const linkCall = mutation({
  args: { churchId: v.id("churches"), callId: v.id("calls"), neighborId: v.id("neighbors") },
  returns: v.null(),
  handler: async (ctx, { churchId, callId, neighborId }) => {
    await neighborRecord(ctx, churchId, neighborId);
    await ownCall(ctx, churchId, callId);
    await ctx.db.patch("calls", callId, { neighborId });
    return null;
  },
});
