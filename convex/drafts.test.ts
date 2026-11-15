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

describe("a call note drafted into a request", () => {
  const note = "Rosa Delgado called from (239) 555-0142, lives at 14 Sample St, Apt 2. Behind on November rent. The landlord says four hundred fifty by Friday. Landlord is Sample Property Co.";

  async function helpLine() {
    const t = convexTest(schema, modules);
    const emails = new Set<string>();
    const empty = defineSchema({});
    t.registerComponent("auth", empty, { "./_generated/server.js": async () => ({}), "./public.ts": async () => ({ getSession: queryGeneric({ args: { sessionId: v.string() }, handler: async (_, { sessionId }) => (emails.has(sessionId) ? { userId: sessionId } : null) }) }) });
    t.registerComponent("authEmail", empty, { "./_generated/server.js": async () => ({}), "./verifiedEmails.ts": async () => ({ getPrimaryEmail: queryGeneric({ args: { userId: v.string() }, handler: async (_, { userId }) => (emails.has(userId) ? "sample@example.org" : null) }) }) });
    const ids = await t.run(async ctx => {
      const churchId = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
      const otherChurch = await ctx.db.insert("churches", { name: "Elsewhere", timeZone: "UTC" });
      const join = async (role: "coordinator" | "member") => {
        const userId = await ctx.db.insert("users", {});
        return { userId, memberId: await ctx.db.insert("memberships", { churchId, userId, name: role, email: `${role}@example.org`, role, active: true, approved: true, coverOptIn: false }) };
      };
      const coordinator = await join("coordinator"), member = await join("member");
      const neighborId = await ctx.db.insert("neighbors", { churchId, name: "Rosa Delgado", nameKey: "rosa delgado", phone: "(239) 555-0142", phoneKey: "2395550142", email: "", address: "14 Sample St, Apt 2", adults: 2, children: 2, language: "es", notes: "", createdBy: coordinator.memberId, createdAt: 0 });
      const callId = await ctx.db.insert("calls", { churchId, neighborId, callerName: "Rosa Delgado", phone: "(239) 555-0142", note, callback: "needed", takenBy: coordinator.memberId, takenAt: 0 });
      return { churchId, otherChurch, coordinator, member, callId };
    });
    emails.add(ids.coordinator.userId); emails.add(ids.member.userId);
    return { t, ids, coordinator: t.withIdentity({ subject: ids.coordinator.userId }), member: t.withIdentity({ subject: ids.member.userId }) };
  }
  const answers = (sure: Record<string, number>) => vi.fn<(url: string, init: { body: string }) => Promise<Response>>(async () => Response.json({ answers: Object.fromEntries(Object.entries(sure).map(([field, noul]) => [field, { type: "noul", noul }])) }));

  test("with no key the draft comes back for review, and nothing leaves", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft).toMatchObject({ kind: "rent", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co", verification: "review" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("members and people outside the group are refused", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const { t, ids, coordinator, member } = await helpLine();
    const args = { churchId: ids.churchId, callId: ids.callId };
    await expect(member.action(api.drafts.draftRequest, args)).rejects.toThrow("coordinators and owners only");
    await expect(t.action(api.drafts.draftRequest, args)).rejects.toThrow("Sign in required.");
    await expect(coordinator.action(api.drafts.draftRequest, { churchId: ids.otherChurch, callId: ids.callId })).rejects.toThrow("Workspace access required.");
  });

  test("the name, phone and address are taken out before the note leaves, and the model is asked yes or no only", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    const fetch = answers({ kind: 0.99, amountRequested: 0.99, payeeKind: 0.99 });
    vi.stubGlobal("fetch", fetch);
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft.verification).toBe("checked");
    const sent = fetch.mock.calls[0][1].body;
    expect(sent).not.toMatch(/rosa|delgado|555|0142|14 sample|apt 2|property co/i);
    expect(sent).toContain("four hundred fifty");
    const body = JSON.parse(sent) as { state: { proposed: Record<string, string> }; questions: Record<string, { type: string }> };
    expect(body.state.proposed).toEqual({ kind: "rent", amountRequested: "$450.00", payeeKind: "landlord" });
    expect(Object.values(body.questions).map(question => question.type)).toEqual(["noul", "noul", "noul"]);
  });

  test("a field the model is not sure of comes back blank", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", answers({ kind: 0.99, amountRequested: 0.4, payeeKind: 0.99 }));
    const { ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft).toMatchObject({ kind: "rent", amountRequested: null, payeeKind: "landlord", verification: "checked" });
    expect(draft.notes).toContain("Please confirm the amount.");
  });

  test("drafting writes no request, and a failed check falls back to review", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-provider-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    const { t, ids, coordinator } = await helpLine();
    const draft = await coordinator.action(api.drafts.draftRequest, { churchId: ids.churchId, callId: ids.callId });
    expect(draft.verification).toBe("review");
    expect(await t.run(ctx => ctx.db.query("assistanceRequests").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("ledgerEntries").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("auditEvents").collect())).toEqual([]);
  });
});
