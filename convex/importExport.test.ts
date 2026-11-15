/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, queryGeneric } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const empty = defineSchema({});
  t.registerComponent("auth", empty, { "./_generated/server.js": async () => ({}), "./public.ts": async () => ({ getSession: queryGeneric({ args: { sessionId: v.string() }, handler: async (_, { sessionId }) => (emails.has(sessionId) ? { userId: sessionId } : null) }) }) });
  t.registerComponent("authEmail", empty, { "./_generated/server.js": async () => ({}), "./verifiedEmails.ts": async () => ({ getPrimaryEmail: queryGeneric({ args: { userId: v.string() }, handler: async (_, { userId }) => emails.get(userId) ?? null }) }) });
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: "America/New_York" });
    const join = async (name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: church, userId, name, email: `${name.toLowerCase()}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await join("Marisol", "owner"), coordinator = await join("Thomas", "coordinator"), member = await join("Renee", "member");
    await ctx.db.insert("invitations", { churchId: church, email: "walter@neighborly.example", role: "member", tokenHash: "a".repeat(64), expiresAt: Date.now() + 86400000, status: "pending", createdBy: owner.memberId, createdAt: Date.now(), requestId: "earlier-invitation-0001" });
    return { church, owner, coordinator, member };
  });
  for (const person of [ids.owner, ids.coordinator, ids.member]) emails.set(person.userId, `${person.userId}@neighborly.example`);
  return { t, ids, as: (person: { userId: string }) => t.withIdentity({ subject: person.userId }) };
}
const batchId = "batch-0000-0000-0001";
const sheet = [
  { line: 2, name: "Hannah Lindqvist", email: " Hannah.Lindqvist@Neighborly.example ", role: "" },
  { line: 3, name: "Victor Salgado", email: "victor.salgado-at-neighborly.example", role: "" },
  { line: 4, name: "Priya Raman", email: "priya.raman@neighborly.example", role: "Coordinator" },
  { line: 5, name: "", email: "nameless@neighborly.example", role: "" },
  { line: 6, name: "Hannah L.", email: "hannah.lindqvist@neighborly.example", role: "" },
  { line: 7, name: "Thomas Okafor", email: "thomas@neighborly.example", role: "" },
  { line: 8, name: "Walter Brzezinski", email: "walter@neighborly.example", role: "" },
  { line: 9, name: "Colleen Marsh", email: "colleen.marsh@neighborly.example", role: "treasurer" },
];

describe("bringing members in from a spreadsheet", () => {
  test("a file with bad rows imports the good rows and reports each bad one", async () => {
    const { t, ids, as } = await setup();
    const results = await as(ids.owner).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet });
    expect(results.map((row) => [row.line, row.outcome])).toEqual([[2, "invited"], [3, "bad_email"], [4, "invited"], [5, "no_name"], [6, "repeated"], [7, "already_member"], [8, "already_invited"], [9, "bad_role"]]);
    for (const row of results) expect(row.token === null).toBe(row.outcome !== "invited");
    for (const row of results.filter((row) => row.token)) expect(row.token).toMatch(/^[0-9a-f]{64}$/);

    const invitations = await t.run((ctx) => ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect());
    expect(invitations.map((invite) => [invite.email, invite.role, invite.status]).sort()).toEqual([
      ["hannah.lindqvist@neighborly.example", "member", "pending"],
      ["priya.raman@neighborly.example", "coordinator", "pending"],
      ["walter@neighborly.example", "member", "pending"],
    ]);
    // Nobody is added on their behalf, and the link token itself is never stored.
    expect(await t.run((ctx) => ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).toHaveLength(3);
    for (const row of results.filter((row) => row.token)) expect(invitations.some((invite) => invite.tokenHash === row.token)).toBe(false);
  });

  test("checking a file changes nothing, and sending the same file twice invites nobody twice", async () => {
    const { t, ids, as } = await setup();
    const count = () => t.run(async (ctx) => (await ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect()).length);
    const preview = await as(ids.owner).query(api.importExport.checkMembers, { churchId: ids.church, rows: sheet });
    expect(preview.filter((row) => row.outcome === "ready").map((row) => row.email)).toEqual(["hannah.lindqvist@neighborly.example", "priya.raman@neighborly.example"]);
    expect(await count()).toBe(1);
    await as(ids.owner).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet });
    const again = await as(ids.owner).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet });
    expect(again.filter((row) => row.outcome === "invited")).toEqual([]);
    expect(again.find((row) => row.line === 2)?.outcome).toBe("already_invited");
    expect(await count()).toBe(3);
  });

  test("only the owner may bring people in", async () => {
    const { t, ids, as } = await setup();
    for (const person of [ids.coordinator, ids.member]) {
      await expect(as(person).query(api.importExport.checkMembers, { churchId: ids.church, rows: sheet })).rejects.toThrow("Owner access required.");
      await expect(as(person).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet })).rejects.toThrow("Owner access required.");
    }
    await expect(t.action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet })).rejects.toThrow("Sign in required.");
    const tooMany = Array.from({ length: 301 }, (_, index) => ({ line: index + 2, name: "Sample Person", email: `person${index}@neighborly.example`, role: "" }));
    await expect(as(ids.owner).query(api.importExport.checkMembers, { churchId: ids.church, rows: tooMany })).rejects.toThrow("up to 300");
  });
});
