import { ConvexError, v, type Infer } from "convex/values";
import { DateTime } from "luxon";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { logNeighborOpening, neighborAccess, neighborRecord, openedBy, opening } from "./access";
import { mayUndo } from "./undo";
import { TAKE_BACK_DAYS, callRow, lookups, nameKey, phoneKey, requestRow, toCallRow, toRequestRow } from "./assistance";
import { paidTowardRequest } from "./treasury";
import schema from "./schema";
import { longestLanguageName, spokenName } from "./spoken";
import { tally } from "./counts";
import { addName, rebuildNames } from "./knownNames";
import { dropReads } from "./aiReads";
import { lookAlikes } from "./duplicates";

/** Neighbor records: the people a group helps. Never the volunteers. */
const fields = schema.tables.neighbors.validator.fields;
const PAGE = 50;
/** What a ledger or shelf line says in place of its memo once the neighbor it was for is removed. */
const REMOVED = "Record removed";

const details = {
  name: v.string(),
  phone: v.string(),
  email: v.string(),
  address: v.string(),
  adults: v.number(),
  children: v.number(),
  language: fields.language,
  languageName: fields.languageName,
  notes: v.string(),
  alert: v.optional(v.string()),
};
const neighborRow = v.object({ id: v.id("neighbors"), ...details, alert: v.string(), createdAt: v.number() });
const toRow = (neighbor: Doc<"neighbors">): Infer<typeof neighborRow> => ({
  id: neighbor._id,
  name: neighbor.name,
  phone: neighbor.phone,
  email: neighbor.email,
  address: neighbor.address,
  adults: neighbor.adults,
  children: neighbor.children,
  language: neighbor.language,
  ...(neighbor.language === "other" ? { languageName: spokenName(neighbor) } : {}),
  notes: neighbor.notes,
  alert: neighbor.alert ?? "",
  createdAt: neighbor.createdAt,
});

const short = (value: string, label: string, max: number) => {
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ConvexError(`${label} is too long.`);
  return trimmed;
};

const named = (language: string) => {
  if (!language) throw new ConvexError("Name the language.");
  return language;
};

function clean(args: Infer<ReturnType<typeof v.object<typeof details>>>) {
  const name = args.name.trim();
  if (!name || !nameKey(name)) throw new ConvexError("A name is needed.");
  const count = (value: number, label: string, min: number) => {
    if (!Number.isInteger(value) || value < min || value > 30) throw new ConvexError(`${label} must be a whole number.`);
    return value;
  };
  return {
    name: short(name, "The name", 120),
    nameKey: nameKey(name),
    phone: short(args.phone, "The phone number", 40),
    phoneKey: phoneKey(args.phone),
    email: short(args.email, "The email", 200),
    address: short(args.address, "The address", 300),
    adults: count(args.adults, "Adults", 1),
    children: count(args.children, "Children", 0),
    language: args.language,
    // Another language is named; one of the three carries no name, and saving one clears a name kept before.
    languageName: args.language === "other" ? named(short(args.languageName ?? "", "The language", longestLanguageName)) : undefined,
    notes: short(args.notes, "The note", 2000),
    ...(args.alert === undefined ? {} : { alert: short(args.alert, "The alert", 160) }),
  };
}

/**
 * What a list shows of a household, and all of it that leaves the server for a list: the name, the street,
 * how many live there and since when it is on file. The phone, email, notes and alert are inside the record,
 * where every opening is written down. A search may match a phone number typed in; the row it finds says no more.
 */
const listRow = v.object({ id: v.id("neighbors"), name: v.string(), address: v.string(), adults: v.number(), children: v.number(), createdAt: v.number() });
const toListRow = (neighbor: Doc<"neighbors">): Infer<typeof listRow> => ({
  id: neighbor._id,
  name: neighbor.name,
  address: neighbor.address,
  adults: neighbor.adults,
  children: neighbor.children,
  createdAt: neighbor.createdAt,
});

/**
 * The neighbor list, by name. `search` finds names that start with the words typed, streets and
 * addresses that contain them, or phone numbers that start with the digits typed.
 */
export const list = query({
  args: { churchId: v.id("churches"), search: v.optional(v.string()), /** The neighbor room: waiting households lead, apart from the rest. */ leading: v.optional(v.boolean()) },
  returns: v.object({
    rows: v.array(v.object({ ...listRow.fields, openRequest: v.union(v.object({ kind: schema.tables.assistanceRequests.validator.fields.kind, amount: v.number(), waiting: v.boolean() }), v.null()), visitAt: v.union(v.number(), v.null()), lastHelpedAt: v.union(v.number(), v.null()) })),
    more: v.boolean(),
    /** Households with a request waiting for a decision, from the conference's own list of them; they lead the list and are left out of `rows`. Empty while searching. */
    waitingRows: v.array(v.object({ ...listRow.fields, openRequest: v.union(v.object({ kind: schema.tables.assistanceRequests.validator.fields.kind, amount: v.number(), waiting: v.boolean() }), v.null()), visitAt: v.union(v.number(), v.null()), lastHelpedAt: v.union(v.number(), v.null()) })),
    /** The conference's running figures (convex/counts.ts); null until they have been counted once. */
    households: v.union(v.number(), v.null()),
    waiting: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, { churchId, search = "", leading: lead = false }) => {
    await neighborAccess(ctx, churchId);
    const digits = phoneKey(search), words = nameKey(search);
    const byPhone = digits.length >= 3 && !/[a-z]/i.test(search);
    const byAddress = !byPhone && words ? await ctx.db.query("neighbors").withSearchIndex("search_address", (q) => q.search("address", search).eq("churchId", churchId)).take(PAGE) : [];
    const listed = byPhone
      ? await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).gte("phoneKey", digits).lt("phoneKey", `${digits}:`)).take(PAGE + 1)
      : words
        ? await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).gte("nameKey", words).lt("nameKey", `${words}￿`)).take(PAGE + 1)
        : await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).gt("nameKey", "")).take(PAGE + 1);
    const church = await ctx.db.get("churches", churchId);
    const waitingIds = search || !lead ? [] : [...new Set(church?.waitingHouseholdIds ?? [])];
    const waitingHouseholds = (await Promise.all(waitingIds.map((id) => ctx.db.get("neighbors", id)))).filter(
      (neighbor): neighbor is Doc<"neighbors"> => neighbor !== null && neighbor.churchId === churchId && neighbor.nameKey !== "",
    ).sort((a, b) => a.nameKey.localeCompare(b.nameKey));
    const found = [...listed, ...byAddress.filter((neighbor) => !listed.some((other) => other._id === neighbor._id))];
    const row = async (neighbor: Doc<"neighbors">) => {
      const requests = await ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighbor._id)).order("desc").take(50);
      const visits = await ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", neighbor._id)).order("desc").take(20);
      const helped = requests.filter((request) => request.status === "paid" || request.status === "approved" || broughtOver(request)).map((request) => request.decidedAt ?? request.createdAt);
      const open = requests.find((request) => request.status === "open") ?? requests.find((request) => request.status === "approved");
      const planned = visits.filter((visit) => visit.status === "scheduled").map((visit) => visit.scheduledAt);
      return {
        ...toListRow(neighbor),
        openRequest: open ? { kind: open.kind, amount: open.amountApproved ?? open.amountRequested, waiting: open.status === "open" } : null,
        visitAt: planned.length ? Math.min(...planned) : null,
        lastHelpedAt: helped.length ? Math.max(...helped) : null,
      };
    };
    const leading = new Set(waitingHouseholds.map((neighbor) => neighbor._id));
    const rows = await Promise.all(found.slice(0, PAGE).filter((neighbor) => !leading.has(neighbor._id)).map(row));
    const waitingRows = await Promise.all(waitingHouseholds.map(row));
    return { rows, waitingRows, more: found.length > PAGE, households: church?.householdCount ?? null, waiting: church?.waitingCount ?? null };
  },
});

/** Past help carried in from a group's earlier records: it was given, but not through this ledger. */
const broughtOver = (request: Pick<Doc<"assistanceRequests">, "source" | "status">) => request.source === "import" && request.status === "closed";

/** Before adding someone: neighbors already on file with the same phone number or the same name. */
export const matches = query({
  args: { churchId: v.id("churches"), name: v.string(), phone: v.string(), address: v.optional(v.string()) },
  returns: v.array(v.object({ ...listRow.fields, same: v.union(v.literal("phone"), v.literal("name"), v.literal("alike")) })),
  handler: async (ctx, { churchId, name, phone, address = "" }) => {
    await neighborAccess(ctx, churchId);
    const digits = phoneKey(phone), words = nameKey(name);
    const samePhone = digits ? await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", digits)).take(5) : [];
    const sameName = words ? await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", words)).take(5) : [];
    return [
      ...samePhone.map((neighbor) => ({ ...toListRow(neighbor), same: "phone" as const })),
      ...sameName.filter((neighbor) => !samePhone.some((other) => other._id === neighbor._id)).map((neighbor) => ({ ...toListRow(neighbor), same: "name" as const })),
      // A name alike, or the same street address: the same code that finds doubles on a record.
      ...(await lookAlikes(ctx, churchId, { name, phone, address })).filter(({ row }) => !samePhone.some((other) => other._id === row._id) && !sameName.some((other) => other._id === row._id)).slice(0, 5).map(({ row }) => ({ ...toListRow(row), same: "alike" as const })),
    ];
  },
});

/**
 * Adds a neighbor. A phone number or name already on file is refused, so a household is not entered
 * twice; pass `confirmedNew` after a person has looked at the matches and said this is someone else.
 * Give `callId` to tie the call that brought them to the new record.
 */
export const create = mutation({
  args: { churchId: v.id("churches"), ...details, callId: v.optional(v.id("calls")), confirmedNew: v.optional(v.boolean()) },
  returns: v.id("neighbors"),
  handler: async (ctx, { churchId, callId, confirmedNew, ...input }) => {
    const member = await neighborAccess(ctx, churchId);
    const record = clean(input);
    if (!confirmedNew) {
      const samePhone = record.phoneKey ? await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", record.phoneKey)).first() : null;
      const existing = samePhone ?? (await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", record.nameKey)).first());
      if (existing) throw new ConvexError(`${existing.name} is already on file with this ${samePhone ? "phone number" : "name"}.`);
      const alike = (await lookAlikes(ctx, churchId, record))[0];
      if (alike) throw new ConvexError(`${alike.row.name} may already be on file.`);
    }
    const neighborId = await ctx.db.insert("neighbors", { churchId, ...record, createdBy: member._id, createdAt: Date.now() });
    await addName(ctx, churchId, record.name);
    await tally(ctx, churchId, { households: 1 });
    if (callId) {
      const call = await ctx.db.get("calls", callId);
      if (!call || call.churchId !== churchId) throw new ConvexError("Call not found.");
      if (!call.neighborId) await ctx.db.patch("calls", callId, { neighborId });
    }
    return neighborId;
  },
});

export const update = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), ...details },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId, ...input }) => {
    const { neighbor } = await neighborRecord(ctx, churchId, neighborId);
    const record = clean(input);
    await ctx.db.patch("neighbors", neighborId, record);
    if (record.name !== neighbor.name) await rebuildNames(ctx, churchId);
    return null;
  },
});

/**
 * Removes a neighbor's record for good. An owner only, and only after typing the neighbor's name.
 * Everything that says who they are or what was said goes: the name, phones, address, household, money,
 * accounts and notes, the words of every call (also calls from the same phone never tied to the record),
 * request and visit, and any draft made from those calls.
 * What stays is what the year counts, with nothing in it that identifies anyone: a nameless row for the
 * household (how many adults and children, and the language), its calls, requests and visits as dates,
 * kinds, amounts and volunteers' hours, and the ledger and shelf lines without their memo. So no figure
 * of a year changes when a record is removed. The neighbor's whole name typed by hand on any other line of
 * the ledger, the shelf or the deposits goes too. Free writing elsewhere (another record's notes, tasks,
 * announcements) is not searched, and the sheet says so. A removed record has an empty nameKey, which no live record
 * can have; neighborRecord() in access.ts answers "Record not found." for it, and lists leave it out.
 * The audit trail keeps who removed a record and when, by the record's id alone.
 */
export const remove = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), typedName: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId, typedName }) => {
    const { member, neighbor } = await neighborRecord(ctx, churchId, neighborId);
    if (member.role !== "owner") throw new ConvexError("Only an owner can remove a neighbor’s record.");
    if (nameKey(typedName) !== nameKey(neighbor.name)) throw new ConvexError("Type the neighbor’s name as it is written on the record.");

    const [requests, visits, notes, tied, everyCall, ledger, shelf, deposits] = await Promise.all([
      ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).collect(),
      ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).collect(),
      ctx.db.query("neighborNotes").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).collect(),
      ctx.db.query("calls").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).collect(),
      ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("voucherStock").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("deposits").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
    ]);
    if (requests.some((request) => request.status === "open" || request.status === "approved"))
      throw new ConvexError("A request for this neighbor is still open. Decide it or close it first.");
    if (visits.some((visit) => visit.status === "scheduled"))
      throw new ConvexError("A home visit to this neighbor is still planned. Cancel it first.");

    // A call that was never tied to the record but is plainly theirs: the same phone, or the same name with no phone.
    const loose = everyCall.filter((call) => {
      if (call.neighborId) return false;
      const phone = phoneKey(call.phone);
      return phone ? phone === neighbor.phoneKey : nameKey(call.callerName) === nameKey(neighbor.name);
    });
    const calls = [...tied, ...loose];
    const drafts = (await Promise.all(calls.map((call) => ctx.db.query("requestDrafts").withIndex("by_call", (q) => q.eq("callId", call._id)).collect()))).flat();

    // The money of the whole conference is read, because a name can be typed by hand on a line with no link to the record.
    // On a line tied to the record the memo goes, and so does a payee that carries any part of the name: who was paid
    // stays when it is a landlord, a utility or a store, and better one store too many than one name left.
    // On every other line, and on deposits and the voucher shelf, a field goes only when it carries the whole name,
    // so that removing a Lee does not blank every payment to Lee County Electric.
    const words = nameKey(neighbor.name).split(" ");
    const part = new Set(words.filter((word) => word.length > 2));
    const said = (text: string) => new Set(nameKey(text).split(" "));
    const anyOf = (text: string) => [...said(text)].some((word) => part.has(word));
    const whole = (text: string) => { const found = said(text); return words.every((word) => found.has(word)); };
    const theirs = new Set<string>(requests.map((request) => request._id));
    for (const entry of ledger) {
      const tiedLine = entry.neighborId === neighborId || (entry.requestId !== undefined && theirs.has(entry.requestId));
      const payee = tiedLine ? anyOf(entry.payee) : whole(entry.payee);
      const memo = tiedLine || whole(entry.memo);
      if (payee || memo) await ctx.db.patch("ledgerEntries", entry._id, { ...(payee && { payee: REMOVED }), ...(memo && { memo: REMOVED }) });
    }
    for (const line of shelf)
      if ((line.requestId !== undefined && theirs.has(line.requestId)) || whole(line.note)) await ctx.db.patch("voucherStock", line._id, { note: REMOVED });
    for (const deposit of deposits) if (whole(deposit.memo)) await ctx.db.patch("deposits", deposit._id, { memo: REMOVED });

    for (const draft of drafts) await ctx.db.delete("requestDrafts", draft._id);
    for (const note of notes) await ctx.db.delete("neighborNotes", note._id);
    // What the year counts stays as a row with nothing in it that was said or written about the household.
    for (const call of calls) {
      await ctx.db.patch("calls", call._id, { callerName: "", phone: "", note: "", outcome: undefined, urgent: undefined });
      // What the assistant was sent from the note goes with the note.
      await dropReads(ctx, call._id);
    }
    for (const visit of visits) await ctx.db.patch("visits", visit._id, { notes: "" });
    for (const request of requests) await ctx.db.patch("assistanceRequests", request._id, { summary: REMOVED, decisionNote: "", payeeName: "", referral: undefined, referrals: undefined });
    await tally(ctx, churchId, { households: -1, waiting: -requests.filter((request) => request.status === "open").length, gone: neighborId });
    await ctx.db.patch("neighbors", neighborId, { name: REMOVED, nameKey: "", phone: "", phoneKey: "", email: "", address: "", notes: "", alert: undefined, household: undefined, money: undefined, accounts: undefined });
    await rebuildNames(ctx, churchId);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "neighbor.removed", targetId: neighborId, at: Date.now() });
    return null;
  },
});

/**
 * Opening a record is written to the audit trail. The screen calls this, then reads `record` with the line it
 * returns; `record` refuses without one, so the record cannot be read without being written down.
 */
export const open = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors") },
  returns: opening,
  handler: async (ctx, { churchId, neighborId }) => {
    const { member, neighbor } = await neighborRecord(ctx, churchId, neighborId);
    return logNeighborOpening(ctx, member, neighbor._id);
  },
});

const householdMember = fields.household.element;
const moneyLine = v.object({ label: v.string(), amount: v.number() });
const accountFields = fields.accounts.element.fields;
const account = v.object(accountFields);

/**
 * Who lives in the household, what comes in and goes out each month, and the accounts a bill is paid to.
 * Each part is replaced whole when given. Saying who lives there keeps the adult and child counts in step.
 */
export const saveHousehold = mutation({
  args: {
    churchId: v.id("churches"),
    neighborId: v.id("neighbors"),
    household: v.optional(v.array(householdMember)),
    money: v.optional(v.object({ income: v.array(moneyLine), expenses: v.array(moneyLine) })),
    /** `keep` is the place of an account already on file whose number stays as it is, for a form that never saw it. */
    accounts: v.optional(v.array(v.object({ ...accountFields, accountNumber: v.optional(v.string()), keep: v.optional(v.number()) }))),
  },
  returns: v.null(),
  handler: async (ctx, { churchId, neighborId, household, money, accounts }) => {
    const { neighbor } = await neighborRecord(ctx, churchId, neighborId);
    const thisYear = new Date().getUTCFullYear();
    const lines = (given: Infer<typeof moneyLine>[]) =>
      given.slice(0, 20).map((line) => {
        if (!Number.isInteger(line.amount) || line.amount < 0) throw new ConvexError("An amount must be zero or more.");
        const label = short(line.label, "A label", 60);
        if (!label) throw new ConvexError("Each line needs a name.");
        return { label, amount: line.amount };
      });
    const people = household?.slice(0, 30).map((person) => {
      if (person.birthYear !== undefined && (!Number.isInteger(person.birthYear) || person.birthYear < 1900 || person.birthYear > thisYear)) throw new ConvexError("A birth year looks wrong.");
      const relationship = short(person.relationship, "A relationship", 60);
      if (!relationship) throw new ConvexError("Each person needs a relationship, such as mother or son.");
      return { relationship, child: person.child, birthYear: person.birthYear };
    });
    if (people?.length && !people.some((person) => !person.child)) throw new ConvexError("A household needs at least one adult.");
    await ctx.db.patch("neighbors", neighborId, {
      ...(people ? { household: people, ...(people.length ? { adults: people.filter((person) => !person.child).length, children: people.filter((person) => person.child).length } : {}) } : {}),
      ...(money ? { money: { income: lines(money.income), expenses: lines(money.expenses), updatedAt: Date.now() } } : {}),
      ...(accounts
        ? {
            accounts: accounts.slice(0, 12).map((given) => {
              const name = short(given.name, "A name", 120);
              if (!name) throw new ConvexError("Each account needs the name of who is paid.");
              const kept = given.keep === undefined ? "" : (neighbor.accounts?.[given.keep]?.accountNumber ?? "");
              return { kind: given.kind, name, accountNumber: given.accountNumber === undefined ? kept : short(given.accountNumber, "An account number", 60), phone: short(given.phone, "A phone number", 40) };
            }),
          }
        : {}),
    });
    return null;
  },
});

/**
 * Account numbers in full. The record shows only the last four; asking for the rest is written to
 * the audit trail like an opening, because a number is enough to act on someone's account.
 */
export const showAccounts = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors") },
  returns: v.array(account),
  handler: async (ctx, { churchId, neighborId }) => {
    const { member, neighbor } = await neighborRecord(ctx, churchId, neighborId);
    await logNeighborOpening(ctx, member, neighbor._id);
    return neighbor.accounts ?? [];
  },
});

/** Adds a dated, signed note. Notes are never edited or removed, so the record stays a true account. */
export const addNote = mutation({
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), body: v.string() },
  returns: v.id("neighborNotes"),
  handler: async (ctx, { churchId, neighborId, body }) => {
    const { member } = await neighborRecord(ctx, churchId, neighborId);
    const text = short(body, "The note", 4000);
    if (!text) throw new ConvexError("Write the note first.");
    return ctx.db.insert("neighborNotes", { churchId, neighborId, body: text, authorId: member._id, createdAt: Date.now() });
  },
});

/** Undoes adding a note, from the line that said so, for the member who wrote it. */
export const takeBackNote = mutation({
  args: { churchId: v.id("churches"), noteId: v.id("neighborNotes") },
  returns: v.null(),
  handler: async (ctx, { churchId, noteId }) => {
    const note = await ctx.db.get("neighborNotes", noteId);
    if (!note || note.churchId !== churchId) throw new ConvexError("Note not found.");
    const { member } = await neighborRecord(ctx, churchId, note.neighborId);
    mayUndo({ by: note.authorId, at: note.createdAt }, member._id, Date.now());
    await ctx.db.delete("neighborNotes", noteId);
    return null;
  },
});

const historyEvent = v.union(
  v.object({ type: v.literal("call"), at: v.number(), note: v.string(), who: v.string() }),
  v.object({ type: v.literal("visit"), at: v.number(), who: v.array(v.string()), note: v.optional(v.string()) }),
  v.object({ type: v.literal("payment"), at: v.number(), category: v.string(), payee: v.string(), amount: v.number(), who: v.string() }),
  v.object({ type: v.literal("note"), at: v.number(), note: v.string(), who: v.string() }),
  v.object({ type: v.literal("brought"), at: v.number(), kind: schema.tables.assistanceRequests.validator.fields.kind, payee: v.string(), amount: v.number() }),
  /** A voucher given from the shelf; `who` approved it. Once taken back, `note` says why and `closedBy` who, when that is known. */
  v.object({ type: v.literal("voucher"), at: v.number(), requestId: v.id("assistanceRequests"), item: v.string(), quantity: v.number(), who: v.string(), closedBy: v.string(), takenBack: v.boolean(), /** Until when a given voucher may be taken back; null when it cannot. The page compares it with its own clock, closeRequest with the real one. */ takeBackUntil: v.union(v.number(), v.null()), note: v.string() }),
  v.object({ type: v.literal("decision"), at: v.number(), kind: schema.tables.assistanceRequests.validator.fields.kind, status: v.union(v.literal("declined"), v.literal("closed")), note: v.string(), who: v.string(), approvedBy: v.string(), approved: v.number(), paid: v.number() }),
);

/**
 * One neighbor's record: who they are, what is open, and everything that has happened, newest first.
 * Payments are read from the ledger; nothing here writes to it.
 */
export const record = query({
  /** `opening` is the audit line `open` returned to this caller for this neighbor. */
  args: { churchId: v.id("churches"), neighborId: v.id("neighbors"), opening },
  returns: v.object({
    neighbor: neighborRow,
    household: v.array(v.object({ ...householdMember.fields, age: v.union(v.number(), v.null()) })),
    money: v.union(v.object({ income: v.array(moneyLine), expenses: v.array(moneyLine), updatedAt: v.number() }), v.null()),
    accounts: v.array(v.object({ kind: accountFields.kind, name: v.string(), ending: v.string(), phone: v.string() })),
    paidThisYear: v.number(),
    requestsThisYear: v.number(),
    visitsDone: v.number(),
    lastVisitAt: v.union(v.number(), v.null()),
    since: v.number(),
    open: v.array(requestRow),
    requests: v.array(requestRow),
    calls: v.array(callRow),
    history: v.array(historyEvent),
    openings: v.array(v.object({ who: v.string(), at: v.number() })),
    /** Only an owner may remove the record; the mutation checks again. */
    mayRemove: v.boolean(),
  }),
  handler: async (ctx, { churchId, neighborId, opening: line }) => {
    const { member, neighbor } = await neighborRecord(ctx, churchId, neighborId);
    await openedBy(ctx, member, neighborId, line);
    const church = await ctx.db.get("churches", churchId);
    const yearStart = DateTime.now().setZone(church?.timeZone ?? "UTC").startOf("year");
    const found = lookups(ctx);
    const [requestDocs, callDocs, visitDocs, entries, noteDocs] = await Promise.all([
      ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
      ctx.db.query("calls").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
      ctx.db.query("visits").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
      ctx.db.query("ledgerEntries").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(200),
      ctx.db.query("neighborNotes").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).order("desc").take(50),
    ]);
    const brought = requestDocs.filter(broughtOver);
    const requests = await Promise.all(requestDocs.map((request) => toRequestRow(found, request)));
    const calls = await Promise.all(callDocs.map((call) => toCallRow(found, call)));
    const payments = entries.filter((entry) => entry.kind === "expense" && !entry.voidedAt);
    const visitsDone = visitDocs.filter((visit) => visit.status === "completed");
    // A voucher that left the shelf: approved (so no money was ever owed) and then either kept or taken back.
    const given = (request: (typeof requests)[number]) => !!request.voucher && request.amountApproved === 0 && (request.status === "paid" || request.status === "closed");
    const history: Infer<typeof historyEvent>[] = [
      ...calls.map((call) => ({ type: "call" as const, at: call.takenAt, note: call.note, who: call.takenByName })),
      ...(await Promise.all(visitsDone.map(async (visit) => ({ type: "visit" as const, at: visit.completedAt ?? visit.scheduledAt, note: visit.notes, who: await Promise.all(visit.visitors.map((visitor) => found.memberName(visitor.memberId))) })))),
      ...(await Promise.all(payments.map(async (entry) => ({ type: "payment" as const, at: DateTime.fromISO(entry.date, { zone: church?.timeZone ?? "UTC" }).toMillis(), category: entry.category, payee: entry.payee, amount: entry.amount, who: await found.memberName(entry.recordedBy) })))),
      ...(await Promise.all(noteDocs.map(async (note) => ({ type: "note" as const, at: note.createdAt, note: note.body, who: await found.memberName(note.authorId) })))),
      ...brought.map((request) => ({ type: "brought" as const, at: request.createdAt, kind: request.kind, payee: request.payeeName, amount: request.importedAmount ?? request.amountRequested })),
      ...requests.filter(given).map((request) => ({ type: "voucher" as const, at: (request.status === "closed" ? request.closedAt : null) ?? request.decidedAt ?? request.createdAt, requestId: request.id, item: request.voucher?.item ?? "", quantity: request.voucher?.quantity ?? 0, who: request.decidedByName ?? request.createdByName, closedBy: request.closedByName ?? "", takenBack: request.status === "closed", takeBackUntil: request.status === "paid" ? (request.decidedAt ?? 0) + TAKE_BACK_DAYS * 24 * 60 * 60 * 1000 : null, note: request.status === "closed" ? request.decisionNote : "" })),
      ...(await Promise.all(requests.filter((request) => request.source !== "import" && !given(request) && (request.status === "declined" || request.status === "closed")).map(async (request) => ({ type: "decision" as const, at: (request.status === "closed" ? request.closedAt : null) ?? request.decidedAt ?? request.createdAt, kind: request.kind, status: request.status === "closed" ? ("closed" as const) : ("declined" as const), note: [request.decisionNote, [...request.referrals, request.referral].filter(Boolean).length ? `Referred to ${[...request.referrals, request.referral].filter(Boolean).join(", ")}.` : ""].filter(Boolean).join(" "), who: request.status === "closed" && request.closedByName ? request.closedByName : request.amountApproved === null ? (request.decidedByName ?? request.createdByName) : "", approvedBy: request.amountApproved === null ? "" : (request.decidedByName ?? "") , approved: request.amountApproved ?? 0, paid: request.status === "closed" && request.amountApproved ? await paidTowardRequest(ctx, request.id) : 0 })))),
    ].sort((a, b) => b.at - a.at);
    const opened = await ctx.db.query("auditEvents").withIndex("by_church_action_target", (q) => q.eq("churchId", churchId).eq("action", "neighbor.opened").eq("targetId", neighborId)).order("desc").take(20);
    const openers = new Map<string, Promise<string>>();
    const opener = (userId: (typeof opened)[number]["actorId"]) => {
      const known = openers.get(userId) ?? ctx.db.query("memberships").withIndex("by_church_user", (q) => q.eq("churchId", churchId).eq("userId", userId)).unique().then((member) => member?.name ?? "A former member");
      openers.set(userId, known);
      return known;
    };
    return {
      mayRemove: member.role === "owner",
      openings: await Promise.all(opened.map(async (event) => ({ who: await opener(event.actorId), at: event.at }))),
      neighbor: toRow(neighbor),
      household: (neighbor.household ?? []).map((person) => ({ ...person, age: person.birthYear === undefined ? null : yearStart.year - person.birthYear })),
      money: neighbor.money ?? null,
      accounts: (neighbor.accounts ?? []).map(({ accountNumber, ...account }) => ({ ...account, ending: accountNumber.slice(-4) })),
      paidThisYear:
        payments.filter((entry) => entry.date >= yearStart.toFormat("yyyy-MM-dd")).reduce((sum, entry) => sum + entry.amount, 0) +
        brought.filter((request) => request.createdAt >= yearStart.toMillis()).reduce((sum, request) => sum + (request.importedAmount ?? request.amountRequested), 0),
      requestsThisYear: requests.filter((request) => request.createdAt >= yearStart.toMillis()).length,
      visitsDone: visitsDone.length,
      lastVisitAt: visitsDone.length ? Math.max(...visitsDone.map((visit) => visit.completedAt ?? visit.scheduledAt)) : null,
      since: Math.min(neighbor.createdAt, ...history.map((event) => event.at)),
      open: requests.filter((request) => request.status === "open" || request.status === "approved"),
      requests,
      calls,
      history,
    };
  },
});
