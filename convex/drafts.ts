import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query, env, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { prepareDraft } from "../src/lib/draft";
import { draftNotes, draftPayeeKinds, monthlyAllowance, kindNotes, prepareRequestDraft, requestKinds, withoutIdentity, type RequestDraft, type RequestKind } from "../src/lib/request-draft";
import { jevSet } from "../src/lib/jev-set";
import { nextStepSet, nextSteps, type NextStep } from "../src/lib/next-step-set";
import { visitSet } from "../src/lib/visit-set";
import { referralPlaces, referralSet, type ReferralPlace } from "../src/lib/referral-set";
import { repeatSet } from "../src/lib/repeat-set";
import type { RepeatFacts } from "../src/lib/repeat-words";
import { ledgerSet } from "../src/lib/ledger-set";
import { spanishSet } from "../src/lib/spanish-set";
import { DateTime } from "luxon";
import { urgentReasons, urgentSigns, type UrgentReason, type UrgentSign } from "../src/lib/urgency";
import { hour, hourAsked, neighborAccess, user } from "./access";
import { isSampleVisitor } from "./demo";
import { fiscalYear } from "./reports";
import { namesFor } from "./knownNames";
import { approvedBetween, paidTowardRequest, sumApproved } from "./treasury";

const draftResult = v.object({
  teamName: v.string(), recurrence: v.string(), peopleCount: v.string(),
  time: v.string(), notes: v.array(v.string()),
  verification: v.union(v.literal("review"), v.literal("checked")),
  /** The description exactly as the model was given it, with identity taken out. Empty when nothing was sent. */
  sent: v.string(),
});

export const identity = internalQuery({
  args: {}, returns: v.union(v.id("users"), v.null()),
  handler: async ctx => ((await ctx.auth.getUserIdentity()) ? (await user(ctx)).id : null),
});


/** What one visitor's session in the sample may ask the model for in a day; the sample's monthly allowance stays the ceiling. */
export const sampleSessionAllowance = 12;
/**
 * What every sample visitor together may ask for in a day. One address can open thirty sessions a minute, so the
 * per-session allowance alone would let one visitor spend the sample's whole month in minutes; this keeps it to a day.
 */
export const sampleDailyAllowance = 200;
/**
 * What one person may ask for in a day when no group is named (the team draft), where no monthly allowance applies.
 * Without it, five a minute was the only bound, all day, every day.
 */
export const personalDailyAllowance = 30;
/** The day's row every sample session shares in aiUsageBySession; a Clerk session id never starts with "*". */
const sampleDay = "*sample";

/**
 * Counts one request to the model, or says why it may not be made: the person's five a minute, or
 * the group's allowance for the month. A refusal is not an error; the draft simply comes back for review.
 * Every sample visitor is the same account, so there the five a minute and a small daily allowance belong to the
 * visitor's own sign-in session instead: one visitor can never use up the sample for everyone.
 */
export const reserve = internalMutation({
  /** `session`: a sample visitor's sign-in session, from a read scheduled after their own save, when no identity is at hand. */
  args: { userId: v.id("users"), churchId: v.optional(v.id("churches")), session: v.optional(v.string()) },
  returns: v.union(v.literal("ok"), v.literal("minute"), v.literal("month")),
  handler: async (ctx, { userId, churchId, session: scheduledFor }) => {
    const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
    const identity = await ctx.auth.getUserIdentity();
    const visitor = scheduledFor !== undefined || isSampleVisitor(identity?.subject);
    // Clerk names the session in `sid`; a token without one counts as a single session, so it is held tightest.
    const session = visitor ? scheduledFor ?? `${typeof identity?.sid === "string" ? identity.sid : "unnamed"}` : null;
    const day = new Date().toISOString().slice(0, 10);
    const daily = (key: string) => ctx.db.query("aiUsageBySession").withIndex("by_session_day", q => q.eq("session", key).eq("day", day)).unique();
    const own = session ? await daily(session) : null;
    const everyone = session ? await daily(sampleDay) : null;
    // With no group named, the person's own day is the ceiling a group's month would otherwise be.
    const personal = session || churchId ? null : `*user:${userId}`;
    const today = personal ? await daily(personal) : null;
    const previous = session ? null : await ctx.db.query("aiUsage").withIndex("by_user", q => q.eq("userId", userId)).unique();
    if (own && own.windowStart === windowStart && own.minute >= 5) return "minute" as const;
    if (own && own.count >= sampleSessionAllowance) return "month" as const;
    if (everyone && everyone.count >= sampleDailyAllowance) return "month" as const;
    if (previous?.windowStart === windowStart && previous.count >= 5) return "minute" as const;
    if (today && today.count >= personalDailyAllowance) return "month" as const;
    const month = new Date().toISOString().slice(0, 7);
    const used = churchId ? await ctx.db.query("aiUsageByChurch").withIndex("by_church_month", q => q.eq("churchId", churchId).eq("month", month)).unique() : null;
    if (used && used.count >= monthlyAllowance) return "month" as const;
    if (session) {
      if (own) await ctx.db.patch("aiUsageBySession", own._id, { windowStart, minute: own.windowStart === windowStart ? own.minute + 1 : 1, count: own.count + 1 });
      else await ctx.db.insert("aiUsageBySession", { session, day, windowStart, minute: 1, count: 1 });
      if (everyone) await ctx.db.patch("aiUsageBySession", everyone._id, { windowStart, count: everyone.count + 1 });
      else await ctx.db.insert("aiUsageBySession", { session: sampleDay, day, windowStart, minute: 0, count: 1 });
    } else if (previous) await ctx.db.patch("aiUsage", previous._id, {
      windowStart, count: previous.windowStart === windowStart ? previous.count + 1 : 1,
    });
    else await ctx.db.insert("aiUsage", { userId, windowStart, count: 1 });
    if (today) await ctx.db.patch("aiUsageBySession", today._id, { windowStart, count: today.count + 1 });
    else if (personal) await ctx.db.insert("aiUsageBySession", { session: personal, day, windowStart, minute: 0, count: 1 });
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
 * The version every line in this file was measured on (the made-up notes in src/lib/jev-set.ts).
 * "jev-latest" moves when a release ships and scores move with it, so change this only with a new measuring run.
 */
export const model = "jev-1.14.0";

type Known = { names: string[]; addresses: string[]; others?: string[] };

/** Every piece of text in a state, at any depth, with identity taken out. */
function scrubbed(value: unknown, known: Known): unknown {
  if (typeof value === "string") return withoutIdentity(value, known);
  if (Array.isArray(value)) return value.map(item => scrubbed(item, known));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, scrubbed(item, known)]));
  return value;
}
/**
 * One request to Jev: a state and named questions, all answered at once. Null means no usable reply, for any reason.
 * This is the only door to the model, and it takes names, phones, emails and addresses out of every text in the
 * state itself, so no caller can send a note as it was typed. `known` adds the names and addresses the records hold.
 */
async function decide(key: string, state: Record<string, unknown>, questions: Record<string, Question>, known: Known = { names: [], addresses: [] }): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, state: scrubbed(state, known), questions }),
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

export async function confidence<Field extends string>(key: string, state: Record<string, unknown>, questions: Record<Field, string>, known?: Known): Promise<Record<Field, number> | null> {
  const fields = Object.keys(questions) as Field[];
  const answers = await decide(key, state, Object.fromEntries(fields.map(field => [field, { type: "noul" as const, instructions: questions[field] }])), known);
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
export const sureEnough = 0.9;
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
function draftQuestions(draft: RequestDraft, payeeShown: boolean) {
  return {
    ...(draft.kind && { kind: `Does note mention ${kindMeaning[draft.kind]}? ${mentioned}` }),
    ...(draft.payeeKind && payeeShown && { payeeKind: `Does note mention ${payeeMeaning[draft.payeeKind]}? ${mentioned}` }),
  };
}
/**
 * Whether the model can see what the payee's kind was read from. A kind read from the payee's own name
 * ("Paid to County Water Authority") cannot be confirmed, because that name is never sent: asked anyway, the
 * model scored a plainly named gas company 0.15. Such a kind stands as code read it, like the amount.
 */
function payeeIsShown(draft: RequestDraft, note: string, known: Parameters<typeof withoutIdentity>[1] = { names: [], addresses: [] }) {
  return prepareRequestDraft(withoutIdentity(note, known)).payeeKind === draft.payeeKind;
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
/**
 * A call note states a bill more often than it says "help", so a bill or debt stated as a present fact counts
 * as the ask. Measured as the "trial" arm of run 5 against the earlier wording ("What one kind of help does
 * note ask for?"): 4 fewer blanks on 36 notes and nothing wrong, and the notes that ask for nothing scored lower.
 */
const kindQuestion: Question = { type: "choice", instructions: "What one kind of help does note ask for? A bill or an amount owed that note states as a present fact counts as asking for help with it.", criteria: kindChoice };
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
 * When code proposed the same kind it stands on the easier line; where code is silent (Spanish,
 * "no food") it stands alone only at 0.9. Where the two disagree, or Jev picks "none", the field is left
 * for a person. The confirming score is used only when the reply holds no pick.
 */
function settleKind(proposed: RequestKind | null, sure: number | null, pick: ReturnType<typeof picked>): RequestKind | null {
  if (!pick) return proposed && sure !== null && sure >= sureEnough ? proposed : null;
  if (pick.kind === "none") return null;
  if (proposed) return pick.kind === proposed && pick.confidence >= agreed ? proposed : null;
  return pick.confidence >= sureEnough ? pick.kind : null;
}
/** One question per sign: a sign code found is confirmed; any other is read by Jev itself, so a note in Spanish is read too. */
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
    const fallback = { ...draft, verification: "review" as const, sent: "" };
    if (!env.TYPESAFE_API_KEY) return fallback;
    // The team's name is read by code and never sent or asked about: a name typed into it ("Rosa's team") would leave
    // with it, and code already read it word for word from the description. It stands as read, like a request's amount.
    const fields = ["recurrence", "peopleCount", "time"] as const;
    const present = fields.filter(field => draft[field]);
    // Field names only, never the description: enough to see on the wire that nothing was read, so nothing was asked.
    if (!present.length) {
      console.log(`jev ${JSON.stringify({ team: "nothing read, nothing sent" })}`);
      return fallback;
    }
    if (await ctx.runMutation(internal.drafts.reserve, { userId }) !== "ok") throw new ConvexError("Please wait a minute before preparing another draft.");
    const plain = description;
    const { teamName: _unsent, ...proposed } = draft;
    const sure = await confidence(env.TYPESAFE_API_KEY, { description: plain, proposed }, Object.fromEntries(present.map(field => [field,
      `Does description explicitly and unambiguously support proposed.${field}? ${stated} Never infer availability, consent, qualifications, membership, or a new fact.`,
    ])) as Record<(typeof present)[number], string>);
    // The words left even when no usable answer came back, so the person is still shown them.
    const sent = withoutIdentity(plain, { names: [], addresses: [] });
    if (!sure) return { ...fallback, sent };
    for (const field of present) {
      if (sure[field] < sureEnough) {
        draft[field] = "";
        draft.notes.push(`Please confirm ${field === "peopleCount" ? "how many people are needed" : field === "time" ? "the start and end time" : "how often the team meets"}.`);
      }
    }
    return { ...draft, verification: "checked" as const, sent };
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
  returns: v.object({ userId: v.id("users"), note: v.string(), linked: v.boolean(), names: v.array(v.string()), addresses: v.array(v.string()), others: v.array(v.string()) }),
  handler: async (ctx, { churchId, callId }) => {
    const member = await neighborAccess(ctx, churchId);
    const call = await ctx.db.get("calls", callId);
    if (!call || call.churchId !== churchId) throw new ConvexError("Call not found.");
    const neighbor = call.neighborId ? await ctx.db.get("neighbors", call.neighborId) : null;
    return {
      userId: member.userId, note: call.note, linked: !!neighbor,
      names: [call.callerName, neighbor?.name ?? ""].filter(Boolean),
      addresses: neighbor?.address ? [neighbor.address] : [],
      others: await namesFor(ctx, churchId),
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
    const { note, names, addresses, others } = await ctx.runQuery(internal.drafts.callNote, args);
    return withoutIdentity(note, { names, addresses, others });
  },
});

/**
 * Turns a call note into a proposed request for help. It saves nothing: the screen shows the
 * draft, and the request exists only after a person approves it through assistance.
 * Code proposes each field and the model says whether the note mentions it. For the kind of help the
 * model also picks from the closed list, so a note code cannot read still gets a kind; see settleKind.
 * The model is sent the note with names, phones, emails and addresses taken out, and it writes no text at all.
 */
/**
 * Keeps the call just made to the assistant about a call note (aiReads), as it was made: the text exactly as it left,
 * each question with its answer, the model, and whether the reply was used. Returns a function that takes the result
 * being returned, schedules the row and hands the result straight back: the row is written after the answer goes,
 * and a failure to keep it never holds up or changes the answer or its fallback.
 */
function keepRead(ctx: ActionCtx, at: { churchId: Id<"churches">; callId: Id<"calls">; purpose: "draft" | "urgency" }, note: string, questions: Record<string, Question>, known: Known, answers: Record<string, unknown> | null) {
  return async <Result extends { verification: "checked" | "review" }>(result: Result): Promise<Result> => {
    try {
      const sent = scrubbed({ note }, known) as { note: string };
      const asked = Object.entries(questions).map(([key, { instructions }]) => {
        const answer = answers?.[key];
        const pick = picked(answer);
        const said = pick ? pick.confidence : noul(answer);
        // Yes is what the code took from the answer: sure enough to act on, the same line every reading uses.
        return { key, question: instructions, answer: said, ...(pick && { choice: pick.kind }), yes: said !== null && said >= sureEnough };
      });
      await ctx.scheduler.runAfter(0, internal.aiReads.keep, { ...at, sentText: sent.note, asked, model, outcome: result.verification, at: Date.now() });
    } catch (cause) {
      console.error(`aiReads not kept: ${cause instanceof Error ? cause.name : "unknown"}`);
    }
    return result;
  };
}

export const draftRequest = action({
  args: { churchId: v.id("churches"), callId: v.id("calls") }, returns: requestDraft,
  handler: async (ctx, args) => {
    const { userId, note, names, addresses, others } = await ctx.runQuery(internal.drafts.callNote, args);
    const draft = prepareRequestDraft(note);
    // The payee's name is copied by code and never shown to the model, so a person always confirms it.
    const fallback = { ...draft, verification: "review" as const };
    // A note too long to be one call's message is not sent anywhere; the person reads it.
    if (!env.TYPESAFE_API_KEY || note.length > 2000) return fallback;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return fallback;
    // Each question stands on its own in plain words. A bare field name ("proposed.kind") gave the model nothing to judge.
    const payeeShown = payeeIsShown(draft, note, { names, addresses, others });
    const questions = {
      ...Object.fromEntries(Object.entries(draftQuestions(draft, payeeShown)).map(([field, instructions]) => [field, { type: "noul" as const, instructions }])),
      chosenKind: kindQuestion,
    };
    const answers = await decide(env.TYPESAFE_API_KEY, { note }, questions, { names, addresses, others });
    const kept = keepRead(ctx, { ...args, purpose: "draft" }, note, questions, { names, addresses, others }, answers);
    if (!answers) return kept(fallback);
    const sure = { kind: noul(answers.kind), payeeKind: noul(answers.payeeKind) }, pick = picked(answers.chosenKind);
    // A proposed field with no usable answer means the reply cannot be trusted; the person reads the draft as code made it.
    if ((draft.kind && sure.kind === null && !pick) || (draft.payeeKind && payeeShown && sure.payeeKind === null)) return kept(fallback);
    // Field names, numbers and a kind from the closed list only, never the note: enough to see why a field came back blank.
    console.log(`jev ${JSON.stringify({ ...sure, chosenKind: pick?.kind, chosenConfidence: pick?.confidence })}`);
    const kind = settleKind(draft.kind, sure.kind, pick);
    if (draft.kind && !kind) draft.notes.push(draftNotes.confirmKind);
    const notes = draft.kind || !kind ? draft.notes : draft.notes.filter(line => line !== kindNotes.missing && line !== kindNotes.several);
    if (draft.payeeKind && payeeShown && (sure.payeeKind ?? 0) < sureEnough) {
      draft.payeeKind = null;
      draft.notes.push(draftNotes.confirmPayee);
    }
    return kept({ ...draft, kind, notes, verification: "checked" as const });
  },
});

const urgency = v.object({
  signs: v.array(v.object({ reason: v.union(...urgentReasons.map(reason => v.literal(reason))), day: v.union(v.number(), v.null()) })),
  verification: v.union(v.literal("review"), v.literal("checked")),
});

/**
 * Reads one call's note for signs that it should be returned first: a shut-off or eviction, no food,
 * a child, an elder, a medical need. A sign code finds is confirmed by the model; any other sign the model
 * reads for itself, so a note in Spanish is read too. A sign under 0.9 is not shown, and only code
 * gives a sign its day. It keeps the call's mark (assistance.keepReading) and decides nothing about who is helped:
 * the screen shows the reason, and a person can always move the call.
 */
export const readUrgency = action({
  args: { churchId: v.id("churches"), callId: v.id("calls") }, returns: urgency,
  handler: async (ctx, args): Promise<{ signs: UrgentSign[]; verification: "review" | "checked" }> => {
    const read = await readNote(ctx, args);
    // Saved here, where the check was made, so who put the call first is never the client's to say.
    const day = read.signs.find(sign => sign.day !== null)?.day ?? undefined;
    await ctx.runMutation(internal.assistance.keepReading, { ...args, reasons: read.signs.map(sign => sign.reason), day, by: read.verification === "checked" ? "assistant" : "rules" });
    return read;
  },
});

async function readNote(ctx: ActionCtx, args: { churchId: Id<"churches">; callId: Id<"calls"> }): Promise<{ signs: UrgentSign[]; verification: "review" | "checked" }> {
  const { userId, note, linked, names, addresses, others } = await ctx.runQuery(internal.drafts.callNote, args);
  const signs = urgentSigns(note);
  const fallback = { signs, verification: "review" as const };
  if (!env.TYPESAFE_API_KEY || note.length > 2000) return fallback;
  if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return fallback;
  // A linked neighbor's record already says what they speak, so the note is asked about Spanish only when there is none.
  const questions: Record<string, Question> = { ...Object.fromEntries(urgentReasons.map(reason => [reason, signQuestion(reason, signs)])), ...(!linked && { spanish: spanishQuestion }) };
  const answers = await decide(env.TYPESAFE_API_KEY, { note }, questions, { names, addresses, others });
  const spanish = linked ? null : noul(answers?.spanish);
  if (spanish !== null) await ctx.runMutation(internal.assistance.keepSpanish, { ...args, spanish: spanish >= sureEnough });
  const kept = keepRead(ctx, { ...args, purpose: "urgency" }, note, questions, { names, addresses, others }, answers);
  if (!answers) return kept(fallback);
  const sure = Object.fromEntries(urgentReasons.map(reason => [reason, noul(answers[reason])]));
  if (signs.some(({ reason }) => sure[reason] === null)) return kept(fallback);
  console.log(`jev ${JSON.stringify(sure)}`);
  return kept({
    signs: urgentReasons.flatMap(reason => ((sure[reason] ?? 0) >= sureEnough ? [signs.find(sign => sign.reason === reason) ?? { reason, day: null }] : [])),
    verification: "checked" as const,
  });
}

/** Asked with the urgent signs, in the same request; shared with measureSpanish so both ask the same thing. */
const spanishQuestion = { type: "noul" as const, instructions: "Is note written in Spanish, or does it say the caller speaks Spanish?" };

const yearFlagKinds = ["approvedNotPaid", "paidNoPayment", "visitNoHours", "noteSaysPaid", "visitNotMarked"] as const;
const yearFlag = v.object({
  kind: v.union(...yearFlagKinds.map(kind => v.literal(kind))),
  record: v.union(v.object({ table: v.literal("assistanceRequests"), id: v.id("assistanceRequests") }), v.object({ table: v.literal("visits"), id: v.id("visits") })),
  /** "rule" was found by counting alone; "assistant" means the model read a note. */
  source: v.union(v.literal("rule"), v.literal("assistant")),
});
const toRead = v.object({ kind: v.union(v.literal("noteSaysPaid"), v.literal("visitNotMarked")), record: yearFlag.fields.record, note: v.string(), names: v.array(v.string()), addresses: v.array(v.string()), /** Who a request was paid to: written with a capital, it is taken out like any name. */ payee: v.optional(v.string()) });
const paidWords = /\b(?:paid|sent (?:a |the )?check|check (?:was )?(?:sent|mailed)|covered the|pagad[oa]|pagamos)\b/i;
const visitedWords = /\b(?:visited|we met|met with|went to see|stopped by|visitamos)\b/i;

/**
 * The year's records that do not add up, found by rules alone, and the notes worth a second reading.
 * No names leave this function except inside toRead, which never leaves the server.
 */
export const yearRecords = internalQuery({
  // `now` comes from the action that asks: a query never reads the clock.
  args: { churchId: v.id("churches"), year: v.number(), now: v.number() },
  returns: v.object({ userId: v.id("users"), flags: v.array(yearFlag), toRead: v.array(toRead), others: v.array(v.string()) }),
  handler: async (ctx, { churchId, year, now }) => {
    const member = await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church || !Number.isInteger(year) || year < 2000 || year > 2100) throw new ConvexError("Year not found.");
    const { start, end } = fiscalYear(year, church.timeZone);
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
      else if (paidWords.test(request.decisionNote) && reading.length < 20) reading.push({ kind: "noteSaysPaid", record, note: request.decisionNote, ...(await identity(request.neighborId)), payee: request.payeeName });
      else if (request.status === "approved" && (request.decidedAt ?? request.createdAt) < now - 30 * 86_400_000) flags.push({ kind: "approvedNotPaid", record, source: "rule" });
    }
    for (const visit of visits) {
      const record = { table: "visits" as const, id: visit._id };
      if (visit.status === "completed" && visit.visitors.every(visitor => visitor.hours === 0)) flags.push({ kind: "visitNoHours", record, source: "rule" });
      else if (visit.status === "scheduled" && visit.scheduledAt < now && visitedWords.test(visit.notes) && reading.length < 20) reading.push({ kind: "visitNotMarked", record, note: visit.notes, ...(await identity(visit.neighborId)) });
    }
    return { userId: member.userId, flags, toRead: reading, others: reading.length ? await namesFor(ctx, churchId) : [] };
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
    const { userId, flags, toRead: reading, others } = await ctx.runQuery(internal.drafts.yearRecords, { ...args, now: Date.now() });
    // With no model, a person reads the notes code picked out; they are flagged as a rule's finding.
    const unread = { flags: [...flags, ...reading.map(({ kind, record }) => ({ kind, record, source: "rule" as const }))], verification: "review" as const };
    if (!reading.length) return { flags, verification: "checked" };
    if (!env.TYPESAFE_API_KEY) return unread;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return unread;
    const asked = { noteSaysPaid: "that money was already paid or a check already sent for this request", visitNotMarked: "that the home visit already took place" };
    const sure = await confidence(env.TYPESAFE_API_KEY,
      { notes: Object.fromEntries(reading.map((item, index) => [`n${index}`, item.note.slice(0, 1000)])) },
      Object.fromEntries(reading.map((item, index) => [`n${index}`, `Does notes.n${index} say ${asked[item.kind]}? ${plainly}`])),
      { names: reading.flatMap(item => item.names), addresses: reading.flatMap(item => item.addresses), others: [...others, ...reading.flatMap(item => (item.payee ? [item.payee] : []))] },
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
  args: { churchId: v.id("churches"), at: hour },
  returns: v.object({
    callsWaiting: v.number(), callsFirstByAssistant: v.number(), callsFirstByRules: v.number(), callsFirstByPerson: v.number(), oldestWaitingDays: v.number(),
    visitsPlanned: v.number(), requestsOpen: v.number(), approvedUnpaid: v.number(), approvedUnpaidCents: v.number(),
    openPlaces: v.number(), away: v.number(),
  }),
  handler: async (ctx, { churchId, at }) => {
    await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church) throw new ConvexError("Group not found.");
    const now = hourAsked(at), weekEnd = now + 7 * 86_400_000;
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
      callsFirstByRules: waiting.filter(call => call.urgent?.reasons.length && call.urgent.by === "rules").length,
      callsFirstByPerson: waiting.filter(call => call.urgent?.reasons.length && call.urgent.by === "person").length,
      // The hour asked about began before a call taken within it, so the age never reads below zero.
      oldestWaitingDays: waiting.length ? Math.max(0, Math.floor((now - Math.min(...waiting.map(call => call.takenAt))) / 86_400_000)) : 0,
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
const arms = { mix: tally, confirm: tally, choose: tally };

/**
 * Sends the made-up set in src/lib/jev-set.ts to the live model once and reports how it did. It is run by
 * hand from the Convex command line, never from a screen. It reads no record and saves none: the notes
 * are the made-up ones in the code, and the one thing written is the count against the group's month.
 * What comes back is field names, scores and right, blank or wrong; never a note.
 *
 * Each note is judged three ways from one request. "mix" is what the screens do: code proposes and Jev
 * confirms, and where code is silent Jev picks the kind and reads the sign itself. "confirm" is code proposing
 * and Jev confirming only; "choose" is Jev alone on kind and signs. The amount is read by code in all three,
 * and who is paid is settled the same way in all three, since Jev cannot write either. Each top line counts every note
 * in its rows. "fresh" holds the same lines counted only on the notes added after the lines were set, which
 * no line was set on: fresh.mix is the figure to trust and the one the screens quote. A shown value that
 * the note does not support is "wrong"; a right value left for a person is "blank".
 */
export const measure = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({
    status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")),
    notes: v.number(), unanswered: v.number(), model: v.string(), ...arms, fresh: v.object(arms),
    rows: v.array(v.object({ id: v.string(), mix: v.optional(marks), confirm: v.optional(marks), choose: v.optional(marks), scores: v.record(v.string(), v.union(v.number(), v.string())) })),
  }),
  handler: async (ctx, { churchId }) => {
    const empty = { notesAllRight: 0, right: 0, blank: 0, wrong: 0 };
    const blank = { mix: empty, confirm: empty, choose: empty };
    const none = { notes: jevSet.length, unanswered: 0, model, ...blank, fresh: blank, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: jevSet.length })) return { status: "no allowance" as const, ...none };
    const rows = await Promise.all(jevSet.map(async item => {
      const draft = prepareRequestDraft(item.note), found = urgentSigns(item.note);
      const confirmSigns = signQuestions(found), payeeShown = payeeIsShown(draft, item.note);
      const answers = await decide(key, { note: item.note }, {
        ...Object.fromEntries(Object.entries(draftQuestions(draft, payeeShown)).map(([field, instructions]) => [field, { type: "noul" as const, instructions }])),
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
      const payeeKind = draft.payeeKind && (!payeeShown || yes("payeeKind")) ? draft.payeeKind : null;
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
    // Every line counts the rows it is printed above: all notes at the top, the fresh notes under "fresh".
    const count = (arm: keyof typeof arms, freshOnly: boolean) => {
      const all = rows.flatMap((row, index) => { const marked = row[arm]; return marked && (!freshOnly || jevSet[index].fresh) ? [Object.values(marked)] : []; });
      const of = (mark: Outcome) => all.flat().filter(value => value === mark).length;
      return { notesAllRight: all.filter(row => row.every(value => value === "right")).length, right: of("right"), blank: of("blank"), wrong: of("wrong") };
    };
    const lines = (freshOnly: boolean) => ({ mix: count("mix", freshOnly), confirm: count("confirm", freshOnly), choose: count("choose", freshOnly) });
    return { status: "done" as const, notes: jevSet.length, unanswered: rows.filter(row => !row.confirm).length, model, ...lines(false), fresh: lines(true), rows };
  },
});

/** One yes or no per place, by index; shared with measureReferrals so both ask the same thing. */
function referralQuestions(count: number) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`p${index}`, `Does note describe a need of the caller's own household that places.p${index} helps with? ${mentioned}`]));
}

/** A request's own words, the call it came from, and the group's places that say what they help with. Never sent as it is. */
export const referralNote = internalQuery({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests") },
  returns: v.object({ userId: v.id("users"), note: v.string(), agencies: v.array(v.object({ name: v.string(), helpsWith: v.string() })), names: v.array(v.string()), addresses: v.array(v.string()), others: v.array(v.string()) }),
  handler: async (ctx, { churchId, requestId }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ctx.db.get("assistanceRequests", requestId);
    if (!request || request.churchId !== churchId) throw new ConvexError("Request not found.");
    const [neighbor, call, places] = await Promise.all([
      ctx.db.get("neighbors", request.neighborId),
      request.callId ? ctx.db.get("calls", request.callId) : null,
      ctx.db.query("referralAgencies").withIndex("by_church", q => q.eq("churchId", churchId)).take(100),
    ]);
    // A place with nothing written under "helps with" gives the model nothing to judge, so it is never asked about.
    const agencies = places.filter(place => place.helpsWith.trim()).slice(0, 12).map(place => ({ name: place.name, helpsWith: place.helpsWith.trim().slice(0, 200) }));
    return {
      userId: member.userId,
      note: [request.summary, call?.note ?? ""].map(text => text.trim()).filter(Boolean).join("\n"),
      agencies,
      names: [neighbor?.name ?? "", call?.callerName ?? ""].filter(Boolean),
      addresses: neighbor?.address ? [neighbor.address] : [],
      // Place names are taken out too: the model judges what a place helps with, never which place it is.
      others: agencies.length ? [...(await namesFor(ctx, churchId)), ...places.map(place => place.name)] : [],
    };
  },
});

/**
 * Where else the neighbor could be sent, for the approve or decline form. The model is given the request's note and
 * each of the group's own places as only what it helps with (no place's name), and says yes or no for each. A place
 * is offered only at 0.9 or more, and only a person adds it: this saves nothing and refers no one.
 */
export const suggestReferrals = action({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests") },
  returns: v.object({ places: v.array(v.string()), verification: v.union(v.literal("review"), v.literal("checked")) }),
  handler: async (ctx, args): Promise<{ places: string[]; verification: "review" | "checked" }> => {
    const { userId, note, agencies, names, addresses, others } = await ctx.runQuery(internal.drafts.referralNote, args);
    const none = { places: [], verification: "review" as const };
    if (!agencies.length || !note || !env.TYPESAFE_API_KEY || note.length > 2000) return none;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return none;
    const key = (index: number) => `p${index}`;
    const sure = await confidence(env.TYPESAFE_API_KEY,
      { note, places: Object.fromEntries(agencies.map((place, index) => [key(index), place.helpsWith])) },
      referralQuestions(agencies.length),
      { names, addresses, others },
    );
    if (!sure) return none;
    return { places: agencies.flatMap((place, index) => (sure[key(index)] >= sureEnough ? [place.name] : [])), verification: "checked" };
  },
});

/** A written-up visit's note, with the names and addresses that must be taken out of it. */
export const visitNote = internalQuery({
  args: { churchId: v.id("churches"), visitId: v.id("visits") },
  returns: v.object({ note: v.string(), names: v.array(v.string()), addresses: v.array(v.string()), others: v.array(v.string()) }),
  handler: async (ctx, { churchId, visitId }) => {
    const visit = await ctx.db.get("visits", visitId);
    if (!visit || visit.churchId !== churchId || visit.status !== "completed") throw new ConvexError("Visit not found.");
    const neighbor = await ctx.db.get("neighbors", visit.neighborId);
    return {
      note: visit.notes,
      names: neighbor?.name ? [neighbor.name] : [],
      addresses: neighbor?.address ? [neighbor.address] : [],
      others: await namesFor(ctx, churchId),
    };
  },
});

export const keepFound = internalMutation({
  args: { visitId: v.id("visits"), kind: v.union(...requestKinds.map(kind => v.literal(kind)), v.null()), signs: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { visitId, kind, signs }) => {
    await ctx.db.patch("visits", visitId, { found: { ...(kind && { kind }), signs, at: Date.now() } });
    return null;
  },
});

/**
 * After a visit is written up: whether its note shows a need the visit was not for. The same measured questions as
 * the help line (the kind-of-help pick and each urgent sign, at 0.9 or more) are asked of the note with names and
 * addresses taken out. What passes is kept on the visit and shown under it; nothing is started, and a person decides.
 * Scheduled by visits.writeUp, inside the member's own save, so it is never reachable from outside and needs no sign-in of its own.
 */
export const readVisit = internalAction({
  args: { churchId: v.id("churches"), visitId: v.id("visits"), userId: v.id("users"), session: v.optional(v.string()) },
  returns: v.object({ kind: v.union(...requestKinds.map(kind => v.literal(kind)), v.null()), signs: v.array(v.union(...urgentReasons.map(reason => v.literal(reason)))), verification: v.union(v.literal("review"), v.literal("checked")) }),
  handler: async (ctx, args): Promise<{ kind: RequestKind | null; signs: UrgentReason[]; verification: "review" | "checked" }> => {
    const { note, names, addresses, others } = await ctx.runQuery(internal.drafts.visitNote, { churchId: args.churchId, visitId: args.visitId });
    const none = { kind: null, signs: [], verification: "review" as const };
    if (!note.trim() || !env.TYPESAFE_API_KEY || note.length > 2000) return none;
    if (await ctx.runMutation(internal.drafts.reserve, { userId: args.userId, churchId: args.churchId, session: args.session }) !== "ok") return none;
    const found = urgentSigns(note);
    const questions = { ...Object.fromEntries(urgentReasons.map(reason => [reason, signQuestion(reason, found)])), chosenKind: kindQuestion };
    const answers = await decide(env.TYPESAFE_API_KEY, { note }, questions, { names, addresses, others });
    if (!answers) return none;
    const pick = picked(answers.chosenKind);
    const kind = pick && pick.kind !== "none" && pick.confidence >= sureEnough ? pick.kind : null;
    const signs = urgentReasons.filter(reason => (noul(answers[reason]) ?? 0) >= sureEnough);
    console.log(`jev visit ${JSON.stringify({ kind, signs })}`);
    await ctx.runMutation(internal.drafts.keepFound, { visitId: args.visitId, kind, signs });
    return { kind, signs, verification: "checked" };
  },
});

/**
 * Measures the referral question on the made-up set (src/lib/referral-set.ts), with the same wording and the same 0.9
 * line the form uses. For each note and place: right (offered and fits, or left out and does not), missed, or wrong.
 */
const referralTally = v.object({ right: v.number(), missed: v.number(), wrong: v.number() });
export const measureReferrals = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({ status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")), model: v.string(), all: referralTally, heldOut: referralTally, rows: v.array(v.object({ id: v.string(), offered: v.array(v.string()), scores: v.record(v.string(), v.number()) })) }),
  handler: async (ctx, { churchId }) => {
    const zero = { right: 0, missed: 0, wrong: 0 };
    const none = { model, all: zero, heldOut: zero, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: referralSet.length })) return { status: "no allowance" as const, ...none };
    const places = Object.keys(referralPlaces) as ReferralPlace[];
    const rows = await Promise.all(referralSet.map(async item => {
      const sure = await confidence(key, { note: item.note, places: Object.fromEntries(places.map((place, index) => [`p${index}`, referralPlaces[place]])) }, referralQuestions(places.length));
      const scores = Object.fromEntries(places.map((place, index) => [place, Math.round((sure?.[`p${index}`] ?? 0) * 100) / 100]));
      const offered = places.filter(place => scores[place] >= sureEnough);
      const marks = places.map(place => (offered.includes(place) === item.fits.includes(place) ? "right" : offered.includes(place) ? "wrong" : "missed"));
      return { id: item.id, offered, scores, marks, heldOut: !!item.heldOut };
    }));
    const add = (only: boolean) => rows.filter(row => !only || row.heldOut).flatMap(row => row.marks).reduce((sum, mark) => ({ ...sum, [mark]: sum[mark] + 1 }), { ...zero });
    return { status: "done" as const, model, all: add(false), heldOut: add(true), rows: rows.map(({ id, offered, scores }) => ({ id, offered, scores })) };
  },
});

const monthFlagKinds = ["double", "overApproved", "noCategory", "noPayee", "offCategory"] as const;
const monthFlag = v.object({
  kind: v.union(...monthFlagKinds.map(kind => v.literal(kind))),
  entryId: v.id("ledgerEntries"),
  /** "rule" was found by counting alone; "assistant" means the model read the memo. */
  source: v.union(v.literal("rule"), v.literal("assistant")),
});
const memoToRead = v.object({ entryId: v.id("ledgerEntries"), memo: v.string(), category: v.string() });
/**
 * One line's question, with its two ends spelled out; shared with measureLedger so both ask the same thing. No free text
 * goes in the question: the memo and the category are both read from the state, which decide() scrubs.
 */
function offCategoryQuestion(line: string): Question {
  return {
    type: "noul",
    instructions: `Does ${line}.memo describe spending on something other than ${line}.category?`,
    criteria: {
      true: `${line}.memo plainly describes buying or paying for something that is not ${line}.category`,
      false: `${line}.memo describes ${line}.category, says too little to tell, or does not describe spending at all`,
    },
  };
}
/** How sure the model is of each line, 0 to 1, or null when any answer is not a number. One request for every line. */
/**
 * A request's kind is booked as its bare code ("voucher"), which tells the model nothing: run 2 read a thrift-store bed
 * under "voucher" as spending elsewhere. Each code goes as what it means, the same words the help line asks with.
 */
const described = (category: string) => (category in kindMeaning ? kindMeaning[category as RequestKind] : category);
async function offCategory(key: string, lines: { memo: string; category: string }[], known?: Known) {
  const answers = await decide(key,
    { lines: Object.fromEntries(lines.map((line, index) => [`l${index}`, { memo: line.memo.slice(0, 500), category: described(line.category) }])) },
    Object.fromEntries(lines.map((_, index) => [`l${index}`, offCategoryQuestion(`lines.l${index}`)])),
    known,
  );
  if (!answers) return null;
  const sure = lines.map((_, index) => noul(answers[`l${index}`]));
  return sure.every((value): value is number => value !== null) ? sure : null;
}

/**
 * One month of the ledger, checked by rules alone, and the memos worth a reading. The month is the group's own:
 * an entry's date is already a day on the group's clock, and a month ahead of today there is refused.
 * No payee or neighbor name leaves this function except as a name to take out, and that never leaves the server.
 */
export const monthRecords = internalQuery({
  args: { churchId: v.id("churches"), month: v.string() },
  returns: v.object({ userId: v.id("users"), flags: v.array(monthFlag), toRead: v.array(memoToRead), names: v.array(v.string()), others: v.array(v.string()) }),
  handler: async (ctx, { churchId, month }) => {
    const member = await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    const start = DateTime.fromFormat(month, "yyyy-MM", { zone: church?.timeZone ?? "UTC" });
    if (!church || !/^\d{4}-\d{2}$/.test(month) || !start.isValid || month > DateTime.now().setZone(church.timeZone).toFormat("yyyy-MM")) throw new ConvexError("Choose a month.");
    // A week before the month too, so a payment entered again on the 2nd is seen beside the one on the 28th.
    const from = start.minus({ days: 7 }).toFormat("yyyy-MM-dd"), to = start.plus({ months: 1 }).toFormat("yyyy-MM-dd");
    const near = await ctx.db.query("ledgerEntries").withIndex("by_church", q => q.eq("churchId", churchId).gte("date", from).lt("date", to)).take(1000);
    const taken = await Promise.all(near.map(entry => ctx.db.query("ledgerEntries").withIndex("by_reverses", q => q.eq("reverses", entry._id)).first()));
    // A voided line, a reversal, and a line a reversal took back are all out of the check.
    const live = near.filter((entry, index) => !entry.voidedAt && !entry.reverses && !taken[index]);
    const inMonth = live.filter(entry => entry.date.startsWith(month));
    const flags: (typeof monthFlag.type)[] = [];
    const apart = (a: string, b: string) => Math.abs(DateTime.fromISO(a).diff(DateTime.fromISO(b), "days").days);
    const same = (row: (typeof live)[number]) => `${row.kind}:${row.amount}:${row.payee.trim().toLowerCase()}`;
    for (const entry of inMonth) {
      const flag = (kind: (typeof monthFlagKinds)[number]) => flags.push({ kind, entryId: entry._id, source: "rule" });
      if (entry.payee.trim() && live.some(other => other._id !== entry._id && same(other) === same(entry) && apart(other.date, entry.date) <= 7)) flag("double");
      if (entry.kind !== "expense") continue;
      if (entry.requestId) {
        const request = await ctx.db.get("assistanceRequests", entry.requestId);
        if (request?.amountApproved !== undefined && entry.amount > request.amountApproved) flag("overApproved");
      }
      if (!entry.category.trim()) flag("noCategory");
      if (!entry.payee.trim()) flag("noPayee");
    }
    const reading = inMonth.filter(entry => entry.kind === "expense" && entry.memo.trim() && entry.category.trim()).slice(0, 20);
    const neighbors = await Promise.all([...new Set(reading.flatMap(entry => entry.neighborId ?? []))].map(id => ctx.db.get("neighbors", id)));
    return {
      userId: member.userId, flags,
      toRead: reading.map(entry => ({ entryId: entry._id, memo: entry.memo, category: entry.category })),
      names: neighbors.flatMap(neighbor => (neighbor ? [neighbor.name] : [])),
      others: reading.length ? [...await namesFor(ctx, churchId), ...new Set(near.map(entry => entry.payee.trim()).filter(Boolean))] : [],
    };
  },
});

/**
 * Before a treasurer closes or reports a month: the ledger lines worth a second look. Every number is code's:
 * likely double entries, a payment above what was approved, a line with no category or no payee. The model reads
 * only memos, with every payee and neighbor name taken out, and says for each whether it describes spending on
 * something other than its category. One request, one reservation, and nothing changes: each flag points to one line.
 */
export const checkMonth = action({
  args: { churchId: v.id("churches"), month: v.string() },
  returns: v.object({ flags: v.array(monthFlag), verification: v.union(v.literal("review"), v.literal("checked")) }),
  handler: async (ctx, args): Promise<{ flags: (typeof monthFlag.type)[]; verification: "review" | "checked" }> => {
    const { userId, flags, toRead: reading, names, others } = await ctx.runQuery(internal.drafts.monthRecords, args);
    const unread = { flags, verification: "review" as const };
    if (!reading.length) return { flags, verification: "checked" };
    if (!env.TYPESAFE_API_KEY) return unread;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return unread;
    const sure = await offCategory(env.TYPESAFE_API_KEY, reading, { names, addresses: [], others });
    if (!sure) return unread;
    return { flags: [...flags, ...reading.flatMap(({ entryId }, index) => (sure[index] >= sureEnough ? [{ kind: "offCategory" as const, entryId, source: "assistant" as const }] : []))], verification: "checked" };
  },
});

/**
 * Measures the month check's memo question on the made-up set (src/lib/ledger-set.ts), with the same wording and the
 * same 0.9 line checkMonth uses, in one request. Run by hand from the Convex command line; it reads and saves no record.
 */
/**
 * Trial wording, measured beside the live one before it may replace it: instead of "is this other than its category",
 * Jev picks what the memo is spent on from the group's own categories (sent as data, scrubbed), "something else", or
 * "unclear". A line is flagged when the pick is another category or "something else", at `agreed` or more. Run 1 missed
 * plain cases (a car repair under rent scored 0.84; a deposit under utility 0.60), which a pick should see more steadily.
 */
function spentOnQuestion(line: string, categories: number): Question {
  return {
    type: "choice",
    instructions: `What does ${line}.memo describe spending on?`,
    criteria: {
      ...Object.fromEntries(Array.from({ length: categories }, (_, index) => [`c${index}`, `Spending that fits categories.c${index}`])),
      elsewhere: "Spending on something that fits none of the categories",
      unclear: "The memo says too little to tell, or does not describe spending",
    },
  };
}
async function spentOn(key: string, lines: { memo: string; category: string }[], known?: Known) {
  const categories = [...new Set(lines.map(line => line.category))];
  const answers = await decide(key,
    { categories: Object.fromEntries(categories.map((name, index) => [`c${index}`, described(name)])), lines: Object.fromEntries(lines.map((line, index) => [`l${index}`, { memo: line.memo.slice(0, 500) }])) },
    Object.fromEntries(lines.map((_, index) => [`l${index}`, spentOnQuestion(`lines.l${index}`, categories.length)])),
    known,
  );
  if (!answers) return null;
  return lines.map((line, index) => {
    const answer = answers[`l${index}`];
    if (!answer || typeof answer !== "object" || !("choice" in answer) || !("confidence" in answer) || typeof answer.confidence !== "number" || typeof answer.choice !== "string") return null;
    const own = `c${categories.indexOf(line.category)}`;
    return { pick: answer.choice, confidence: answer.confidence, elsewhere: answer.choice !== own && answer.choice !== "unclear" };
  });
}

export const measureLedger = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({ status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance"), v.literal("no answer")), model: v.string(), all: referralTally, heldOut: referralTally, trial: v.object({ all: referralTally, heldOut: referralTally }), fresh: v.object({ live: referralTally, trial: referralTally }), rows: v.array(v.object({ id: v.string(), score: v.number(), flagged: v.boolean(), pick: v.optional(v.string()), pickConfidence: v.optional(v.number()), trialFlagged: v.optional(v.boolean()) })) }),
  handler: async (ctx, { churchId }) => {
    const zero = { right: 0, missed: 0, wrong: 0 };
    const none = { model, all: zero, heldOut: zero, trial: { all: zero, heldOut: zero }, fresh: { live: zero, trial: zero }, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: 2 })) return { status: "no allowance" as const, ...none };
    const [sure, picks] = await Promise.all([offCategory(key, ledgerSet), spentOn(key, ledgerSet)]);
    if (!sure) return { status: "no answer" as const, ...none };
    const rows = ledgerSet.map((item, index) => {
      const flagged = sure[index] >= sureEnough;
      const mark = flagged === item.off ? "right" as const : flagged ? "wrong" as const : "missed" as const;
      const pick = picks?.[index] ?? null;
      // Trial 3: the live yes stands; otherwise both readings must lean the same way: a near-certain pick of somewhere
      // else (0.95) and a yes-or-no score of at least 0.5. Either alone is too loose (run 2: three wrong); below, it abstains.
      const trialFlagged = flagged || (!!pick?.elsewhere && pick.confidence >= 0.95 && sure[index] >= 0.5);
      const trialMark = trialFlagged === item.off ? "right" as const : trialFlagged ? "wrong" as const : "missed" as const;
      return { id: item.id, score: Math.round(sure[index] * 100) / 100, flagged, mark, trialMark, heldOut: !!item.heldOut, fresh: !!item.fresh, ...(pick && { pick: pick.pick, pickConfidence: Math.round(pick.confidence * 100) / 100, trialFlagged }) };
    });
    const add = (only: boolean | "fresh", arm: "mark" | "trialMark") => rows.filter(row => (only === "fresh" ? row.fresh : !only || row.heldOut)).reduce((sum, row) => ({ ...sum, [row[arm]]: sum[row[arm]] + 1 }), { ...zero });
    return {
      status: "done" as const, model, all: add(false, "mark"), heldOut: add(true, "mark"), trial: { all: add(false, "trialMark"), heldOut: add(true, "trialMark") }, fresh: { live: add("fresh", "mark"), trial: add("fresh", "trialMark") },
      rows: rows.map(({ id, score, flagged, pick, pickConfidence, trialFlagged }) => ({ id, score, flagged, ...(pick !== undefined && { pick, pickConfidence, trialFlagged }) })),
    };
  },
});

/**
 * Measures the visit read on the made-up set (src/lib/visit-set.ts) with the same questions and 0.9 line readVisit uses.
 * The kind and each of the eight signs is one mark: right, missed (left out but true) or wrong (shown but untrue).
 */
export const measureVisits = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({ status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")), model: v.string(), all: referralTally, heldOut: referralTally, rows: v.array(v.object({ id: v.string(), kind: v.union(v.string(), v.null()), signs: v.array(v.string()) })) }),
  handler: async (ctx, { churchId }) => {
    const zero = { right: 0, missed: 0, wrong: 0 };
    const none = { model, all: zero, heldOut: zero, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: visitSet.length })) return { status: "no allowance" as const, ...none };
    const rows = await Promise.all(visitSet.map(async item => {
      const found = urgentSigns(item.note);
      const answers = await decide(key, { note: item.note }, { ...Object.fromEntries(urgentReasons.map(reason => [reason, signQuestion(reason, found)])), chosenKind: kindQuestion });
      const pick = answers ? picked(answers.chosenKind) : null;
      const kind = pick && pick.kind !== "none" && pick.confidence >= sureEnough ? pick.kind : null;
      const signs = answers ? urgentReasons.filter(reason => (noul(answers[reason]) ?? 0) >= sureEnough) : [];
      const mark = (shown: boolean, wanted: boolean) => (shown === wanted ? "right" : shown ? "wrong" : "missed");
      const marks = [kind === item.kind ? "right" : kind ? "wrong" : "missed", ...urgentReasons.map(reason => mark(signs.includes(reason), item.signs.includes(reason)))] as const;
      return { id: item.id, kind, signs, marks, heldOut: !!item.heldOut };
    }));
    const add = (only: boolean) => rows.filter(row => !only || row.heldOut).flatMap(row => row.marks).reduce((sum, mark) => ({ ...sum, [mark]: sum[mark] + 1 }), { ...zero });
    return { status: "done" as const, model, all: add(false), heldOut: add(true), rows: rows.map(({ id, kind, signs }) => ({ id, kind, signs })) };
  },
});

/** A household's records are read back one year from the request. */
const repeatYear = 365 * 86_400_000;
/** A request of the same kind approved or paid this many days before is shown from the records alone, with no model. */
const repeatRecentDays = 90;
/** The newest earlier records the model is asked about; each is two questions. */
const repeatRecords = 6;
const kindValidator = v.union(...requestKinds.map(kind => v.literal(kind)));
const recordWhat = v.union(v.literal("request"), v.literal("note"), v.literal("visit"));

/** Two yes-or-no questions per earlier record, by index; shared with measureRepeats so both ask the same thing. */
function repeatQuestions(count: number) {
  const judge = "Judge only what the texts say.";
  return Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const earlier = `earlier.r${index}.text`;
    return [
      [`same${index}`, `Is ${earlier} about the same bill, the same rent or the same need as request, for the same month or the same amount? Answer no when request is for a new month, a different bill or a different need. ${judge}`],
      // "Says otherwise" is asked four ways, each narrow: one broad question scored real contradictions between 0.41 and 0.86.
      [`differs${index}`, `Does request state something about the caller's own household that ${earlier} plainly states otherwise? Answer no when the two only add to each other, when the time between them could explain the change, or when either is unclear. ${judge}`],
      [`home${index}`, `Does request say who lives in the household, such as living alone or having no children, in a way that ${earlier} contradicts? Answer no when they agree, when one only adds a detail, or when either says nothing about who lives there. ${judge}`],
      [`work${index}`, `Does request say the household has no work or no income in a way that ${earlier} contradicts? Answer no when request says the work or income ended after ${earlier} was written, or when either says nothing about work or income. ${judge}`],
      [`paid${index}`, `Does request say a bill is unpaid when ${earlier} says that same bill was already paid? Answer no when it is a different bill or a different month. ${judge}`],
    ];
  }).flat());
}
/** Whether a record is the same need again, or says otherwise (any of the four ways asked), at the 0.9 line. */
const repeatHit = (sure: Record<string, number>, question: "same" | "differs", index: number) =>
  (question === "same" ? [`same${index}`] : ["differs", "home", "work", "paid"].map(field => `${field}${index}`)).some(field => (sure[field] ?? 0) >= sureEnough);
function repeatState(request: string, earlier: { daysBefore: number; text: string }[]) {
  return { request, earlier: Object.fromEntries(earlier.map((record, index) => [`r${index}`, record])) };
}

/**
 * An open request and the same household's own records from the year before it: earlier requests, notes and written-up
 * visits. Code finds same-kind help approved or paid in the last 90 days; the newest texts go to the model, never as typed.
 */
export const repeatHistory = internalQuery({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests") },
  returns: v.object({
    userId: v.id("users"), request: v.string(), timeZone: v.string(),
    records: v.array(v.object({ at: v.number(), what: recordWhat, kind: v.optional(kindValidator), daysBefore: v.number(), text: v.string() })),
    recent: v.array(v.object({ at: v.number(), kind: kindValidator, status: v.union(v.literal("approved"), v.literal("paid")), amount: v.number() })),
    sameAmount: v.array(v.object({ at: v.number(), kind: kindValidator, amount: v.number() })),
    names: v.array(v.string()), addresses: v.array(v.string()), others: v.array(v.string()),
  }),
  handler: async (ctx, { churchId, requestId }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ctx.db.get("assistanceRequests", requestId);
    if (!request || request.churchId !== churchId) throw new ConvexError("Request not found.");
    const now = request.createdAt;
    const inYear = (at: number) => at <= now && at >= now - repeatYear;
    const [church, neighbor, call, requests, notes, visits] = await Promise.all([
      ctx.db.get("churches", churchId),
      ctx.db.get("neighbors", request.neighborId),
      request.callId ? ctx.db.get("calls", request.callId) : null,
      ctx.db.query("assistanceRequests").withIndex("by_neighbor", q => q.eq("neighborId", request.neighborId)).take(200),
      ctx.db.query("neighborNotes").withIndex("by_neighbor", q => q.eq("neighborId", request.neighborId).gte("createdAt", now - repeatYear).lte("createdAt", now)).take(100),
      ctx.db.query("visits").withIndex("by_neighbor", q => q.eq("neighborId", request.neighborId)).take(200),
    ]);
    const earlier = requests.filter(other => other._id !== requestId && other.churchId === churchId && inYear(other.createdAt));
    const recent = earlier.flatMap(other => {
      const at = other.decidedAt ?? other.createdAt;
      if (other.kind !== request.kind || (other.status !== "approved" && other.status !== "paid") || now - at > repeatRecentDays * 86_400_000) return [];
      return [{ at, kind: other.kind, status: other.status, amount: other.amountApproved ?? 0 }];
    }).sort((a, b) => b.at - a.at);
    // The same kind and the same amount asked again within 60 days, whatever was decided: an exact match, so no model is asked.
    const shownRecent = new Set(recent.map(item => item.at));
    const sameAmount = earlier.filter(other => other.kind === request.kind && request.amountRequested > 0 && other.amountRequested === request.amountRequested && now - other.createdAt <= 60 * 86_400_000 && !shownRecent.has(other.decidedAt ?? other.createdAt))
      .map(other => ({ at: other.createdAt, kind: other.kind, amount: other.amountRequested })).sort((a, b) => b.at - a.at);
    const texts = [
      ...earlier.map(other => ({ at: other.createdAt, what: "request" as const, kind: other.kind, text: other.summary })),
      ...notes.filter(note => note.churchId === churchId).map(note => ({ at: note.createdAt, what: "note" as const, text: note.body })),
      ...visits.filter(visit => visit.churchId === churchId && visit.status === "completed" && inYear(visit.completedAt ?? visit.scheduledAt))
        .map(visit => ({ at: visit.completedAt ?? visit.scheduledAt, what: "visit" as const, text: visit.notes })),
    ].map(record => ({ ...record, text: record.text.trim().slice(0, 300) })).filter(record => record.text)
      .sort((a, b) => b.at - a.at).slice(0, repeatRecords)
      .map(record => ({ ...record, daysBefore: Math.round((now - record.at) / 86_400_000) }));
    return {
      userId: member.userId, timeZone: church?.timeZone ?? "America/New_York",
      request: [request.summary, call?.note ?? ""].map(text => text.trim()).filter(Boolean).join("\n"),
      records: texts, recent, sameAmount,
      names: [neighbor?.name ?? "", call?.callerName ?? ""].filter(Boolean),
      addresses: neighbor?.address ? [neighbor.address] : [],
      others: texts.length ? [...(await namesFor(ctx, churchId)), request.payeeName].filter(Boolean) : [],
    };
  },
});

/** An amount is said to stand out only against this many earlier approvals of its kind. */
const amountBaseline = 10;
/**
 * The group's own spending around a request, from the records alone: help approved this month and in the same month a
 * year before (by decision date, in the group's time zone), and where the asked amount falls among the past year's
 * approvals of its kind. `at` is the moment the sheet asked, passed in because a query never reads the clock.
 */
const spent = v.object({
  month: v.number(), thisMonth: v.number(), lastYear: v.number(), budget: v.union(v.number(), v.null()),
  household: v.number(), householdCap: v.union(v.number(), v.null()),
  kind: kindValidator, asked: v.number(), approvals: v.number(), median: v.number(), above: v.number(),
});
export const spending = internalQuery({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests"), at: v.number() },
  returns: spent,
  handler: async (ctx, { churchId, requestId, at }) => {
    await neighborAccess(ctx, churchId);
    const [church, request] = await Promise.all([ctx.db.get("churches", churchId), ctx.db.get("assistanceRequests", requestId)]);
    if (!church || !request || request.churchId !== churchId) throw new ConvexError("Request not found.");
    const zone = church.timeZone;
    const start = DateTime.fromMillis(at, { zone }).startOf("month");
    const before = start.minus({ years: 1 });
    const decided = (from: number, to: number) => approvedBetween(ctx, churchId, from, to);
    const sum = sumApproved;
    const [thisMonth, lastYear, year] = await Promise.all([
      decided(start.toMillis(), at),
      decided(before.toMillis(), before.endOf("month").toMillis()),
      decided(at - repeatYear, at),
    ]);
    const amounts = year.filter(one => one.kind === request.kind && one._id !== requestId).map(one => one.amountApproved ?? 0).sort((a, b) => a - b);
    return {
      month: start.month, thisMonth: sum(thisMonth), lastYear: sum(lastYear), budget: church.monthlyBudget ?? null,
      // Approved to this household in the twelve months before, this request apart; and the group's limit, when set.
      household: sum(year.filter(one => one.neighborId === request.neighborId && one._id !== requestId)), householdCap: church.householdYearCap ?? null,
      kind: request.kind, asked: request.amountRequested, approvals: amounts.length,
      median: amounts.length ? amounts[Math.floor((amounts.length - 1) / 2)] : 0,
      // How many of the past year's approvals of this kind were below what is asked now.
      above: amounts.filter(amount => amount < request.amountRequested).length,
    };
  },
});

type RepeatFlag = { at: number; what: "request" | "note" | "visit"; kind?: RequestKind };
type RepeatFound = RepeatFacts & { same: RepeatFlag[]; differs: RepeatFlag[]; verification: "review" | "checked" };
const repeatFlag = v.object({ at: v.number(), what: recordWhat, kind: v.optional(kindValidator) });
/**
 * Before an approver decides: what the household's own records say about this request. Same-kind help approved or paid
 * in the last 90 days comes from the records alone. The model is then given the request and the newest earlier texts,
 * with names and addresses taken out, and asked of each whether it is the same need again and whether it says otherwise.
 * Only a yes at 0.9 or more is shown. Nothing is saved or changed: a person reads both records and decides.
 */
export const checkRepeat = action({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests") },
  returns: v.object({
    recent: v.array(v.object({ at: v.number(), kind: kindValidator, status: v.union(v.literal("approved"), v.literal("paid")), amount: v.number() })),
    same: v.array(repeatFlag), differs: v.array(repeatFlag),
    /** Facts, never sentences: the sheet words them in the language on the screen (src/lib/repeat-words.ts). */
    sameAmount: v.array(v.object({ at: v.number(), kind: kindValidator, amount: v.number() })),
    spent, baseline: v.number(), timeZone: v.string(),
    verification: v.union(v.literal("review"), v.literal("checked")),
  }),
  handler: async (ctx, args): Promise<RepeatFound> => {
    const [{ userId, request, timeZone, records, recent, sameAmount, names, addresses, others }, spent] = await Promise.all([
      ctx.runQuery(internal.drafts.repeatHistory, args),
      ctx.runQuery(internal.drafts.spending, { ...args, at: Date.now() }),
    ]);
    const facts = { recent, sameAmount, spent, baseline: amountBaseline, timeZone };
    const unread = { ...facts, same: [], differs: [], verification: "review" as const };
    if (!records.length || !request || !env.TYPESAFE_API_KEY || request.length > 2000) return unread;
    if (await ctx.runMutation(internal.drafts.reserve, { userId, churchId: args.churchId }) !== "ok") return unread;
    const sure = await confidence(env.TYPESAFE_API_KEY,
      repeatState(request, records.map(({ daysBefore, text }) => ({ daysBefore, text }))),
      repeatQuestions(records.length),
      { names, addresses, others },
    );
    if (!sure) return unread;
    const flagged = (question: "same" | "differs") => records.flatMap((record, index) => (repeatHit(sure, question, index) ? [{ at: record.at, what: record.what, ...("kind" in record && record.kind ? { kind: record.kind } : {}) }] : []));
    const same = flagged("same");
    const differs = flagged("differs");
    return { ...facts, same, differs, verification: "checked" as const };
  },
});

/**
 * Measures the repeat questions on the made-up set (src/lib/repeat-set.ts), with the same wording and the same 0.9
 * line the form uses. For each case, record and question: right, missed, or wrong.
 */
type Tally = { right: number; missed: number; wrong: number };
export const measureRepeats = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({ status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")), model: v.string(), all: referralTally, heldOut: referralTally, rows: v.array(v.object({ id: v.string(), same: v.array(v.number()), differs: v.array(v.number()), scores: v.record(v.string(), v.number()) })) }),
  handler: async (ctx, { churchId }): Promise<{ status: "done" | "no key" | "no allowance"; model: string; all: Tally; heldOut: Tally; rows: { id: string; same: number[]; differs: number[]; scores: Record<string, number> }[] }> => {
    const zero = { right: 0, missed: 0, wrong: 0 };
    const none = { model, all: zero, heldOut: zero, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: repeatSet.length })) return { status: "no allowance" as const, ...none };
    const rows = await Promise.all(repeatSet.map(async item => {
      const sure = await confidence(key, repeatState(item.request, item.earlier), repeatQuestions(item.earlier.length));
      const scores = Object.fromEntries(Object.entries(sure ?? {}).map(([field, value]) => [field, Math.round(value * 100) / 100]));
      const shown = (question: "same" | "differs") => item.earlier.flatMap((_, index) => (repeatHit(scores, question, index) ? [index] : []));
      const same = shown("same");
      const differs = shown("differs");
      const marks = (["same", "differs"] as const).flatMap(question => item.earlier.map((_, index) => {
        const got = (question === "same" ? same : differs).includes(index);
        return got === item[question].includes(index) ? "right" as const : got ? "wrong" as const : "missed" as const;
      }));
      return { id: item.id, same, differs, scores, marks, heldOut: !!item.heldOut };
    }));
    const add = (only: boolean) => rows.filter(row => !only || row.heldOut).flatMap(row => row.marks).reduce((sum, mark) => ({ ...sum, [mark]: sum[mark] + 1 }), { ...zero });
    return { status: "done" as const, model, all: add(false), heldOut: add(true), rows: rows.map(({ id, same, differs, scores }) => ({ id, same, differs, scores })) };
  },
});

/** What Jev may pick as the one next step after a returned call. "none" is there so it never has to force a step. */
const nextStepChoice: Record<NextStep, string> = {
  resolved: "The need is met or was never there: nothing more is needed",
  request: "The caller asks this group for help it gives, such as money toward a bill or rent, food or goods: a help request should be started",
  refer: "The need is one another place handles, and the caller should be sent there",
  callAgain: "The caller was not reached, or asked to be called again later",
  none: "The outcome is unclear, says too little, or points to two or more different steps",
};
const nextStepQuestion: Question = { type: "choice", instructions: "note is what a volunteer wrote after returning a call to a neighbor. What one next step does note point to?", criteria: nextStepChoice };
const shownSteps = v.union(v.literal("resolved"), v.literal("request"), v.literal("refer"), v.literal("callAgain"));
/** The step to show from Jev's answer: only at 0.9 or more, and never "none". */
function shownStep(answer: unknown): Exclude<NextStep, "none"> | null {
  if (!answer || typeof answer !== "object" || !("choice" in answer) || !("confidence" in answer) || typeof answer.confidence !== "number") return null;
  const step = nextSteps.find(option => option === (answer as { choice: unknown }).choice);
  return step && step !== "none" && answer.confidence >= sureEnough ? step : null;
}

/** A returned call's outcome, with the names and addresses that must be taken out of it. */
export const outcomeNote = internalQuery({
  args: { churchId: v.id("churches"), callId: v.id("calls") },
  returns: v.object({ outcome: v.string(), returnedAt: v.union(v.number(), v.null()), names: v.array(v.string()), addresses: v.array(v.string()), others: v.array(v.string()) }),
  handler: async (ctx, { churchId, callId }) => {
    const call = await ctx.db.get("calls", callId);
    if (!call || call.churchId !== churchId) throw new ConvexError("Call not found.");
    const neighbor = call.neighborId ? await ctx.db.get("neighbors", call.neighborId) : null;
    return {
      outcome: call.callback === "done" ? (call.outcome ?? "") : "",
      returnedAt: call.returnedAt ?? null,
      names: [call.callerName, neighbor?.name ?? ""].filter(Boolean),
      addresses: neighbor?.address ? [neighbor.address] : [],
      others: await namesFor(ctx, churchId),
    };
  },
});

/** Keeps the suggested step on the call, only while it is still the same return: an undone or later return is left alone. */
export const keepNextStep = internalMutation({
  args: { callId: v.id("calls"), returnedAt: v.number(), step: shownSteps },
  returns: v.null(),
  handler: async (ctx, { callId, returnedAt, step }) => {
    const call = await ctx.db.get("calls", callId);
    if (call?.callback === "done" && call.returnedAt === returnedAt) await ctx.db.patch("calls", callId, { nextStep: { step, at: Date.now() } });
    return null;
  },
});

/**
 * After a call is returned: the one next step its outcome points to, as one closed choice, asked of the outcome with names
 * and addresses taken out. A step at 0.9 or more is kept on the call and shown as one line under it; nothing is started,
 * and a person decides. Scheduled by assistance.markReturned, inside the member's own save.
 */
export const readOutcome = internalAction({
  args: { churchId: v.id("churches"), callId: v.id("calls"), returnedAt: v.number(), userId: v.id("users"), session: v.optional(v.string()) },
  returns: v.union(shownSteps, v.null()),
  handler: async (ctx, args): Promise<Exclude<NextStep, "none"> | null> => {
    const { outcome, returnedAt, names, addresses, others } = await ctx.runQuery(internal.drafts.outcomeNote, { churchId: args.churchId, callId: args.callId });
    if (!outcome.trim() || returnedAt !== args.returnedAt || !env.TYPESAFE_API_KEY || outcome.length > 2000) return null;
    if (await ctx.runMutation(internal.drafts.reserve, { userId: args.userId, churchId: args.churchId, session: args.session }) !== "ok") return null;
    const answers = await decide(env.TYPESAFE_API_KEY, { note: outcome }, { nextStep: nextStepQuestion }, { names, addresses, others });
    const step = answers ? shownStep(answers.nextStep) : null;
    console.log(`jev outcome ${JSON.stringify({ step })}`);
    if (step) await ctx.runMutation(internal.drafts.keepNextStep, { callId: args.callId, returnedAt: args.returnedAt, step });
    return step;
  },
});

/**
 * Measures the next-step read on the made-up set (src/lib/next-step-set.ts) with the same question and 0.9 line readOutcome
 * uses. Each outcome is one mark: right (the wanted step, or nothing shown when "none" is wanted), missed (nothing shown) or wrong.
 */
export const measureNextStep = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({ status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")), model: v.string(), all: referralTally, heldOut: referralTally, rows: v.array(v.object({ id: v.string(), step: v.union(v.string(), v.null()) })) }),
  handler: async (ctx, { churchId }) => {
    const zero = { right: 0, missed: 0, wrong: 0 };
    const none = { model, all: zero, heldOut: zero, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: nextStepSet.length })) return { status: "no allowance" as const, ...none };
    const rows = await Promise.all(nextStepSet.map(async item => {
      const answers = await decide(key, { note: item.outcome }, { nextStep: nextStepQuestion });
      const step = answers ? shownStep(answers.nextStep) : null;
      const wanted = item.step === "none" ? null : item.step;
      const mark: "right" | "missed" | "wrong" = step === wanted ? "right" : step ? "wrong" : "missed";
      return { id: item.id, step, mark, heldOut: !!item.heldOut };
    }));
    const add = (only: boolean) => rows.filter(row => !only || row.heldOut).reduce((sum, row) => ({ ...sum, [row.mark]: sum[row.mark] + 1 }), { ...zero });
    return { status: "done" as const, model, all: add(false), heldOut: add(true), rows: rows.map(({ id, step }) => ({ id, step })) };
  },
});


/**
 * Measures the Spanish question on the made-up set (src/lib/spanish-set.ts), with the same wording and the same 0.9
 * line the help line uses. Each note is right (marked and speaks Spanish, or left and does not), missed, or wrong.
 */
const spanishTally = v.object({ right: v.number(), missed: v.number(), wrong: v.number() });
export const measureSpanish = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({ status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")), model: v.string(), all: spanishTally, heldOut: spanishTally, rows: v.array(v.object({ id: v.string(), score: v.union(v.number(), v.null()) })) }),
  handler: async (ctx, { churchId }) => {
    const zero = { right: 0, missed: 0, wrong: 0 };
    const none = { model, all: zero, heldOut: zero, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: spanishSet.length })) return { status: "no allowance" as const, ...none };
    const rows = await Promise.all(spanishSet.map(async item => {
      const score = noul((await decide(key, { note: item.note }, { spanish: spanishQuestion }))?.spanish);
      const marked = score !== null && score >= sureEnough;
      const mark = marked === item.spanish ? "right" as const : marked ? "wrong" as const : "missed" as const;
      return { id: item.id, score: score === null ? null : Math.round(score * 100) / 100, mark, heldOut: !!item.heldOut };
    }));
    const add = (only: boolean) => rows.filter(row => !only || row.heldOut).reduce((sum, row) => ({ ...sum, [row.mark]: sum[row.mark] + 1 }), { ...zero });
    return { status: "done" as const, model, all: add(false), heldOut: add(true), rows: rows.map(({ id, score }) => ({ id, score })) };
  },
});
