import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { prepareDraft } from "../src/lib/draft";
import { draftPayeeKinds, prepareRequestDraft, requestKinds, withoutIdentity } from "../src/lib/request-draft";
import { neighborAccess } from "./access";

const draftResult = v.object({
  teamName: v.string(), recurrence: v.string(), peopleCount: v.string(),
  time: v.string(), notes: v.array(v.string()),
  verification: v.union(v.literal("review"), v.literal("checked")),
});

export const identity = internalQuery({
  args: {}, returns: v.union(v.id("users"), v.null()),
  handler: async ctx => getAuthUserId(ctx),
});

export const reserve = internalMutation({
  args: { userId: v.id("users") }, returns: v.null(),
  handler: async (ctx, { userId }) => {
    const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
    const previous = await ctx.db.query("aiUsage").withIndex("by_user", q => q.eq("userId", userId)).unique();
    if (previous?.windowStart === windowStart && previous.count >= 5) {
      throw new Error("Please wait a minute before preparing another draft.");
    }
    if (previous) await ctx.db.patch("aiUsage", previous._id, {
      windowStart, count: previous.windowStart === windowStart ? previous.count + 1 : 1,
    });
    else await ctx.db.insert("aiUsage", { userId, windowStart, count: 1 });
    return null;
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
    await ctx.runMutation(internal.drafts.reserve, { userId });
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
    if (!env.TYPESAFE_API_KEY) return fallback;
    const proposed = {
      ...(draft.kind && { kind: draft.kind }),
      ...(draft.amountRequested !== null && { amountRequested: `$${(draft.amountRequested / 100).toFixed(2)}` }),
      ...(draft.payeeKind && { payeeKind: draft.payeeKind }),
    };
    const present = Object.keys(proposed) as (keyof typeof proposed)[];
    if (!present.length) return fallback;
    await ctx.runMutation(internal.drafts.reserve, { userId });
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
