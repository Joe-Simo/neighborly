/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, queryGeneric } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { api } from "./_generated/api";
import * as functions from "./assistance";
import { neighborAccess } from "./access";
import { settleRequest } from "./assistance";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const refused = "Neighbor records are open to coordinators and owners only.";

/** A made-up group with an owner, a coordinator and a member, and a second group to prove nothing crosses over. */
async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const empty = defineSchema({});
  t.registerComponent("auth", empty, { "./_generated/server.js": async () => ({}), "./public.ts": async () => ({ getSession: queryGeneric({ args: { sessionId: v.string() }, handler: async (_, { sessionId }) => (emails.has(sessionId) ? { userId: sessionId } : null) }) }) });
  t.registerComponent("authEmail", empty, { "./_generated/server.js": async () => ({}), "./verifiedEmails.ts": async () => ({ getPrimaryEmail: queryGeneric({ args: { userId: v.string() }, handler: async (_, { userId }) => emails.get(userId) ?? null }) }) });
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
    const other = await ctx.db.insert("churches", { name: "Example Conference", timeZone: "UTC" });
    const join = async (group: typeof church, name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: group, userId, name, email: `${role}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await join(church, "Marisol Vega", "owner"), coordinator = await join(church, "Thomas Okafor", "coordinator"), member = await join(church, "Renee Baptiste", "member"), stranger = await join(other, "Victor Salgado", "owner");
    const record = (group: typeof church, name: string, phone: string, address: string, createdBy: typeof owner.memberId) =>
      ctx.db.insert("neighbors", { churchId: group, name, nameKey: name.toLowerCase(), phone, phoneKey: phone.replace(/\D/g, ""), email: "", address, adults: 2, children: 2, language: "es", notes: "", createdBy, createdAt: 0 });
    return {
      church, other, owner, coordinator, member, stranger,
      rosa: await record(church, "Rosa Delgado", "(239) 555-0142", "14 Sample St, Apt 2", owner.memberId),
      earl: await record(church, "Earl Jennings", "(239) 555-0178", "8 Example Ave", owner.memberId),
      elsewhere: await record(other, "Mai Tran", "(239) 555-0150", "31 Demo Ct", stranger.memberId),
    };
  });
  for (const person of [ids.owner, ids.coordinator, ids.member, ids.stranger]) emails.set(person.userId, `${person.userId}@neighborly.example`);
  return { t, ids, as: (person: { userId: string }) => t.withIdentity({ subject: person.userId }) };
}

const rent = { kind: "rent", summary: "Behind on November rent.", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co." } as const;

describe("who may use the help line and requests", () => {
  test("a member is refused on every function and a coordinator passes", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const { callId } = await as(ids.owner).mutation(api.assistance.recordCall, { churchId, callerName: "New caller", phone: "(239) 555-0119", note: "Asked about food.", callback: "needed" });
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    for (const person of [ids.member, ids.coordinator]) {
      const caller = as(person);
      const attempts = [
        () => caller.query(api.assistance.requests, { churchId }),
        () => caller.query(api.assistance.requestsForNeighbor, { churchId, neighborId: ids.rosa }),
        () => caller.query(api.assistance.request, { churchId, requestId }),
        () => caller.query(api.assistance.calls, { churchId }),
        () => caller.mutation(api.assistance.recordCall, { churchId, callerName: "Earl Jennings", phone: "", note: "Called back.", callback: "none" }),
        () => caller.mutation(api.assistance.linkCall, { churchId, callId, neighborId: ids.earl }),
        () => caller.mutation(api.assistance.markReturned, { churchId, callId }),
        () => caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.earl, ...rent }),
        () => caller.mutation(api.assistance.updateRequest, { churchId, requestId, ...rent, amountRequested: 40000 }),
        () => caller.mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 40000, note: "" }),
        () => caller.mutation(api.assistance.closeRequest, { churchId, requestId, note: "Resolved." }),
      ];
      // Every public function in the file is tried, so a new one cannot be added without its gate.
      expect(attempts).toHaveLength(Object.values(functions).filter((value) => typeof value === "function" && "isPublic" in value).length);
      for (const attempt of attempts) {
        if (person === ids.member) await expect(attempt()).rejects.toThrow(refused);
        else await attempt();
      }
    }
  });

  test("another group's coordinator cannot reach this group's calls or requests", async () => {
    const { ids, as } = await setup();
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId: ids.church, neighborId: ids.rosa, ...rent });
    await expect(as(ids.stranger).query(api.assistance.requests, { churchId: ids.church })).rejects.toThrow("Workspace access required.");
    await expect(as(ids.stranger).query(api.assistance.request, { churchId: ids.other, requestId })).rejects.toThrow("Request not found.");
    await expect(as(ids.stranger).mutation(api.assistance.createRequest, { churchId: ids.other, neighborId: ids.rosa, ...rent })).rejects.toThrow("Record not found.");
  });
});

describe("the help line", () => {
  test("a call from a phone on file is matched to that neighbor; an unknown number is not", async () => {
    const { ids, as } = await setup();
    const known = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Rosa", phone: "239.555.0142", note: "Behind on rent.", callback: "needed", ownerId: ids.owner.memberId });
    const unknown = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "", phone: "(239) 555-0119", note: "Food for five.", callback: "needed" });
    expect(known.neighborId).toBe(ids.rosa);
    expect(unknown.neighborId).toBeNull();
    const { waiting } = await as(ids.owner).query(api.assistance.calls, { churchId: ids.church });
    expect(waiting).toMatchObject([{ neighborName: "Rosa Delgado", takenByName: "Thomas Okafor", ownerName: "Marisol Vega" }, { neighborName: null, ownerName: null }]);
    await expect(as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "", phone: "", note: "Silence.", callback: "none" })).rejects.toThrow("A name or a phone number is needed.");
  });

  test("marking a call returned keeps who returned it, when, and what came of it", async () => {
    const { ids, as } = await setup();
    const { callId } = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Earl Jennings", phone: "(239) 555-0178", note: "Shut-off notice.", callback: "needed" });
    await as(ids.owner).mutation(api.assistance.markReturned, { churchId: ids.church, callId, outcome: "Home visit planned for Thursday." });
    const { waiting, returned } = await as(ids.owner).query(api.assistance.calls, { churchId: ids.church });
    expect(waiting).toEqual([]);
    expect(returned).toMatchObject([{ id: callId, callback: "done", returnedByName: "Marisol Vega", outcome: "Home visit planned for Thursday." }]);
    expect(returned[0].returnedAt).toBeGreaterThan(0);
    await expect(as(ids.owner).mutation(api.assistance.markReturned, { churchId: ids.church, callId })).rejects.toThrow("not waiting");
  });
});

describe("a request for help", () => {
  test("is recorded open, tied to its call, and read back with the neighbor's household", async () => {
    const { ids, as } = await setup();
    const { callId } = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Someone", phone: "(239) 555-0119", note: "Rent.", callback: "needed" });
    const requestId = await as(ids.coordinator).mutation(api.assistance.createRequest, { churchId: ids.church, neighborId: ids.rosa, callId, ...rent });
    expect(await as(ids.owner).query(api.assistance.request, { churchId: ids.church, requestId })).toMatchObject({
      neighborName: "Rosa Delgado", neighborAddress: "14 Sample St, Apt 2", neighborLanguage: "es", householdSize: 4, callId, kind: "rent", amountRequested: 45000, amountApproved: null,
      status: "open", payeeKind: "landlord", payeeName: "Sample Property Co.", source: "person", createdByName: "Thomas Okafor", decidedByName: null, referral: "",
    });
    // The call from an unknown number now belongs to the neighbor it was about.
    expect((await as(ids.owner).query(api.assistance.calls, { churchId: ids.church })).waiting[0].neighborId).toBe(ids.rosa);
    await expect(as(ids.owner).mutation(api.assistance.createRequest, { churchId: ids.church, neighborId: ids.earl, callId, ...rent })).rejects.toThrow("another neighbor");
  });

  test("money is whole cents and a summary is required", async () => {
    const { ids, as } = await setup();
    const create = (change: Partial<{ amountRequested: number; summary: string }>) => as(ids.owner).mutation(api.assistance.createRequest, { churchId: ids.church, neighborId: ids.rosa, ...rent, ...change });
    await expect(create({ amountRequested: 450.5 })).rejects.toThrow("dollar amount");
    await expect(create({ amountRequested: -100 })).rejects.toThrow("dollar amount");
    await expect(create({ summary: "  " })).rejects.toThrow("What they need is needed.");
  });

  test("a decision keeps who decided, and cannot be made twice", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const requestId = await as(ids.coordinator).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    await expect(as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", note: "" })).rejects.toThrow("approved amount is needed");
    await expect(as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 0, note: "" })).rejects.toThrow("dollar amount");
    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 40000, note: "Approved after the home visit." });
    expect(await as(ids.owner).query(api.assistance.request, { churchId, requestId })).toMatchObject({ status: "approved", amountApproved: 40000, decidedByName: "Marisol Vega", decisionNote: "Approved after the home visit." });
    await expect(as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "declined", note: "" })).rejects.toThrow("already been decided");
    await expect(as(ids.owner).mutation(api.assistance.updateRequest, { churchId, requestId, ...rent })).rejects.toThrow("already been decided");
    expect(await as(ids.owner).query(api.assistance.requests, { churchId, status: "approved" })).toHaveLength(1);
    expect(await as(ids.owner).query(api.assistance.requests, { churchId, status: "open" })).toHaveLength(0);
  });

  test("cannot be approved without someone to pay; a decline keeps the referral", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId, neighborId: ids.earl, ...rent, kind: "utility", payeeKind: "utility", payeeName: "" });
    await expect(as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 18600, note: "" })).rejects.toThrow("Add who is paid");
    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "declined", note: "Outside our area.", referral: "Referred to 211." });
    expect(await as(ids.owner).query(api.assistance.request, { churchId, requestId })).toMatchObject({ status: "declined", referral: "Referred to 211.", amountApproved: null });
  });

  test("treasury settles an approved request, and a reversal brings it back", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    const settle = (person: typeof ids.owner, group: typeof churchId, fullyPaid: boolean) => as(person).run(async (ctx) => settleRequest(ctx, await neighborAccess(ctx, group), requestId, fullyPaid));
    await expect(settle(ids.owner, churchId, true)).rejects.toThrow("Only an approved request can be paid.");
    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 45000, note: "" });
    await expect(settle(ids.stranger, ids.other, true)).rejects.toThrow("Request not found.");
    await settle(ids.owner, churchId, true);
    expect((await as(ids.owner).query(api.assistance.request, { churchId, requestId })).status).toBe("paid");
    await expect(as(ids.owner).mutation(api.assistance.closeRequest, { churchId, requestId, note: "" })).rejects.toThrow("already finished");
    await settle(ids.owner, churchId, false);
    expect((await as(ids.owner).query(api.assistance.request, { churchId, requestId })).status).toBe("approved");
  });
});
