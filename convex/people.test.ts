/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

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
