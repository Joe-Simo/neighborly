import { v } from "convex/values";
import { action, internalMutation, internalQuery, query, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { prepareDraft } from "../src/lib/draft";
import { draftPayeeKinds, prepareRequestDraft, requestKinds, withoutIdentity } from "../src/lib/request-draft";
import { urgentReasons, urgentSigns, type UrgentSign } from "../src/lib/urgency";
import { neighborAccess, user } from "./access";
import { fiscalYear } from "./reports";
import { paidTowardRequest } from "./treasury";

const draftResult = v.object({
  teamName: v.string(), recurrence: v.string(), peopleCount: v.string(),
  time: v.string(), notes: v.array(v.string()),
  verification: v.union(v.literal("review"), v.literal("checked")),
});

export const identity = internalQuery({
  args: {}, returns: v.union(v.id("users"), v.null()),
  handler: async ctx => ((await ctx.auth.getUserIdentity()) ? (await user(ctx)).id : null),
});

/** How many times a group may ask the model in one month. At Jev's price this is a few cents; it is here so a mistake cannot run up a bill. */
export const monthlyAllowance = 2000;

/**
 * Counts one request to the model, or says why it may not be made: the person's five a minute, or
 * the group's allowance for the month. A refusal is not an error; the draft simply comes back for review.
 */
export const reserve = internalMutation({
  args: { userId: v.id("users"), churchId: v.optional(v.id("churches")) },
  returns: v.union(v.literal("ok"), v.literal("minute"), v.literal("month")),
  handler: async (ctx, { userId, churchId }) => {
    const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
    const previous = await ctx.db.query("aiUsage").withIndex("by_user", q => q.eq("userId", userId)).unique();
    if (previous?.windowStart === windowStart && previous.count >= 5) return "minute" as const;
    const month = new Date().toISOString().slice(0, 7);
    const used = churchId ? await ctx.db.query("aiUsageByChurch").withIndex("by_church_month", q => q.eq("churchId", churchId).eq("month", month)).unique() : null;
    if (used && used.count >= monthlyAllowance) return "month" as const;
    if (previous) await ctx.db.patch("aiUsage", previous._id, {
      windowStart, count: previous.windowStart === windowStart ? previous.count + 1 : 1,
    });
    else await ctx.db.insert("aiUsage", { userId, windowStart, count: 1 });
    if (used) await ctx.db.patch("aiUsageByChurch", used._id, { count: used.count + 1 });
    else if (churchId) await ctx.db.insert("aiUsageByChurch", { churchId, month, count: 1 });
    return "ok" as const;
  },
});

/**
 * Asks the model one yes-or-no question per proposed field and returns how sure it is of each, 0 to 1.
 * The model writes no text: no summary, no advice, no prayer. Null means no usable answer, for any reason.
 */
async function confidence<Field extends string>(key: string, state: Record<string, unknown>, questions: Record<Field, string>): Promise<Record<Field, number> | null> {
  const fields = Object.keys(questions) as Field[];
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest", state,
        questions: Object.fromEntries(fields.map(field => [field, { type: "noul", instructions: questions[field] }])),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("answers" in data) || !data.answers || typeof data.answers !== "object") return null;
    const answers = data.answers as Record<string, unknown>;
    const sure = {} as Record<Field, number>;
    for (const field of fields) {
      const answer = answers[field];
      if (!answer || typeof answer !== "object" || !("type" in answer) || answer.type !== "noul" || !("noul" in answer) || typeof answer.noul !== "number" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return null;
      sure[field] = answer.noul;
    }
    return sure;
  } catch {
    return null;
  }
}
const stated = "Answer yes only if the value is stated as an affirmative fact, not a question, negation, wish, conditional, or conflicting alternative. A normalized equivalent of explicit wording is supported.";

/** AI checks proposed facts; it never creates a team, names people or assigns work. */
export const suggestTeam = action({
  args: { description: v.string() }, returns: draftResult,
  handler: async (ctx, { description }) => {
    const userId = await ctx.runQuery(internal.drafts.identity, {});
    if (!userId) throw new Error("Sign in to prepare a team draft.");
    if (!description.trim() || description.length > 2000) throw new Error("Describe your team in up to 2,000 characters.");
    const draft = prepareDraft(description);
    const fallback = { ...draft, verification: "review" as const };
    if (!env.TYPESAFE_API_KEY) return fallback;
    const fields = ["teamName", "recurrence", "peopleCount", "time"] as const;
    const present = fields.filter(field => draft[field]);
    if (!present.length) return fallback;
    if (await ctx.runMutation(internal.drafts.reserve, { userId }) !== "ok") throw new Error("Please wait a minute before preparing another draft.");
    const sure = await confidence(env.TYPESAFE_API_KEY, { description, proposed: draft }, Object.fromEntries(present.map(field => [field,
      `Does description explicitly and unambiguously support proposed.${field}? ${stated} Never infer availability, consent, qualifications, membership, or a new fact.`,
    ])) as Record<(typeof present)[number], string>);
    if (!sure) return fallback;
    for (const field of present) {
      if (sure[field] < 0.9) {
        draft[field] = "";
        draft.notes.push(`Please confirm ${field === "teamName" ? "the team name" : field === "peopleCount" ? "how many people are needed" : field === "time" ? "the start and end time" : "how often the team meets"}.`);
      }
    }
    return { ...draft, verification: "checked" as const };
  },
});

const requestDraft = v.object({
  kind: v.union(...requestKinds.map(kind => v.literal(kind)), v.null()),
  amountRequested: v.union(v.number(), v.null()),
  payeeKind: v.union(...draftPayeeKinds.map(kind => v.literal(kind)), v.null()),
  payeeName: v.string(), quote: v.string(), notes: v.array(v.string()),
  verification: v.union(v.literal("review"), v.literal("checked")),
});

/** One call's note for drafting, with the names and addresses that must be taken out of it. Coordinators and owners only. */
export const callNote = internalQuery({
  args: { churchId: v.id("churches"), callId: v.id("calls") },
  returns: v.object({ userId: v.id("users"), note: v.string(), names: v.array(v.string()), addresses: v.array(v.string()) }),
  handler: async (ctx, { churchId, callId }) => {
    const member = await neighborAccess(ctx, churchId);
    const call = await ctx.db.get("calls", callId);
    if (!call || call.churchId !== churchId) throw new Error("Call not found.");
    const neighbor = call.neighborId ? await ctx.db.get("neighbors", call.neighborId) : null;
    return {
      userId: member.userId, note: call.note,
      names: [call.callerName, neighbor?.name ?? ""].filter(Boolean),
      addresses: neighbor?.address ? [neighbor.address] : [],
    };
  },
});

/**
 * Turns a call note into a proposed request for help. It saves nothing: the screen shows the
 * draft, and the request exists only after a person approves it through assistance.
 * Code proposes each field; the model only says whether the note states it. The model is sent
 * the note with names, phones, emails and addresses taken out, and it writes no text at all.
 */
export const draftRequest = action({
  args: { churchId: v.id("churches"), callId: v.id("calls") }, returns: requestDraft,
  handler: async (ctx, args) => {
    const { userId, note, names, addresses } = await ctx.runQuery(internal.drafts.callNote, args);
    const draft = prepareRequestDraft(note);
    // The payee's name is copied by code and never shown to the model, so a person always confirms it.
    const fallback = { ...draft, verification: "review" as const };
    // A note too long to be one call's message is not sent anywhere; the person reads it.
    if (!env.TYPESAFE_API_KEY || note.length > 2000) return fallback;
    const proposed = {
      ...(draft.kind && { kind: draft.kind }),
      ...(draft.amountRequested !== null && { amountRequested: `$${(draft.amountRequested / 100).toFixed(2)}` }),
      ...(draft.payeeKind && { payeeKind: draft.payeeKind }),
    };
    const present = Object.keys(proposed) as (keyof typeof proposed)[];
    if (!present.length) return fallback;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return fallback;
    const sure = await confidence(env.TYPESAFE_API_KEY, { note: withoutIdentity(note, { names, addresses }), proposed }, Object.fromEntries(present.map(field => [field,
      `Does note explicitly and unambiguously support proposed.${field}? ${stated} Never infer need, eligibility, a decision, or a new fact.`,
    ])) as Record<(typeof present)[number], string>);
    if (!sure) return fallback;
    const asked = { kind: "the kind of help", amountRequested: "the amount", payeeKind: "who is paid" };
    for (const field of present) {
      if (sure[field] < 0.9) {
        draft[field] = null;
        draft.notes.push(`Please confirm ${asked[field]}.`);
      }
    }
    return { ...draft, verification: "checked" as const };
  },
});

const urgency = v.object({
  signs: v.array(v.object({ reason: v.union(...urgentReasons.map(reason => v.literal(reason))), day: v.union(v.number(), v.null()) })),
  verification: v.union(v.literal("review"), v.literal("checked")),
});

/**
 * Reads one call's note for signs that it should be returned first: a shut-off or eviction, no food,
 * a child, an elder, a medical need. Code finds the signs; the model only says whether the note states
 * each one, and a sign under 0.9 is dropped. It saves nothing and decides nothing about who is helped:
 * the screen shows the reason, and a person can always move the call.
 */
export const readUrgency = action({
  args: { churchId: v.id("churches"), callId: v.id("calls") }, returns: urgency,
  handler: async (ctx, args): Promise<{ signs: UrgentSign[]; verification: "review" | "checked" }> => {
    const { userId, note, names, addresses } = await ctx.runQuery(internal.drafts.callNote, args);
    const signs = urgentSigns(note);
    const fallback = { signs, verification: "review" as const };
    if (!env.TYPESAFE_API_KEY || note.length > 2000 || !signs.length) return fallback;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return fallback;
    const meaning = { shutoff: "a utility is being or about to be shut off", eviction: "the household faces eviction", noFood: "the household has no food", hungry: "someone is hungry or has not eaten", child: "there is a child", elder: "someone is elderly", alone: "someone lives alone", medical: "there is a medical need" };
    const sure = await confidence(env.TYPESAFE_API_KEY, { note: withoutIdentity(note, { names, addresses }) }, Object.fromEntries(signs.map(({ reason }) => [reason,
      `Does note explicitly state that ${meaning[reason]}? ${stated} Never infer need, eligibility, a decision, or a new fact.`,
    ])) as Record<(typeof signs)[number]["reason"], string>);
    if (!sure) return fallback;
    return { signs: signs.filter(({ reason }) => sure[reason] >= 0.9), verification: "checked" as const };
  },
});

const yearFlagKinds = ["approvedNotPaid", "paidNoPayment", "visitNoHours", "noteSaysPaid", "visitNotMarked"] as const;
const yearFlag = v.object({
  kind: v.union(...yearFlagKinds.map(kind => v.literal(kind))),
  record: v.union(v.object({ table: v.literal("assistanceRequests"), id: v.id("assistanceRequests") }), v.object({ table: v.literal("visits"), id: v.id("visits") })),
  /** "rule" was found by counting alone; "assistant" means the model read a note. */
  source: v.union(v.literal("rule"), v.literal("assistant")),
});
const toRead = v.object({ kind: v.union(v.literal("noteSaysPaid"), v.literal("visitNotMarked")), record: yearFlag.fields.record, note: v.string(), names: v.array(v.string()), addresses: v.array(v.string()) });
const paidWords = /\b(?:paid|sent (?:a |the )?check|check (?:was )?(?:sent|mailed)|covered the|pagad[oa]|pagamos)\b/i;
const visitedWords = /\b(?:visited|we met|met with|went to see|stopped by|visitamos)\b/i;

/**
 * The year's records that do not add up, found by rules alone, and the notes worth a second reading.
 * No names leave this function except inside toRead, which never leaves the server.
 */
export const yearRecords = internalQuery({
  args: { churchId: v.id("churches"), year: v.number() },
  returns: v.object({ userId: v.id("users"), flags: v.array(yearFlag), toRead: v.array(toRead) }),
  handler: async (ctx, { churchId, year }) => {
    const member = await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church || !Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Year not found.");
    const { start, end } = fiscalYear(year, church.timeZone);
    const now = Date.now();
    const [requests, visits] = await Promise.all([
      ctx.db.query("assistanceRequests").withIndex("by_church", q => q.eq("churchId", churchId).gte("createdAt", start).lt("createdAt", end)).take(1000),
      ctx.db.query("visits").withIndex("by_church", q => q.eq("churchId", churchId).gte("scheduledAt", start).lt("scheduledAt", end)).take(1000),
    ]);
    const flags: (typeof yearFlag.type)[] = [];
    const reading: (typeof toRead.type)[] = [];
    const identity = async (neighborId: (typeof requests)[number]["neighborId"]) => {
      const neighbor = await ctx.db.get("neighbors", neighborId);
      return { names: neighbor ? [neighbor.name] : [], addresses: neighbor?.address ? [neighbor.address] : [] };
    };
    for (const request of requests) {
      if (request.status !== "approved" && request.status !== "paid" && request.status !== "open") continue;
      const record = { table: "assistanceRequests" as const, id: request._id };
      const payment = await ctx.db.query("ledgerEntries").withIndex("by_request", q => q.eq("requestId", request._id)).first();
      if (payment) continue;
      if (request.status === "paid") flags.push({ kind: "paidNoPayment", record, source: "rule" });
      else if (paidWords.test(request.decisionNote) && reading.length < 20) reading.push({ kind: "noteSaysPaid", record, note: request.decisionNote, ...(await identity(request.neighborId)) });
      else if (request.status === "approved" && (request.decidedAt ?? request.createdAt) < now - 30 * 86_400_000) flags.push({ kind: "approvedNotPaid", record, source: "rule" });
    }
    for (const visit of visits) {
      const record = { table: "visits" as const, id: visit._id };
      if (visit.status === "completed" && visit.visitors.every(visitor => visitor.hours === 0)) flags.push({ kind: "visitNoHours", record, source: "rule" });
      else if (visit.status === "scheduled" && visit.scheduledAt < now && visitedWords.test(visit.notes) && reading.length < 20) reading.push({ kind: "visitNotMarked", record, note: visit.notes, ...(await identity(visit.neighborId)) });
    }
    return { userId: member.userId, flags, toRead: reading };
  },
});

/**
 * Before the yearly report is sent: the records that do not add up. Counts come from code. The model
 * reads only the notes code picked out, with names and addresses removed, and answers yes or no on
 * whether each says what code suspects (a bill already paid with no payment recorded; a visit made
 * but never marked done). It changes nothing; each flag points a person to one record to look at.
 */
export const checkYear = action({
  args: { churchId: v.id("churches"), year: v.number() },
  returns: v.object({ flags: v.array(yearFlag), verification: v.union(v.literal("review"), v.literal("checked")) }),
  handler: async (ctx, args): Promise<{ flags: (typeof yearFlag.type)[]; verification: "review" | "checked" }> => {
    const { userId, flags, toRead: reading } = await ctx.runQuery(internal.drafts.yearRecords, args);
    // With no model, a person reads the notes code picked out; they are flagged as a rule's finding.
    const unread = { flags: [...flags, ...reading.map(({ kind, record }) => ({ kind, record, source: "rule" as const }))], verification: "review" as const };
    if (!reading.length) return { flags, verification: "checked" };
    if (!env.TYPESAFE_API_KEY) return unread;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return unread;
    const asked = { noteSaysPaid: "that money was already paid or a check already sent for this request", visitNotMarked: "that the home visit already took place" };
    const sure = await confidence(env.TYPESAFE_API_KEY,
      { notes: Object.fromEntries(reading.map((item, index) => [`n${index}`, withoutIdentity(item.note.slice(0, 1000), item)])) },
      Object.fromEntries(reading.map((item, index) => [`n${index}`, `Does notes.n${index} explicitly state ${asked[item.kind]}? ${stated} Never infer a new fact.`])),
    );
    if (!sure) return unread;
    return { flags: [...flags, ...reading.flatMap(({ kind, record }, index) => (sure[`n${index}`] >= 0.9 ? [{ kind, record, source: "assistant" as const }] : []))], verification: "checked" };
  },
});

/**
 * The week in plain counts, for the note a president reads on Monday. Everything here is counted by
 * code from the records; the model is not asked anything and no note text or name leaves the function.
 * A call counts as put first only when that mark is saved on it, and the count says who put it there,
 * because a mark by the assistant means the note was read by it. The screen turns the counts into sentences.
 */
export const weekNote = query({
  args: { churchId: v.id("churches") },
  returns: v.object({
    callsWaiting: v.number(), callsFirstByAssistant: v.number(), callsFirstByPerson: v.number(), oldestWaitingDays: v.number(),
    visitsPlanned: v.number(), requestsOpen: v.number(), approvedUnpaid: v.number(), approvedUnpaidCents: v.number(),
    openPlaces: v.number(), away: v.number(),
  }),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church) throw new Error("Group not found.");
    const now = Date.now(), weekEnd = now + 7 * 86_400_000;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: church.timeZone }).format(now);
    const lastDay = new Intl.DateTimeFormat("en-CA", { timeZone: church.timeZone }).format(weekEnd);
    const [waiting, visits, open, approved, commitments, timeOff] = await Promise.all([
      ctx.db.query("calls").withIndex("by_church_callback", q => q.eq("churchId", churchId).eq("callback", "needed")).take(200),
      ctx.db.query("visits").withIndex("by_church", q => q.eq("churchId", churchId).gte("scheduledAt", now).lt("scheduledAt", weekEnd)).take(200),
      ctx.db.query("assistanceRequests").withIndex("by_church_status", q => q.eq("churchId", churchId).eq("status", "open")).take(200),
      ctx.db.query("assistanceRequests").withIndex("by_church_status", q => q.eq("churchId", churchId).eq("status", "approved")).take(200),
      ctx.db.query("commitments").withIndex("by_church", q => q.eq("churchId", churchId)).take(1000),
      ctx.db.query("timeOff").withIndex("by_church", q => q.eq("churchId", churchId)).take(500),
    ]);
    let approvedUnpaidCents = 0;
    for (const request of approved) approvedUnpaidCents += Math.max(0, (request.amountApproved ?? request.amountRequested) - await paidTowardRequest(ctx, request._id));
    return {
      callsWaiting: waiting.length,
      callsFirstByAssistant: waiting.filter(call => call.urgent?.reasons.length && call.urgent.by === "assistant").length,
      callsFirstByPerson: waiting.filter(call => call.urgent?.reasons.length && call.urgent.by === "person").length,
      oldestWaitingDays: waiting.length ? Math.floor((now - Math.min(...waiting.map(call => call.takenAt))) / 86_400_000) : 0,
      visitsPlanned: visits.filter(visit => visit.status === "scheduled").length,
      requestsOpen: open.length, approvedUnpaid: approved.length, approvedUnpaidCents,
      openPlaces: commitments.filter(item => !item.cancelled && !item.assigneeId && item.start >= now && item.start < weekEnd).length,
      away: new Set(timeOff.filter(item => item.start <= lastDay && item.end >= today).map(item => item.memberId)).size,
    };
  },
});
