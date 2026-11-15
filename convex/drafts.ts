import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, env } from "./_generated/server";
import { internal } from "./_generated/api";
import { prepareDraft } from "../src/lib/draft";

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
    try {
      const response = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "jev-latest", state: { description, proposed: draft },
          questions: Object.fromEntries(present.map(field => [field, {
            type: "noul",
            instructions: `Does description explicitly and unambiguously support proposed.${field}? Answer yes only if the value is stated as an affirmative fact, not a question, negation, wish, conditional, or conflicting alternative. A normalized equivalent of explicit wording is supported. Never infer availability, consent, qualifications, membership, or a new fact.`,
          }])),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return fallback;
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("answers" in data) || !data.answers || typeof data.answers !== "object") return fallback;
      const answers = data.answers as Record<string, unknown>;
      for (const field of present) {
        const answer = answers[field];
        if (!answer || typeof answer !== "object" || !("type" in answer) || answer.type !== "noul" || !("noul" in answer) || typeof answer.noul !== "number" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return fallback;
        if (answer.noul < 0.9) {
          draft[field] = "";
          draft.notes.push(`Please confirm ${field === "teamName" ? "the team name" : field === "peopleCount" ? "how many people are needed" : field === "time" ? "the start and end time" : "how often the team meets"}.`);
        }
      }
      return { ...draft, verification: "checked" as const };
    } catch {
      return fallback;
    }
  },
});
