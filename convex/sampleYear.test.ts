/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import { sampleYear } from "../src/lib/sample-year";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

beforeEach(() => void vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => void vi.useRealTimers());

// The sample is rebuilt every night from the day it is built on; its closed year must read the same on any of them.
test.each(["2026-11-16T15:00:00Z", "2026-11-30T09:00:00Z"])("the home page's four figures are the sample's own yearly report, built on %s", async (day) => {
  vi.setSystemTime(new Date(day));
  const t = convexTest(schema, modules);
  const churchId = await t.mutation(internal.sampleData.load, {});
  const owner = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).find((member) => member.role === "owner"));
  if (!owner) throw new Error("The sample has no owner.");
  const report = await signedIn(t, owner.userId).query(api.reports.year, { churchId, year: sampleYear.year });
  expect(report.closed).toBe(true);
  expect({ calls: report.calls.taken, requests: report.requests.received, visits: report.visits, helpPaid: report.helpPaid }).toEqual({
    calls: sampleYear.calls,
    requests: sampleYear.requests,
    visits: sampleYear.visits,
    helpPaid: sampleYear.helpPaid,
  });
});
