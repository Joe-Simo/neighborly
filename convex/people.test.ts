/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
type Caller = Pick<ReturnType<ReturnType<typeof convexTest>["withIdentity"]>, "query" | "mutation">;
/** Reads a visit sheet the way the screen does: `openSheet` writes the audit line, and `sheet` is read with it. */
async function readSheet(caller: Caller, args: { churchId: Id<"churches">; visitId: Id<"visits"> }) {
  return caller.query(api.visits.sheet, { ...args, opening: await caller.mutation(api.visits.openSheet, args) });
}

test("a member is sent teammates' names and roles, never their email addresses", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const churchId = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: "America/New_York" });
    const teamId = await ctx.db.insert("teams", { churchId, name: "Home visits", description: "" });
    const join = async (name: string, role: "owner" | "coordinator" | "member", teamRole?: "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name, email: `${role}.${name.toLowerCase()}@example.org`, role, active: true, approved: true, coverOptIn: true });
      if (teamRole) await ctx.db.insert("teamMembers", { churchId, teamId, memberId, teamRole, approved: true, status: "active" });
      return userId;
    };
    return { churchId, owner: await join("Olive", "owner"), coordinator: await join("Hannah", "coordinator", "coordinator"), member: await join("Renee", "member", "member"), other: await join("Samuel", "member", "member") };
  });
  const peopleFor = async (userId: string) => (await signedIn(t, userId).query(api.workspace.dashboard, { churchId: ids.churchId })).people;
  const addresses = (people: Awaited<ReturnType<typeof peopleFor>>) => Object.fromEntries(people.map((person) => [person.name, person.email]));

  const seenByMember = await peopleFor(ids.member);
  expect(seenByMember.map((person) => person.name).sort()).toEqual(["Hannah", "Renee", "Samuel"]);
  expect(addresses(seenByMember)).toEqual({ Hannah: "", Samuel: "", Renee: "member.renee@example.org" });
  expect(seenByMember.find((person) => person.name === "Hannah")?.role).toBe("coordinator");

  expect(addresses(await peopleFor(ids.coordinator))).toMatchObject({ Renee: "member.renee@example.org", Samuel: "member.samuel@example.org" });
  expect(Object.values(addresses(await peopleFor(ids.owner))).every((email) => email.endsWith("@example.org"))).toBe(true);
});

import { describe, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import { sampleOwner } from "./demo";
import { formerMember } from "./people";

describe("removing a person for good", () => {
  async function conference() {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(new Date("2026-11-15T15:00:00Z"));
    const t = convexTest(schema, modules);
    const ownerUser = await t.run((ctx) => ctx.db.insert("users", {}));
    const churchId = await t.mutation(internal.sampleData.load, { owner: { userId: ownerUser, ...sampleOwner } });
    // Someone who has done real work in the sample year: a visitor with hours, on a team.
    const person = await t.run(async (ctx) => {
      const visits = await ctx.db.query("visits").collect();
      const members = await ctx.db.query("memberships").collect();
      return members.find((member) => member.role === "member" && visits.some((visit) => visit.visitors.some((visitor) => visitor.memberId === member._id && visitor.hours > 0)))!;
    });
    // And who has left a trace in every table that can hold one.
    await t.run(async (ctx) => {
      const now = Date.now();
      const team = (await ctx.db.query("teams").collect())[0];
      const owner = (await ctx.db.query("memberships").collect()).find((member) => member.role === "owner")!;
      await ctx.db.patch("users", person.userId, { legacyEmail: person.email });
      await ctx.db.insert("timeOff", { churchId, memberId: person._id, start: "2026-12-01", end: "2026-12-05", note: `${person.name} is visiting family` });
      await ctx.db.insert("availability", { churchId, memberId: person._id, start: "2026-11-01", end: "2027-03-01" });
      await ctx.db.insert("calendarFeeds", { churchId, memberId: person._id, token: "feed-token", createdAt: now });
      const future = await ctx.db.insert("commitments", { churchId, teamId: team._id, title: "Pantry shift", start: now + 86_400_000, end: now + 90_000_000, location: "Hall", preparation: "", assigneeId: person._id, coordinatorId: owner._id, version: 1 });
      const open = await ctx.db.insert("commitments", { churchId, teamId: team._id, title: "Help line", start: now + 2 * 86_400_000, end: now + 2 * 86_400_000 + 3_600_000, location: "Office", preparation: "", assigneeId: null, coordinatorId: owner._id, version: 1 });
      const request = await ctx.db.insert("requests", { churchId, commitmentId: open, recipientId: person._id, commitmentVersion: 1, status: "pending" });
      await ctx.db.insert("outbox", { churchId, requestId: request, memberId: person._id, eventKey: `cover:${request}`, kind: "cover_request", recipient: person.email, state: "awaiting_configuration", createdAt: now });
      const invitation = await ctx.db.insert("invitations", { churchId, email: person.email, role: "member", tokenHash: "hash", expiresAt: now, status: "accepted", createdBy: owner._id, acceptedBy: person.userId, createdAt: now, requestId: "first" });
      await ctx.db.insert("outbox", { churchId, invitationId: invitation, kind: "invitation", recipient: person.email, state: "awaiting_configuration", createdAt: now });
      await ctx.db.insert("tasks", { churchId, title: "Call the landlord back", dueAt: null, assigneeId: person._id, complete: false });
      await ctx.db.insert("auditEvents", { churchId, actorId: person.userId, action: "accept", commitmentId: future, at: now });
      await ctx.db.insert("commitmentHistory", { churchId, commitmentId: future, actorId: person.userId, action: "revised", version: 1, title: "Pantry shift", start: now, end: now, location: "Hall", preparation: "", assigneeId: person._id, at: now });
    });
    return { t, churchId, ownerUser, person };
  }

  test("nothing that says who they were is left in any table, and their work still counts", async () => {
    const { t, churchId, ownerUser, person } = await conference();
    const owner = signedIn(t, ownerUser);
    const before = await owner.query(api.reports.year, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId, year: 2026 });

    const visited = await t.run(async (ctx) => (await ctx.db.query("visits").collect()).find((visit) => visit.status === "completed" && visit.visitors.some((visitor) => visitor.memberId === person._id && visitor.hours > 0))!);
    await owner.mutation(api.people.remove, { churchId, personId: person._id, typedName: `  ${person.name.toUpperCase()} ` });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // Every row of every table, read as text: their name, address and account id appear nowhere but on the account itself.
    const left = await t.run(async (ctx) => {
      const found: string[] = [];
      for (const table of Object.keys(schema.tables) as TableNames[]) {
        for (const row of await ctx.db.query(table).collect()) {
          if (row._id === person.userId) continue;
          const text = JSON.stringify(row);
          for (const detail of [person.name, person.email, person.userId]) if (text.includes(detail)) found.push(`${table}: ${detail}`);
        }
      }
      return found;
    });
    expect(left).toEqual([]);

    await t.run(async (ctx) => {
      expect(await ctx.db.get("memberships", person._id)).toMatchObject({ name: formerMember, email: "", active: false, approved: false });
      for (const table of ["teamMembers", "availability", "timeOff", "calendarFeeds"] as const) expect(await ctx.db.query(table).withIndex("by_member", (q) => q.eq("memberId", person._id)).collect()).toEqual([]);
      const promised = await ctx.db.query("commitments").withIndex("by_assignee_end", (q) => q.eq("assigneeId", person._id).gt("end", Date.now())).collect();
      expect(promised).toEqual([]);
      expect((await ctx.db.query("requests").withIndex("by_recipient_status", (q) => q.eq("recipientId", person._id).eq("status", "pending")).collect())).toEqual([]);
      expect((await ctx.db.query("tasks").collect()).filter((task) => task.assigneeId === person._id && !task.complete)).toEqual([]);
    });

    // The year still adds up: same households, visits and hours, with their line under the plain name.
    const after = await owner.query(api.reports.year, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId, year: 2026 });
    expect(after.households).toBe(before.households);
    expect(after.visits).toBe(before.visits);
    expect(after.time.hours).toBe(before.time.hours);
    expect(JSON.stringify(after)).not.toContain(person.name);
    expect(JSON.stringify(after)).toContain(formerMember);

    // A visit they made still opens, and its sheet and the printed members table say the plain name.
    const sheet = await readSheet(owner, { churchId, visitId: visited._id });
    expect(sheet.visitors).toContain(formerMember);
    expect(sheet.visitors).not.toContain(person.name);
    expect(after.time.members.filter((line) => line.name === formerMember)).toHaveLength(1);
    expect(after.time.members.find((line) => line.name === formerMember)?.hours).toBe(before.time.members.find((line) => line.name === person.name)?.hours);

    // They are gone from the list, and their sign-in no longer opens this conference.
    const people = (await owner.query(api.workspace.dashboard, { churchId })).people;
    expect(people.some((row) => row.id === person._id || row.name === formerMember)).toBe(false);
    await expect(signedIn(t, person.userId).query(api.workspace.dashboard, { churchId })).rejects.toThrow("Workspace access required.");
    // Asked without naming one, as the sample door does: the conference they belong to, and nothing once they are gone.
    expect((await owner.query(api.workspace.dashboard, {})).church.id).toBe(churchId);
    await expect(signedIn(t, person.userId).query(api.workspace.dashboard, {})).rejects.toThrow("Workspace access required.");
    vi.useRealTimers();
  });

  test("only the owner can, only with the name typed, and never the owner themself", async () => {
    const { t, churchId, ownerUser, person } = await conference();
    const owner = signedIn(t, ownerUser);
    const { ownerRow, coordinator } = await t.run(async (ctx) => {
      const members = await ctx.db.query("memberships").collect();
      return { ownerRow: members.find((member) => member.role === "owner")!, coordinator: members.find((member) => member.role === "coordinator")! };
    });
    const remove = (as: typeof owner, personId: Id<"memberships">, typedName: string) => as.mutation(api.people.remove, { churchId, personId, typedName });
    await expect(remove(signedIn(t, coordinator.userId), person._id, person.name)).rejects.toThrow("Only the owner can remove a person.");
    await expect(remove(owner, person._id, "someone else")).rejects.toThrow("Type the person’s name exactly to remove them.");
    await expect(remove(owner, ownerRow._id, ownerRow.name)).rejects.toThrow("The owner cannot be removed.");
    expect((await t.run((ctx) => ctx.db.get("memberships", person._id)))?.name).toBe(person.name);
    await remove(owner, person._id, person.name);
    await expect(remove(owner, person._id, formerMember)).rejects.toThrow("This person is not in the conference.");
    vi.useRealTimers();
  });
});
