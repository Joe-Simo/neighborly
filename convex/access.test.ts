/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";
import { logNeighborOpening, neighborAccess, neighborRecord } from "./access";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const refused = "Neighbor records are open to coordinators and owners only.";

async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "A", timeZone: "America/New_York" });
    const other = await ctx.db.insert("churches", { name: "B", timeZone: "UTC" });
    const join = async (group: typeof church, role: "owner" | "coordinator" | "member", active = true) => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: group, userId, name: role, email: `${role}@example.org`, role, active, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await join(church, "owner"), coordinator = await join(church, "coordinator"), member = await join(church, "member");
    const removed = await join(church, "coordinator", false), stranger = await join(other, "owner");
    const unverified = await join(church, "owner");
    // A member who coordinates a team is still a member of the group.
    const team = await ctx.db.insert("teams", { churchId: church, name: "Visitors", description: "" });
    await ctx.db.insert("teamMembers", { churchId: church, teamId: team, memberId: member.memberId, teamRole: "coordinator", approved: true, status: "active" });
    const record = (group: typeof church, createdBy: typeof owner.memberId) => ctx.db.insert("neighbors", { churchId: group, name: "Sample Neighbor", nameKey: "sample neighbor", phone: "555-0100", phoneKey: "5550100", email: "", address: "1 Sample St", adults: 1, children: 0, language: "en", notes: "", createdBy, createdAt: 0 });
    return { church, other, owner, coordinator, member, removed, stranger, unverified, neighbor: await record(church, owner.memberId), elsewhere: await record(other, stranger.memberId) };
  });
  for (const person of [ids.owner, ids.coordinator, ids.member, ids.removed, ids.stranger]) emails.set(person.userId, `${person.userId}@example.org`);
  return { t, ids, as: (person: { userId: string }) => signedIn(t, person.userId, emails.has(person.userId)) };
}

describe("who may open a neighbor's record", () => {
  test("owners and coordinators may; members may not, even when they coordinate a team", async () => {
    const { ids, as } = await setup();
    expect(await as(ids.owner).query(api.access.canOpenNeighborRecords, { churchId: ids.church })).toBe(true);
    expect(await as(ids.coordinator).query(api.access.canOpenNeighborRecords, { churchId: ids.church })).toBe(true);
    expect(await as(ids.member).query(api.access.canOpenNeighborRecords, { churchId: ids.church })).toBe(false);
    await expect(as(ids.member).run((ctx) => neighborAccess(ctx, ids.church))).rejects.toThrow(refused);
    await expect(as(ids.member).run((ctx) => neighborRecord(ctx, ids.church, ids.neighbor))).rejects.toThrow(refused);
    expect((await as(ids.coordinator).run((ctx) => neighborRecord(ctx, ids.church, ids.neighbor))).neighbor.name).toBe("Sample Neighbor");
  });

  test("a coordinator waits for the owner's approval before any record opens", async () => {
    const { t, ids, as } = await setup();
    await t.run((ctx) => ctx.db.patch("memberships", ids.coordinator.memberId, { approved: false }));
    expect(await as(ids.coordinator).query(api.access.canOpenNeighborRecords, { churchId: ids.church })).toBe(false);
    await expect(as(ids.coordinator).run((ctx) => neighborRecord(ctx, ids.church, ids.neighbor))).rejects.toThrow(refused);
    await t.run((ctx) => ctx.db.patch("memberships", ids.coordinator.memberId, { approved: true }));
    expect(await as(ids.coordinator).query(api.access.canOpenNeighborRecords, { churchId: ids.church })).toBe(true);
  });

  test("people without a place in the group are refused before the role is considered", async () => {
    const { t, ids, as } = await setup();
    for (const caller of [as(ids.removed), as(ids.stranger)]) {
      await expect(caller.query(api.access.canOpenNeighborRecords, { churchId: ids.church })).rejects.toThrow("Workspace access required.");
      await expect(caller.run((ctx) => neighborAccess(ctx, ids.church))).rejects.toThrow("Workspace access required.");
    }
    await expect(t.query(api.access.canOpenNeighborRecords, { churchId: ids.church })).rejects.toThrow("Sign in required.");
    // An owner whose session the sign-in service does not recognise gets no further than a signed-out visitor.
    await expect(as(ids.unverified).run((ctx) => neighborAccess(ctx, ids.church))).rejects.toThrow("A verified email is required.");
  });

  test("a record from another group cannot be opened through your own", async () => {
    const { ids, as } = await setup();
    await expect(as(ids.owner).run((ctx) => neighborRecord(ctx, ids.church, ids.elsewhere))).rejects.toThrow("Record not found.");
    await expect(as(ids.stranger).run((ctx) => neighborRecord(ctx, ids.church, ids.neighbor))).rejects.toThrow("Workspace access required.");
  });

  test("an opening is written to the audit trail with who and which record", async () => {
    const { t, ids, as } = await setup();
    await as(ids.coordinator).run(async (ctx) => {
      const { member, neighbor } = await neighborRecord(ctx, ids.church, ids.neighbor);
      await logNeighborOpening(ctx, member, neighbor._id);
    });
    const events = await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect());
    expect(events).toMatchObject([{ action: "neighbor.opened", actorId: ids.coordinator.userId, targetId: ids.neighbor }]);
  });
});
