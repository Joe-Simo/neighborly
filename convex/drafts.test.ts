/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, queryGeneric } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const description = "Our Welcome team serves every other Sunday. We need two people from 9am to 10am.";

async function setup() {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert("users", {}));
  t.registerComponent("auth", defineSchema({}), {
    "./_generated/server.js": async () => ({}),
    "./public.ts": async () => ({
      getSession: queryGeneric({ args: { sessionId: v.string() }, handler: async (_, { sessionId }) => sessionId === id ? { userId: id } : null }),
    }),
  });
  return { t, signed: t.withIdentity({ subject: id }) };
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("reviewable team drafting", () => {
  test("requires authentication and works without an AI provider", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const { t, signed } = await setup();
    await expect(t.action(api.drafts.suggestTeam, { description })).rejects.toThrow("Sign in");
    const draft = await signed.action(api.drafts.suggestTeam, { description });
    expect(draft.teamName).toBe("Welcome team");
    expect(draft.peopleCount).toBe("2");
    expect(draft.verification).toBe("review");
  });

  test("uncertain AI checks remove proposed facts without creating records", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ answers: {
      teamName: { type: "noul", noul: 0.99 }, recurrence: { type: "noul", noul: 0.2 },
      peopleCount: { type: "noul", noul: 0.99 }, time: { type: "noul", noul: 0.99 },
    } })));
    const { t, signed } = await setup();
    const draft = await signed.action(api.drafts.suggestTeam, { description });
    expect(draft.recurrence).toBe("");
    expect(draft.verification).toBe("checked");
    expect(await t.run(ctx => ctx.db.query("teams").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("memberships").collect())).toEqual([]);
  });

  test("limits provider requests and fails safely on malformed answers", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = vi.fn(async () => Response.json({ answers: { teamName: { type: "noul", noul: 2 } } }));
    vi.stubGlobal("fetch", fetch);
    const { signed } = await setup();
    for (let index = 0; index < 5; index++) {
      expect((await signed.action(api.drafts.suggestTeam, { description })).verification).toBe("review");
    }
    await expect(signed.action(api.drafts.suggestTeam, { description })).rejects.toThrow("wait a minute");
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
