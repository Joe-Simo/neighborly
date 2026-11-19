import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { neighborAccess } from "./access";
import schema from "./schema";
import { internal } from "./_generated/api";

const fields = schema.tables.aiReads.validator.fields;
const purpose = fields.purpose;
const askedAsSent = v.array(v.object({ key: v.string(), question: v.string(), answer: v.union(v.number(), v.null()), choice: v.optional(v.string()), yes: v.boolean() }));
/** How long a record of what was sent is kept, at most. */
export const KEEP_DAYS = 30;

/** Keeps one call to the assistant as it was made. Scheduled by the action that made it, so a failure here never holds up its answer. */
export const keep = internalMutation({
  args: { churchId: fields.churchId, callId: fields.callId, purpose, sentText: fields.sentText, asked: askedAsSent, model: fields.model, outcome: fields.outcome, at: fields.at },
  returns: v.null(),
  handler: async (ctx, row) => {
    // A call removed while the assistant was answering keeps nothing about it.
    const call = await ctx.db.get("calls", row.callId);
    if (!call || call.churchId !== row.churchId || !call.note) return null;
    const asked = [];
    for (const { question, ...one } of row.asked) {
      const kept = await ctx.db.query("aiQuestions").withIndex("by_text", (q) => q.eq("text", question)).unique();
      asked.push({ ...one, question: kept?._id ?? (await ctx.db.insert("aiQuestions", { text: question })) });
    }
    await ctx.db.insert("aiReads", { ...row, asked });
    return null;
  },
});

/**
 * The latest call to the assistant about one call note, for one purpose, exactly as it was recorded: what was sent,
 * each question and its answer, and the model. Only those who can open the note can read it (owners and coordinators).
 */
export const latest = query({
  args: { churchId: v.id("churches"), callId: v.id("calls"), purpose },
  returns: v.union(v.object({ sentText: fields.sentText, asked: askedAsSent, model: fields.model, outcome: fields.outcome, at: fields.at }), v.null()),
  handler: async (ctx, { churchId, callId, purpose }) => {
    await neighborAccess(ctx, churchId);
    const call = await ctx.db.get("calls", callId);
    if (!call || call.churchId !== churchId) return null;
    const row = await ctx.db.query("aiReads").withIndex("by_call", (q) => q.eq("callId", callId).eq("purpose", purpose)).order("desc").first();
    if (!row || row.churchId !== churchId) return null;
    const asked = await Promise.all(row.asked.map(async ({ question, ...one }) => ({ ...one, question: (await ctx.db.get("aiQuestions", question))?.text ?? "" })));
    return { sentText: row.sentText, asked, model: row.model, outcome: row.outcome, at: row.at };
  },
});

/** Removes what was kept about a call's note: for one purpose (a draft going), or all of it (the note going). */
export async function dropReads(ctx: MutationCtx, callId: Id<"calls">, only?: "draft" | "urgency") {
  for (const one of only ? [only] : (["draft", "urgency"] as const)) {
    for (const row of await ctx.db.query("aiReads").withIndex("by_call", (q) => q.eq("callId", callId).eq("purpose", one)).take(200)) await ctx.db.delete("aiReads", row._id);
  }
}

/** Daily: a record of what was sent goes after KEEP_DAYS, even while its draft or note remains. A long backlog continues in turns. */
export const dropOld = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const before = Date.now() - KEEP_DAYS * 86_400_000;
    const old = await ctx.db.query("aiReads").withIndex("by_at", (q) => q.lt("at", before)).take(500);
    for (const row of old) await ctx.db.delete("aiReads", row._id);
    if (old.length === 500) await ctx.scheduler.runAfter(0, internal.aiReads.dropOld, {});
    return null;
  },
});
