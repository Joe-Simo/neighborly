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

const blank = { phone: "", email: "", address: "", adults: "", children: "", language: "", notes: "" };
const households = [
  { line: 2, ...blank, name: "Alma Almonte", phone: "(555) 0100", address: "12 Sample St, Apt 3", adults: "2", children: "3", language: "Spanish", notes: "Prefers a call after 5." },
  { line: 3, ...blank, name: "Benito Castellanos", phone: "555-0142" },
  { line: 4, ...blank, name: "  ", phone: "(555) 0103" },
  { line: 5, ...blank, name: "Celeste Desrosiers", phone: "(555) 0104", adults: "two" },
  { line: 6, ...blank, name: "ALMA  ALMONTE" },
  { line: 7, ...blank, name: "Darnell Eastman", phone: "555.0100" },
  { line: 8, ...blank, name: "celeste hyppolite", phone: "(555) 0199" },
  { line: 9, ...blank, name: "Esperanza Figueroa", language: "Klingon" },
  { line: 10, ...blank, name: "Fabrice Greenhalgh", language: "kreyòl", children: "0" },
];

describe("bringing neighbors in from a spreadsheet", () => {
  async function withNeighbor() {
    const world = await setup();
    await world.t.run((ctx) => ctx.db.insert("neighbors", { churchId: world.ids.church, name: "Celeste Hyppolite", nameKey: "celeste hyppolite", phone: "(555) 0142", phoneKey: "5550142", email: "", address: "412 Placeholder Rd", adults: 1, children: 2, language: "ht", notes: "", createdBy: world.ids.owner.memberId, createdAt: 0 }));
    const neighbors = () => world.t.run((ctx) => ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", world.ids.church)).collect());
    return { ...world, neighbors };
  }

  test("good rows are added; a duplicate phone or name, in the file or on file, is caught and reported", async () => {
    const { ids, as, neighbors } = await withNeighbor();
    const preview = await as(ids.coordinator).query(api.importExport.checkNeighbors, { churchId: ids.church, rows: households });
    expect(preview.map((row) => [row.line, row.outcome])).toEqual([[2, "ready"], [3, "same_phone"], [4, "no_name"], [5, "bad_count"], [6, "repeated"], [7, "repeated"], [8, "same_name"], [9, "bad_language"], [10, "ready"]]);
    expect(await neighbors()).toHaveLength(1);

    const results = await as(ids.coordinator).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households });
    expect(results.map((row) => row.outcome)).toEqual(["added", "same_phone", "no_name", "bad_count", "repeated", "repeated", "same_name", "bad_language", "added"]);
    const added = (await neighbors()).filter((neighbor) => neighbor.name !== "Celeste Hyppolite");
    expect(added).toMatchObject([
      { name: "Alma Almonte", nameKey: "alma almonte", phone: "(555) 0100", phoneKey: "5550100", address: "12 Sample St, Apt 3", adults: 2, children: 3, language: "es", notes: "Prefers a call after 5.", createdBy: ids.coordinator.memberId },
      { name: "Fabrice Greenhalgh", phone: "", phoneKey: "", adults: 1, children: 0, language: "ht" },
    ]);
    // Sending the file again adds nobody: everyone in it is now on file.
    const again = await as(ids.coordinator).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households });
    expect(again.filter((row) => row.outcome === "added")).toEqual([]);
    expect(await neighbors()).toHaveLength(3);
  });

  test("a member is refused, and what comes back never carries more than the name", async () => {
    const { t, ids, as, neighbors } = await withNeighbor();
    const refused = "Neighbor records are open to coordinators and owners only.";
    await expect(as(ids.member).query(api.importExport.checkNeighbors, { churchId: ids.church, rows: households })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households })).rejects.toThrow(refused);
    await expect(t.mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households })).rejects.toThrow("Sign in required.");
    expect(await neighbors()).toHaveLength(1);
    const preview = await as(ids.owner).query(api.importExport.checkNeighbors, { churchId: ids.church, rows: households });
    for (const row of preview) expect(Object.keys(row).sort()).toEqual(["line", "name", "outcome"]);
    const events = async () => (await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).filter((event) => event.action === "neighbors_imported");
    expect(await events()).toHaveLength(0);
    await as(ids.owner).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households });
    expect(await events()).toMatchObject([{ actorId: ids.owner.userId, targetId: "2" }]);
  });
});

describe("bringing past requests over from another system", () => {
  const blank = { phone: "", status: "Completed", type: "Rent", amount: "$1,250.00", payee: "Sample Street Apartments", notes: "Behind after reduced hours" };
  const history = [
    { line: 2, name: "Celeste Hyppolite", date: "03/14/2026", ...blank },
    { line: 3, name: "Someone Else", date: "03/14/2026", ...blank, phone: "(555) 0142", type: "Electric bill", amount: "86.5", status: "Call Back", notes: "" },
    { line: 4, name: "Nestor Orlov", date: "03/14/2026", ...blank },
    { line: 5, name: "Celeste Hyppolite", date: "14 March", ...blank },
    { line: 6, name: "Celeste Hyppolite", date: "03/15/2026", ...blank, amount: "a lot" },
    { line: 7, name: "Celeste Hyppolite", date: "03/15/2026", ...blank, status: "Maybe" },
    { line: 8, name: "Celeste Hyppolite", date: "2026-03-14", ...blank },
    { line: 9, name: "", date: "03/14/2026", ...blank },
  ];
  const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  async function withNeighbor() {
    const world = await setup();
    const neighborId = await world.t.run((ctx) => ctx.db.insert("neighbors", { churchId: world.ids.church, name: "Celeste Hyppolite", nameKey: "celeste hyppolite", phone: "(555) 0142", phoneKey: "5550142", email: "", address: "412 Placeholder Rd", adults: 1, children: 2, language: "ht", notes: "", createdBy: world.ids.owner.memberId, createdAt: 0 }));
    const requests = () => world.t.run((ctx) => ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).collect());
    return { ...world, requests };
  }

  test("history comes in as history: dated, never approved or paid, no ledger entry, and never twice", async () => {
    const { t, ids, as, requests } = await withNeighbor();
    const preview = await as(ids.coordinator).query(api.importExport.checkRequests, { churchId: ids.church, rows: history });
    expect(preview.map((row) => [row.line, row.outcome])).toEqual([[2, "ready"], [3, "ready"], [4, "no_neighbor"], [5, "bad_date"], [6, "bad_amount"], [7, "bad_status"], [8, "repeated"], [9, "no_name"]]);
    for (const row of preview) expect(Object.keys(row).sort()).toEqual(["line", "name", "outcome"]);
    expect(await requests()).toHaveLength(0);

    await as(ids.coordinator).mutation(api.importExport.importRequests, { churchId: ids.church, rows: history });
    const added = await requests();
    expect(added).toMatchObject([
      { source: "import", status: "closed", kind: "rent", payeeKind: "landlord", payeeName: "Sample Street Apartments", importedAmount: 125000, amountRequested: 125000, summary: "Behind after reduced hours", createdBy: ids.coordinator.memberId },
      { source: "import", status: "closed", kind: "utility", payeeKind: "utility", importedAmount: 8650, summary: "Electric bill" },
    ]);
    // Left open in the other system months ago, it is history; only a recent one is still waiting.
    await as(ids.coordinator).mutation(api.importExport.importRequests, { churchId: ids.church, rows: [{ line: 2, name: "Celeste Hyppolite", date: recent, ...blank, status: "Open", type: "Food", amount: "" }] });
    expect((await requests()).at(-1)).toMatchObject({ status: "open", kind: "food", importedAmount: 0 });
    expect(new Date(added[0].createdAt).toISOString()).toBe("2026-03-14T16:00:00.000Z");
    for (const request of added) expect(request.amountApproved).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("ledgerEntries").collect())).toEqual([]);

    const again = await as(ids.coordinator).mutation(api.importExport.importRequests, { churchId: ids.church, rows: history });
    expect(again.slice(0, 2).map((row) => row.outcome)).toEqual(["already_here", "already_here"]);
    expect(await requests()).toHaveLength(3);
    const events = (await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).filter((event) => event.action === "requests_imported");
    expect(events).toMatchObject([{ actorId: ids.coordinator.userId, targetId: "2" }, { targetId: "1" }]);
  });

  test("a member is refused", async () => {
    const { ids, as, requests } = await withNeighbor();
    const refused = "Neighbor records are open to coordinators and owners only.";
    await expect(as(ids.member).query(api.importExport.checkRequests, { churchId: ids.church, rows: history })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.importExport.importRequests, { churchId: ids.church, rows: history })).rejects.toThrow(refused);
    expect(await requests()).toHaveLength(0);
  });
});
