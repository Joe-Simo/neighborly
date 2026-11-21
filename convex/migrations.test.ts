import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

test("every stored Creole becomes another language for a neighbor and is cleared for a member; nothing else moves", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
    const userId = await ctx.db.insert("users", {});
    const member = (language?: "en" | "es" | "ht") => ctx.db.insert("memberships", { churchId, userId, name: "Renee Baptiste", email: "member@neighborly.example", role: "member", active: true, approved: true, coverOptIn: false, language });
    const creator = await member("es");
    const neighbor = (name: string, language: "en" | "es" | "ht" | "other", languageName?: string) =>
      ctx.db.insert("neighbors", { churchId, name, nameKey: name.toLowerCase(), phone: "", phoneKey: "", email: "", address: "", adults: 1, children: 0, language, languageName, notes: "Prefers a call after 5 PM.", createdBy: creator, createdAt: 0 });
    const made = { creole: await neighbor("Fabrice Pemberton", "ht"), spanish: await neighbor("Esperanza Montoya", "es"), german: await neighbor("Celeste Greenhalgh", "other", "German") };
    return { ...made, creoleMember: await member("ht"), spanishMember: creator };
  });
  expect(await t.query(internal.migrations.creoleLeft, {})).toEqual({ neighbors: 1, memberships: 1 });
  await t.mutation(internal.migrations.creoleToOther, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.query(internal.migrations.creoleLeft, {})).toEqual({ neighbors: 0, memberships: 0 });
  await t.run(async (ctx) => {
    expect(await ctx.db.get(ids.creole)).toMatchObject({ language: "other", notes: "Prefers a call after 5 PM." });
    expect((await ctx.db.get(ids.creole))?.languageName).toBeUndefined();
    expect(await ctx.db.get(ids.spanish)).toMatchObject({ language: "es" });
    expect(await ctx.db.get(ids.german)).toMatchObject({ language: "other", languageName: "German" });
    expect((await ctx.db.get(ids.creoleMember))?.language).toBeUndefined();
    expect(await ctx.db.get(ids.spanishMember)).toMatchObject({ language: "es" });
  });
  // A second run finds nothing left to change.
  await t.mutation(internal.migrations.creoleToOther, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.query(internal.migrations.creoleLeft, {})).toEqual({ neighbors: 0, memberships: 0 });
  vi.useRealTimers();
});
