import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { prepareDraft } from "../src/lib/draft";
import { draftNotes, draftPayeeKinds, monthlyAllowance, kindNotes, prepareRequestDraft, requestKinds, withoutIdentity, type RequestDraft, type RequestKind } from "../src/lib/request-draft";
import { jevSet } from "../src/lib/jev-set";
import { urgentReasons, urgentSigns, type UrgentReason, type UrgentSign } from "../src/lib/urgency";
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
type Question = { type: "noul" | "choice"; instructions: string; criteria?: Record<string, string> };
/**
 * The version every line in this file was measured on (the 23 made-up notes in src/lib/jev-set.ts).
 * "jev-latest" moves when a release ships and scores move with it, so change this only with a new measuring run.
 */
const model = "jev-1.14.0";

/** One request to Jev: a state and named questions, all answered at once. Null means no usable reply, for any reason. */
async function decide(key: string, state: Record<string, unknown>, questions: Record<string, Question>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, state, questions }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("answers" in data) || !data.answers || typeof data.answers !== "object") return null;
    return data.answers as Record<string, unknown>;
  } catch {
    return null;
  }
}
/** A yes-or-no answer as a number from 0 to 1, or null when the answer is not one. */
function noul(answer: unknown): number | null {
  if (!answer || typeof answer !== "object" || !("type" in answer) || answer.type !== "noul" || !("noul" in answer) || typeof answer.noul !== "number" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return null;
  return answer.noul;
}

async function confidence<Field extends string>(key: string, state: Record<string, unknown>, questions: Record<Field, string>): Promise<Record<Field, number> | null> {
  const fields = Object.keys(questions) as Field[];
  const answers = await decide(key, state, Object.fromEntries(fields.map(field => [field, { type: "noul" as const, instructions: questions[field] }])));
  if (!answers) return null;
  const sure = {} as Record<Field, number>;
  for (const field of fields) {
    const value = noul(answers[field]);
    if (value === null) return null;
    sure[field] = value;
  }
  // Field names and numbers only, never the note: enough to see why a field came back blank.
  console.log(`jev ${JSON.stringify(sure)}`);
  return sure;
}
/**
 * How a question about a note ends. The note is a volunteer's own shorthand, so its plain words count
 * ("behind on rent" is about rent); what does not count is a question, a denial or a maybe.
 */
const plainly = "Answer yes when the note says this in its own words or a plain equivalent. Answer no when it is only asked as a question, denied, or given as something that might happen. Judge only what the note says.";
/**
 * How a question about a draft field ends. Code has already left out anything the note doubts or denies,
 * so the model is asked the one thing it scores steadily on a volunteer's shorthand: is this in the note.
 * Asked whether the note showed a "need for help", it scored a plain power bill at 0.53.
 */
const mentioned = "Answer yes when the note mentions this, in any wording, about the caller's own household. Answer no when the note does not mention it or says it is not so. Judge only what the note says.";
/** At or above this the model's yes stands; below it the field is left blank for a person. */
const sureEnough = 0.9;
const kindMeaning = { rent: "rent, a landlord or an eviction", utility: "a utility or its bill, such as power, electricity, water or gas", food: "food, groceries or a food pantry", voucher: "clothing, furniture or household goods", other: "a need other than rent, utilities, food or household goods" };
const payeeMeaning = { landlord: "a landlord", utility: "a utility company", vendor: "a store or other business" };
const signMeaning = {
  shutoff: "a utility has been, is being or will be shut off or disconnected (a shut-off notice or a shut-off date counts)",
  eviction: "the household has an eviction notice or is being evicted (a notice or a date counts)",
  noFood: "the household has no food",
  hungry: "someone is hungry or has not eaten",
  child: "there is a child, children, kids or a baby in the household",
  elder: "someone is elderly or is aged 80 or more",
  alone: "someone lives alone",
  medical: "there is a medical need, such as oxygen, insulin, dialysis, medication, a wheelchair or a hospital stay",
};
/**
 * The questions that confirm a draft's fields, one per field the code proposed. Shared with the measuring run
 * so both ask the same thing. The amount is not asked about: code reads it from the note's own figures or
 * number words, shows it only when the note gives exactly one, and that needs no second opinion. Asked
 * anyway, the model scored a plain "$450" between 0.86 and 0.97 from one wording to the next.
 */
function draftQuestions(draft: RequestDraft) {
  return {
    ...(draft.kind && { kind: `Does note mention ${kindMeaning[draft.kind]}? ${mentioned}` }),
    ...(draft.payeeKind && { payeeKind: `Does note mention ${payeeMeaning[draft.payeeKind]}? ${mentioned}` }),
  };
}
function signQuestions(signs: UrgentSign[]) {
  return Object.fromEntries(signs.map(({ reason }) => [reason, `Does note say that ${signMeaning[reason]}? ${plainly}`])) as Record<UrgentReason, string>;
}
/** What Jev may pick for the kind of help when it chooses for itself. "none" is there so it never has to force a kind. */
const kindChoice: Record<RequestKind | "none", string> = {
  rent: "The caller needs help with rent, a landlord, a lease or an eviction",
  utility: "The caller needs help with a utility or its bill: power, electricity, water, gas",
  food: "The caller needs food, groceries or a food pantry",
  voucher: "The caller needs clothing, furniture or household goods",
  other: "The caller needs some other single thing, such as transport or a repair",
  none: "Nothing is asked for, the note denies a need, the need is only a maybe, or the note names two or more different needs",
};
/** The two ends of each sign, for when Jev reads every sign itself instead of confirming the ones code found. */
const signEnds: Record<UrgentReason, { true: string; false: string }> = {
  shutoff: { true: "A utility has been, is being or will be shut off or disconnected for the caller's household; a notice or a date counts", false: "No shut-off is mentioned, it is denied, it is only a possibility, or it is someone else's household" },
  eviction: { true: "The caller's household has an eviction notice or is being evicted; a notice or a date counts", false: "No eviction is mentioned, it is denied, it is only a possibility, or it is someone else's household" },
  noFood: { true: "The caller's household has no food", false: "Food is not mentioned, food is only asked about, or the household without food is someone else's" },
  hungry: { true: "Someone in the caller's household is hungry or has not eaten", false: "Hunger is not mentioned, or it is someone else's household" },
  child: { true: "A child, children, kids or a baby live in the caller's household", false: "No child is mentioned, or the note says there are none" },
  elder: { true: "Someone in the caller's household is elderly or aged 80 or more", false: "No old age is mentioned, or the note says the person is not elderly" },
  alone: { true: "The caller lives alone", false: "Living alone is not mentioned" },
  medical: { true: "Someone in the caller's household has a medical need: oxygen, insulin, dialysis, medication, a wheelchair, a hospital stay", false: "No medical need is mentioned" },
};

/** When code and Jev's own pick name the same kind, the pick stands at this easier line. Set from the 23-note run. */
const agreed = 0.8;
const kindQuestion: Question = { type: "choice", instructions: "What one kind of help does note ask for?", criteria: kindChoice };
/** Jev's pick from the closed list, or null when the answer is not one. */
function picked(answer: unknown): { kind: RequestKind | "none"; confidence: number } | null {
  if (!answer || typeof answer !== "object" || !("choice" in answer) || !("confidence" in answer) || typeof answer.confidence !== "number") return null;
  const { choice, confidence } = answer;
  const kind = choice === "none" ? "none" : requestKinds.find(option => option === choice);
  return kind ? { kind, confidence } : null;
}
/**
 * The kind of help to show, from what code proposed, how sure Jev is of that proposal, and Jev's own pick.
 * Jev's pick is the only reading of whether help is asked for at all: the confirming score says a kind is
 * mentioned, and a note can mention rent while asking for nothing. So the pick always has to carry the kind.
 * When code proposed the same kind it stands on the easier line; where code is silent (Spanish, Creole,
 * "no food") it stands alone only at 0.9. Where the two disagree, or Jev picks "none", the field is left
 * for a person. The confirming score is used only when the reply holds no pick.
 */
function settleKind(proposed: RequestKind | null, sure: number | null, pick: ReturnType<typeof picked>): RequestKind | null {
  if (!pick) return proposed && sure !== null && sure >= sureEnough ? proposed : null;
  if (pick.kind === "none") return null;
  if (proposed) return pick.kind === proposed && pick.confidence >= agreed ? proposed : null;
  return pick.confidence >= sureEnough ? pick.kind : null;
}
/** One question per sign: a sign code found is confirmed; any other is read by Jev itself, so a note in Spanish or Creole is read too. */
function signQuestion(reason: UrgentReason, found: UrgentSign[]): Question {
  if (found.some(sign => sign.reason === reason)) return { type: "noul", instructions: signQuestions(found)[reason] };
  return { type: "noul", instructions: `Does note say this about the caller's own household: ${signMeaning[reason]}?`, criteria: signEnds[reason] };
}
const stated = "Answer yes only if the value is stated as an affirmative fact, not a question, negation, wish, conditional, or conflicting alternative. A normalized equivalent of explicit wording is supported.";

/** AI checks proposed facts; it never creates a team, names people or assigns work. */
export const suggestTeam = action({
  args: { description: v.string() }, returns: draftResult,
  handler: async (ctx, { description }) => {
    const userId = await ctx.runQuery(internal.drafts.identity, {});
    if (!userId) throw new ConvexError("Sign in to prepare a team draft.");
    if (!description.trim() || description.length > 2000) throw new ConvexError("Describe your team in up to 2,000 characters.");
    const draft = prepareDraft(description);
    const fallback = { ...draft, verification: "review" as const };
    if (!env.TYPESAFE_API_KEY) return fallback;
    const fields = ["teamName", "recurrence", "peopleCount", "time"] as const;
    const present = fields.filter(field => draft[field]);
    if (!present.length) return fallback;
    if (await ctx.runMutation(internal.drafts.reserve, { userId }) !== "ok") throw new ConvexError("Please wait a minute before preparing another draft.");
    const sure = await confidence(env.TYPESAFE_API_KEY, { description, proposed: draft }, Object.fromEntries(present.map(field => [field,
      `Does description explicitly and unambiguously support proposed.${field}? ${stated} Never infer availability, consent, qualifications, membership, or a new fact.`,
    ])) as Record<(typeof present)[number], string>);
    if (!sure) return fallback;
    for (const field of present) {
      if (sure[field] < sureEnough) {
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
    if (!call || call.churchId !== churchId) throw new ConvexError("Call not found.");
    const neighbor = call.neighborId ? await ctx.db.get("neighbors", call.neighborId) : null;
    return {
      userId: member.userId, note: call.note,
      names: [call.callerName, neighbor?.name ?? ""].filter(Boolean),
      addresses: neighbor?.address ? [neighbor.address] : [],
    };
  },
});

/**
 * A call's note exactly as the assistant is given it: names, phones, emails and addresses taken out by the same
 * code that prepares the request. The draft sheet shows it so a person can see what was read. It calls no model.
 */
export const noteAsSent = query({
  args: { churchId: v.id("churches"), callId: v.id("calls") }, returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const { note, names, addresses } = await ctx.runQuery(internal.drafts.callNote, args);
    return withoutIdentity(note, { names, addresses });
  },
});

/**
 * Turns a call note into a proposed request for help. It saves nothing: the screen shows the
 * draft, and the request exists only after a person approves it through assistance.
 * Code proposes each field and the model says whether the note mentions it. For the kind of help the
 * model also picks from the closed list, so a note code cannot read still gets a kind; see settleKind.
 * The model is sent the note with names, phones, emails and addresses taken out, and it writes no text at all.
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
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return fallback;
    // Each question stands on its own in plain words. A bare field name ("proposed.kind") gave the model nothing to judge.
    const answers = await decide(env.TYPESAFE_API_KEY, { note: withoutIdentity(note, { names, addresses }) }, {
      ...Object.fromEntries(Object.entries(draftQuestions(draft)).map(([field, instructions]) => [field, { type: "noul" as const, instructions }])),
      chosenKind: kindQuestion,
    });
    if (!answers) return fallback;
    const sure = { kind: noul(answers.kind), payeeKind: noul(answers.payeeKind) }, pick = picked(answers.chosenKind);
    // A proposed field with no usable answer means the reply cannot be trusted; the person reads the draft as code made it.
    if ((draft.kind && sure.kind === null && !pick) || (draft.payeeKind && sure.payeeKind === null)) return fallback;
    // Field names, numbers and a kind from the closed list only, never the note: enough to see why a field came back blank.
    console.log(`jev ${JSON.stringify({ ...sure, chosenKind: pick?.kind, chosenConfidence: pick?.confidence })}`);
    const kind = settleKind(draft.kind, sure.kind, pick);
    if (draft.kind && !kind) draft.notes.push(draftNotes.confirmKind);
    const notes = draft.kind || !kind ? draft.notes : draft.notes.filter(line => line !== kindNotes.missing && line !== kindNotes.several);
    if (draft.payeeKind && (sure.payeeKind ?? 0) < sureEnough) {
      draft.payeeKind = null;
      draft.notes.push(draftNotes.confirmPayee);
    }
    return { ...draft, kind, notes, verification: "checked" as const };
  },
});

const urgency = v.object({
  signs: v.array(v.object({ reason: v.union(...urgentReasons.map(reason => v.literal(reason))), day: v.union(v.number(), v.null()) })),
  verification: v.union(v.literal("review"), v.literal("checked")),
});

/**
 * Reads one call's note for signs that it should be returned first: a shut-off or eviction, no food,
 * a child, an elder, a medical need. A sign code finds is confirmed by the model; any other sign the model
 * reads for itself, so a note in Spanish or Creole is read too. A sign under 0.9 is not shown, and only code
 * gives a sign its day. It saves nothing and decides nothing about who is helped:
 * the screen shows the reason, and a person can always move the call.
 */
export const readUrgency = action({
  args: { churchId: v.id("churches"), callId: v.id("calls") }, returns: urgency,
  handler: async (ctx, args): Promise<{ signs: UrgentSign[]; verification: "review" | "checked" }> => {
    const { userId, note, names, addresses } = await ctx.runQuery(internal.drafts.callNote, args);
    const signs = urgentSigns(note);
    const fallback = { signs, verification: "review" as const };
    if (!env.TYPESAFE_API_KEY || note.length > 2000) return fallback;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return fallback;
    const answers = await decide(env.TYPESAFE_API_KEY, { note: withoutIdentity(note, { names, addresses }) }, Object.fromEntries(urgentReasons.map(reason => [reason, signQuestion(reason, signs)])));
    if (!answers) return fallback;
    const sure = Object.fromEntries(urgentReasons.map(reason => [reason, noul(answers[reason])]));
    if (signs.some(({ reason }) => sure[reason] === null)) return fallback;
    console.log(`jev ${JSON.stringify(sure)}`);
    return {
      signs: urgentReasons.flatMap(reason => ((sure[reason] ?? 0) >= sureEnough ? [signs.find(sign => sign.reason === reason) ?? { reason, day: null }] : [])),
      verification: "checked" as const,
    };
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
    if (!church || !Number.isInteger(year) || year < 2000 || year > 2100) throw new ConvexError("Year not found.");
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
      // A voucher comes off the shelf and nobody is paid, so a missing payment is not a fault.
      if (request.kind === "voucher" || request.amountApproved === 0) continue;
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
      Object.fromEntries(reading.map((item, index) => [`n${index}`, `Does notes.n${index} say ${asked[item.kind]}? ${plainly}`])),
    );
    if (!sure) return unread;
    return { flags: [...flags, ...reading.flatMap(({ kind, record }, index) => (sure[`n${index}`] >= sureEnough ? [{ kind, record, source: "assistant" as const }] : []))], verification: "checked" };
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
    if (!church) throw new ConvexError("Group not found.");
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

/** Counts a whole measuring run against a group's month, or refuses it when the month has no room. */
export const reserveMany = internalMutation({
  args: { churchId: v.id("churches"), count: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { churchId, count }) => {
    const month = new Date().toISOString().slice(0, 7);
    const used = await ctx.db.query("aiUsageByChurch").withIndex("by_church_month", q => q.eq("churchId", churchId).eq("month", month)).unique();
    if ((used?.count ?? 0) + count > monthlyAllowance) return false;
    if (used) await ctx.db.patch("aiUsageByChurch", used._id, { count: used.count + count });
    else await ctx.db.insert("aiUsageByChurch", { churchId, month, count });
    return true;
  },
});

type Outcome = "right" | "blank" | "wrong";
const judge = <Value>(shown: Value | null, wanted: Value | null): Outcome => (shown === wanted ? "right" : shown === null ? "blank" : "wrong");
/** Signs are right when the same reasons are shown; one that should not be there is wrong; one missing is blank. */
function judgeSigns(shown: UrgentReason[], wanted: UrgentReason[]): Outcome {
  if (shown.some(reason => !wanted.includes(reason))) return "wrong";
  return wanted.every(reason => shown.includes(reason)) ? "right" : "blank";
}
const outcome = v.union(v.literal("right"), v.literal("blank"), v.literal("wrong"));
const marks = v.object({ kind: outcome, amount: outcome, payeeKind: outcome, signs: outcome });
const tally = v.object({ notesAllRight: v.number(), right: v.number(), blank: v.number(), wrong: v.number() });

/**
 * Sends the made-up set in src/lib/jev-set.ts to the live model once and reports how it did. It is run by
 * hand from the Convex command line, never from a screen. It reads no record and saves none: the notes
 * are the made-up ones in the code, and the one thing written is the count against the group's month.
 * What comes back is field names, scores and right, blank or wrong; never a note.
 *
 * Each note is judged three ways from one request. "mix" is what the screens do: code proposes and Jev
 * confirms, and where code is silent Jev picks the kind and reads the sign itself. "confirm" is code proposing
 * and Jev confirming only; "choose" is Jev alone on kind and signs. The amount is read by code in all three,
 * and who is paid is confirmed the same way in all three, since Jev cannot write either. Those three are
 * counted on the notes the lines were set from. "fresh" is the screens' way counted on the notes added
 * afterwards, which no line was set on: that is the figure to trust. A shown value that the note does not
 * support is "wrong"; a right value left for a person is "blank".
 */
export const measure = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({
    status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")),
    notes: v.number(), unanswered: v.number(), model: v.string(), mix: tally, confirm: tally, choose: tally, fresh: tally,
    rows: v.array(v.object({ id: v.string(), mix: v.optional(marks), confirm: v.optional(marks), choose: v.optional(marks), scores: v.record(v.string(), v.union(v.number(), v.string())) })),
  }),
  handler: async (ctx, { churchId }) => {
    const empty = { notesAllRight: 0, right: 0, blank: 0, wrong: 0 };
    const none = { notes: jevSet.length, unanswered: 0, model, mix: empty, confirm: empty, choose: empty, fresh: empty, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: jevSet.length })) return { status: "no allowance" as const, ...none };
    const rows = await Promise.all(jevSet.map(async item => {
      const draft = prepareRequestDraft(item.note), found = urgentSigns(item.note);
      const confirmSigns = signQuestions(found);
      const answers = await decide(key, { note: withoutIdentity(item.note, { names: [], addresses: [] }) }, {
        ...Object.fromEntries(Object.entries(draftQuestions(draft)).map(([field, instructions]) => [field, { type: "noul" as const, instructions }])),
        ...Object.fromEntries(found.map(({ reason }) => [`confirm_${reason}`, { type: "noul" as const, instructions: confirmSigns[reason] }])),
        choose_kind: kindQuestion,
        ...Object.fromEntries(urgentReasons.map(reason => [`choose_${reason}`, signQuestion(reason, [])])),
      });
      if (!answers) return { id: item.id, scores: {} };
      const scores: Record<string, number | string> = {};
      for (const [name, answer] of Object.entries(answers)) {
        const value = noul(answer);
        if (value !== null) scores[name] = Math.round(value * 100) / 100;
      }
      const yes = (name: string) => typeof scores[name] === "number" && scores[name] >= sureEnough;
      const choice = picked(answers.choose_kind);
      if (choice) {
        scores.choose_kind = choice.kind;
        scores.choose_kind_confidence = Math.round(choice.confidence * 100) / 100;
      }
      const amount = draft.amountRequested;
      const payeeKind = draft.payeeKind && yes("payeeKind") ? draft.payeeKind : null;
      const wanted = item.signs.map(sign => sign.reason);
      const chosenKind = choice && choice.kind !== "none" && choice.confidence >= sureEnough ? choice.kind : null;
      const codeFound = found.map(sign => sign.reason);
      return {
        id: item.id, scores,
        mix: {
          kind: judge(settleKind(draft.kind, noul(answers.kind), choice), item.kind), amount: judge(amount, item.amount), payeeKind: judge(payeeKind, item.payeeKind),
          signs: judgeSigns(urgentReasons.filter(reason => yes(`${codeFound.includes(reason) ? "confirm" : "choose"}_${reason}`)), wanted),
        },
        confirm: {
          kind: judge(draft.kind && yes("kind") ? draft.kind : null, item.kind), amount: judge(amount, item.amount), payeeKind: judge(payeeKind, item.payeeKind),
          signs: judgeSigns(found.filter(({ reason }) => yes(`confirm_${reason}`)).map(sign => sign.reason), wanted),
        },
        choose: {
          kind: judge(chosenKind, item.kind), amount: judge(amount, item.amount), payeeKind: judge(payeeKind, item.payeeKind),
          signs: judgeSigns(urgentReasons.filter(reason => yes(`choose_${reason}`)), wanted),
        },
      };
    }));
    // The three arms are counted on the notes the lines were set from; "fresh" is the screens' way on the notes they were not.
    const count = (arm: "mix" | "confirm" | "choose", fresh = false) => {
      const all = rows.flatMap((row, index) => (row[arm] && !!jevSet[index].fresh === fresh ? [Object.values(row[arm])] : []));
      const of = (mark: Outcome) => all.flat().filter(value => value === mark).length;
      return { notesAllRight: all.filter(row => row.every(value => value === "right")).length, right: of("right"), blank: of("blank"), wrong: of("wrong") };
    };
    return { status: "done" as const, notes: jevSet.length, unanswered: rows.filter(row => !row.confirm).length, model, mix: count("mix"), fresh: count("mix", true), confirm: count("confirm"), choose: count("choose"), rows };
  },
});
