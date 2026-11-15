/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, queryGeneric } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { api } from "./_generated/api";
import * as functions from "./neighbors";

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

const pat = { name: "Patrice Louis", phone: "(239) 555-0163", email: "", address: "220 Placeholder Rd", adults: 2, children: 4, language: "ht", notes: "" } as const;
const openings = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.run((ctx) => ctx.db.query("auditEvents").collect());

describe("who may use neighbor records", () => {
  test("a member is refused on every function and a coordinator passes", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    for (const person of [ids.member, ids.coordinator]) {
      const caller = as(person);
      const attempts = [
        () => caller.query(api.neighbors.list, { churchId }),
        () => caller.query(api.neighbors.matches, { churchId, name: "Rosa Delgado", phone: "" }),
        () => caller.mutation(api.neighbors.create, { churchId, ...pat }),
        () => caller.mutation(api.neighbors.update, { churchId, neighborId: ids.rosa, ...pat, name: "Rosa Delgado", phone: "(239) 555-0142" }),
        () => caller.mutation(api.neighbors.open, { churchId, neighborId: ids.rosa }),
        () => caller.query(api.neighbors.record, { churchId, neighborId: ids.rosa }),
      ];
      expect(attempts).toHaveLength(Object.values(functions).filter((value) => typeof value === "function" && "isPublic" in value).length);
      for (const attempt of attempts) {
        if (person === ids.member) await expect(attempt()).rejects.toThrow(refused);
        else await attempt();
      }
    }
  });

  test("a record in another group cannot be opened, read or changed through your own", async () => {
    const { t, ids, as } = await setup();
    const args = { churchId: ids.church, neighborId: ids.elsewhere };
    await expect(as(ids.owner).mutation(api.neighbors.open, args)).rejects.toThrow("Record not found.");
    await expect(as(ids.owner).query(api.neighbors.record, args)).rejects.toThrow("Record not found.");
    await expect(as(ids.owner).mutation(api.neighbors.update, { ...args, ...pat })).rejects.toThrow("Record not found.");
    expect(await openings(t)).toEqual([]);
  });
});

describe("opening a record", () => {
  test("writes one line to the audit trail, and the record shows who opened it", async () => {
    const { t, ids, as } = await setup();
    await as(ids.coordinator).mutation(api.neighbors.open, { churchId: ids.church, neighborId: ids.rosa });
    expect(await openings(t)).toMatchObject([{ action: "neighbor.opened", actorId: ids.coordinator.userId, targetId: ids.rosa }]);
    const record = await as(ids.coordinator).query(api.neighbors.record, { churchId: ids.church, neighborId: ids.rosa });
    expect(record.openings).toMatchObject([{ who: "Thomas Okafor" }]);
    // Reading the list or another record adds nothing.
    await as(ids.coordinator).query(api.neighbors.list, { churchId: ids.church });
    expect((await as(ids.owner).query(api.neighbors.record, { churchId: ids.church, neighborId: ids.earl })).openings).toEqual([]);
    expect(await openings(t)).toHaveLength(1);
  });

  test("the record gathers calls, requests, visits and payments, newest first", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.church, neighborId = ids.rosa;
    const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
    await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId, callerName: "Rosa Delgado", phone: "(239) 555-0142", note: "Behind on rent.", callback: "needed" });
    const open = await as(ids.coordinator).mutation(api.assistance.createRequest, { churchId, neighborId, kind: "rent", summary: "November rent.", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co." });
    await t.run(async (ctx) => {
      const paid = await ctx.db.insert("assistanceRequests", { churchId, neighborId, kind: "utility", summary: "Electric bill.", amountRequested: 31000, amountApproved: 31000, status: "paid", decisionNote: "", decidedBy: ids.owner.memberId, decidedAt: now - 5000, payeeKind: "utility", payeeName: "Example Power", source: "person", createdBy: ids.owner.memberId, createdAt: now - 9000 });
      await ctx.db.insert("ledgerEntries", { churchId, kind: "expense", amount: 31000, date: today, category: "utility", payee: "Example Power", memo: "", requestId: paid, neighborId, recordedBy: ids.owner.memberId, createdAt: now });
      await ctx.db.insert("ledgerEntries", { churchId, kind: "expense", amount: 9900, date: today, category: "food", payee: "Fixture Family Market", memo: "", neighborId, voidedAt: now, recordedBy: ids.owner.memberId, createdAt: now });
      await ctx.db.insert("visits", { churchId, neighborId, requestId: paid, scheduledAt: now - 8000, status: "completed", visitors: [{ memberId: ids.owner.memberId, hours: 1, miles: 6 }, { memberId: ids.coordinator.memberId, hours: 1, miles: 6 }], notes: "", completedAt: now - 7000, createdBy: ids.owner.memberId, createdAt: now - 8500 });
      await ctx.db.insert("visits", { churchId, neighborId, requestId: open, scheduledAt: now + 86400000, status: "scheduled", visitors: [], notes: "", createdBy: ids.owner.memberId, createdAt: now });
    });
    const record = await as(ids.owner).query(api.neighbors.record, { churchId, neighborId });
    expect(record).toMatchObject({ paidThisYear: 31000, requestsThisYear: 2, visitsDone: 1, lastVisitAt: now - 7000, neighbor: { name: "Rosa Delgado", adults: 2, children: 2 } });
    expect(record.open).toMatchObject([{ id: open, status: "open" }]);
    expect(record.history.map((event) => event.type).sort()).toEqual(["call", "payment", "visit"]);
    expect(record.history).toEqual([...record.history].sort((a, b) => b.at - a.at));
    expect(record.history.find((event) => event.type === "visit")).toMatchObject({ who: ["Marisol Vega", "Thomas Okafor"] });
    expect((await as(ids.owner).query(api.neighbors.list, { churchId, search: "rosa" })).rows).toMatchObject([{ openRequest: { kind: "rent", amount: 45000 }, visitAt: now + 86400000, lastHelpedAt: now - 5000 }]);
  });
});

describe("adding and finding neighbors", () => {
  test("a duplicate phone is caught, however it is typed, until a person says it is someone new", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const sameHouse = { ...pat, name: "Lucia Delgado", phone: "239-555-0142" };
    expect(await as(ids.owner).query(api.neighbors.matches, { churchId, name: sameHouse.name, phone: sameHouse.phone })).toMatchObject([{ id: ids.rosa, same: "phone" }]);
    await expect(as(ids.owner).mutation(api.neighbors.create, { churchId, ...sameHouse })).rejects.toThrow("Rosa Delgado is already on file with this phone number.");
    await expect(as(ids.owner).mutation(api.neighbors.create, { churchId, ...pat, name: "rosa  DELGADO" })).rejects.toThrow("already on file with this name");
    const created = await as(ids.owner).mutation(api.neighbors.create, { churchId, ...sameHouse, confirmedNew: true });
    expect((await as(ids.owner).query(api.neighbors.record, { churchId, neighborId: created })).neighbor).toMatchObject({ name: "Lucia Delgado", language: "ht" });
    // The same phone in another group is not a duplicate here.
    await as(ids.owner).mutation(api.neighbors.create, { churchId, ...pat, name: "Mai Tran", phone: "(239) 555-0150" });
  });

  test("a new neighbor can be tied to the call that brought them", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const { callId } = await as(ids.owner).mutation(api.assistance.recordCall, { churchId, callerName: "Patrice", phone: pat.phone, note: "Food for six.", callback: "needed" });
    const neighborId = await as(ids.owner).mutation(api.neighbors.create, { churchId, ...pat, callId });
    expect((await as(ids.owner).query(api.neighbors.record, { churchId, neighborId })).calls).toMatchObject([{ id: callId, note: "Food for six." }]);
  });

  test("search finds by the start of a name, by phone and by street, only in your group", async () => {
    const { ids, as } = await setup();
    const find = async (search?: string) => (await as(ids.coordinator).query(api.neighbors.list, { churchId: ids.church, search })).rows.map((row) => row.name);
    expect(await find()).toEqual(["Earl Jennings", "Rosa Delgado"]);
    expect(await find("ros")).toEqual(["Rosa Delgado"]);
    expect(await find("(239) 555-017")).toEqual(["Earl Jennings"]);
    expect(await find("Example")).toEqual(["Earl Jennings"]);
    expect(await find("Mai")).toEqual([]);
    expect(await find("Demo")).toEqual([]);
  });

  test("a name is required and household counts are whole numbers", async () => {
    const { ids, as } = await setup();
    const create = (change: Partial<{ name: string; adults: number }>) => as(ids.owner).mutation(api.neighbors.create, { churchId: ids.church, ...pat, ...change });
    await expect(create({ name: " " })).rejects.toThrow("A name is needed.");
    await expect(create({ adults: 0 })).rejects.toThrow("Adults must be a whole number.");
    await expect(create({ adults: 1.5 })).rejects.toThrow("whole number");
  });
});
