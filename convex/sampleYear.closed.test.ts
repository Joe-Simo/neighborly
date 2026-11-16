/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
afterEach(() => void vi.useRealTimers());

/** The sample as it would be loaded at that moment, with its closed year's report and what the rooms must always hold. */
async function loadedOn(moment: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(moment));
  const t = convexTest(schema, modules);
  const churchId = await t.mutation(internal.sampleData.load, { owner: await t.run(async (ctx) => ({ userId: await ctx.db.insert("users", {}), name: "Sample Owner", email: "owner@kindhelps.example" })) });
  const held = await t.run(async (ctx) => {
    const members = await ctx.db.query("memberships").collect();
    const owner = members.find((member) => member.role === "owner");
    if (!owner) throw new Error("The sample has no owner.");
    const tasks = (await ctx.db.query("tasks").collect()).filter((task) => !task.complete);
    return {
      owner,
      awaitingReply: (await ctx.db.query("requests").collect()).filter((request) => request.status === "pending" && request.recipientId === owner._id).length,
      drafts: (await ctx.db.query("requestDrafts").collect()).length,
      toPay: (await ctx.db.query("assistanceRequests").collect()).filter((request) => request.status === "approved").length,
      tasksForOne: Math.max(0, ...tasks.map((task) => tasks.filter((other) => other.assigneeId === task.assigneeId).length)),
      notYetReady: members.filter((member) => !member.approved).length,
      invited: (await ctx.db.query("invitations").collect()).filter((invitation) => invitation.status === "pending").length,
      toReturn: (await ctx.db.query("calls").collect()).filter((call) => call.callback === "needed").length,
    };
  });
  const report = await signedIn(t, held.owner.userId).query(api.reports.year, { churchId, year: 2026, at: Math.floor(Date.now() / 3600000) * 3600000 });
  return { report, held };
}

// The home page shows the closed year's totals and the Reports room adds them up from the records: they must
// agree to the digit on whatever day the sample was last rebuilt. From two weeks after the year closes, when
// its last requests have been settled, until the next year closes.
test("the closed year reads the same whatever day the sample is loaded, and the rooms keep their open work", async () => {
  const days = ["2026-10-14T15:00:00Z", "2026-11-15T15:00:00Z", "2026-11-16T03:30:00Z", "2026-11-17T22:00:00Z", "2026-11-28T09:00:00Z", "2026-12-20T15:00:00Z", "2027-02-10T15:00:00Z", "2027-09-30T15:00:00Z"];
  const first = await loadedOn(days[0]);
  expect(first.report.closed).toBe(true);
  expect({ calls: first.report.calls.taken, requests: first.report.requests.received, visits: first.report.visits, helpPaid: first.report.helpPaid }).toEqual({ calls: 459, requests: 370, visits: 325, helpPaid: 5243500 });
  // Members' hours are the one part still drawn back from today (the last 52 weeks of turns), so it is left out.
  const still = (report: typeof first.report) => ({ ...report, time: null });
  for (const day of days.slice(1)) {
    const { report, held } = await loadedOn(day);
    expect(still(report), day).toEqual(still(first.report));
    expect(held, day).toMatchObject({ awaitingReply: 1, drafts: 1, tasksForOne: 2, notYetReady: 1, invited: 1 });
    expect(held.toPay, day).toBeGreaterThanOrEqual(1);
    expect(held.toReturn, day).toBeGreaterThanOrEqual(1);
  }
});
