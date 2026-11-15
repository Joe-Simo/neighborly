import { v, type Infer } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, query } from "./_generated/server";
import { membership } from "./access";

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

/** What would happen to each row, without changing anything. The screen shows this before the owner says yes. */
export const checkMembers = query({
  args: { churchId: v.id("churches"), rows: v.array(memberRow) },
  returns: v.array(checked),
  handler: async (ctx, args) => {
    const me = await membership(ctx, args.churchId);
    if (me.role !== "owner") throw new Error("Owner access required.");
    if (args.rows.length > mostRows) throw new Error(`Bring in up to ${mostRows} people at a time.`);
    const [members, invitations] = await Promise.all([
      ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", args.churchId)).take(1001),
      ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", args.churchId)).take(1001),
    ]);
    if (members.length > 1000 || invitations.length > 1000) throw new Error("This group is too large to check a file against. Invite people one at a time.");
    const now = Date.now();
    const joined = new Set(members.map((member) => normalizeEmail(member.email)));
    const waiting = new Set(invitations.filter((invite) => invite.status === "pending" && invite.expiresAt > now).map((invite) => invite.email));
    const seen = new Set<string>();
    return args.rows.map((row) => {
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
  },
});

/**
 * Invites every ready row and reports every row. Each invitation's private link token is returned once,
 * for the owner to pass on by hand while no sending address is set up.
 * Running the same batch twice invites nobody twice.
 */
export const importMembers = action({
  args: { churchId: v.id("churches"), batchId: v.string(), rows: v.array(memberRow) },
  returns: v.array(imported),
  handler: async (ctx, args): Promise<Infer<typeof imported>[]> => {
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(args.batchId)) throw new Error("Invalid batch identifier.");
    const rows: Infer<typeof checked>[] = await ctx.runQuery(api.importExport.checkMembers, { churchId: args.churchId, rows: args.rows });
    const results: Infer<typeof imported>[] = [];
    for (const row of rows) {
      if (row.outcome !== "ready") { results.push({ line: row.line, name: row.name, email: row.email, outcome: row.outcome, token: null }); continue; }
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const record = await ctx.runMutation(internal.invitations.createRecord, { churchId: args.churchId, email: row.email, role: row.role, requestId: `${args.batchId}_${row.line}`, tokenHash, token });
      results.push({ line: row.line, name: row.name, email: row.email, outcome: record.created ? "invited" : "already_invited", token: record.created ? token : null });
    }
    return results;
  },
});
