/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, queryGeneric } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const person = (subject: string, email: string, emailVerified = true) => ({ subject, email, emailVerified });

/** A group whose owner made their account before Clerk. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
    const earlier = await ctx.db.insert("users", { legacyEmail: "ana@example.org" });
    await ctx.db.insert("memberships", { churchId: church, userId: earlier, name: "Ana Sample", email: "ana@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
    return { church, earlier };
  });
  const users = () => t.run((ctx) => ctx.db.query("users").collect());
  return { t, ids, users };
}

describe("arriving through Clerk", () => {
  test("someone with an earlier account gets the same row back, memberships and all", async () => {
    const { t, ids, users } = await setup();
    const ana = t.withIdentity(person("user_ana", "Ana@Example.org"));
    await expect(ana.query(api.access.canOpenNeighborRecords, { churchId: ids.church })).rejects.toThrow("Sign in required.");
    await ana.mutation(api.users.enter, {});
    expect(await users()).toEqual([expect.objectContaining({ _id: ids.earlier, clerkId: "user_ana" })]);
    expect((await users())[0]).not.toHaveProperty("legacyEmail");
    expect(await ana.query(api.access.canOpenNeighborRecords, { churchId: ids.church })).toBe(true);
  });

  test("an unverified email claims nothing and creates nothing", async () => {
    const { t, users } = await setup();
    await expect(t.withIdentity(person("user_x", "ana@example.org", false)).mutation(api.users.enter, {})).rejects.toThrow("A verified email is required.");
    await expect(t.mutation(api.users.enter, {})).rejects.toThrow("Sign in required.");
    expect(await users()).toHaveLength(1);
    expect((await users())[0].clerkId).toBeUndefined();
  });

  test("a row that belongs to a Clerk account is never handed to another, even with the same email", async () => {
    const { t, ids, users } = await setup();
    await t.withIdentity(person("user_ana", "ana@example.org")).mutation(api.users.enter, {});
    const later = t.withIdentity(person("user_other", "ana@example.org"));
    await later.mutation(api.users.enter, {});
    const rows = await users();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row._id === ids.earlier)?.clerkId).toBe("user_ana");
    await expect(later.query(api.access.canOpenNeighborRecords, { churchId: ids.church })).rejects.toThrow("Workspace access required.");
  });

  test("a new person gets one row however many times they arrive", async () => {
    const { t, users } = await setup();
    const ben = t.withIdentity(person("user_ben", "ben@example.org"));
    await ben.mutation(api.users.enter, {});
    await ben.mutation(api.users.enter, {});
    expect((await users()).filter((row) => row.clerkId === "user_ben")).toHaveLength(1);
  });
});

test("the earlier sign-in store's verified emails are copied onto their accounts once", async () => {
  const t = convexTest(schema, modules);
  const stored = new Map<string, string>();
  t.registerComponent("authEmail", defineSchema({}), { "./_generated/server.js": async () => ({}), "./verifiedEmails.ts": async () => ({ getPrimaryEmail: queryGeneric({ args: { userId: v.string() }, handler: async (_, { userId }) => stored.get(userId) ?? null }) }) });
  const ids = await t.run(async (ctx) => ({ verified: await ctx.db.insert("users", {}), sample: await ctx.db.insert("users", {}), arrived: await ctx.db.insert("users", { clerkId: "user_c" }) }));
  stored.set(ids.verified, " Ana@Example.org ");
  stored.set(ids.arrived, "c@example.org");
  await t.mutation(internal.users.keepLegacyEmails, {});
  const rows = await t.run((ctx) => ctx.db.query("users").collect());
  expect(rows.find((row) => row._id === ids.verified)?.legacyEmail).toBe("ana@example.org");
  expect(rows.find((row) => row._id === ids.sample)?.legacyEmail).toBeUndefined();
  expect(rows.find((row) => row._id === ids.arrived)?.legacyEmail).toBeUndefined();
});
