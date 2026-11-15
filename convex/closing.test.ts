/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { swept } from "./closing";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const tables = Object.keys(schema.tables) as TableNames[];

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

/** A whole made-up conference with a year in every room, turned into a real one, beside another that must not be touched. */
async function setup() {
  const t = convexTest(schema, modules);
  const people = await t.run(async (ctx) => {
    const join = async (churchId: Awaited<ReturnType<typeof ctx.db.insert<"churches">>>, name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      return { userId, memberId: await ctx.db.insert("memberships", { churchId, userId, name, email: `${userId}@neighborly.example`, role, active: true, approved: true, coverOptIn: false }) };
    };
    const other = await ctx.db.insert("churches", { name: "Example Conference", timeZone: "UTC" });
    const stranger = await join(other, "Victor Salgado", "owner");
    await ctx.db.insert("neighbors", { churchId: other, name: "Celeste Greenhalgh", nameKey: "celeste greenhalgh", phone: "(100) 555-0102", phoneKey: "1005550102", email: "", address: "31 Demo Ct", adults: 1, children: 0, language: "en", notes: "", createdBy: stranger.memberId, createdAt: 0 });
    return { other, stranger, owner: { userId: await ctx.db.insert("users", {}) } };
  });
  const churchId = await t.mutation(internal.sampleData.load, { owner: { userId: people.owner.userId, name: "Marisol Vega", email: "owner@neighborly.example" } });
  const rest = await t.run(async (ctx) => {
    await ctx.db.patch("churches", churchId, { sample: undefined, name: "St. Example Conference" });
    const members = await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect();
    const owner = members.find((member) => member.role === "owner")!, coordinator = members.find((member) => member.role === "coordinator")!, member = members.find((one) => one.role === "member")!;
    // What a year of sample activity does not happen to leave behind, so that every table has a row to lose.
    const now = Date.now(), by = { createdBy: owner._id, createdAt: now };
    const neighbor = (await ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", churchId)).first())!;
    const call = (await ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", churchId)).first())!;
    const commitment = (await ctx.db.query("commitments").withIndex("by_church", (q) => q.eq("churchId", churchId)).first())!;
    const team = (await ctx.db.query("teams").withIndex("by_church", (q) => q.eq("churchId", churchId)).first())!;
    const meeting = await ctx.db.insert("meetings", { churchId, fanoutStatus: "complete", cutoff: now, title: "Monthly meeting", start: now, end: now + 3600000, location: "Parish hall" });
    const invitation = await ctx.db.insert("invitations", { churchId, email: "new@neighborly.example", role: "member", tokenHash: "hash", expiresAt: now + 86400000, status: "pending", createdBy: owner._id, createdAt: now, requestId: "one" });
    const seeds: { [Table in (typeof swept)[number]]?: () => Promise<unknown> } = {
      meetingInvitees: () => ctx.db.insert("meetingInvitees", { churchId, meetingId: meeting, memberId: member._id }),
      meetingResponses: () => ctx.db.insert("meetingResponses", { churchId, meetingId: meeting, memberId: member._id, response: "accepted" }),
      outbox: () => ctx.db.insert("outbox", { churchId, invitationId: invitation, kind: "invitation", recipient: "new@neighborly.example", state: "awaiting_configuration", createdAt: now }),
      calendarFeeds: () => ctx.db.insert("calendarFeeds", { churchId, memberId: member._id, token: "feed-token", createdAt: now }),
      commitmentHistory: () => ctx.db.insert("commitmentHistory", { churchId, commitmentId: commitment._id, actorId: owner.userId, action: "revised", version: 1, title: commitment.title, start: commitment.start, end: commitment.end, location: "", preparation: "", assigneeId: null, at: now }),
      requests: () => ctx.db.insert("requests", { churchId, commitmentId: commitment._id, recipientId: member._id, commitmentVersion: 1, status: "pending" }),
      series: () => ctx.db.insert("series", { churchId, teamId: team._id, intervalWeeks: 1, count: 4 }),
      neighborNotes: () => ctx.db.insert("neighborNotes", { churchId, neighborId: neighbor._id, body: "Prefers a call after five.", authorId: owner._id, createdAt: now }),
      requestDrafts: () => ctx.db.insert("requestDrafts", { churchId, callId: call._id, payeeName: "", quote: "behind on rent", notes: [], verification: "review", ...by }),
      referralAgencies: () => ctx.db.insert("referralAgencies", { churchId, name: "211", phone: "211", helpsWith: "Rent" }),
      payees: () => ctx.db.insert("payees", { churchId, kind: "utility", name: "Example Power", nameKey: "example power", address: "", phone: "", email: "", notes: "", ...by }),
      aiUsageByChurch: () => ctx.db.insert("aiUsageByChurch", { churchId, month: "2026-11", count: 3 }),
      auditEvents: () => ctx.db.insert("auditEvents", { churchId, actorId: owner.userId, action: "neighbor.opened", targetId: neighbor._id, at: now }),
      availability: () => ctx.db.insert("availability", { churchId, memberId: member._id, start: "2026-11-01", end: "2026-11-02" }),
    };
    for (const table of swept) {
      const has = (await ctx.db.query(table).collect()).some((row) => row.churchId === churchId);
      if (!has) await seeds[table]?.();
    }
    return { coordinator, member };
  });
  return { t, churchId, ...people, ...rest, as: (person: { userId: string }) => signedIn(t, person.userId) };
}

const all = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
  t.run(async (ctx) => Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await ctx.db.query(table).collect()] as const))));

describe("closing a conference for good", () => {
  test("the sweep names every table that holds a conference's rows", () => {
    const held = tables.filter((table) => "churchId" in schema.tables[table].validator.fields);
    expect([...swept].sort()).toEqual(held.sort());
  });

  test("no row is left in any table, and another conference is untouched", async () => {
    const { t, churchId, owner, member, other, as } = await setup();
    const before = await all(t);
    for (const table of swept) expect(before[table].some((row) => "churchId" in row && row.churchId === churchId), table).toBe(true);
    const others = (rows: typeof before) => Object.fromEntries(tables.filter((table) => table !== "users").map((table) => [table, rows[table].filter((row) => !("churchId" in row) ? table !== "churches" || row._id !== churchId : row.churchId !== churchId)]));

    await as(owner).mutation(api.closing.close, { churchId, typedName: " st example  conference " });
    // The door is shut at once, before the sweep has run: the plain not-found a stranger would get.
    await expect(as({ userId: member.userId }).query(api.workspace.dashboard, { churchId })).rejects.toThrow("Workspace access required.");
    await expect(as(owner).query(api.neighbors.list, { churchId })).rejects.toThrow("Workspace access required.");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const after = await all(t);
    expect(JSON.stringify(after)).not.toContain(churchId);
    for (const table of swept) expect(after[table].filter((row) => "churchId" in row && row.churchId === churchId), table).toEqual([]);
    expect(after.churches.map((church) => church._id)).toEqual([other]);
    expect(others(after)).toEqual(others(before));
    // Accounts belong to the people, not to the conference: they keep theirs.
    expect(after.users.map((user) => user._id)).toEqual(before.users.map((user) => user._id));
    expect((await as(owner).query(api.workspace.viewer, {})).churches).toEqual([]);
  });

  test("only an owner, only with the name, and never the sample", async () => {
    const { t, churchId, owner, coordinator, member, other, stranger, as } = await setup();
    const args = { churchId, typedName: "St. Example Conference" };
    await expect(as({ userId: member.userId }).mutation(api.closing.close, args)).rejects.toThrow("Only an owner can close a conference.");
    await expect(as({ userId: coordinator.userId }).mutation(api.closing.close, args)).rejects.toThrow("Only an owner can close a conference.");
    await expect(as(stranger).mutation(api.closing.close, args)).rejects.toThrow("Workspace access required.");
    await expect(as(owner).mutation(api.closing.close, { churchId: other, typedName: "Example Conference" })).rejects.toThrow("Workspace access required.");
    await expect(as(owner).mutation(api.closing.close, { churchId, typedName: "St. Example" })).rejects.toThrow("Type the conference’s name as it is written.");
    await t.run((ctx) => ctx.db.patch("churches", churchId, { sample: true }));
    await expect(as(owner).mutation(api.closing.close, args)).rejects.toThrow("The sample conference cannot be closed.");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get("churches", churchId))).not.toBeNull();
  });
});
