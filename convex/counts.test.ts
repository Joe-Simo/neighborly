/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

test("the sample's running figures match its households and its open requests, and a backfill counts the same", async () => {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const churchId = await t.mutation(internal.sampleData.load, {});
  const truth = await t.run(async (ctx) => ({
    households: (await ctx.db.query("neighbors").withIndex("by_church_name", (q) => q.eq("churchId", churchId).gt("nameKey", "")).collect()).length,
    waiting: (await ctx.db.query("assistanceRequests").collect()).filter((request) => request.churchId === churchId && request.status === "open").length,
  }));
  const waitingIds = await t.run(async (ctx) => (await ctx.db.query("assistanceRequests").collect()).filter((request) => request.churchId === churchId && request.status === "open").map((request) => request.neighborId).sort());
  const kept = await t.run((ctx) => ctx.db.get("churches", churchId));
  expect({ households: kept?.householdCount, waiting: kept?.waitingCount }).toEqual(truth);
  expect([...(kept?.waitingHouseholdIds ?? [])].sort()).toEqual(waitingIds);
  await t.run((ctx) => ctx.db.patch("churches", churchId, { householdCount: undefined, waitingCount: undefined, waitingHouseholdIds: undefined }));
  expect(await t.mutation(internal.counts.backfill, {})).toBe(1);
  const counted = await t.run((ctx) => ctx.db.get("churches", churchId));
  expect({ households: counted?.householdCount, waiting: counted?.waitingCount }).toEqual(truth);
  expect([...(counted?.waitingHouseholdIds ?? [])].sort()).toEqual(waitingIds);
});
