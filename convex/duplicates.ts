import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query, env, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { neighborAccess, neighborRecord } from "./access";
import { confidence, model } from "./drafts";
import { namesFor, rebuildNames } from "./knownNames";
import { tally } from "./counts";
import { nameLikeness, namesAlike, needsNotes, sameBy, type Comparable, type SameBy } from "../src/lib/duplicates";
import { duplicateSet, notesSayOne, type DuplicateSide } from "../src/lib/duplicate-set";
import { nameKey, phoneKey } from "../src/lib/keys";

/**
 * Two records that may be one household. Code finds them by the phone, the street address and the name; the assistant
 * is asked one yes-or-no question about the two records' notes, with names, phones and streets taken out; a person
 * merges the two or says they are not the same. Nothing is merged or hidden without a person.
 */
const LOOK = 10;
const sameByValue = v.array(v.union(v.literal("phone"), v.literal("address"), v.literal("name")));
const ordered = (a: Id<"neighbors">, b: Id<"neighbors">) => (a < b ? [a, b] as const : [b, a] as const);
const live = (row: Doc<"neighbors"> | null): row is Doc<"neighbors"> => row !== null && row.nameKey !== "";

async function pairOf(ctx: QueryCtx, a: Id<"neighbors">, b: Id<"neighbors">) {
  const [first, second] = ordered(a, b);
  return ctx.db.query("duplicatePairs").withIndex("by_pair", (q) => q.eq("first", first).eq("second", second)).unique();
}

/**
 * Records that may be this household, each with what it shares, read with indexes only: never the whole conference.
 * `household` is a record on file, or what is being typed for a new one (then `except` is left out).
 */
export async function lookAlikes(ctx: QueryCtx, churchId: Id<"churches">, household: Comparable, except?: Id<"neighbors">) {
  const phone = phoneKey(household.phone);
  const words = nameKey(household.name).split(" ").filter(Boolean);
  const byName = (word: string) => ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).gte("nameKey", word.slice(0, 3)).lt("nameKey", `${word.slice(0, 3)}￿`)).take(40);
  const found = await Promise.all([
    phone.length >= 7 ? ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", phone)).take(LOOK) : [],
    words[0] ? byName(words[0]) : [],
    // A name written family name first ("Walker, Denise") is found by its last word too.
    words.length > 1 ? byName(words[words.length - 1]) : [],
    household.address.trim() ? ctx.db.query("neighbors").withSearchIndex("search_address", (q) => q.search("address", household.address).eq("churchId", churchId)).take(LOOK) : [],
  ]);
  const seen = new Map<Id<"neighbors">, Doc<"neighbors">>();
  for (const row of found.flat()) if (row._id !== except && live(row)) seen.set(row._id, row);
  return [...seen.values()].map((row) => ({ row, shared: sameBy(household, row) })).filter(({ shared }) => shared.length > 0);
}

/**
 * On a record: the records that may be the same household. A pair code is sure of (two things in common) shows at once;
 * a pair with one thing in common shows only once the notes have been read as the same household (notesSayOne: the assistant at 0.7 or more, and the same number of adults and children).
 * `unread` lists the pairs whose notes the screen should ask about; the screen asks once and this answer follows.
 */
export const forRecord = query({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors") },
  returns: v.object({
    shown: v.array(v.object({ id: v.id("neighbors"), name: v.string(), address: v.string(), adults: v.number(), children: v.number(), sameBy: sameByValue, notesAgree: v.boolean() })),
    unread: v.array(v.id("neighbors")),
  }),
  handler: async (ctx, { churchId, neighborId }) => {
    const { neighbor } = await neighborRecord(ctx, churchId, neighborId);
    const shown = [], unread: Id<"neighbors">[] = [];
    for (const { row, shared } of (await lookAlikes(ctx, churchId, neighbor, neighborId)).slice(0, LOOK)) {
      const pair = await pairOf(ctx, neighborId, row._id);
      if (pair?.dismissedAt) continue;
      const read = pair?.read?.question === asked ? pair.read : null;
      if (!read) unread.push(row._id);
      const notesAgree = notesSayOne(read?.same ?? 0, neighbor, row);
      if (needsNotes(shared) && !notesAgree) continue;
      shown.push({ id: row._id, name: row.name, address: row.address, adults: row.adults, children: row.children, sameBy: shared, notesAgree });
    }
    return { shown, unread };
  },
});

/** What is said about a household, for the question: its own notes and its last few calls. Never its name or street. */
async function said(ctx: QueryCtx, neighbor: Doc<"neighbors">): Promise<DuplicateSide> {
  const calls = await ctx.db.query("calls").withIndex("by_neighbor", (q) => q.eq("neighborId", neighbor._id)).order("desc").take(3);
  const notes = [neighbor.notes, ...calls.map((call) => call.note)].map((text) => text.trim()).filter(Boolean).join("\n").slice(0, 1000);
  return { notes, adults: neighbor.adults, children: neighbor.children };
}

export const pairNotes = internalQuery({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), otherId: v.id("neighbors") },
  returns: v.union(v.null(), v.object({
    userId: v.id("users"),
    first: v.object({ notes: v.string(), adults: v.number(), children: v.number() }),
    second: v.object({ notes: v.string(), adults: v.number(), children: v.number() }),
    names: v.array(v.string()), addresses: v.array(v.string()), others: v.array(v.string()),
  })),
  handler: async (ctx, { churchId, neighborId, otherId }) => {
    const { member, neighbor } = await neighborRecord(ctx, churchId, neighborId);
    const other = await ctx.db.get("neighbors", otherId);
    if (!live(other) || other.churchId !== churchId || neighborId === otherId) throw new ConvexError("Record not found.");
    // Asked once per pair, and only about a pair code found.
    if ((await pairOf(ctx, neighborId, otherId))?.read?.question === asked || !sameBy(neighbor, other).length) return null;
    const [first, second] = await Promise.all([said(ctx, neighbor), said(ctx, other)]);
    return {
      userId: member.userId, first, second,
      names: [neighbor.name, other.name], addresses: [neighbor.address, other.address].filter(Boolean),
      others: await namesFor(ctx, churchId),
    };
  },
});

export const keepRead = internalMutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), otherId: v.id("neighbors"), same: v.number() },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId, otherId, same }) => {
    const [first, second] = ordered(neighborId, otherId);
    const pair = await pairOf(ctx, first, second);
    const read = { same, at: Date.now(), question: asked };
    if (pair) await ctx.db.patch("duplicatePairs", pair._id, { read });
    else await ctx.db.insert("duplicatePairs", { churchId, first, second, read });
    return null;
  },
});

/**
 * One question, shared with the measuring run so both ask the same thing: who lives there, not what they ask for this
 * time. Measured as a trial beside the first wording in run 2 (eval/duplicates/run-2.json) and promoted on its result.
 */
const peopleQuestion = {
  people: "Do first and second describe the same people? Judge from who lives in the household and their lasting circumstances (work, age, health, family), not from what they ask for this time. Answer no when the people plainly differ or when either says too little to tell.",
};
/** Marks a reading made with that question; one made with the first wording is read again. */
const asked = "people" as const;

/**
 * Reads the two records' notes and keeps how sure the assistant is that they describe one household. Names, phones,
 * emails and streets are taken out before anything is sent, and the model writes no text. Asked once per pair.
 */
export const readPair = action({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), otherId: v.id("neighbors") },
  returns: v.union(v.literal("read"), v.literal("not asked")),
  handler: async (ctx, args): Promise<"read" | "not asked"> => {
    const asked = await ctx.runQuery(internal.duplicates.pairNotes, args);
    const key = env.TYPESAFE_API_KEY;
    if (!asked || !key || !asked.first.notes || !asked.second.notes) return "not asked";
    if (await ctx.runMutation(internal.drafts.reserve, { userId: asked.userId, churchId: args.churchId }) !== "ok") return "not asked";
    const sure = await confidence(key, { first: asked.first, second: asked.second }, peopleQuestion, { names: asked.names, addresses: asked.addresses, others: asked.others });
    if (!sure) return "not asked";
    await ctx.runMutation(internal.duplicates.keepRead, { ...args, same: sure.people });
    return "read";
  },
});

/** A person says the two are different households; the pair is not shown again. */
export const dismiss = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), otherId: v.id("neighbors") },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId, otherId }) => {
    const member = await neighborAccess(ctx, churchId);
    const [first, second] = ordered(neighborId, otherId);
    const both = await Promise.all([ctx.db.get("neighbors", first), ctx.db.get("neighbors", second)]);
    if (!both.every((row) => row?.churchId === churchId) || first === second) throw new ConvexError("Record not found.");
    const pair = await pairOf(ctx, first, second);
    const said = { dismissedBy: member._id, dismissedAt: Date.now() };
    if (pair) await ctx.db.patch("duplicatePairs", pair._id, said);
    else await ctx.db.insert("duplicatePairs", { churchId, first, second, ...said });
    return null;
  },
});

/**
 * A person folds `otherId` into `neighborId`: every call, request, visit, note and ledger line of the other record moves
 * to this one, a field this record leaves empty takes the other's, the other's notes are added under this one's, and the
 * other record goes. Nothing is counted twice and nothing said about the household is lost. Written to the audit trail.
 */
export const merge = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), otherId: v.id("neighbors") },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId, otherId }) => {
    const { member, neighbor } = await neighborRecord(ctx, churchId, neighborId);
    const other = await ctx.db.get("neighbors", otherId);
    if (!live(other) || other.churchId !== churchId || otherId === neighborId) throw new ConvexError("Record not found.");
    const [calls, requests, visits, notes, ledger, pairs] = await Promise.all([
      ctx.db.query("calls").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).collect(),
      ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).collect(),
      ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).collect(),
      ctx.db.query("neighborNotes").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).collect(),
      ctx.db.query("ledgerEntries").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).collect(),
      Promise.all([
        ctx.db.query("duplicatePairs").withIndex("by_pair", (q) => q.eq("first", otherId)).collect(),
        ctx.db.query("duplicatePairs").withIndex("by_second", (q) => q.eq("second", otherId)).collect(),
      ]).then((both) => both.flat()),
    ]);
    for (const row of calls) await ctx.db.patch("calls", row._id, { neighborId });
    for (const row of requests) await ctx.db.patch("assistanceRequests", row._id, { neighborId });
    for (const row of visits) await ctx.db.patch("visits", row._id, { neighborId });
    for (const row of notes) await ctx.db.patch("neighborNotes", row._id, { neighborId });
    for (const row of ledger) await ctx.db.patch("ledgerEntries", row._id, { neighborId });
    for (const row of pairs) await ctx.db.delete("duplicatePairs", row._id);
    const notesBoth = [neighbor.notes, other.notes].map((text) => text.trim()).filter((text, index, all) => text && all.indexOf(text) === index).join("\n\n");
    await ctx.db.patch("neighbors", neighborId, {
      ...(!neighbor.phone && other.phone && { phone: other.phone, phoneKey: other.phoneKey }),
      ...(!neighbor.email && other.email && { email: other.email }),
      ...(!neighbor.address && other.address && { address: other.address }),
      ...(!neighbor.alert && other.alert && { alert: other.alert }),
      ...(!neighbor.household?.length && other.household?.length && { household: other.household }),
      ...(!neighbor.money && other.money && { money: other.money }),
      ...(other.accounts?.length && { accounts: [...(neighbor.accounts ?? []), ...other.accounts].slice(0, 20) }),
      notes: notesBoth.slice(0, 2000),
      // Who merged what and when, read on this record. The other record's own merges come along with it.
      mergedFrom: [...(neighbor.mergedFrom ?? []), ...(other.mergedFrom ?? []), {
        name: other.name, by: member._id, at: Date.now(),
        moved: { calls: calls.length, requests: requests.length, visits: visits.length, ledger: ledger.length, notes: notes.length },
      }].slice(-50),
    });
    // The other's waiting requests now wait under this record: the conference's figures move with them, not twice.
    const waiting = requests.filter((request) => request.status === "open").length;
    await tally(ctx, churchId, { households: -1, gone: otherId });
    for (let index = 0; index < waiting; index++) await tally(ctx, churchId, { opened: neighborId });
    await ctx.db.delete("neighbors", otherId);
    await rebuildNames(ctx, churchId);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "neighbor.merged", targetId: neighborId, at: Date.now() });
    return null;
  },
});

/**
 * Measures the question on the made-up pairs (src/lib/duplicate-set.ts) with the same wording and the same rule (notesSayOne) the
 * record uses. Run by hand from the Convex command line, never from a screen; it reads no record and saves none.
 * Right: the notes were read as one household when they are, or not when they are not. Missed: one household not
 * seen (a person still sees the pair when code is sure of it). Wrong: two households read as one.
 */
const tallied = v.object({ right: v.number(), missed: v.number(), wrong: v.number() });
export const measure = internalAction({
  args: { churchId: v.id("churches") },
  returns: v.object({
    status: v.union(v.literal("done"), v.literal("no key"), v.literal("no allowance")), model: v.string(),
    all: tallied, heldOut: tallied,
    rows: v.array(v.object({ id: v.string(), people: v.number() })),
  }),
  handler: async (ctx, { churchId }) => {
    const zero = { right: 0, missed: 0, wrong: 0 };
    const none = { model, all: zero, heldOut: zero, rows: [] };
    const key = env.TYPESAFE_API_KEY;
    if (!key) return { status: "no key" as const, ...none };
    if (!await ctx.runMutation(internal.drafts.reserveMany, { churchId, count: duplicateSet.length })) return { status: "no allowance" as const, ...none };
    const rows = await Promise.all(duplicateSet.map(async (item) => {
      // A pair with nothing written is never asked on a record; it is marked as the record would leave it.
      const sure = item.a.notes && item.b.notes ? await confidence(key, { first: item.a, second: item.b }, peopleQuestion) : null;
      const people = Math.round((sure?.people ?? 0) * 100) / 100;
      const read = notesSayOne(people, item.a, item.b);
      return { id: item.id, people, mark: read === item.same ? "right" as const : read ? "wrong" as const : "missed" as const, heldOut: !!item.heldOut };
    }));
    const add = (only: boolean) => rows.filter((row) => !only || row.heldOut).reduce((sum, row) => ({ ...sum, [row.mark]: sum[row.mark] + 1 }), { ...zero });
    return { status: "done" as const, model, all: add(false), heldOut: add(true), rows: rows.map(({ id, people }) => ({ id, people })) };
  },
});

export type { SameBy };

/**
 * The records check in Tools, all by code; nothing here reaches the model, because what it compares is names, emails and
 * phones. Two members who may be one person signed up twice (the same email, or names alike), and phones that more than
 * one household gives under names that are not alike. Asked only when a person presses the check, never on its own.
 */
const memberSide = v.object({ id: v.id("memberships"), name: v.string(), email: v.string(), role: v.string() });
export const recordsCheck = query({
  args: { churchId: v.id("churches") },
  returns: v.object({
    people: v.array(v.object({ key: v.string(), first: memberSide, second: memberSide, sameBy: v.array(v.union(v.literal("email"), v.literal("name"))) })),
    phones: v.array(v.object({ key: v.string(), phone: v.string(), households: v.array(v.object({ id: v.id("neighbors"), name: v.string(), address: v.string() })) })),
  }),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const [members, households, dismissed] = await Promise.all([
      ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1000),
      ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(3000),
      ctx.db.query("duplicateDismissals").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1000),
    ]);
    const set = new Set(dismissed.map((row) => `${row.kind}:${row.key}`));
    const kept = members.filter((member) => !member.removedAt && member.name.trim());
    const people = [];
    for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) {
      const [a, b] = [kept[i], kept[j]];
      const sameBy = [
        ...(a.email.trim() && a.email.trim().toLowerCase() === b.email.trim().toLowerCase() ? ["email" as const] : []),
        ...(nameLikeness(a.name, b.name) >= namesAlike ? ["name" as const] : []),
      ];
      const key = [a._id, b._id].sort().join(" ");
      if (sameBy.length && !set.has(`person:${key}`)) people.push({ key, sameBy, first: { id: a._id, name: a.name, email: a.email, role: a.role }, second: { id: b._id, name: b.name, email: b.email, role: b.role } });
    }
    const byPhone = new Map<string, Doc<"neighbors">[]>();
    for (const row of households) if (live(row) && row.phoneKey.length >= 7) byPhone.set(row.phoneKey, [...(byPhone.get(row.phoneKey) ?? []), row]);
    const phones = [...byPhone].flatMap(([key, rows]) =>
      // Names alike under one phone are one household entered twice: the record's own check shows those.
      rows.length > 1 && rows.some((row, i) => rows.slice(i + 1).some((other) => nameLikeness(row.name, other.name) < namesAlike)) && !set.has(`phone:${key}`)
        ? [{ key, phone: rows[0].phone, households: rows.slice(0, 8).map((row) => ({ id: row._id, name: row.name, address: row.address })) }]
        : []);
    return { people: people.slice(0, 50), phones: phones.slice(0, 50) };
  },
});

export const dismissCheck = mutation({
  args: { churchId: v.id("churches"), kind: v.union(v.literal("person"), v.literal("phone")), key: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, kind, key }) => {
    const member = await neighborAccess(ctx, churchId);
    if (key.length > 100) throw new ConvexError("Record not found.");
    if (!await ctx.db.query("duplicateDismissals").withIndex("by_church", (q) => q.eq("churchId", churchId).eq("kind", kind).eq("key", key)).first())
      await ctx.db.insert("duplicateDismissals", { churchId, kind, key, by: member._id, at: Date.now() });
    return null;
  },
});

const moved = v.object({ calls: v.number(), requests: v.number(), visits: v.number(), ledger: v.number(), notes: v.number() });
/** Before a merge is confirmed: how much of the other record would move to this one. */
export const mergeCounts = query({
  args: { churchId: v.id("churches"), otherId: v.id("neighbors") },
  returns: moved,
  handler: async (ctx, { churchId, otherId }) => {
    await neighborRecord(ctx, churchId, otherId);
    const count = async (rows: Promise<unknown[]>) => (await rows).length;
    const [calls, requests, visits, ledger, notes] = await Promise.all([
      count(ctx.db.query("calls").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).take(1000)),
      count(ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).take(1000)),
      count(ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).take(1000)),
      count(ctx.db.query("ledgerEntries").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).take(1000)),
      count(ctx.db.query("neighborNotes").withIndex("by_neighbor", (q) => q.eq("neighborId", otherId)).take(1000)),
    ]);
    return { calls, requests, visits, ledger, notes };
  },
});

/** On the surviving record: every record merged into it, who merged it and when, and what moved. */
export const merges = query({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors") },
  returns: v.array(v.object({ name: v.string(), who: v.string(), at: v.number(), moved })),
  handler: async (ctx, { churchId, neighborId }) => {
    const { neighbor } = await neighborRecord(ctx, churchId, neighborId);
    return Promise.all((neighbor.mergedFrom ?? []).map(async (merge) => ({
      name: merge.name, at: merge.at, moved: merge.moved,
      who: (await ctx.db.get("memberships", merge.by))?.name || "A former member",
    })).reverse());
  },
});
