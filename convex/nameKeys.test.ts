/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { nameKey } from "./assistance";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

test("a name is found with its accents, case and spaces set aside, once refold has written the stored keys again", async () => {
  expect(nameKey("  José  García ")).toBe("jose garcia");
  expect(nameKey("JOSE GARCIA")).toBe(nameKey("José García"));
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId: "clerk|owner" }));
  const churchId = await t.mutation(internal.sampleData.load, { owner: { userId, name: "Marisol Vega", email: "owner@neighborly.example" } });
  // A record saved before accents were set aside: its key lost the letters instead.
  const id = await t.run(async (ctx) => {
    const owner = (await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect()).find((one) => one.role === "owner")!;
    return ctx.db.insert("neighbors", { churchId, name: "José Ñúñez", nameKey: "jos n ez", phone: "(100) 555-0177", phoneKey: "1005550177", email: "", address: "9 Demo Ct", adults: 1, children: 0, language: "es", notes: "", createdBy: owner._id, createdAt: 0 });
  });
  await t.mutation(internal.nameKeys.refold, {});
  await t.finishAllScheduledFunctions(() => {});
  expect((await t.run((ctx) => ctx.db.get("neighbors", id)))?.nameKey).toBe("jose nunez");
  const owner = t.withIdentity({ subject: "clerk|owner", email: "owner@neighborly.example", emailVerified: true });
  for (const typed of ["jose", "  JOSÉ ñu ", "100-555-0177", "1005550177"]) {
    const found = await owner.query(api.neighbors.list, { churchId, search: typed });
    expect(found.rows.map((row) => row.id), typed).toContain(id);
  }
});
