/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { keyed } from "./intakeKeys";
import { statusKeyHash } from "./intake";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const visitor = { subject: "user_sample", email: "demo@kindhelps.com", emailVerified: true };
const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers();
  // A Wednesday morning, so every business day the rows name is fixed.
  vi.setSystemTime(new Date("2026-11-18T15:00:00Z"));
  vi.stubEnv("DEMO_CLERK_USER_ID", visitor.subject);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function start() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}
async function refreshed(t: ReturnType<typeof start>) {
  await t.mutation(internal.demo.refresh, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}
async function sample(t: ReturnType<typeof start>) {
  const guest = t.withIdentity(visitor);
  await guest.mutation(api.users.enter, {});
  const [church] = (await guest.query(api.workspace.viewer, {})).churches;
  return { guest, churchId: church.id as Id<"churches"> };
}
const rows = (t: ReturnType<typeof start>) => t.run(async (ctx) => ({
  web: await ctx.db.query("webRequests").collect(),
  webCalls: (await ctx.db.query("calls").collect()).filter((call) => call.fromWeb),
  read: (await ctx.db.query("visits").collect()).filter((visit) => visit.found),
}));

describe("the sample conference's web requests and read-in write-ups", () => {
  test("the seed lays exactly two confirmed web requests, each with its call, shaped as the form lays them", async () => {
    const t = start();
    await refreshed(t);
    const { churchId } = await sample(t);
    const { web, webCalls, read } = await rows(t);
    expect(web).toHaveLength(2);
    expect(webCalls).toHaveLength(2);
    const [fresh, known] = [...web].sort((a, b) => b.createdAt - a.createdAt);
    for (const row of web) {
      expect(row).toMatchObject({ churchId, stage: "received", codeHash: "", codeTries: 0, safe: true });
      expect(row.confirmedAt).toBeGreaterThan(row.createdAt);
      expect(row.firstContactBy).toBeGreaterThan(row.confirmedAt!);
      expect(row.email).toMatch(/@kindhelps\.example$/);
      // Only the keyed hashes the form keeps, never the raw contact or address.
      expect(row.contactHash).toBe(await keyed(`email:${row.email}`));
      expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.statusKeyHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.unverified).toBeUndefined();
      const call = webCalls.find((one) => one._id === row.callId);
      expect(call).toMatchObject({ churchId, callback: "needed", fromWeb: true, takenAt: row.confirmedAt });
      expect(call?.note).toContain("From the web form");
    }
    expect(fresh).toMatchObject({ language: "es", kinds: ["utility", "food"], phone: "" });
    expect(fresh.phoneHash).toBeUndefined();
    expect(webCalls.find((call) => call._id === fresh.callId)).toMatchObject({ spanish: true, callerName: fresh.email });
    expect(known).toMatchObject({ language: "en", kinds: ["rent"], phone: "1015550131", referredBy: "Parish office" });
    expect(known.phoneHash).toBe(await keyed("phone:1015550131"));
    // Its phone is one household's alone, so its call is marked as likely theirs.
    const household = await t.run(async (ctx) => ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", churchId).eq("phoneKey", "1015550131")).collect());
    expect(household).toHaveLength(1);
    expect(webCalls.find((call) => call._id === known.callId)?.likelyNeighborId).toBe(household[0]._id);
    // No status link opens a sample request: its key is not one the status page takes.
    expect(await t.query(api.intake.status, { key: "0".repeat(32) })).toBeNull();
    expect(web.map((row) => row.statusKeyHash)).not.toContain(await statusKeyHash("0".repeat(32)));

    expect(read).toHaveLength(2);
    for (const visit of read) {
      expect(visit.status).toBe("completed");
      expect(visit.visitors).toHaveLength(2);
      expect(visit.requestId).toBeDefined();
      expect(visit.found?.signs.length).toBeGreaterThan(0);
      expect(visit.notes.length).toBeGreaterThan(40);
    }
  });

  test("a rerun of the nightly reset lays no second copy, and puts back what a visitor closed", async () => {
    const t = start();
    await refreshed(t);
    const { guest, churchId } = await sample(t);
    const first = await rows(t);
    const [one] = first.web;
    await guest.mutation(api.intake.close, { churchId, requestId: one._id });
    await t.mutation(internal.demo.nightly, {});
    const settled = await rows(t);
    await t.mutation(internal.demo.nightly, {});
    const after = await rows(t);
    expect(after.web).toHaveLength(2);
    expect(after.webCalls).toHaveLength(2);
    expect(after.read).toHaveLength(2);
    expect(after.web.every((row) => row.stage === "received")).toBe(true);
    expect(after.webCalls.every((call) => call.callback === "needed")).toBe(true);
    // A second night at the same hour finds nothing to write: every row keeps its id.
    for (const table of ["web", "webCalls", "read"] as const) expect(after[table].map((row) => row._id).sort()).toEqual(settled[table].map((row) => row._id).sort());
  });

  test("the help line and the visits room give them to a sample member", async () => {
    const t = start();
    await refreshed(t);
    const { guest, churchId } = await sample(t);
    const at = Math.floor(Date.now() / HOUR) * HOUR;
    const web = await guest.query(api.intake.forTeam, { churchId, at });
    expect(web.waiting).toHaveLength(2);
    expect(web.waiting.map((row) => row.kinds)).toEqual(expect.arrayContaining([["rent"], ["utility", "food"]]));
    const calls = await guest.query(api.assistance.calls, { churchId, at });
    const fromWeb = calls.waiting.filter((call) => call.takenByName === "The web form");
    expect(fromWeb).toHaveLength(2);
    expect(fromWeb.filter((call) => call.likely)).toHaveLength(1);
    expect(fromWeb.filter((call) => call.spanish === "assistant")).toHaveLength(1);

    const board = await guest.query(api.visits.board, { churchId, at });
    const readIn = board.writtenUp.filter((visit) => visit.found);
    expect(readIn).toHaveLength(2);
    // They lead the written-up list, where the room shows them first.
    expect(board.writtenUp.slice(0, 2).every((visit) => visit.found)).toBe(true);
    expect(readIn.map((visit) => visit.found?.kind).sort()).toEqual(["food", "utility"]);
    for (const visit of readIn) {
      expect(visit.requestId).not.toBeNull();
      expect(visit.visitors.map((person) => person.name).every(Boolean)).toBe(true);
      expect(visit.kind).not.toBe(visit.found?.kind);
    }
  });

  test("a sample web request cannot be passed to a real team, blocked or marked", async () => {
    const t = start();
    await refreshed(t);
    const { guest, churchId } = await sample(t);
    const [one] = (await rows(t)).web;
    await expect(guest.mutation(api.intake.passOn, { churchId, requestId: one._id, toChurchId: churchId, reason: "Closer to them" })).rejects.toThrow(/sample/);
    await expect(guest.mutation(api.intake.block, { churchId, requestId: one._id })).rejects.toThrow(/sample/);
    await expect(guest.mutation(api.intake.notGenuine, { churchId, requestId: one._id })).rejects.toThrow(/sample/);
    expect(await t.run(async (ctx) => (await ctx.db.query("webBlocks").collect()).length + (await ctx.db.query("webFlags").collect()).length)).toBe(0);
  });
});
