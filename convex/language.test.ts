import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("the language a person reads in", () => {
  test("the door's language is taken up only by someone who has never chosen, and a choice always stands", async () => {
    const t = convexTest(schema, modules);
    const { churchId, memberId } = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|member" });
      return { churchId, memberId: await ctx.db.insert("memberships", { churchId, userId, name: "member", email: "member@example.org", role: "member", active: true, approved: true, coverOptIn: false }) };
    });
    const member = t.withIdentity({ subject: "clerk|member", email: "member@example.org", emailVerified: true });
    const saved = async () => (await t.run(ctx => ctx.db.get("memberships", memberId)))?.language;
    await member.mutation(api.language.adopt, { churchId, language: "es" });
    expect(await saved()).toBe("es");
    await member.mutation(api.language.adopt, { churchId, language: "ht" });
    expect(await saved()).toBe("es");
    await member.mutation(api.language.choose, { churchId, language: "en" });
    await member.mutation(api.language.adopt, { churchId, language: "es" });
    expect(await saved()).toBe("en");
    await expect(t.mutation(api.language.adopt, { churchId, language: "es" })).rejects.toThrow();
  });

  test("a visitor to the sample never changes the language of the made-up member every visitor shares", async () => {
    vi.stubEnv("DEMO_CLERK_USER_ID", "clerk|visitor");
    const t = convexTest(schema, modules);
    const { churchId, memberId } = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: "America/New_York", sample: true });
      const userId = await ctx.db.insert("users", { clerkId: "clerk|visitor" });
      return { churchId, memberId: await ctx.db.insert("memberships", { churchId, userId, name: "Sample Owner", email: "owner@example.org", role: "owner", active: true, approved: true, coverOptIn: false }) };
    });
    const visitor = t.withIdentity({ subject: "clerk|visitor", email: "owner@example.org", emailVerified: true });
    await visitor.mutation(api.language.adopt, { churchId, language: "es" });
    await visitor.mutation(api.language.choose, { churchId, language: "ht" });
    expect((await t.run(ctx => ctx.db.get("memberships", memberId)))?.language).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
