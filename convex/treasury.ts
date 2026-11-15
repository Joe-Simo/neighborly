import { v } from "convex/values";
import { DateTime } from "luxon";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { neighborAccess } from "./access";
import { settleRequest } from "./assistance";

/**
 * The treasury: one ledger per group. Money is whole cents, always positive; the entry kind says
 * which way it moves. The balance is never stored. It is the sum of the entries, so it cannot
 * drift from them.
 */

/** A group's whole ledger is read to add it up. Past this many entries the sum is refused rather than cut short. */
const LEDGER_LIMIT = 10000;
const REQUEST_ENTRY_LIMIT = 200;
const PAYABLE_LIMIT = 200;
const MEMO_LIMIT = 200;
const NAME_LIMIT = 120;

/** Where money comes from. The label is what the ledger stores and shows. */
export const incomeSources = {
  collection: "Parish collection",
  walk: "Friends of the Poor Walk",
  donation: "Donation",
  twinning: "Twinning received",
  opening: "Opening balance",
} as const;
export const TWINNING_GIFT = "Twinning gift";
const incomeSource = v.union(v.literal("collection"), v.literal("walk"), v.literal("donation"), v.literal("twinning"), v.literal("opening"));

type Ctx = QueryCtx | MutationCtx;
type Entry = Doc<"ledgerEntries">;

const signed = (entry: Pick<Entry, "kind" | "amount">) => (entry.kind === "income" ? entry.amount : -entry.amount);
const isCents = (amount: number) => Number.isSafeInteger(amount) && amount > 0;
const nameKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function group(ctx: Ctx, churchId: Id<"churches">) {
  const church = await ctx.db.get("churches", churchId);
  if (!church) throw new Error("Group not found.");
  return church;
}
function requireCents(amount: number) {
  if (!isCents(amount)) throw new Error("Enter an amount in dollars and cents, more than zero.");
}
/** The day and note every new entry carries: a real calendar day, not ahead of today in the group's time zone. */
async function dated(ctx: Ctx, churchId: Id<"churches">, date: string, note: string | undefined) {
  if (!DateTime.fromFormat(date, "yyyy-MM-dd").isValid) throw new Error("Choose the day.");
  if (date > today((await group(ctx, churchId)).timeZone)) throw new Error("An entry cannot be dated in the future.");
  const memo = (note ?? "").trim();
  if (memo.length > MEMO_LIMIT) throw new Error(`Keep the note under ${MEMO_LIMIT} characters.`);
  return { date, memo };
}
function named(name: string, missing: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error(missing);
  if (trimmed.length > NAME_LIMIT) throw new Error(`Keep the name under ${NAME_LIMIT} characters.`);
  return trimmed;
}
const today = (timeZone: string) => DateTime.now().setZone(timeZone).toFormat("yyyy-MM-dd");

/** Every entry of the group, oldest day first, and within a day in the order recorded. */
async function ledgerEntries(ctx: Ctx, churchId: Id<"churches">) {
  const entries = await ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(LEDGER_LIMIT + 1);
  if (entries.length > LEDGER_LIMIT) throw new Error("This ledger is too long to add up in one pass. Tell us, and we will close out the earlier years.");
  return entries;
}

/**
 * Whole cents paid so far toward one request: payments, less any money that came back against it.
 * No access check inside; call it after neighborAccess().
 */
export async function paidTowardRequest(ctx: Ctx, requestId: Id<"assistanceRequests">) {
  const entries = await ctx.db.query("ledgerEntries").withIndex("by_request", (q) => q.eq("requestId", requestId)).take(REQUEST_ENTRY_LIMIT + 1);
  if (entries.length > REQUEST_ENTRY_LIMIT) throw new Error("This request has too many ledger entries to add up.");
  return entries.reduce((paid, entry) => paid - signed(entry), 0);
}

const neighborLink = v.union(v.null(), v.object({ id: v.id("neighbors"), name: v.string() }));
const ledgerRow = v.object({
  id: v.id("ledgerEntries"),
  date: v.string(),
  kind: v.union(v.literal("income"), v.literal("expense")),
  amount: v.number(),
  category: v.string(),
  /** What the neighbor asked for, when the entry is tied to a request. */
  summary: v.union(v.null(), v.string()),
  payee: v.string(),
  memo: v.string(),
  requestId: v.union(v.null(), v.id("assistanceRequests")),
  neighbor: neighborLink,
  /** The entry this one takes back, if it is a reversal. */
  reverses: v.union(v.null(), v.id("ledgerEntries")),
  /** True once a later entry has taken this one back. */
  reversed: v.boolean(),
  /** The balance after this entry. */
  balance: v.number(),
});

/** One month of the ledger with the balance after every entry, newest first, and the balance today. */
export const ledger = query({
  args: { churchId: v.id("churches"), month: v.optional(v.string()) },
  returns: v.object({
    today: v.string(),
    month: v.string(),
    /** Months that have entries, newest first, always including this month. */
    months: v.array(v.string()),
    balance: v.number(),
    opening: v.number(),
    moneyIn: v.number(),
    moneyOut: v.number(),
    incomeSources: v.array(v.string()),
    neighborsHelped: v.number(),
    entries: v.array(ledgerRow),
  }),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const day = today((await group(ctx, args.churchId)).timeZone);
    const month = args.month ?? day.slice(0, 7);
    if (!DateTime.fromFormat(month, "yyyy-MM").isValid) throw new Error("Choose a month.");
    const all = await ledgerEntries(ctx, args.churchId);

    let balance = 0, opening = 0, moneyIn = 0, moneyOut = 0;
    const reversed = new Set(all.flatMap((entry) => entry.reverses ?? []));
    const helped = new Map<Id<"neighbors">, number>();
    const months = new Set([day.slice(0, 7)]);
    const inMonth: { entry: Entry; balance: number }[] = [];
    for (const entry of all) {
      const entryMonth = entry.date.slice(0, 7);
      months.add(entryMonth);
      if (entryMonth < month) opening += signed(entry);
      balance += signed(entry);
      if (entryMonth !== month) continue;
      // A reversal takes away from the side it corrects, so a payment taken back is not counted as money in.
      if (entry.kind === "income" === !entry.reverses) moneyIn += entry.reverses ? -entry.amount : entry.amount;
      else moneyOut += entry.reverses ? -entry.amount : entry.amount;
      if (entry.neighborId) helped.set(entry.neighborId, (helped.get(entry.neighborId) ?? 0) - signed(entry));
      inMonth.push({ entry, balance });
    }

    const requestIds = [...new Set(inMonth.flatMap(({ entry }) => entry.requestId ?? []))];
    const neighborIds = [...new Set(inMonth.flatMap(({ entry }) => entry.neighborId ?? []))];
    const requests = new Map((await Promise.all(requestIds.map((id) => ctx.db.get("assistanceRequests", id)))).flatMap((request) => (request ? [[request._id, request] as const] : [])));
    const neighbors = new Map((await Promise.all(neighborIds.map((id) => ctx.db.get("neighbors", id)))).flatMap((neighbor) => (neighbor ? [[neighbor._id, neighbor] as const] : [])));

    return {
      today: day,
      month,
      months: [...months].sort().reverse(),
      balance,
      opening,
      moneyIn,
      moneyOut,
      incomeSources: [...new Set(inMonth.flatMap(({ entry }) => (entry.kind === "income" && !entry.reverses && !reversed.has(entry._id) ? [entry.category] : [])))],
      neighborsHelped: [...helped.values()].filter((paid) => paid > 0).length,
      entries: inMonth.reverse().map(({ entry, balance }) => {
        const request = entry.requestId && requests.get(entry.requestId);
        const neighbor = entry.neighborId && neighbors.get(entry.neighborId);
        return {
          id: entry._id,
          date: entry.date,
          kind: entry.kind,
          amount: entry.amount,
          category: entry.category,
          summary: request?.summary ?? null,
          payee: entry.payee,
          memo: entry.memo,
          requestId: entry.requestId ?? null,
          neighbor: neighbor ? { id: neighbor._id, name: neighbor.name } : null,
          reverses: entry.reverses ?? null,
          reversed: reversed.has(entry._id),
          balance,
        };
      }),
    };
  },
});

/** Approved requests with money still owed, oldest decision first. */
export const payable = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({
    requestId: v.id("assistanceRequests"),
    neighborId: v.id("neighbors"),
    neighborName: v.string(),
    kind: v.union(v.literal("rent"), v.literal("utility"), v.literal("food"), v.literal("voucher"), v.literal("other")),
    summary: v.string(),
    payeeKind: v.union(v.literal("landlord"), v.literal("utility"), v.literal("vendor"), v.literal("neighbor")),
    payeeName: v.string(),
    amountApproved: v.number(),
    paid: v.number(),
    remaining: v.number(),
  })),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const approved = await ctx.db.query("assistanceRequests").withIndex("by_church_status", (q) => q.eq("churchId", args.churchId).eq("status", "approved")).take(PAYABLE_LIMIT);
    const rows = await Promise.all(approved.map(async (request) => {
      const amountApproved = request.amountApproved ?? 0;
      const [paid, neighbor] = await Promise.all([paidTowardRequest(ctx, request._id), ctx.db.get("neighbors", request.neighborId)]);
      return { decidedAt: request.decidedAt ?? request.createdAt, row: { requestId: request._id, neighborId: request.neighborId, neighborName: neighbor?.name ?? "", kind: request.kind, summary: request.summary, payeeKind: request.payeeKind, payeeName: request.payeeName, amountApproved, paid, remaining: amountApproved - paid } };
    }));
    return rows.filter(({ row }) => row.remaining > 0).sort((a, b) => a.decidedAt - b.decidedAt).map(({ row }) => row);
  },
});

/**
 * Pays part or all of an approved request. The money goes to the landlord, utility or store named
 * on the request, never to the neighbor, and the total paid never passes the approved amount.
 */
export const recordPayment = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests"), amount: v.number(), date: v.string(), memo: v.optional(v.string()) },
  returns: v.id("ledgerEntries"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const request = await ctx.db.get("assistanceRequests", args.requestId);
    if (!request || request.churchId !== args.churchId) throw new Error("Request not found.");
    if (request.status !== "approved" || request.amountApproved === undefined) throw new Error("Only an approved request can be paid.");
    requireCents(args.amount);

    const neighbor = await ctx.db.get("neighbors", request.neighborId);
    const payee = request.payeeName.trim();
    if (!payee) throw new Error("Add who is to be paid to the request first.");
    if (request.payeeKind === "neighbor" || (neighbor && nameKey(payee) === neighbor.nameKey))
      throw new Error("Payments go to the landlord, utility or store, never to the neighbor. Change who is paid on the request first.");

    const { date, memo } = await dated(ctx, args.churchId, args.date, args.memo);

    const remaining = request.amountApproved - (await paidTowardRequest(ctx, request._id));
    if (args.amount > remaining) throw new Error(remaining > 0 ? "This is more than what is left of the approved amount." : "This request is already paid in full.");

    const entryId = await ctx.db.insert("ledgerEntries", { churchId: args.churchId, kind: "expense", amount: args.amount, date, category: request.kind, payee, memo, requestId: request._id, neighborId: request.neighborId, recordedBy: member._id, createdAt: Date.now() });
    // The last payment closes the request, through the one function the help line exposes for it.
    if (args.amount === remaining) await settleRequest(ctx, member, request._id, true);
    return entryId;
  },
});

/** Money in: a collection, the Friends of the Poor Walk, a donation, a twinning gift received, or the balance a group starts with. */
export const recordIncome = mutation({
  args: { churchId: v.id("churches"), source: incomeSource, amount: v.number(), date: v.string(), from: v.string(), memo: v.optional(v.string()) },
  returns: v.id("ledgerEntries"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    requireCents(args.amount);
    const payee = named(args.from, "Say where the money came from.");
    const { date, memo } = await dated(ctx, args.churchId, args.date, args.memo);
    return ctx.db.insert("ledgerEntries", { churchId: args.churchId, kind: "income", amount: args.amount, date, category: incomeSources[args.source], payee, memo, recordedBy: member._id, createdAt: Date.now() });
  },
});

/** A twinning gift out to another conference: the one payment that is not tied to a neighbor's request. */
export const recordTwinningGift = mutation({
  args: { churchId: v.id("churches"), amount: v.number(), date: v.string(), to: v.string(), memo: v.optional(v.string()) },
  returns: v.id("ledgerEntries"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    requireCents(args.amount);
    const payee = named(args.to, "Say which conference the gift goes to.");
    const { date, memo } = await dated(ctx, args.churchId, args.date, args.memo);
    return ctx.db.insert("ledgerEntries", { churchId: args.churchId, kind: "expense", amount: args.amount, date, category: TWINNING_GIFT, payee, memo, recordedBy: member._id, createdAt: Date.now() });
  },
});

/**
 * Takes an entry back. Nothing in the ledger is ever edited or deleted: a mistake is corrected by
 * a new entry for the same amount the other way, dated today, that points at the one it reverses.
 */
export const reverseEntry = mutation({
  args: { churchId: v.id("churches"), entryId: v.id("ledgerEntries"), reason: v.string() },
  returns: v.id("ledgerEntries"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const entry = await ctx.db.get("ledgerEntries", args.entryId);
    if (!entry || entry.churchId !== args.churchId) throw new Error("Entry not found.");
    if (entry.reverses) throw new Error("A reversal cannot be reversed. Record the entry again instead.");
    const already = await ctx.db.query("ledgerEntries").withIndex("by_reverses", (q) => q.eq("reverses", entry._id)).first();
    if (already) throw new Error("This entry has already been reversed.");
    const reason = args.reason.trim();
    if (!reason) throw new Error("Say why this entry is being reversed.");
    if (reason.length > MEMO_LIMIT) throw new Error(`Keep the reason under ${MEMO_LIMIT} characters.`);
    const date = today((await group(ctx, args.churchId)).timeZone);
    // Taking back a payment on a request that was paid in full means it is owed again.
    if (entry.kind === "expense" && entry.requestId && (await ctx.db.get("assistanceRequests", entry.requestId))?.status === "paid") await settleRequest(ctx, member, entry.requestId, false);
    return ctx.db.insert("ledgerEntries", { churchId: args.churchId, kind: entry.kind === "income" ? "expense" : "income", amount: entry.amount, date, category: entry.category, payee: entry.payee, memo: reason, requestId: entry.requestId, neighborId: entry.neighborId, reverses: entry._id, recordedBy: member._id, createdAt: Date.now() });
  },
});
