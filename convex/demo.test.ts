/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const visitor = { subject: "user_sample", email: "demo@kindhelps.com", emailVerified: true };

beforeEach(() => {
  vi.useFakeTimers();
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

describe("the sample conference a visitor looks around", () => {
  test("the visitor owns one sample conference, and a refresh replaces what they typed", async () => {
    const t = start();
    await refreshed(t);
    const guest = t.withIdentity(visitor);
    await guest.mutation(api.users.enter, {});
    const [first] = (await guest.query(api.workspace.viewer, {})).churches;
    const month = new Date().toISOString().slice(0, 7);
    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", { churchId: first.id, title: "Typed by a visitor", dueAt: null, assigneeId: null, complete: false });
      const [member] = await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", first.id)).take(1);
      await ctx.db.insert("calendarFeeds", { churchId: first.id, memberId: member._id, token: "a-link-a-visitor-copied", createdAt: Date.now() });
      await ctx.db.insert("aiUsageByChurch", { churchId: first.id, month, count: 1999 });
    });

    await refreshed(t);
    const after = await guest.query(api.workspace.viewer, {});
    expect(after.churches).toHaveLength(1);
    // The conference keeps its id, so an open page and its address stay good across the night.
    expect(after.churches[0].id).toBe(first.id);
    const left = await t.run(async (ctx) => ({
      churches: await ctx.db.query("churches").collect(),
      typed: (await ctx.db.query("tasks").collect()).filter((task) => task.title === "Typed by a visitor"),
      visitors: (await ctx.db.query("users").collect()).filter((user) => user.clerkId === visitor.subject),
      feeds: await ctx.db.query("calendarFeeds").collect(),
      ai: await ctx.db.query("aiUsageByChurch").collect(),
    }));
    // A copied calendar link stops working, and the month's AI allowance is not handed out again.
    expect(left.feeds).toHaveLength(0);
    expect(left.ai).toEqual([expect.objectContaining({ churchId: after.churches[0].id, month, count: 1999 })]);
    expect(left.churches).toHaveLength(1);
    expect(left.typed).toHaveLength(0);
    expect(left.visitors).toHaveLength(1);
  });

  test("the nightly reset can be turned off for a deployment nobody is shown", async () => {
    const t = start();
    const nightly = async () => {
      await t.mutation(internal.demo.nightly, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      return t.run(async (ctx) => (await ctx.db.query("tasks").collect()).filter((task) => task.title === "Typed by a visitor").length);
    };
    await nightly();
    const type = () => t.run(async (ctx) => {
      const church = (await ctx.db.query("churches").first())!;
      await ctx.db.insert("tasks", { churchId: church._id, title: "Typed by a visitor", dueAt: null, assigneeId: null, complete: false });
    });
    await type();
    vi.stubEnv("SAMPLE_NIGHTLY", "off");
    expect(await nightly()).toBe(1);
    vi.stubEnv("SAMPLE_NIGHTLY", "");
    expect(await nightly()).toBe(0);
  });

  test("a refresh leaves every other conference alone, sample or real", async () => {
    const t = start();
    const others = await t.run(async (ctx) => {
      const real = await ctx.db.insert("churches", { name: "Real Conference", timeZone: "UTC" });
      const owner = await ctx.db.insert("users", {});
      await ctx.db.insert("memberships", { churchId: real, userId: owner, name: "Ana Sample", email: "ana@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
      return { real, sample: await ctx.runMutation(internal.sampleData.load, {}) };
    });
    await refreshed(t);
    await refreshed(t);
    const churches = await t.run((ctx) => ctx.db.query("churches").collect());
    expect(churches).toHaveLength(3);
    expect(churches.map((church) => church._id)).toEqual(expect.arrayContaining([others.real, others.sample]));
  });

  test("the visitor cannot start a conference of their own", async () => {
    const t = start();
    await refreshed(t);
    const guest = t.withIdentity(visitor);
    await guest.mutation(api.users.enter, {});
    await expect(guest.mutation(api.workspace.createChurch, { name: "Mine", timeZone: "UTC", displayName: "Visitor" })).rejects.toThrow("sample account");
  });

  test("nobody can be invited into the sample conference", async () => {
    const t = start();
    await refreshed(t);
    const guest = t.withIdentity(visitor);
    await guest.mutation(api.users.enter, {});
    const [church] = (await guest.query(api.workspace.viewer, {})).churches;
    await expect(guest.action(api.invitations.create, { churchId: church.id, email: "someone@example.org", role: "member", requestId: "sample-request-0001" })).rejects.toThrow("cannot invite");
    // The sample carries one invented invitation of its own; the refused one adds nothing to it.
    expect((await t.run((ctx) => ctx.db.query("invitations").collect())).map((row) => row.email)).toEqual(["ana.duarte@kindhelps.example"]);
    expect(await guest.query(api.demo.visiting, {})).toBe(true);
  });

  test("entry is rationed for one visitor and for everyone together", async () => {
    const t = start();
    const one = "a".repeat(64);
    const tries = [];
    for (let i = 0; i < 31; i++) tries.push(await t.mutation(api.demo.admit, { visitor: one }));
    expect(tries).toEqual([...Array<string>(30).fill(visitor.subject), null]);
    expect(await t.mutation(api.demo.admit, { visitor: "not-a-hash" })).toBeNull();
    let admitted = 30;
    for (let i = 0; i < 130; i++) if (await t.mutation(api.demo.admit, { visitor: i.toString(16).padStart(64, "0") })) admitted++;
    expect(admitted).toBe(120);
  });

  test("nothing happens until the deployment names the visitor account", async () => {
    vi.stubEnv("DEMO_CLERK_USER_ID", "");
    const t = start();
    await refreshed(t);
    expect(await t.run((ctx) => ctx.db.query("churches").collect())).toHaveLength(0);
  });

  // Convex keeps one answer for everyone who asks the same question, and the sample is one conference
  // shared by every visitor. A query that reads the clock loses that and is run again while a page sits
  // open, which is what spent a month's allowance in two days. So the time comes in as an argument.
  test("no room's query reads the clock, and none but the year's report reads more than a room needs", async () => {
    const t = start();
    await refreshed(t);
    const guest = t.withIdentity(visitor);
    await guest.mutation(api.users.enter, {});
    const [{ id: churchId }] = (await guest.query(api.workspace.viewer, {})).churches;
    const at = Math.floor(Date.now() / 3600000) * 3600000;
    const read = (ask: (ctx: Parameters<Parameters<typeof guest.run>[0]>[0]) => Promise<unknown>) =>
      guest.run(async (ctx) => {
        const clock = vi.spyOn(Date, "now");
        await ask(ctx);
        const looked = clock.mock.calls.length;
        clock.mockRestore();
        return { looked, bytes: (await ctx.meta.getTransactionMetrics()).bytesRead.used };
      });
    const rooms = {
      helpLine: await read((ctx) => ctx.runQuery(api.assistance.calls, { churchId, at })),
      weekNote: await read((ctx) => ctx.runQuery(api.drafts.weekNote, { churchId, at })),
      board: await read((ctx) => ctx.runQuery(api.visits.board, { churchId, at })),
      mine: await read((ctx) => ctx.runQuery(api.visits.mine, { churchId, at })),
      years: await read((ctx) => ctx.runQuery(api.reports.years, { churchId, at })),
      year: await read((ctx) => ctx.runQuery(api.reports.year, { churchId, at, year: 2026 })),
      record: await read(async (ctx) => {
        const [neighbor] = await ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(1);
        return ctx.runQuery(api.neighbors.record, { churchId, neighborId: neighbor._id });
      }),
    };
    for (const [room, { looked }] of Object.entries(rooms)) expect(looked, room).toBe(0);
    // Only a whole hour is taken, so the kept answers are one an hour, and a query asked without the hour is refused.
    await expect(guest.query(api.assistance.calls, { churchId, at: at + 1 })).rejects.toThrow("Reload the page");
    // @ts-expect-error a page that sends no hour
    await expect(guest.query(api.assistance.calls, { churchId })).rejects.toThrow();
    // The help line read 74 KB when it took the last 200 returned calls to find a week of them.
    expect(rooms.helpLine.bytes).toBeLessThan(40_000);
    for (const room of [rooms.weekNote, rooms.board, rooms.mine, rooms.years, rooms.record]) expect(room.bytes).toBeLessThan(100_000);
    // A whole year added up is the one large read, and it is asked only in the Reports room.
    expect(rooms.year.bytes).toBeLessThan(1_000_000);
  });
});
