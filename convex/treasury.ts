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
const CHECK_LIMIT = 20;
const BANK_LIST_LIMIT = 300;
const CLEAR_BATCH = 500;
const DEPOSIT_LIMIT = 100;
const STATEMENT_LIST = 24;
const SHELF_LIMIT = 5000;
const KIND_LIMIT = 200;

/** Where money comes from. The label is what the ledger stores and shows. */
export const incomeSources = {
  collection: "Parish collection",
  walk: "Friends of the Poor Walk",
  donation: "Donation",
  twinning: "Twinning received",
  opening: "Opening balance",
} as const;
export const TWINNING_GIFT = "Twinning gift";
/** What a conference spends on besides a neighbor's request. The label is what the ledger stores and shows. */
export const spendingKinds = {
  twinning: TWINNING_GIFT,
  pantry: "Pantry purchase",
  supplies: "Supplies",
  dues: "Council dues",
  fee: "Bank fee",
  other: "Other spending",
} as const;
const spendingKind = v.union(v.literal("twinning"), v.literal("pantry"), v.literal("supplies"), v.literal("dues"), v.literal("fee"), v.literal("other"));
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
/** A check number as written on the check: short, with no spaces around it. Empty means none. */
function check(number: string | undefined) {
  const trimmed = (number ?? "").trim();
  if (trimmed.length > CHECK_LIMIT) throw new Error(`Keep the check number under ${CHECK_LIMIT} characters.`);
  return trimmed || undefined;
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
/** What every screen shows of an entry. It names no neighbor. */
const entryFields = {
  id: v.id("ledgerEntries"),
  date: v.string(),
  kind: v.union(v.literal("income"), v.literal("expense")),
  amount: v.number(),
  category: v.string(),
  /** What the neighbor asked for, when the entry is tied to a request. */
  summary: v.union(v.null(), v.string()),
  payee: v.string(),
  memo: v.string(),
  checkNumber: v.union(v.null(), v.string()),
  /** The statement day this entry cleared the bank, once someone has matched it. */
  clearedOn: v.union(v.null(), v.string()),
  requestId: v.union(v.null(), v.id("assistanceRequests")),
  /** The entry this one takes back, if it is a reversal. */
  reverses: v.union(v.null(), v.id("ledgerEntries")),
  /** True once a later entry has taken this one back. */
  reversed: v.boolean(),
};
const entryView = (entry: Entry, summary: string | null, reversed: boolean) => ({
  id: entry._id,
  date: entry.date,
  kind: entry.kind,
  amount: entry.amount,
  category: entry.category,
  summary,
  payee: entry.payee,
  memo: entry.memo,
  checkNumber: entry.checkNumber ?? null,
  clearedOn: entry.clearedOn ?? null,
  requestId: entry.requestId ?? null,
  reverses: entry.reverses ?? null,
  reversed,
});
/** The request summaries for a set of entries, read once each. */
async function summaries(ctx: Ctx, entries: Entry[]) {
  const ids = [...new Set(entries.flatMap((entry) => entry.requestId ?? []))];
  return new Map((await Promise.all(ids.map((id) => ctx.db.get("assistanceRequests", id)))).flatMap((request) => (request ? [[request._id, request.summary] as const] : [])));
}
const depositRow = v.object({ id: v.id("deposits"), date: v.string(), total: v.number(), memo: v.string(), /** How many gifts went to the bank together. */ count: v.number() });
const ledgerRow = v.object({ ...entryFields, neighbor: neighborLink, /** The balance after this entry. */ balance: v.number() });

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

    const neighborIds = [...new Set(inMonth.flatMap(({ entry }) => entry.neighborId ?? []))];
    const requests = await summaries(ctx, inMonth.map(({ entry }) => entry));
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
        const neighbor = entry.neighborId && neighbors.get(entry.neighborId);
        return {
          ...entryView(entry, (entry.requestId && requests.get(entry.requestId)) ?? null, reversed.has(entry._id)),
          neighbor: neighbor ? { id: neighbor._id, name: neighbor.name } : null,
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
  args: { churchId: v.id("churches"), requestId: v.id("assistanceRequests"), amount: v.number(), date: v.string(), memo: v.optional(v.string()), checkNumber: v.optional(v.string()) },
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

    const entryId = await ctx.db.insert("ledgerEntries", { churchId: args.churchId, kind: "expense", amount: args.amount, date, category: request.kind, payee, memo, checkNumber: check(args.checkNumber), requestId: request._id, neighborId: request.neighborId, recordedBy: member._id, createdAt: Date.now() });
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

/**
 * Money out that is not for a neighbor: food bought for the pantry, supplies, council dues, a bank
 * fee, a twinning gift. Help for a neighbor is never recorded here; it goes through recordPayment
 * so that it stays tied to the request.
 */
export const recordSpending = mutation({
  args: { churchId: v.id("churches"), kind: spendingKind, amount: v.number(), date: v.string(), to: v.string(), memo: v.optional(v.string()), checkNumber: v.optional(v.string()) },
  returns: v.id("ledgerEntries"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    requireCents(args.amount);
    const payee = named(args.to, "Say who was paid.");
    const { date, memo } = await dated(ctx, args.churchId, args.date, args.memo);
    return ctx.db.insert("ledgerEntries", { churchId: args.churchId, kind: "expense", amount: args.amount, date, category: spendingKinds[args.kind], payee, memo, checkNumber: check(args.checkNumber), recordedBy: member._id, createdAt: Date.now() });
  },
});

/**
 * Cash in and cash out by kind between two days, both included, with the balance before and
 * after. For the reports stream and the treasurer's report at a meeting. A reversal takes away
 * from the kind it corrects, so nothing is counted on both sides. No neighbor is named.
 */
export const cashFlow = query({
  args: { churchId: v.id("churches"), from: v.string(), to: v.string() },
  returns: v.object({
    opening: v.number(),
    closing: v.number(),
    moneyIn: v.number(),
    moneyOut: v.number(),
    kinds: v.array(v.object({ category: v.string(), direction: v.union(v.literal("in"), v.literal("out")), amount: v.number(), entries: v.number() })),
  }),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    for (const date of [args.from, args.to]) if (!DateTime.fromFormat(date, "yyyy-MM-dd").isValid) throw new Error("Choose the day.");
    if (args.to < args.from) throw new Error("The last day must be on or after the first day.");
    let opening = 0, closing = 0;
    const kinds = new Map<string, { category: string; direction: "in" | "out"; amount: number; entries: number }>();
    for (const entry of await ledgerEntries(ctx, args.churchId)) {
      if (entry.date > args.to) break;
      closing += signed(entry);
      if (entry.date < args.from) {
        opening += signed(entry);
        continue;
      }
      // A reversal belongs to the side of the entry it takes back.
      const direction = (entry.kind === "income") === !entry.reverses ? "in" : "out";
      const key = `${direction}:${entry.category}`;
      const kind = kinds.get(key) ?? { category: entry.category, direction, amount: 0, entries: 0 };
      kind.amount += entry.reverses ? -entry.amount : entry.amount;
      kind.entries += entry.reverses ? -1 : 1;
      kinds.set(key, kind);
    }
    const rows = [...kinds.values()].sort((a, b) => a.direction.localeCompare(b.direction) || b.amount - a.amount);
    const total = (direction: "in" | "out") => rows.reduce((sum, row) => (row.direction === direction ? sum + row.amount : sum), 0);
    return { opening, closing, moneyIn: total("in"), moneyOut: total("out"), kinds: rows };
  },
});

/**
 * The checks written between two days, both included, in the order of their numbers. For the
 * reports stream. A check that was taken back still appears, marked reversed. No neighbor is named.
 */
export const checkRegister = query({
  args: { churchId: v.id("churches"), from: v.string(), to: v.string() },
  returns: v.array(v.object({ id: v.id("ledgerEntries"), checkNumber: v.string(), date: v.string(), payee: v.string(), category: v.string(), amount: v.number(), reversed: v.boolean(), clearedOn: v.union(v.null(), v.string()) })),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    for (const date of [args.from, args.to]) if (!DateTime.fromFormat(date, "yyyy-MM-dd").isValid) throw new Error("Choose the day.");
    if (args.to < args.from) throw new Error("The last day must be on or after the first day.");
    const all = await ledgerEntries(ctx, args.churchId);
    const reversed = new Set(all.flatMap((entry) => entry.reverses ?? []));
    return all
      .flatMap((entry) => (entry.checkNumber && entry.kind === "expense" && entry.date >= args.from && entry.date <= args.to ? [{ id: entry._id, checkNumber: entry.checkNumber, date: entry.date, payee: entry.payee, category: entry.category, amount: entry.amount, reversed: reversed.has(entry._id), clearedOn: entry.clearedOn ?? null }] : []))
      .sort((a, b) => a.checkNumber.localeCompare(b.checkNumber, "en", { numeric: true }) || a.date.localeCompare(b.date));
  },
});

/**
 * Matching the books to the bank as of one day. An entry has cleared when someone has marked it
 * against a statement. The books are always what has cleared plus what is still on its way, so
 * if the cleared figure equals the statement, the ledger and the bank agree.
 */
export const reconciliation = query({
  args: { churchId: v.id("churches"), asOf: v.optional(v.string()) },
  returns: v.object({
    asOf: v.string(),
    today: v.string(),
    /** The ledger's balance on that day. */
    books: v.number(),
    /** What had cleared the bank by that day. Compare this with the statement. */
    cleared: v.number(),
    onItsWayIn: v.number(),
    onItsWayOut: v.number(),
    waitingCount: v.number(),
    /** Entries not yet cleared by that day, oldest first; at most 300 are listed. */
    waiting: v.array(v.object(entryFields)),
    /** The entries cleared most recently, newest first, so a slip can be undone. */
    lately: v.array(v.object(entryFields)),
    /** Deposits the bank has not shown by that day. Each is one line on a statement, so its entries are left out of waiting. */
    deposits: v.array(depositRow),
  }),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const day = today((await group(ctx, args.churchId)).timeZone);
    const asOf = args.asOf ?? day;
    if (!DateTime.fromFormat(asOf, "yyyy-MM-dd").isValid) throw new Error("Choose the day.");
    const all = await ledgerEntries(ctx, args.churchId);
    const reversed = new Set(all.flatMap((entry) => entry.reverses ?? []));
    let books = 0, cleared = 0, onItsWayIn = 0, onItsWayOut = 0;
    const waiting: Entry[] = [], done: Entry[] = [];
    const carried = new Map<Id<"deposits">, number>();
    for (const entry of all) {
      if (entry.date > asOf) break;
      books += signed(entry);
      if (entry.clearedOn && entry.clearedOn <= asOf) {
        cleared += signed(entry);
        done.push(entry);
      } else {
        if (entry.kind === "income") onItsWayIn += entry.amount;
        else onItsWayOut += entry.amount;
        if (entry.depositId) carried.set(entry.depositId, (carried.get(entry.depositId) ?? 0) + 1);
        else waiting.push(entry);
      }
    }
    const deposits = (await Promise.all([...carried].map(async ([id, count]) => {
      const deposit = await ctx.db.get("deposits", id);
      return deposit ? [{ id, date: deposit.date, total: deposit.total, memo: deposit.memo, count }] : [];
    }))).flat().sort((a, b) => a.date.localeCompare(b.date));
    const listed = waiting.slice(0, BANK_LIST_LIMIT);
    const lately = done.sort((a, b) => (b.clearedOn ?? "").localeCompare(a.clearedOn ?? "") || b.date.localeCompare(a.date)).slice(0, 8);
    const requests = await summaries(ctx, [...listed, ...lately]);
    const view = (entry: Entry) => entryView(entry, (entry.requestId && requests.get(entry.requestId)) ?? null, reversed.has(entry._id));
    return { asOf, today: day, books, cleared, onItsWayIn, onItsWayOut, waitingCount: waiting.length + deposits.length, waiting: listed.map(view), lately: lately.map(view), deposits };
  },
});

/** A statement day an entry can have cleared on: a real day, not before the entry and not ahead of today. */
async function statementDay(ctx: Ctx, churchId: Id<"churches">, clearedOn: string) {
  if (!DateTime.fromFormat(clearedOn, "yyyy-MM-dd").isValid) throw new Error("Choose the statement day.");
  if (clearedOn > today((await group(ctx, churchId)).timeZone)) throw new Error("A statement cannot be dated in the future.");
  return clearedOn;
}

/**
 * Marks one entry as cleared on a statement day, or takes the mark off with null. The mark is
 * not money: no amount, day or payee of the entry changes, and the balance stays the same.
 */
export const setCleared = mutation({
  args: { churchId: v.id("churches"), entryId: v.id("ledgerEntries"), clearedOn: v.union(v.null(), v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const entry = await ctx.db.get("ledgerEntries", args.entryId);
    if (!entry || entry.churchId !== args.churchId) throw new Error("Entry not found.");
    if (args.clearedOn === null) {
      await ctx.db.patch("ledgerEntries", entry._id, { clearedOn: undefined });
      return null;
    }
    const clearedOn = await statementDay(ctx, args.churchId, args.clearedOn);
    if (clearedOn < entry.date) throw new Error("An entry cannot clear the bank before the day it was made.");
    await ctx.db.patch("ledgerEntries", entry._id, { clearedOn });
    return null;
  },
});

/**
 * For starting out: marks every entry dated on or before a statement day, and not yet marked, as
 * cleared on that day. Returns how many were marked and whether more remain for another pass.
 */
export const clearThrough = mutation({
  args: { churchId: v.id("churches"), through: v.string() },
  returns: v.object({ marked: v.number(), more: v.boolean() }),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const through = await statementDay(ctx, args.churchId, args.through);
    const waiting = (await ledgerEntries(ctx, args.churchId)).filter((entry) => entry.date <= through && !entry.clearedOn);
    const batch = waiting.slice(0, CLEAR_BATCH);
    for (const entry of batch) await ctx.db.patch("ledgerEntries", entry._id, { clearedOn: through });
    return { marked: batch.length, more: waiting.length > batch.length };
  },
});

/** What had cleared the bank by a day, in whole cents. */
async function clearedBy(ctx: Ctx, churchId: Id<"churches">, asOf: string) {
  return (await ledgerEntries(ctx, churchId)).reduce((sum, entry) => (entry.date <= asOf && entry.clearedOn && entry.clearedOn <= asOf ? sum + signed(entry) : sum), 0);
}

/**
 * Keeps a statement that has been matched: its last day, its ending balance, who matched it and
 * when. It is refused unless the balance equals what has cleared by that day, so a kept statement
 * always agreed with the ledger when it was kept. Matching the same day again replaces the line.
 */
export const agreeStatement = mutation({
  args: { churchId: v.id("churches"), endsOn: v.string(), balance: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const endsOn = await statementDay(ctx, args.churchId, args.endsOn);
    if (!Number.isSafeInteger(args.balance)) throw new Error("Enter the ending balance in dollars and cents.");
    if (args.balance !== (await clearedBy(ctx, args.churchId, endsOn))) throw new Error("The statement and what has cleared do not agree yet, so it was not kept.");
    const kept = await ctx.db.query("bankStatements").withIndex("by_church", (q) => q.eq("churchId", args.churchId).eq("endsOn", endsOn)).first();
    const line = { balance: args.balance, agreedBy: member._id, agreedAt: Date.now() };
    if (kept) await ctx.db.patch("bankStatements", kept._id, line);
    else await ctx.db.insert("bankStatements", { churchId: args.churchId, endsOn, ...line });
    return null;
  },
});

/** The statements matched so far, newest first, for the treasurer and for an audit. */
export const statements = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({ id: v.id("bankStatements"), endsOn: v.string(), balance: v.number(), agreedBy: v.string(), agreedAt: v.number() })),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const kept = await ctx.db.query("bankStatements").withIndex("by_church", (q) => q.eq("churchId", args.churchId)).order("desc").take(STATEMENT_LIST);
    return Promise.all(kept.map(async (row) => ({ id: row._id, endsOn: row.endsOn, balance: row.balance, agreedBy: (await ctx.db.get("memberships", row.agreedBy))?.name ?? "A former member", agreedAt: row.agreedAt })));
  },
});

/**
 * Gifts recorded but not yet carried to the bank: money in that is in no deposit, has not cleared
 * and was not taken back. The balance a group starts with is not a gift and is left out.
 */
export const undeposited = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({ id: v.id("ledgerEntries"), date: v.string(), amount: v.number(), category: v.string(), from: v.string(), memo: v.string() })),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const all = await ledgerEntries(ctx, args.churchId);
    const reversed = new Set(all.flatMap((entry) => entry.reverses ?? []));
    return all
      .filter((entry) => entry.kind === "income" && !entry.depositId && !entry.clearedOn && !entry.reverses && !reversed.has(entry._id) && entry.category !== incomeSources.opening)
      .slice(-DEPOSIT_LIMIT)
      .map((entry) => ({ id: entry._id, date: entry.date, amount: entry.amount, category: entry.category, from: entry.payee, memo: entry.memo }));
  },
});

/**
 * Several gifts carried to the bank as one deposit, so the statement's single line has one line
 * here to match. The deposit is a grouping, not money: no entry's amount or day changes and the
 * balance stays the same.
 */
export const recordDeposit = mutation({
  args: { churchId: v.id("churches"), entryIds: v.array(v.id("ledgerEntries")), date: v.string(), memo: v.optional(v.string()) },
  returns: v.id("deposits"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const ids = [...new Set(args.entryIds)];
    if (!ids.length) throw new Error("Choose the gifts that went to the bank.");
    if (ids.length > DEPOSIT_LIMIT) throw new Error(`A deposit holds up to ${DEPOSIT_LIMIT} gifts. Record the rest as a second deposit.`);
    const { date, memo } = await dated(ctx, args.churchId, args.date, args.memo);
    let total = 0;
    for (const id of ids) {
      const entry = await ctx.db.get("ledgerEntries", id);
      if (!entry || entry.churchId !== args.churchId) throw new Error("Entry not found.");
      if (entry.kind !== "income" || entry.reverses) throw new Error("Only money that came in can be deposited.");
      if (entry.depositId) throw new Error("One of these gifts is already in a deposit.");
      if (await ctx.db.query("ledgerEntries").withIndex("by_reverses", (q) => q.eq("reverses", id)).first()) throw new Error("One of these gifts was taken back, so it cannot be deposited.");
      if (entry.date > date) throw new Error("A gift cannot be deposited before the day it was received.");
      total += entry.amount;
    }
    const depositId = await ctx.db.insert("deposits", { churchId: args.churchId, date, total, memo, recordedBy: member._id, createdAt: Date.now() });
    for (const id of ids) await ctx.db.patch("ledgerEntries", id, { depositId });
    return depositId;
  },
});

async function depositEntries(ctx: Ctx, churchId: Id<"churches">, depositId: Id<"deposits">) {
  const deposit = await ctx.db.get("deposits", depositId);
  if (!deposit || deposit.churchId !== churchId) throw new Error("Deposit not found.");
  return { deposit, entries: await ctx.db.query("ledgerEntries").withIndex("by_deposit", (q) => q.eq("depositId", depositId)).take(DEPOSIT_LIMIT) };
}

/** Marks a whole deposit as cleared on a statement day, or takes the mark off with null. */
export const clearDeposit = mutation({
  args: { churchId: v.id("churches"), depositId: v.id("deposits"), clearedOn: v.union(v.null(), v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const { deposit, entries } = await depositEntries(ctx, args.churchId, args.depositId);
    const clearedOn = args.clearedOn === null ? undefined : await statementDay(ctx, args.churchId, args.clearedOn);
    if (clearedOn && clearedOn < deposit.date) throw new Error("A deposit cannot clear the bank before the day it was made.");
    for (const entry of entries) await ctx.db.patch("ledgerEntries", entry._id, { clearedOn });
    return null;
  },
});

/** Takes a deposit apart, so its gifts wait to be deposited again. Refused once the bank has shown it. */
export const undoDeposit = mutation({
  args: { churchId: v.id("churches"), depositId: v.id("deposits") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const { entries } = await depositEntries(ctx, args.churchId, args.depositId);
    if (entries.some((entry) => entry.clearedOn)) throw new Error("This deposit has cleared the bank. Take the cleared mark back first.");
    for (const entry of entries) await ctx.db.patch("ledgerEntries", entry._id, { depositId: undefined });
    await ctx.db.delete("deposits", args.depositId);
    return null;
  },
});

/** Every movement on the voucher shelf, oldest first. */
async function shelfRows(ctx: Ctx, churchId: Id<"churches">) {
  const rows = await ctx.db.query("voucherStock").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(SHELF_LIMIT + 1);
  if (rows.length > SHELF_LIMIT) throw new Error("The voucher shelf has too many lines to count in one pass. Tell us, and we will close out the earlier years.");
  return rows;
}
function voucherItem(item: string) {
  const name = named(item, "Say what the voucher is for.");
  return { name, key: nameKey(name) };
}
const wholeCount = (quantity: number) => Number.isSafeInteger(quantity) && quantity > 0;

/**
 * The voucher shelf: how many of each voucher are on hand, and the latest movements. A count, not
 * money, so it never touches the balance. A count below zero means more were given than were ever
 * recorded as received.
 */
export const voucherShelf = query({
  args: { churchId: v.id("churches") },
  returns: v.object({
    items: v.array(v.object({ item: v.string(), onHand: v.number(), received: v.number(), given: v.number() })),
    lately: v.array(v.object({ id: v.id("voucherStock"), date: v.string(), item: v.string(), change: v.number(), note: v.string(), forRequest: v.boolean() })),
  }),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const rows = await shelfRows(ctx, args.churchId);
    const items = new Map<string, { item: string; onHand: number; received: number; given: number }>();
    for (const row of rows) {
      const key = nameKey(row.item);
      const line = items.get(key) ?? { item: row.item, onHand: 0, received: 0, given: 0 };
      line.onHand += row.change;
      if (row.requestId) line.given -= row.change;
      else line.received += row.change;
      items.set(key, line);
    }
    return {
      items: [...items.values()].sort((a, b) => a.item.localeCompare(b.item)),
      lately: rows.slice(-12).reverse().map((row) => ({ id: row._id, date: row.date, item: row.item, change: row.change, note: row.note, forRequest: Boolean(row.requestId) })),
    };
  },
});

/**
 * Vouchers put on the shelf, or a correction after counting them by hand. change is a whole
 * number: plus for vouchers received, minus to take a miscount off. A correction says why.
 */
export const recordVouchers = mutation({
  args: { churchId: v.id("churches"), item: v.string(), change: v.number(), date: v.string(), note: v.optional(v.string()) },
  returns: v.id("voucherStock"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    if (!wholeCount(Math.abs(args.change))) throw new Error("Enter how many vouchers, as a whole number.");
    const { name } = voucherItem(args.item);
    const { date, memo } = await dated(ctx, args.churchId, args.date, args.note);
    if (args.change < 0 && !memo) throw new Error("Say why the count is going down.");
    return ctx.db.insert("voucherStock", { churchId: args.churchId, date, change: args.change, item: name, note: memo, recordedBy: member._id, createdAt: Date.now() });
  },
});

/**
 * For the help line: call this when a voucher is given on a request, changed, or taken back.
 * quantity is how many of the item the request now holds in all (0 when none), so calling it
 * twice with the same number changes nothing. The shelf goes down by the difference, on a line
 * tied to the request. With 0 any payment recorded for the voucher is reversed by a new
 * entry, so its worth leaves the money paid out. No access check inside; call it after neighborAccess() with that member.
 */
export async function voucherGiven(ctx: MutationCtx, member: Doc<"memberships">, given: { requestId: Id<"assistanceRequests">; item: string; quantity: number }): Promise<void> {
  if (given.quantity !== 0 && !wholeCount(given.quantity)) throw new Error("Enter how many vouchers, as a whole number.");
  const { name, key } = voucherItem(given.item);
  const request = await ctx.db.get("assistanceRequests", given.requestId);
  if (!request || request.churchId !== member.churchId) throw new Error("Request not found.");
  const lines = await ctx.db.query("voucherStock").withIndex("by_request", (q) => q.eq("requestId", given.requestId)).take(REQUEST_ENTRY_LIMIT);
  // What the shelf has already given to this request, item by item. A changed item goes back whole.
  const out = new Map<string, { item: string; count: number }>();
  for (const line of lines) {
    const held = out.get(nameKey(line.item)) ?? { item: line.item, count: 0 };
    held.count -= line.change;
    out.set(nameKey(line.item), held);
  }
  const date = today((await group(ctx, member.churchId)).timeZone);
  const move = (item: string, change: number, note: string) => ctx.db.insert("voucherStock", { churchId: member.churchId, date, change, item, note, requestId: given.requestId, recordedBy: member._id, createdAt: Date.now() });
  for (const [held, { item, count }] of out) if (held !== key && count !== 0) await move(item, count, "Back on the shelf");
  const change = (out.get(key)?.count ?? 0) - given.quantity;
  if (change !== 0) await move(name, change, change < 0 ? "Given on a request" : "Back on the shelf");
  // A voucher taken back whole takes its worth back too: every payment still standing on the
  // request gets a reversing entry, so the ledger shows both the payment and why it no longer counts.
  if (given.quantity === 0) {
    const entries = await ctx.db.query("ledgerEntries").withIndex("by_request", (q) => q.eq("requestId", given.requestId)).take(REQUEST_ENTRY_LIMIT);
    const reversed = new Set(entries.flatMap((entry) => entry.reverses ?? []));
    for (const entry of entries) {
      if (entry.kind !== "expense" || entry.reverses || reversed.has(entry._id)) continue;
      await ctx.db.insert("ledgerEntries", { churchId: member.churchId, kind: "income", amount: entry.amount, date, category: entry.category, payee: entry.payee, memo: "Voucher taken back", requestId: entry.requestId, neighborId: entry.neighborId, reverses: entry._id, recordedBy: member._id, createdAt: Date.now() });
    }
  }
}

async function ownKinds(ctx: Ctx, churchId: Id<"churches">) {
  return ctx.db.query("ledgerKinds").withIndex("by_church_key", (q) => q.eq("churchId", churchId)).take(KIND_LIMIT);
}

/** A conference's own kinds of money in and money out, beside the ones every conference has. */
export const kinds = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({ id: v.id("ledgerKinds"), direction: v.union(v.literal("income"), v.literal("expense")), name: v.string() })),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    return (await ownKinds(ctx, args.churchId)).filter((kind) => !kind.retiredAt).map((kind) => ({ id: kind._id, direction: kind.direction, name: kind.name }));
  },
});

/** Adds a kind. A name already in use, by the conference or built in, is refused; a retired one comes back. */
export const addKind = mutation({
  args: { churchId: v.id("churches"), direction: v.union(v.literal("income"), v.literal("expense")), name: v.string() },
  returns: v.id("ledgerKinds"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const name = named(args.name, "Give the kind a name.");
    const key = nameKey(name);
    if (!key) throw new Error("Give the kind a name with letters or numbers.");
    const builtIn = [...Object.values(incomeSources), ...Object.values(spendingKinds), "rent", "utility", "utilities", "food", "voucher", "thrift store voucher", "other", "other help"];
    if (builtIn.some((label) => nameKey(label) === key)) throw new Error("Every conference already has a kind with this name.");
    const same = await ctx.db.query("ledgerKinds").withIndex("by_church_key", (q) => q.eq("churchId", args.churchId).eq("nameKey", key)).first();
    if (same && !same.retiredAt) throw new Error("You already have a kind with this name.");
    if (same) {
      await ctx.db.patch("ledgerKinds", same._id, { retiredAt: undefined, direction: args.direction, name });
      return same._id;
    }
    if ((await ownKinds(ctx, args.churchId)).length >= KIND_LIMIT) throw new Error(`A conference can keep up to ${KIND_LIMIT} kinds of its own.`);
    return ctx.db.insert("ledgerKinds", { churchId: args.churchId, direction: args.direction, name, nameKey: key, recordedBy: member._id, createdAt: Date.now() });
  },
});

/** Stops offering a kind. Entries already recorded under it keep its name. */
export const retireKind = mutation({
  args: { churchId: v.id("churches"), kindId: v.id("ledgerKinds") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const kind = await ctx.db.get("ledgerKinds", args.kindId);
    if (!kind || kind.churchId !== args.churchId) throw new Error("Kind not found.");
    if (!kind.retiredAt) await ctx.db.patch("ledgerKinds", kind._id, { retiredAt: Date.now() });
    return null;
  },
});

/** Money in or out under one of the conference's own kinds. The kind says which way it moves. */
export const recordOwnKind = mutation({
  args: { churchId: v.id("churches"), kindId: v.id("ledgerKinds"), amount: v.number(), date: v.string(), name: v.string(), memo: v.optional(v.string()), checkNumber: v.optional(v.string()) },
  returns: v.id("ledgerEntries"),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const kind = await ctx.db.get("ledgerKinds", args.kindId);
    if (!kind || kind.churchId !== args.churchId || kind.retiredAt) throw new Error("This kind is no longer offered. Choose another.");
    requireCents(args.amount);
    const out = kind.direction === "expense";
    const payee = named(args.name, out ? "Say who was paid." : "Say where the money came from.");
    const { date, memo } = await dated(ctx, args.churchId, args.date, args.memo);
    return ctx.db.insert("ledgerEntries", { churchId: args.churchId, kind: kind.direction, amount: args.amount, date, category: kind.name, payee, memo, checkNumber: out ? check(args.checkNumber) : undefined, recordedBy: member._id, createdAt: Date.now() });
  },
});
