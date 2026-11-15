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
      rosa: await record(church, "Esperanza Montoya", "(100) 555-0104", "14 Sample St, Apt 2", owner.memberId),
      earl: await record(church, "Darnell Joseph", "(100) 555-0103", "8 Example Ave", owner.memberId),
      elsewhere: await record(other, "Celeste Greenhalgh", "(100) 555-0102", "31 Demo Ct", stranger.memberId),
    };
  });
  for (const person of [ids.owner, ids.coordinator, ids.member, ids.stranger]) emails.set(person.userId, `${person.userId}@neighborly.example`);
  return { t, ids, as: (person: { userId: string }) => t.withIdentity({ subject: person.userId }) };
}

const pat = { name: "Fabrice Pemberton", phone: "(100) 555-0105", email: "", address: "220 Placeholder Rd", adults: 2, children: 4, language: "ht", notes: "" } as const;
const openings = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.run((ctx) => ctx.db.query("auditEvents").collect());

describe("who may use neighbor records", () => {
  test("a member is refused on every function and a coordinator passes", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    for (const person of [ids.member, ids.coordinator]) {
      const caller = as(person);
      const attempts = [
        () => caller.query(api.neighbors.list, { churchId }),
        () => caller.query(api.neighbors.matches, { churchId, name: "Esperanza Montoya", phone: "" }),
        () => caller.mutation(api.neighbors.create, { churchId, ...pat }),
        () => caller.mutation(api.neighbors.update, { churchId, neighborId: ids.rosa, ...pat, name: "Esperanza Montoya", phone: "(100) 555-0104" }),
        () => caller.mutation(api.neighbors.open, { churchId, neighborId: ids.rosa }),
        () => caller.query(api.neighbors.record, { churchId, neighborId: ids.rosa }),
        () => caller.mutation(api.neighbors.saveHousehold, { churchId, neighborId: ids.rosa, household: [] }),
        () => caller.mutation(api.neighbors.showAccounts, { churchId, neighborId: ids.rosa }),
        () => caller.mutation(api.neighbors.addNote, { churchId, neighborId: ids.rosa, body: "Prefers a call after five." }),
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
    await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId, callerName: "Esperanza Montoya", phone: "(100) 555-0104", note: "Behind on rent.", callback: "needed" });
    const open = await as(ids.coordinator).mutation(api.assistance.createRequest, { churchId, neighborId, kind: "rent", summary: "November rent.", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co." });
    await t.run(async (ctx) => {
      const paid = await ctx.db.insert("assistanceRequests", { churchId, neighborId, kind: "utility", summary: "Electric bill.", amountRequested: 31000, amountApproved: 31000, status: "paid", decisionNote: "", decidedBy: ids.owner.memberId, decidedAt: now - 5000, payeeKind: "utility", payeeName: "Example Power", source: "person", createdBy: ids.owner.memberId, createdAt: now - 9000 });
      await ctx.db.insert("ledgerEntries", { churchId, kind: "expense", amount: 31000, date: today, category: "utility", payee: "Example Power", memo: "", requestId: paid, neighborId, recordedBy: ids.owner.memberId, createdAt: now });
      await ctx.db.insert("ledgerEntries", { churchId, kind: "expense", amount: 9900, date: today, category: "food", payee: "Fixture Family Market", memo: "", neighborId, voidedAt: now, recordedBy: ids.owner.memberId, createdAt: now });
      await ctx.db.insert("visits", { churchId, neighborId, requestId: paid, scheduledAt: now - 8000, status: "completed", visitors: [{ memberId: ids.owner.memberId, hours: 1, miles: 6 }, { memberId: ids.coordinator.memberId, hours: 1, miles: 6 }], notes: "", completedAt: now - 7000, createdBy: ids.owner.memberId, createdAt: now - 8500 });
      await ctx.db.insert("visits", { churchId, neighborId, requestId: open, scheduledAt: now + 86400000, status: "scheduled", visitors: [], notes: "", createdBy: ids.owner.memberId, createdAt: now });
    });
    const record = await as(ids.owner).query(api.neighbors.record, { churchId, neighborId });
    expect(record).toMatchObject({ paidThisYear: 31000, requestsThisYear: 2, visitsDone: 1, lastVisitAt: now - 7000, neighbor: { name: "Esperanza Montoya", adults: 2, children: 2 } });
    expect(record.open).toMatchObject([{ id: open, status: "open" }]);
    expect(record.history.map((event) => event.type).sort()).toEqual(["call", "payment", "visit"]);
    expect(record.history).toEqual([...record.history].sort((a, b) => b.at - a.at));
    expect(record.history.find((event) => event.type === "visit")).toMatchObject({ who: ["Marisol Vega", "Thomas Okafor"] });
    expect((await as(ids.owner).query(api.neighbors.list, { churchId, search: "esperanza" })).rows).toMatchObject([{ openRequest: { kind: "rent", amount: 45000 }, visitAt: now + 86400000, lastHelpedAt: now - 5000 }]);
  });
});

describe("the home on a record", () => {
  test("who lives there sets the counts, the month adds up, and account numbers stay covered until asked for", async () => {
    const { t, ids, as } = await setup();
    const target = { churchId: ids.church, neighborId: ids.rosa };
    const year = new Date().getUTCFullYear();
    await as(ids.coordinator).mutation(api.neighbors.saveHousehold, {
      ...target,
      household: [{ relationship: "Mother", child: false, birthYear: year - 41 }, { relationship: "Son", child: true, birthYear: year - 12 }, { relationship: "Grandmother", child: false }],
      money: { income: [{ label: "Wages", amount: 185000 }], expenses: [{ label: "Rent", amount: 145000 }, { label: "Electric", amount: 21000 }] },
      accounts: [{ kind: "utility", name: "Example Power", accountNumber: "00-4417-9921", phone: "" }],
    });
    const record = await as(ids.coordinator).query(api.neighbors.record, target);
    expect(record.neighbor).toMatchObject({ adults: 2, children: 1 });
    expect(record.household.map((person) => person.age)).toEqual([41, 12, null]);
    expect(record.money).toMatchObject({ income: [{ amount: 185000 }], expenses: [{ label: "Rent" }, { label: "Electric" }] });
    expect(record.accounts).toEqual([{ kind: "utility", name: "Example Power", ending: "9921", phone: "" }]);
    expect(JSON.stringify(record)).not.toContain("4417");
    expect(await openings(t)).toHaveLength(0);
    expect(await as(ids.coordinator).mutation(api.neighbors.showAccounts, target)).toMatchObject([{ accountNumber: "00-4417-9921" }]);
    expect(await openings(t)).toMatchObject([{ action: "neighbor.opened", actorId: ids.coordinator.userId, targetId: ids.rosa }]);
    // Saving one part leaves the others as they were.
    await as(ids.owner).mutation(api.neighbors.saveHousehold, { ...target, money: { income: [], expenses: [] } });
    expect((await as(ids.owner).query(api.neighbors.record, target)).accounts).toHaveLength(1);
    await expect(as(ids.owner).mutation(api.neighbors.saveHousehold, { ...target, household: [{ relationship: "Son", child: true }] })).rejects.toThrow("at least one adult");
    await expect(as(ids.owner).mutation(api.neighbors.saveHousehold, { ...target, money: { income: [{ label: "Wages", amount: -5 }], expenses: [] } })).rejects.toThrow("zero or more");
    await expect(as(ids.owner).mutation(api.neighbors.saveHousehold, { churchId: ids.church, neighborId: ids.elsewhere, household: [] })).rejects.toThrow("Record not found.");
  });

  test("a note is signed and dated in the history, and an alert sits on the record", async () => {
    const { ids, as } = await setup();
    const target = { churchId: ids.church, neighborId: ids.rosa };
    await as(ids.coordinator).mutation(api.neighbors.addNote, { ...target, body: "  Works nights; call after five.  " });
    await expect(as(ids.coordinator).mutation(api.neighbors.addNote, { ...target, body: " " })).rejects.toThrow("Write the note first.");
    await as(ids.owner).mutation(api.neighbors.update, { ...target, ...pat, name: "Esperanza Montoya", phone: "(100) 555-0104", alert: "Call before visiting." });
    const record = await as(ids.owner).query(api.neighbors.record, target);
    expect(record.history).toMatchObject([{ type: "note", note: "Works nights; call after five.", who: "Thomas Okafor" }]);
    expect(record.neighbor.alert).toBe("Call before visiting.");
  });

  test("help brought over from earlier records shows as past help, not as a decision made here", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.church, neighborId = ids.rosa, now = Date.now();
    await t.run(async (ctx) => {
      const brought = { churchId, neighborId, decisionNote: "", payeeKind: "landlord" as const, source: "import" as const, createdBy: ids.owner.memberId };
      await ctx.db.insert("assistanceRequests", { ...brought, kind: "rent", summary: "Short on rent.", amountRequested: 45000, importedAmount: 45000, status: "closed", payeeName: "Sample Street Apartments", createdAt: now - 1000 });
      await ctx.db.insert("assistanceRequests", { ...brought, kind: "food", summary: "Call back about the pantry.", amountRequested: 0, status: "open", payeeName: "", createdAt: now - 3 * 86400000 });
    });
    const record = await as(ids.owner).query(api.neighbors.record, { churchId, neighborId });
    expect(record.history).toMatchObject([{ type: "brought", kind: "rent", amount: 45000, payee: "Sample Street Apartments", at: now - 1000 }]);
    expect(record.paidThisYear).toBe(45000);
    expect(record.open).toMatchObject([{ source: "import", kind: "food" }]);
    expect((await as(ids.owner).query(api.neighbors.list, { churchId, search: "esperanza" })).rows).toMatchObject([{ lastHelpedAt: now - 1000 }]);
  });
});

describe("adding and finding neighbors", () => {
  test("a duplicate phone is caught, however it is typed, until a person says it is someone new", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const sameHouse = { ...pat, name: "Alma Montoya", phone: "100-555-0104" };
    expect(await as(ids.owner).query(api.neighbors.matches, { churchId, name: sameHouse.name, phone: sameHouse.phone })).toMatchObject([{ id: ids.rosa, same: "phone" }]);
    await expect(as(ids.owner).mutation(api.neighbors.create, { churchId, ...sameHouse })).rejects.toThrow("Esperanza Montoya is already on file with this phone number.");
    await expect(as(ids.owner).mutation(api.neighbors.create, { churchId, ...pat, name: "esperanza  MONTOYA" })).rejects.toThrow("already on file with this name");
    const created = await as(ids.owner).mutation(api.neighbors.create, { churchId, ...sameHouse, confirmedNew: true });
    expect((await as(ids.owner).query(api.neighbors.record, { churchId, neighborId: created })).neighbor).toMatchObject({ name: "Alma Montoya", language: "ht" });
    // The same phone in another group is not a duplicate here.
    await as(ids.owner).mutation(api.neighbors.create, { churchId, ...pat, name: "Celeste Greenhalgh", phone: "(100) 555-0102" });
  });

  test("a new neighbor can be tied to the call that brought them", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const { callId } = await as(ids.owner).mutation(api.assistance.recordCall, { churchId, callerName: "Fabrice", phone: pat.phone, note: "Food for six.", callback: "needed" });
    const neighborId = await as(ids.owner).mutation(api.neighbors.create, { churchId, ...pat, callId });
    expect((await as(ids.owner).query(api.neighbors.record, { churchId, neighborId })).calls).toMatchObject([{ id: callId, note: "Food for six." }]);
  });

  test("search finds by the start of a name, by phone and by street, only in your group", async () => {
    const { ids, as } = await setup();
    const find = async (search?: string) => (await as(ids.coordinator).query(api.neighbors.list, { churchId: ids.church, search })).rows.map((row) => row.name);
    expect(await find()).toEqual(["Darnell Joseph", "Esperanza Montoya"]);
    expect(await find("esp")).toEqual(["Esperanza Montoya"]);
    expect(await find("(100) 555-0103")).toEqual(["Darnell Joseph"]);
    expect(await find("Example")).toEqual(["Darnell Joseph"]);
    expect(await find("Celeste")).toEqual([]);
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
