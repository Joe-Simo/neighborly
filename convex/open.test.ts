/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const visitor = { subject: "user_sample", email: "demo@kindhelps.com", emailVerified: true };
const HOUR = 3_600_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T09:00:00Z"));
  vi.stubEnv("DEMO_CLERK_USER_ID", visitor.subject);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

function start() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}
type Shape = { type: string; value?: unknown; tableName?: string; fieldType?: Shape; optional?: boolean; keys?: Shape; values?: Shape };
type Exported = { isQuery?: boolean; isPublic?: boolean; exportArgs?: () => string };

describe("the one read that needs no sign-in", () => {
  test("builds This week from the seed alone: no ids in, no row read, no clock, nothing a visitor typed", async () => {
    const t = start();
    await t.mutation(internal.demo.refresh, {});
    const guest = t.withIdentity(visitor);
    await guest.mutation(api.users.enter, {});
    const at = Math.floor(Date.now() / HOUR) * HOUR;
    const live = await guest.query(api.workspace.dashboard, {});
    // A visitor types into the sample after the reset.
    await t.run(async (ctx) => {
      const [note] = await ctx.db.query("announcements").take(1);
      await ctx.db.patch("announcements", note._id, { title: "Typed by a visitor" });
      await ctx.db.insert("tasks", { churchId: note.churchId, title: "Typed by a visitor", dueAt: null, assigneeId: null, complete: false });
    });
    const { room, metrics, looked } = await t.run(async (ctx) => {
      const clock = vi.spyOn(Date, "now");
      const answer = await ctx.runQuery(api.demo.firstRoom, { at });
      const calls = clock.mock.calls.length;
      clock.mockRestore();
      return { room: answer, looked: calls, metrics: await ctx.meta.getTransactionMetrics() };
    });
    expect(looked).toBe(0);
    expect(metrics.bytesRead.used).toBe(0);
    expect(metrics.documentsRead.used).toBe(0);
    expect(metrics.documentsWritten.used).toBe(0);
    expect(room).not.toBeNull();
    expect(JSON.stringify(room)).not.toContain("Typed by a visitor");
    // The same room the signed-in visitor is given straight after a reset, row for row, but for the ids:
    // a seed key stands where each id is, and no database id is in the answer.
    const keyed = new Map<string, number>();
    const shape = (value: unknown) => JSON.parse(JSON.stringify(value, (name, inner) => {
      const idLike = (text: unknown) => typeof text === "string" && (text.startsWith("plan:") || /^\d+;?[a-zA-Z]+$/.test(text) || /^[0-9]{10,}[a-zA-Z]+$/.test(text));
      if (idLike(inner)) { if (!keyed.has(inner)) keyed.set(inner, keyed.size); return `#${keyed.get(inner)}`; }
      return inner;
    }));
    const { firstRequests, firstAnnouncements, ...dashboard } = room!;
    keyed.clear(); const seedShape = shape(dashboard);
    keyed.clear(); const liveShape = shape(live);
    expect(seedShape).toEqual(liveShape);
    expect(firstAnnouncements.map((note) => note.title)).toEqual([...dashboard.announcements].reverse().map((note) => note.title));
    expect(firstRequests.length).toBe(Math.min(25, dashboard.requests.length));
    const realIds = await t.run(async (ctx) => [(await ctx.db.query("churches").first())!._id, ...(await ctx.db.query("memberships").collect()).map((member) => member._id)]);
    for (const id of realIds) expect(JSON.stringify(room)).not.toContain(id);
    // One answer for the whole hour, whoever asks, and only whole hours are taken.
    expect(await t.query(api.demo.firstRoom, { at })).toEqual(room);
    await expect(t.query(api.demo.firstRoom, { at: at + 1 })).rejects.toThrow("Reload the page");
  });

  test("answers nothing where no sample is set up, and takes no id", async () => {
    vi.stubEnv("DEMO_CLERK_USER_ID", "");
    const t = start();
    const at = Math.floor(Date.now() / HOUR) * HOUR;
    expect(await t.query(api.demo.firstRoom, { at })).toBeNull();
    const firstRoom = (await modules["./demo.ts"]() as Record<string, Exported>).firstRoom;
    expect(JSON.parse(firstRoom.exportArgs!())).toEqual({ type: "object", value: { at: { fieldType: { type: "number" }, optional: false } } });
    // @ts-expect-error it cannot be pointed at a conference
    await expect(t.query(api.demo.firstRoom, { at, churchId: "x" })).rejects.toThrow();
  });

  test("every other public query still refuses a caller who is not signed in", async () => {
    const t = start();
    await t.mutation(internal.demo.refresh, {});
    const at = Math.floor(Date.now() / HOUR) * HOUR;
    const ids = await t.run(async (ctx) => {
      const found: Record<string, string> = {};
      for (const table of Object.keys(schema.tables) as (keyof typeof schema.tables)[]) {
        const row = await ctx.db.query(table).first();
        if (row) found[table] = row._id;
      }
      return found;
    });
    // The smallest arguments each query's own validator accepts, with real ids of the sample, so the refusal
    // met is the sign-in one and not a complaint about arguments.
    const fill = (shape: Shape, name: string): unknown =>
      shape.type === "id" ? ids[shape.tableName!] ?? ids.churches
        : shape.type === "number" ? (name === "at" ? at : name === "numItems" ? 10 : 2026)
        : shape.type === "string" ? "x"
        : shape.type === "boolean" ? false
        : shape.type === "null" ? null
        : shape.type === "literal" ? shape.value
        : shape.type === "union" ? fill((shape.value as Shape[])[0], name)
        : shape.type === "array" ? []
        : shape.type === "object" ? Object.fromEntries(Object.entries(shape.value as Record<string, Shape>).filter(([, field]) => !field.optional || field.fieldType!.type === "id").map(([field, inner]) => [field, fill(inner.fieldType!, field)]))
        : shape.type === "any" ? null : {};
    const open: string[] = [], asked: string[] = [];
    for (const [path, load] of Object.entries(modules)) {
      if (/_generated|\.config\.|schema|http/.test(path)) continue;
      for (const [name, exported] of Object.entries(await load() as Record<string, Exported>)) {
        if (!exported?.isQuery || !exported.isPublic) continue;
        const key = `${path.slice(2, -3)}:${name}`;
        asked.push(key);
        const args = fill(JSON.parse(exported.exportArgs!()), "") as Record<string, never>;
        const answer = await t.query(makeFunctionReference<"query">(key), args).then(() => "answered", (error: Error) => error.message);
        if (!/Sign in required/.test(answer)) open.push(`${key}: ${answer.slice(0, 80)}`);
      }
    }
    expect(asked.length).toBeGreaterThan(40);
    // Two older ones answer a plain yes or no and read nothing: whether the caller is the sample visitor, and
    // whether email delivery is set up. The seed read is the only one that answers with anything more.
    expect(open.sort()).toEqual(["demo:firstRoom: answered", "demo:visiting: answered", "workspace:emailConfiguration: answered"]);
  });
});
