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
  const known = new Set<string>();
  const empty = defineSchema({});
  t.registerComponent("auth", empty, { "./_generated/server.js": async () => ({}), "./public.ts": async () => ({ getSession: queryGeneric({ args: { sessionId: v.string() }, handler: async (_, { sessionId }) => (known.has(sessionId) ? { userId: sessionId } : null) }) }) });
  t.registerComponent("authEmail", empty, { "./_generated/server.js": async () => ({}), "./verifiedEmails.ts": async () => ({ getPrimaryEmail: queryGeneric({ args: { userId: v.string() }, handler: async (_, { userId }) => (known.has(userId) ? "sample@example.org" : null) }) }) });
  const ids = await t.run(async ctx => {
    const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
    const elsewhere = await ctx.db.insert("churches", { name: "Elsewhere", timeZone: "UTC" });
    const join = async (name: string) => {
      const userId = await ctx.db.insert("users", {});
      return { userId, memberId: await ctx.db.insert("memberships", { churchId, userId, name, email: `${name}@example.org`, role: "member", active: true, approved: true, coverOptIn: false }) };
    };
    return { churchId, elsewhere, graciela: await join("graciela"), thomas: await join("thomas") };
  });
  known.add(ids.graciela.userId); known.add(ids.thomas.userId);
  return { t, ids, as: (person: { userId: string }) => t.withIdentity({ subject: person.userId }) };
}

describe("choosing a language", () => {
  test("changes the caller's own membership and no one else's", async () => {
    const { t, ids, as } = await setup();
    await as(ids.graciela).mutation(api.language.choose, { churchId: ids.churchId, language: "es" });
    expect((await t.run(ctx => ctx.db.get("memberships", ids.graciela.memberId)))?.language).toBe("es");
    expect((await t.run(ctx => ctx.db.get("memberships", ids.thomas.memberId)))?.language).toBeUndefined();
  });

  test("is refused to a visitor and to someone outside the group", async () => {
    const { t, ids, as } = await setup();
    await expect(t.mutation(api.language.choose, { churchId: ids.churchId, language: "ht" })).rejects.toThrow("Sign in required.");
    await expect(as(ids.graciela).mutation(api.language.choose, { churchId: ids.elsewhere, language: "ht" })).rejects.toThrow("Workspace access required.");
  });
});
