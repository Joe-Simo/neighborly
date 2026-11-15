import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { membership, neighborAccess } from "./access";
import { nameKey, phoneKey } from "./assistance";

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
  if (me.role !== "owner") throw new Error("Owner access required.");
  if (rows.length > mostRows) throw new Error(`Bring in up to ${mostRows} people at a time.`);
  const [members, invitations] = await Promise.all([
    ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1001),
    ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1001),
  ]);
  if (members.length > 1000 || invitations.length > 1000) throw new Error("This group is too large to check a file against. Invite people one at a time.");
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
    if (args.rows.length > mostRows) throw new Error(`Bring in up to ${mostRows} people at a time.`);
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
const neighborProblem = v.union(v.literal("no_name"), v.literal("too_long"), v.literal("bad_count"), v.literal("bad_language"), v.literal("repeated"), v.literal("same_phone"), v.literal("same_name"));
const neighborChecked = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("ready"), neighborProblem) });
const neighborImported = v.object({ line: v.number(), name: v.string(), outcome: v.union(v.literal("added"), neighborProblem) });
const languages = new Map([["", "en"], ["en", "en"], ["english", "en"], ["es", "es"], ["spanish", "es"], ["espanol", "es"], ["español", "es"], ["ht", "ht"], ["creole", "ht"], ["haitian creole", "ht"], ["kreyol", "ht"], ["kreyòl", "ht"]] as const);
type Language = "en" | "es" | "ht";

async function reviewNeighbors(ctx: QueryCtx, churchId: Id<"churches">, rows: Infer<typeof neighborRow>[]) {
  if (rows.length > mostRows) throw new Error(`Bring in up to ${mostRows} neighbors at a time.`);
  const seenPhones = new Set<string>(), seenNames = new Set<string>();
  const count = (value: string, empty: number, least: number) => {
    const number = value.trim() === "" ? empty : Number(value.trim());
    return Number.isInteger(number) && number >= least && number <= 30 ? number : null;
  };
  return Promise.all(rows.map(async (row) => {
    const name = row.name.trim(), phone = row.phone.trim(), email = row.email.trim(), address = row.address.trim(), notes = row.notes.trim();
    const keys = { nameKey: nameKey(name), phoneKey: phoneKey(phone) };
    const verdict = (outcome: Infer<typeof neighborChecked>["outcome"], record: { adults: number; children: number; language: Language } | null = null) => ({ line: row.line, name, outcome, record: record && { name, ...keys, phone, email, address, notes, ...record } });
    if (!name || !keys.nameKey) return verdict("no_name");
    if (name.length > 120 || phone.length > 40 || email.length > 200 || address.length > 300 || notes.length > 2000) return verdict("too_long");
    const adults = count(row.adults, 1, 1), children = count(row.children, 0, 0);
    if (adults === null || children === null) return verdict("bad_count");
    const language: Language | undefined = languages.get(row.language.trim().toLowerCase() as never);
    if (!language) return verdict("bad_language");
    // The same order as adding one neighbor by hand: a shared phone number first, then a shared name.
    if ((keys.phoneKey && seenPhones.has(keys.phoneKey)) || seenNames.has(keys.nameKey)) return verdict("repeated");
    if (keys.phoneKey) seenPhones.add(keys.phoneKey);
    seenNames.add(keys.nameKey);
    if (keys.phoneKey && (await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", keys.phoneKey)).first())) return verdict("same_phone");
    if (await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).eq("nameKey", keys.nameKey)).first()) return verdict("same_name");
    return verdict("ready", { adults, children, language });
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
    if (added) await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: member.userId, action: "neighbors_imported", targetId: String(added), at: now });
    return results;
  },
});
