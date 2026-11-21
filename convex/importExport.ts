import { ConvexError, v, type Infer } from "convex/values";
import { DateTime } from "luxon";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auditedBy, membership, neighborAccess } from "./access";
import { nameKey, phoneKey } from "./assistance";
import { longestLanguageName, readSpoken, spokenName, type Spoken } from "./spoken";
import { tally } from "./counts";
import { rebuildNames } from "./knownNames";

/**
 * Bringing a members list in from a spreadsheet. Nobody is added on their behalf: every good row
 * becomes an invitation the person accepts themselves, exactly as if the owner had typed it.
 * A row that cannot be used is reported with its line number and the rest still go through.
 */
const mostRows = 300;
const memberRow = v.object({ line: v.number(), name: v.string(), email: v.string(), role: v.string() });
const problem = v.union(v.literal("no_name"), v.literal("bad_email"), v.literal("bad_role"), v.literal("repeated"), v.literal("already_member"), v.literal("already_invited"));
const checked = v.object({ line: v.number(), name: v.string(), email: v.string(), role: v.union(v.literal("member"), v.literal("coordinator")), outcome: v.union(v.literal("ready"), problem) });
const imported = v.object({ line: v.number(), name: v.string(), email: v.string(), outcome: v.union(v.literal("invited"), problem), token: v.union(v.string(), v.null()) });
const normalizeEmail = (value: string) => value.trim().toLowerCase();

async function reviewMembers(ctx: QueryCtx, churchId: Id<"churches">, rows: Infer<typeof memberRow>[]) {
  const me = await membership(ctx, churchId);
  if (me.role !== "owner") throw new ConvexError("Owner access required.");
  if (rows.length > mostRows) throw new ConvexError(`Bring in up to ${mostRows} people at a time.`);
  const [members, invitations] = await Promise.all([
    ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1001),
    ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1001),
  ]);
  if (members.length > 1000 || invitations.length > 1000) throw new ConvexError("This group is too large to check a file against. Invite people one at a time.");
  const now = Date.now();
  const joined = new Set(members.map((member) => normalizeEmail(member.email)));
  const waiting = new Set(invitations.filter((invite) => invite.status === "pending" && invite.expiresAt > now).map((invite) => invite.email));
  const seen = new Set<string>();
  return rows.map((row) => {
    const name = row.name.trim(), email = normalizeEmail(row.email), wanted = row.role.trim().toLowerCase();
    const role = wanted === "coordinator" ? "coordinator" as const : "member" as const;
    const verdict = (outcome: Infer<typeof checked>["outcome"]) => ({ line: row.line, name, email, role, outcome });
    if (!name || name.length > 200) return verdict("no_name");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return verdict("bad_email");
    if (wanted && wanted !== "member" && wanted !== "coordinator") return verdict("bad_role");
    if (seen.has(email)) return verdict("repeated");
    seen.add(email);
    if (joined.has(email)) return verdict("already_member");
    if (waiting.has(email)) return verdict("already_invited");
    return verdict("ready");
  });
}

/** What would happen to each row, without changing anything. The screen shows this before the owner says yes. */
export const checkMembers = query({
  args: { churchId: v.id("churches"), rows: v.array(memberRow) },
  returns: v.array(checked),
  handler: (ctx, args) => reviewMembers(ctx, args.churchId, args.rows),
});

/**
 * Invites every ready row and reports every row. Each invitation's private link token is returned once,
 * for the owner to pass on by hand while no sending address is set up.
 * The whole file is one step: every invitation is made, or none is, so a link is never made and then lost.
 */
export const importMembers = action({
  args: { churchId: v.id("churches"), batchId: v.string(), rows: v.array(memberRow) },
  returns: v.array(imported),
  handler: async (ctx, args): Promise<Infer<typeof imported>[]> => {
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(args.batchId)) throw new Error("Invalid batch identifier.");
    if (args.rows.length > mostRows) throw new ConvexError(`Bring in up to ${mostRows} people at a time.`);
    const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const tokens = await Promise.all(args.rows.map(async () => {
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      return { token, tokenHash: hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))) };
    }));
    return ctx.runMutation(internal.importExport.inviteReady, { ...args, tokens });
  },
});

/** The check and the invitations in one transaction, so two imports at once cannot both invite the same person. */
export const inviteReady = internalMutation({
  args: { churchId: v.id("churches"), batchId: v.string(), rows: v.array(memberRow), tokens: v.array(v.object({ token: v.string(), tokenHash: v.string() })) },
  returns: v.array(imported),
  handler: async (ctx, args) => {
    const rows = await reviewMembers(ctx, args.churchId, args.rows);
    const results: Infer<typeof imported>[] = [];
    for (const [index, row] of rows.entries()) {
      if (row.outcome !== "ready") { results.push({ line: row.line, name: row.name, email: row.email, outcome: row.outcome, token: null }); continue; }
      const { token, tokenHash } = args.tokens[index];
      const record: { created: boolean } = await ctx.runMutation(internal.invitations.createRecord, { churchId: args.churchId, email: row.email, role: row.role, requestId: `${args.batchId}_${row.line}`, tokenHash, token });
      results.push({ line: row.line, name: row.name, email: row.email, outcome: record.created ? "invited" : "already_invited", token: record.created ? token : null });
    }
    return results;
  },
});

/**
 * Bringing neighbor records in from a spreadsheet, for a group moving over from paper or another system.
 * Open to coordinators and owners only, like every neighbor record. A row whose phone number or name is
 * already on file, or appears earlier in the same file, is left out and reported, never merged or doubled:
 * a person decides what to do with it on the neighbor's own record.
 */
const neighborRow = v.object({ line: v.number(), name: v.string(), phone: v.string(), email: v.string(), address: v.string(), adults: v.string(), children: v.string(), language: v.string(), notes: v.string() });
/** The name a removed record keeps (see neighbors.remove). A line with this name is never a household to bring in. */
const REMOVED = "Record removed";
const removedKey = nameKey(REMOVED);
const neighborProblem = v.union(v.literal("no_name"), v.literal("too_long"), v.literal("bad_count"), v.literal("repeated"), v.literal("same_phone"), v.literal("same_name"));
const neighborChecked = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("ready"), neighborProblem) });
const neighborImported = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("added"), neighborProblem) });

async function reviewNeighbors(ctx: QueryCtx, churchId: Id<"churches">, rows: Infer<typeof neighborRow>[]) {
  if (rows.length > mostRows) throw new ConvexError(`Bring in up to ${mostRows} neighbors at a time.`);
  const seenPhones = new Set<string>(), seenNames = new Set<string>();
  const count = (value: string, empty: number, least: number) => {
    const number = value.trim() === "" ? empty : Number(value.trim());
    return Number.isInteger(number) && number >= least && number <= 30 ? number : null;
  };
  return Promise.all(rows.map(async (row) => {
    const name = row.name.trim(), phone = row.phone.trim(), email = row.email.trim(), address = row.address.trim(), notes = row.notes.trim();
    const keys = { nameKey: nameKey(name), phoneKey: phoneKey(phone) };
    const verdict = (outcome: Infer<typeof neighborChecked>["outcome"], record: { adults: number; children: number; language: Spoken; languageName?: string } | null = null) => ({ line: row.line, name, outcome, record: record && { name, ...keys, phone, email, address, notes, ...record } });
    if (!name || !keys.nameKey || keys.nameKey === removedKey) return verdict("no_name");
    if (name.length > 120 || phone.length > 40 || email.length > 200 || address.length > 300 || notes.length > 2000) return verdict("too_long");
    const adults = count(row.adults, 1, 1), children = count(row.children, 0, 0);
    if (adults === null || children === null) return verdict("bad_count");
    // Any language is taken as written: a household speaks what it speaks.
    const speaks = readSpoken(row.language);
    if ((speaks.languageName ?? "").length > longestLanguageName) return verdict("too_long");
    // The same order as adding one neighbor by hand: a shared phone number first, then a shared name.
    if ((keys.phoneKey && seenPhones.has(keys.phoneKey)) || seenNames.has(keys.nameKey)) return verdict("repeated");
    if (keys.phoneKey) seenPhones.add(keys.phoneKey);
    seenNames.add(keys.nameKey);
    if (keys.phoneKey && (await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", keys.phoneKey)).first())) return verdict("same_phone");
    if (await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", keys.nameKey)).first()) return verdict("same_name");
    return verdict("ready", { adults, children, ...speaks });
  }));
}

/** What would happen to each row, without changing anything. Only the name comes back, never the rest of the row. */
export const checkNeighbors = query({
  args: { churchId: v.id("churches"), rows: v.array(neighborRow) },
  returns: v.array(neighborChecked),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    return (await reviewNeighbors(ctx, args.churchId, args.rows)).map(({ line, name, outcome }) => ({ line, name, outcome }));
  },
});

/** Adds every ready row in one step and reports every row. The file is checked again here, so nothing slips in between. */
export const importNeighbors = mutation({
  args: { churchId: v.id("churches"), rows: v.array(neighborRow) },
  returns: v.array(neighborImported),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const now = Date.now();
    const results: Infer<typeof neighborImported>[] = [];
    for (const row of await reviewNeighbors(ctx, args.churchId, args.rows)) {
      if (row.record) await ctx.db.insert("neighbors", { churchId: args.churchId, ...row.record, createdBy: member._id, createdAt: now });
      results.push({ line: row.line, name: row.name, outcome: row.outcome === "ready" ? "added" : row.outcome });
    }
    const added = results.filter((row) => row.outcome === "added").length;
    await tally(ctx, args.churchId, { households: added });
    if (added) await rebuildNames(ctx, args.churchId);
    if (added) await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: member.userId, action: "neighbors_imported", targetId: String(added), at: now });
    return results;
  },
});

/**
 * Bringing a conference's past requests over from another system, such as ServWare's request export.
 * History only: each line becomes a request marked source "import" with the day it was made, never approved
 * or paid here, and with no ledger entry, so the treasury is untouched. The help ServWare recorded is kept in
 * importedAmount, apart from anything the ledger sums. A line whose neighbor is not on file is left out, and
 * so is one already brought in: the same neighbor, day, kind and amount. Running a file twice adds nothing.
 * A request still open in the other system stays open here only when it is under 60 days old.
 */
const requestRow = v.object({ line: v.number(), name: v.string(), phone: v.string(), date: v.string(), status: v.string(), type: v.string(), amount: v.string(), payee: v.string(), notes: v.string() });
const requestProblem = v.union(v.literal("no_name"), v.literal("no_neighbor"), v.literal("bad_date"), v.literal("bad_amount"), v.literal("bad_status"), v.literal("too_long"), v.literal("repeated"), v.literal("already_here"));
const requestChecked = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("ready"), requestProblem) });
const requestImported = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("added"), requestProblem) });
const kinds = [["rent", /rent|housing|mortgage|deposit|lodging|shelter/], ["utility", /utilit|electric|power|water|gas|heat|energy|phone|internet/], ["food", /food|grocer|pantry|meal/], ["voucher", /voucher|thrift|furniture|clothing|cloth|store/]] as const;
const stillOpenDays = 60;
const payeeKinds = { rent: "landlord", utility: "utility", food: "vendor", voucher: "vendor", other: "vendor" } as const;
const statuses = new Map<string, "open" | "closed">([["", "closed"], ["completed", "closed"], ["complete", "closed"], ["closed", "closed"], ["open", "open"], ["call back", "open"], ["callback", "open"], ["pending", "open"]]);

async function reviewRequests(ctx: QueryCtx, churchId: Id<"churches">, rows: Infer<typeof requestRow>[]) {
  if (rows.length > mostRows) throw new ConvexError(`Bring in up to ${mostRows} requests at a time.`);
  const church = await ctx.db.get("churches", churchId);
  if (!church) throw new ConvexError("Group not found.");
  const now = Date.now();
  const seen = new Set<string>();
  const earlier = new Map<Id<"neighbors">, Set<string>>();
  const results = [];
  for (const row of rows) {
    const name = row.name.trim(), type = row.type.trim(), payee = row.payee.trim(), notes = row.notes.trim();
    const verdict = (outcome: Infer<typeof requestChecked>["outcome"], record: { neighborId: Id<"neighbors">; kind: "rent" | "utility" | "food" | "voucher" | "other"; status: "open" | "closed"; createdAt: number; importedAmount: number } | null = null) =>
      ({ line: row.line, name, outcome, record: record && { ...record, summary: notes || type || "Brought over from an earlier system", payeeName: payee, payeeKind: payeeKinds[record.kind] } });
    if (!nameKey(name) || nameKey(name) === removedKey) { results.push(verdict("no_name")); continue; }
    if (name.length > 120 || type.length > 120 || payee.length > 120 || notes.length > 500) { results.push(verdict("too_long")); continue; }
    const day = ["M/d/yyyy", "M/d/yy", "yyyy-MM-dd"].map((format) => DateTime.fromFormat(row.date.trim(), format, { zone: church.timeZone })).find((date) => date.isValid);
    const createdAt = day?.set({ hour: 12 }).toMillis();
    if (!createdAt || createdAt > now || createdAt < now - 40 * 365 * 86400000) { results.push(verdict("bad_date")); continue; }
    const money = row.amount.trim() === "" ? 0 : Number(row.amount.replace(/[$,\s]/g, ""));
    const importedAmount = Math.round(money * 100);
    if (!Number.isFinite(money) || money < 0 || importedAmount > 100_000_00) { results.push(verdict("bad_amount")); continue; }
    const stated = statuses.get(row.status.trim().toLowerCase());
    if (!stated) { results.push(verdict("bad_status")); continue; }
    // Only what is truly still waiting stays open: an old request left open in the other system comes in as history.
    const status = stated === "open" && createdAt >= now - stillOpenDays * 86400000 ? "open" : "closed";
    // The neighbor is found the way a person would look: by the phone number when the line has one, else by the name.
    const phone = phoneKey(row.phone);
    const neighbor = (phone && (await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", phone)).first()))
      || (await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", nameKey(name))).first());
    if (!neighbor) { results.push(verdict("no_neighbor")); continue; }
    const kind = kinds.find(([, pattern]) => pattern.test(type.toLowerCase()))?.[0] ?? "other";
    const mark = `${createdAt}|${kind}|${importedAmount}`;
    if (seen.has(`${neighbor._id}|${mark}`)) { results.push(verdict("repeated")); continue; }
    seen.add(`${neighbor._id}|${mark}`);
    if (!earlier.has(neighbor._id)) {
      const before = await ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighbor._id)).take(500);
      earlier.set(neighbor._id, new Set(before.filter((request) => request.source === "import").map((request) => `${request.createdAt}|${request.kind}|${request.importedAmount ?? 0}`)));
    }
    if (earlier.get(neighbor._id)?.has(mark)) { results.push(verdict("already_here")); continue; }
    results.push(verdict("ready", { neighborId: neighbor._id, kind, status, createdAt, importedAmount }));
  }
  return results;
}

/** What would happen to each line, without changing anything. Only the name comes back. */
export const checkRequests = query({
  args: { churchId: v.id("churches"), rows: v.array(requestRow) },
  returns: v.array(requestChecked),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    return (await reviewRequests(ctx, args.churchId, args.rows)).map(({ line, name, outcome }) => ({ line, name, outcome }));
  },
});

/** Checks again, then adds every ready line as history. One entry in the record of who did what says how many came in. */
export const importRequests = mutation({
  args: { churchId: v.id("churches"), rows: v.array(requestRow) },
  returns: v.array(requestImported),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const results: Infer<typeof requestImported>[] = [];
    for (const row of await reviewRequests(ctx, args.churchId, args.rows)) {
      if (row.record) await ctx.db.insert("assistanceRequests", { churchId: args.churchId, ...row.record, amountRequested: row.record.importedAmount, decisionNote: "", source: "import", createdBy: member._id });
      if (row.record?.status === "open") await tally(ctx, args.churchId, { waiting: 1, opened: row.record.neighborId });
      results.push({ line: row.line, name: row.name, outcome: row.outcome === "ready" ? "added" : row.outcome });
    }
    const added = results.filter((row) => row.outcome === "added").length;
    if (added) await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: member.userId, action: "requests_imported", targetId: String(added), at: Date.now() });
    return results;
  },
});

/**
 * Bringing over the list of who a conference pays: landlords, utilities and stores, such as ServWare's
 * vendor list. A name already on the list, or twice in the file, is left out. No money and no account
 * numbers come with it: an account belongs to one neighbor and stays on that neighbor's record.
 */
const payeeRow = v.object({ line: v.number(), name: v.string(), type: v.string(), address: v.string(), phone: v.string(), email: v.string(), notes: v.string() });
const payeeProblem = v.union(v.literal("no_name"), v.literal("too_long"), v.literal("repeated"), v.literal("already_here"));
const payeeChecked = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("ready"), payeeProblem) });
const payeeImported = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("added"), payeeProblem) });
const payeeKindOf = (type: string) => (/landlord|rent|housing|apartment|propert|realty|lodging/.test(type) ? "landlord" as const : /utilit|electric|power|water|gas|energy|phone|internet/.test(type) ? "utility" as const : "vendor" as const);

async function reviewPayees(ctx: QueryCtx, churchId: Id<"churches">, rows: Infer<typeof payeeRow>[]) {
  if (rows.length > mostRows) throw new ConvexError(`Bring in up to ${mostRows} payees at a time.`);
  const seen = new Set<string>();
  const results = [];
  for (const row of rows) {
    const name = row.name.trim(), address = row.address.trim(), phone = row.phone.trim(), email = row.email.trim(), notes = row.notes.trim();
    const key = nameKey(name);
    const verdict = (outcome: Infer<typeof payeeChecked>["outcome"]) => ({ line: row.line, name, outcome, record: outcome === "ready" ? { name, nameKey: key, kind: payeeKindOf(`${row.type} ${name}`.toLowerCase()), address, phone, email, notes } : null });
    if (!key) results.push(verdict("no_name"));
    else if (name.length > 120 || address.length > 300 || phone.length > 40 || email.length > 200 || notes.length > 2000) results.push(verdict("too_long"));
    else if (seen.has(key)) results.push(verdict("repeated"));
    else {
      seen.add(key);
      results.push(verdict((await ctx.db.query("payees").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", key)).first()) ? "already_here" : "ready"));
    }
  }
  return results;
}

/** What would happen to each line, without changing anything. */
export const checkPayees = query({
  args: { churchId: v.id("churches"), rows: v.array(payeeRow) },
  returns: v.array(payeeChecked),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    return (await reviewPayees(ctx, args.churchId, args.rows)).map(({ line, name, outcome }) => ({ line, name, outcome }));
  },
});

/** Checks again, then adds every ready line. One entry in the record of who did what says how many came in. */
export const importPayees = mutation({
  args: { churchId: v.id("churches"), rows: v.array(payeeRow) },
  returns: v.array(payeeImported),
  handler: async (ctx, args) => {
    const member = await neighborAccess(ctx, args.churchId);
    const now = Date.now();
    const results: Infer<typeof payeeImported>[] = [];
    for (const row of await reviewPayees(ctx, args.churchId, args.rows)) {
      if (row.record) await ctx.db.insert("payees", { churchId: args.churchId, ...row.record, createdBy: member._id, createdAt: now });
      results.push({ line: row.line, name: row.name, outcome: row.outcome === "ready" ? "added" : row.outcome });
    }
    const added = results.filter((row) => row.outcome === "added").length;
    if (added) await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: member.userId, action: "payees_imported", targetId: String(added), at: now });
    return results;
  },
});

/** The conference's payees by name, for offering where a payee is typed. Coordinators and owners only. */
export const payees = query({
  args: { churchId: v.id("churches") },
  returns: v.array(v.object({ id: v.id("payees"), name: v.string(), kind: v.union(v.literal("landlord"), v.literal("utility"), v.literal("vendor")), phone: v.string() })),
  handler: async (ctx, args) => {
    await neighborAccess(ctx, args.churchId);
    const rows = await ctx.db.query("payees").withIndex("by_church", (q) => q.eq("churchId", args.churchId)).take(500);
    return rows.map((row) => ({ id: row._id, name: row.name, kind: row.kind, phone: row.phone }));
  },
});

/**
 * The way out: an owner takes the conference's own records away as spreadsheets, a page at a time so a
 * large conference never times out. Nothing is sent anywhere; the pages go to the owner's own browser and
 * become files on that device. The column names are the ones the imports above read, so a file taken out
 * here comes back in here. An account number leaves with only its last four digits.
 */
const exportFile = v.union(
  v.literal("neighbors"), v.literal("notes"), v.literal("calls"), v.literal("requests"), v.literal("visits"),
  v.literal("ledger"), v.literal("deposits"), v.literal("statements"), v.literal("vouchers"), v.literal("payees"), v.literal("referrals"),
  v.literal("members"), v.literal("teams"), v.literal("commitments"), v.literal("history"),
);
const exportColumns = {
  neighbors: ["Name", "Phone", "Email", "Address", "Adults", "Children", "Language", "Notes", "Alert", "Household", "Monthly Income", "Monthly Expenses", "Accounts"],
  requests: ["Name", "Phone", "Request Date", "Request Status", "Assistance Type", "Value", "Payee", "Request Notes", "Outcome", "Amount Requested", "Amount Approved", "Decision Note", "Decided On", "Referrals", "How It Was Entered"],
  visits: ["Name", "Date", "Time", "Status", "Visitors", "Hours", "Miles", "Notes", "Completed On"],
  ledger: ["Date", "In or Out", "Amount", "Category", "Payee", "Memo", "Check Number", "Cleared On", "Neighbor", "Reversal", "Voided"],
  payees: ["Name", "Type", "Address", "Phone", "Email", "Notes"],
  members: ["Name", "Email", "Role", "Active", "Approved", "Language"],
  notes: ["Name", "Date", "Note", "Written By"],
  calls: ["Date", "Time", "Caller", "Phone", "Neighbor", "What They Said", "Call Back", "Taken By", "Returned By", "Returned On", "Outcome", "Urgent"],
  deposits: ["Date", "Total", "Memo", "Recorded By"],
  statements: ["Statement Ends", "Bank Balance", "Agreed By", "Agreed On"],
  vouchers: ["Date", "Received", "Given", "Item", "Note", "Recorded By"],
  referrals: ["Name", "Phone", "Helps With"],
  teams: ["Team", "About", "Member", "Team Role", "Status"],
  commitments: ["Date", "Start", "End", "Title", "Team", "Location", "Who", "Coordinator", "Cancelled"],
  history: ["Date", "Time", "Who", "What"],
} as const;
const languageNames = { en: "English", es: "Spanish" } as const;
const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const dollars = (cents: number | undefined) => (cents === undefined ? "" : (cents / 100).toFixed(2));
const yesNo = (value: boolean) => (value ? "Yes" : "No");
/** A stored day, 2026-03-17, the way the other dates in these files read: 03/17/2026. */
const plainDay = (stored: string | undefined) => stored?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1") ?? "";
/** A word the software keeps for itself, such as shut_off or removePerson, as a person would write it. */
const plainWords = (code: string) => title(code.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]+/g, " ").toLowerCase());
const urgentWords: Record<string, string> = {
  shutoff: "Shut-off notice", eviction: "Eviction notice", noFood: "No food in the house", hungry: "Someone is hungry",
  child: "A child at home", elder: "An older person at home", alone: "Lives alone", medical: "A medical need", marked: "Marked urgent by a person",
};
const historyWords: Record<string, string> = {
  church_created: "Started the conference",
  invitation_created: "Invited someone",
  invitation_accepted: "Accepted an invitation",
  invitation_revoked: "Withdrew an invitation",
  removePerson: "Removed a member",
  "neighbor.opened": "Opened a neighbor’s record",
  "neighbor.removed": "Removed a neighbor’s record",
  neighbors_imported: "Brought in neighbor records",
  requests_imported: "Brought in past requests",
  payees_imported: "Brought in who you pay",
  records_exported: "Took the records out",
  calendar_address_created: "Made a calendar address",
  calendar_address_replaced: "Replaced a calendar address",
  time_off_confirmed: "Confirmed time off",
};
/** "Sample Power, account ending 4821": enough to recognise the account, never enough to use it. */
export const maskedAccount = (account: { kind: string; name: string; accountNumber: string }) => {
  const digits = account.accountNumber.replace(/\s/g, "");
  return `${title(account.kind)}: ${account.name}${digits ? `, account ending ${digits.slice(-4)}` : ""}`;
};

async function ownerExport(ctx: QueryCtx, churchId: Id<"churches">) {
  const member = await neighborAccess(ctx, churchId);
  if (member.role !== "owner") throw new ConvexError("Only an owner can take the records out.");
  const church = await ctx.db.get("churches", churchId);
  if (!church) throw new ConvexError("Group not found.");
  return { member, church };
}

/** Writes down that the records were taken out, and by whom, before the first page is read. Returns the line `exportPage` asks for. */
export const recordExport = mutation({
  args: { churchId: v.id("churches") },
  returns: v.id("auditEvents"),
  handler: async (ctx, args) => {
    const { member } = await ownerExport(ctx, args.churchId);
    return ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: member.userId, action: "records_exported", at: Date.now() });
  },
});

/** One page of one file: its column names, up to 200 lines as text, and where the next page starts. */
export const exportPage = query({
  /** `exported` is the audit line `recordExport` returned to this owner; a page is refused without it. */
  args: { churchId: v.id("churches"), exported: v.id("auditEvents"), file: exportFile, cursor: v.union(v.string(), v.null()) },
  returns: v.object({ columns: v.array(v.string()), rows: v.array(v.array(v.string())), cursor: v.string(), done: v.boolean() }),
  handler: async (ctx, { churchId, exported, file, cursor }) => {
    const { member, church } = await ownerExport(ctx, churchId);
    await auditedBy(ctx, member, exported, "records_exported");
    const page = { cursor, numItems: 200 };
    const day = (time: number | undefined) => (time === undefined ? "" : DateTime.fromMillis(time, { zone: church.timeZone }).toFormat("MM/dd/yyyy"));
    const names = new Map<string, string>();
    const named = async <Id extends string>(id: Id | undefined, read: (id: Id) => Promise<string>) => {
      if (!id) return "";
      if (!names.has(id)) names.set(id, await read(id));
      return names.get(id) ?? "";
    };
    // A neighbor whose record was removed is still named on the lines the year's books keep, by the one phrase.
    const neighborName = (id: Id<"neighbors"> | undefined) => named(id, async (found) => (await ctx.db.get("neighbors", found))?.name ?? REMOVED);
    const memberName = (id: Id<"memberships"> | undefined) => named(id, async (found) => (await ctx.db.get("memberships", found))?.name ?? "");
    const finish = (result: { continueCursor: string; isDone: boolean }, rows: string[][]) => ({ columns: [...exportColumns[file]] as string[], rows, cursor: result.continueCursor, done: result.isDone });

    if (file === "neighbors") {
      const result = await ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      const sum = (lines: { amount: number }[] | undefined) => (lines ? dollars(lines.reduce((total, line) => total + line.amount, 0)) : "");
      return finish(result, result.page.map((row) => [row.name, row.phone, row.email, row.address, String(row.adults), String(row.children), spokenName(row), row.notes, row.alert ?? "",
        (row.household ?? []).map((person) => `${person.relationship}${person.child ? " (child)" : ""}${person.birthYear ? `, born ${person.birthYear}` : ""}`).join("; "),
        sum(row.money?.income), sum(row.money?.expenses), (row.accounts ?? []).map(maskedAccount).join("; ")]));
    }
    if (file === "requests") {
      const result = await ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => {
        const neighbor = await ctx.db.get("neighbors", row.neighborId);
        const given = row.importedAmount ?? (row.status === "paid" ? row.amountApproved : undefined);
        return [neighbor?.name ?? REMOVED, neighbor?.phone ?? "", day(row.createdAt), row.status === "open" ? "Open" : "Completed", title(row.kind), dollars(given), row.payeeName, row.summary, title(row.status),
          dollars(row.amountRequested), dollars(row.amountApproved), row.decisionNote, day(row.decidedAt), [...(row.referrals ?? []), ...(row.referral ? [row.referral] : [])].join("; "),
          row.source === "import" ? "Brought over from earlier records" : row.source === "ai_draft" ? "Drafted by the assistant, approved by a person" : "By a person"];
      })));
    }
    if (file === "visits") {
      const result = await ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => [await neighborName(row.neighborId), day(row.scheduledAt), DateTime.fromMillis(row.scheduledAt, { zone: church.timeZone }).toFormat("h:mm a"), title(row.status),
        (await Promise.all(row.visitors.map((visitor) => memberName(visitor.memberId)))).join("; "), String(row.visitors.reduce((total, visitor) => total + visitor.hours, 0)), String(row.visitors.reduce((total, visitor) => total + visitor.miles, 0)), row.notes, day(row.completedAt)])));
    }
    if (file === "ledger") {
      const result = await ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => [plainDay(row.date), row.kind === "income" ? "Money in" : "Money out", dollars(row.amount), title(row.category), row.payee, row.memo, row.checkNumber ?? "", plainDay(row.clearedOn), await neighborName(row.neighborId), yesNo(Boolean(row.reverses)), yesNo(Boolean(row.voidedAt))])));
    }
    if (file === "payees") {
      const result = await ctx.db.query("payees").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, result.page.map((row) => [row.name, title(row.kind), row.address, row.phone, row.email, row.notes]));
    }
    const clock = (time: number | undefined) => (time === undefined ? "" : DateTime.fromMillis(time, { zone: church.timeZone }).toFormat("h:mm a"));
    if (file === "notes") {
      const result = await ctx.db.query("neighborNotes").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => [await neighborName(row.neighborId), day(row.createdAt), row.body, await memberName(row.authorId)])));
    }
    if (file === "calls") {
      const result = await ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      const callBack = { none: "Not needed", needed: "Still needed", done: "Returned" } as const;
      return finish(result, await Promise.all(result.page.map(async (row) => [day(row.takenAt), clock(row.takenAt), row.callerName || ((await neighborName(row.neighborId)) === REMOVED ? REMOVED : ""), row.phone, await neighborName(row.neighborId), row.note, callBack[row.callback],
        await memberName(row.takenBy), await memberName(row.returnedBy), day(row.returnedAt), row.outcome ?? "", row.urgent ? row.urgent.reasons.map((reason) => urgentWords[reason] ?? plainWords(reason)).join("; ") || "Yes" : ""])));
    }
    if (file === "deposits") {
      const result = await ctx.db.query("deposits").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => [plainDay(row.date), dollars(row.total), row.memo, await memberName(row.recordedBy)])));
    }
    if (file === "statements") {
      const result = await ctx.db.query("bankStatements").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => [plainDay(row.endsOn), dollars(row.balance), await memberName(row.agreedBy), day(row.agreedAt)])));
    }
    if (file === "vouchers") {
      const result = await ctx.db.query("voucherStock").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => [plainDay(row.date), row.change > 0 ? String(row.change) : "", row.change < 0 ? String(-row.change) : "", row.item, row.note, await memberName(row.recordedBy)])));
    }
    if (file === "referrals") {
      const result = await ctx.db.query("referralAgencies").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, result.page.map((row) => [row.name, row.phone, row.helpsWith]));
    }
    if (file === "teams") {
      // One line per person on a team, so the file shows who served where.
      const result = await ctx.db.query("teamMembers").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => {
        const team = await ctx.db.get("teams", row.teamId);
        return [team?.name ?? "", team?.description ?? "", await memberName(row.memberId), title(row.teamRole), title(row.status)];
      })));
    }
    if (file === "commitments") {
      const result = await ctx.db.query("commitments").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      return finish(result, await Promise.all(result.page.map(async (row) => [day(row.start), clock(row.start), clock(row.end), row.title, (await ctx.db.get("teams", row.teamId))?.name ?? "", row.location,
        row.assigneeId ? await memberName(row.assigneeId) : "Open", await memberName(row.coordinatorId), yesNo(Boolean(row.cancelled))])));
    }
    if (file === "history") {
      // Who did what and when, in plain words. It names the action only, never the record it touched.
      const result = await ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
      const people = new Map((await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1000)).map((member) => [member.userId, member.name]));
      return finish(result, result.page.map((row) => [day(row.at), clock(row.at), people.get(row.actorId) ?? "", historyWords[row.action] ?? plainWords(row.action)]));
    }
    const result = await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).paginate(page);
    return finish(result, result.page.map((row) => [row.name, row.email, title(row.role), yesNo(row.active), yesNo(row.approved), row.language ? languageNames[row.language] : ""]));
  },
});
