/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import { sampleYear } from "../src/lib/sample-year";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

// The sample is built backward from today, so today is the moment the home page's figures were taken.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(sampleYear.asOf));
});
afterEach(() => void vi.useRealTimers());

test("the home page's four figures are the sample's own yearly report", async () => {
  const t = convexTest(schema, modules);
  const churchId = await t.mutation(internal.sampleData.load, {});
  const owner = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).find((member) => member.role === "owner"));
  if (!owner) throw new Error("The sample has no owner.");
  const report = await signedIn(t, owner.userId).query(api.reports.year, { churchId, year: sampleYear.year, at: Date.parse(sampleYear.asOf) });
  expect(report.closed).toBe(true);
  expect({ calls: report.calls.taken, requests: report.requests.received, visits: report.visits, helpPaid: report.helpPaid }).toEqual({
    calls: sampleYear.calls,
    requests: sampleYear.requests,
    visits: sampleYear.visits,
    helpPaid: sampleYear.helpPaid,
  });
});
