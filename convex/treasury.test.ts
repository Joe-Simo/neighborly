/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { DateTime } from "luxon";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { paidTowardRequest } from "./treasury";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const refused = "Neighbor records are open to coordinators and owners only.";
const zone = "America/New_York";
const now = DateTime.now().setZone(zone);
const day = (daysAgo = 0) => now.minus({ days: daysAgo }).toFormat("yyyy-MM-dd");

type Request = Pick<Doc<"assistanceRequests">, "status" | "payeeKind" | "payeeName"> & { amountApproved?: number };

async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const empty = defineSchema({});
  t.registerComponent("auth", empty, { "./_generated/server.js": async () => ({}), "./public.ts": async () => ({ getSession: queryGeneric({ args: { sessionId: v.string() }, handler: async (_, { sessionId }) => (emails.has(sessionId) ? { userId: sessionId } : null) }) }) });
  t.registerComponent("authEmail", empty, { "./_generated/server.js": async () => ({}), "./verifiedEmails.ts": async () => ({ getPrimaryEmail: queryGeneric({ args: { userId: v.string() }, handler: async (_, { userId }) => emails.get(userId) ?? null }) }) });
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "St. Sample Conference", timeZone: zone });
    const other = await ctx.db.insert("churches", { name: "Another Sample Conference", timeZone: zone });
    const join = async (group: Id<"churches">, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: group, userId, name: `Sample ${role}`, email: `${role}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await join(church, "owner"), coordinator = await join(church, "coordinator"), member = await join(church, "member"), stranger = await join(other, "owner");
    const neighbor = (group: Id<"churches">, createdBy: Id<"memberships">) => ctx.db.insert("neighbors", { churchId: group, name: "Alma Figueroa", nameKey: "alma figueroa", phone: "(555) 0101", phoneKey: "5550101", email: "", address: "12 Sample St", adults: 1, children: 2, language: "en", notes: "", createdBy, createdAt: 0 });
    return { church, other, owner, coordinator, member, stranger, neighbor: await neighbor(church, owner.memberId), elsewhere: await neighbor(other, stranger.memberId) };
  });
  for (const person of [ids.owner, ids.coordinator, ids.member, ids.stranger]) emails.set(person.userId, `${person.userId}@neighborly.example`);

  const request = (fields: Partial<Request> = {}, group = ids.church, neighborId = ids.neighbor) =>
    t.run((ctx) => ctx.db.insert("assistanceRequests", { churchId: group, neighborId, kind: "utility", summary: "Shut-off notice on the electric bill", amountRequested: 30000, amountApproved: 21460, status: "approved", decisionNote: "", payeeKind: "utility", payeeName: "Demo Power & Light", source: "person", createdBy: ids.owner.memberId, createdAt: 0, ...fields }));
  const income = (amount: number, date: string, category = "Parish collection") =>
    t.run((ctx) => ctx.db.insert("ledgerEntries", { churchId: ids.church, kind: "income", amount, date, category, payee: "St. Sample Parish", memo: "Poor-box collection", recordedBy: ids.owner.memberId, createdAt: 0 }));
  const entries = (group = ids.church) => t.run((ctx) => ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", group)).collect());
  return { t, ids, request, income, entries, as: (person: { userId: string }) => t.withIdentity({ subject: person.userId }) };
}

const sum = (rows: Pick<Doc<"ledgerEntries">, "kind" | "amount">[]) => rows.reduce((total, row) => total + (row.kind === "income" ? row.amount : -row.amount), 0);

describe("who may see and use the ledger", () => {
  test("a member is refused on every function; a coordinator and an owner pass", async () => {
    const { ids, as, request, income, entries } = await setup();
    const requestId = await request();
    await income(50000, day(3));
    const payment = { churchId: ids.church, requestId, amount: 1000, date: day() };
    await expect(as(ids.member).query(api.treasury.ledger, { churchId: ids.church })).rejects.toThrow(refused);
    await expect(as(ids.member).query(api.treasury.payable, { churchId: ids.church })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.treasury.recordPayment, payment)).rejects.toThrow(refused);
    await expect(as(ids.stranger).query(api.treasury.ledger, { churchId: ids.church })).rejects.toThrow("Workspace access required.");
    await expect(as(ids.stranger).mutation(api.treasury.recordPayment, payment)).rejects.toThrow("Workspace access required.");
    expect(await entries()).toHaveLength(1);

    expect((await as(ids.coordinator).query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(50000);
    expect(await as(ids.owner).query(api.treasury.payable, { churchId: ids.church })).toHaveLength(1);
    await as(ids.coordinator).mutation(api.treasury.recordPayment, payment);
    expect(await entries()).toHaveLength(2);
  });

  test("a request from another group cannot be paid through your own", async () => {
    const { ids, as, request } = await setup();
    const theirs = await request({}, ids.other, ids.elsewhere);
    await expect(as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId: theirs, amount: 1000, date: day() })).rejects.toThrow("Request not found.");
  });
});

describe("paying an approved request", () => {
  test("the payment goes to the payee on the request and is tied to the request and the neighbor", async () => {
    const { ids, as, request, income, entries } = await setup();
    const requestId = await request();
    await income(100000, day(5));
    const id = await as(ids.coordinator).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, amount: 21460, date: day(1), memo: " Check 1042 " });
    expect((await entries()).find((entry) => entry._id === id)).toMatchObject({ kind: "expense", amount: 21460, date: day(1), category: "utility", payee: "Demo Power & Light", memo: "Check 1042", requestId, neighborId: ids.neighbor, recordedBy: ids.coordinator.memberId });

    const view = await as(ids.coordinator).query(api.treasury.ledger, { churchId: ids.church, month: day(1).slice(0, 7) });
    expect(view.balance).toBe(78540);
    expect(view.entries.find((entry) => entry.id === id)).toMatchObject({ what: "Shut-off notice on the electric bill, Demo Power & Light", neighbor: { id: ids.neighbor, name: "Alma Figueroa" } });
  });

  test("payments in parts never pass the approved amount", async () => {
    const { t, ids, as, request } = await setup();
    const requestId = await request({ amountApproved: 60000 });
    const pay = (amount: number) => as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, amount, date: day() });
    const owed = async () => (await as(ids.owner).query(api.treasury.payable, { churchId: ids.church })).map(({ paid, remaining }) => ({ paid, remaining }));

    await expect(pay(60001)).rejects.toThrow("more than what is left");
    await pay(25000);
    expect(await owed()).toEqual([{ paid: 25000, remaining: 35000 }]);
    await expect(pay(35001)).rejects.toThrow("more than what is left");
    await pay(35000);
    expect(await owed()).toEqual([]);
    await expect(pay(1)).rejects.toThrow("already paid in full");
    expect(await t.run((ctx) => paidTowardRequest(ctx, requestId))).toBe(60000);
  });

  test("only an approved request can be paid", async () => {
    const { ids, as, request } = await setup();
    for (const status of ["open", "declined", "paid", "closed"] as const) {
      const requestId = await request({ status });
      await expect(as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, amount: 1000, date: day() })).rejects.toThrow("Only an approved request can be paid.");
    }
    const noAmount = await request({ amountApproved: undefined });
    await expect(as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId: noAmount, amount: 1000, date: day() })).rejects.toThrow("Only an approved request can be paid.");
  });

  test("the neighbor is never the payee", async () => {
    const { ids, as, request, entries } = await setup();
    const cases = [
      [{ payeeKind: "neighbor", payeeName: "Demo Power & Light" }, "never to the neighbor"],
      [{ payeeKind: "landlord", payeeName: "  ALMA  Figueroa." }, "never to the neighbor"],
      [{ payeeKind: "vendor", payeeName: "   " }, "Add who is to be paid"],
    ] as const;
    for (const [fields, message] of cases) {
      const requestId = await request(fields);
      await expect(as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, amount: 1000, date: day() })).rejects.toThrow(message);
    }
    expect(await entries()).toHaveLength(0);
  });

  test("cents never become fractions, and a payment is never dated ahead", async () => {
    const { ids, as, request, entries } = await setup();
    const requestId = await request();
    const pay = (amount: number, date = day()) => as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, amount, date });
    for (const amount of [10.5, 0.1 + 0.2, 0, -500, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])
      await expect(pay(amount)).rejects.toThrow("Enter an amount");
    await expect(pay(1000, day(-1))).rejects.toThrow("cannot be dated in the future");
    for (const date of ["", "2026-02-30", "11/15/2026"]) await expect(pay(1000, date)).rejects.toThrow("Choose the day");
    expect(await entries()).toHaveLength(0);
    await pay(1);
    expect((await entries()).every((entry) => Number.isInteger(entry.amount))).toBe(true);
  });
});

describe("a balance that always adds up", () => {
  test("after any sequence of money in and payments, the balance is the sum of the entries", async () => {
    const { ids, as, request, income, entries } = await setup();
    // A fixed-seed sequence, so a failure can be replayed.
    let state = 1833;
    const next = (low: number, high: number) => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return low + (state % (high - low + 1));
    };
    for (let step = 0; step < 40; step++) {
      if (next(0, 2) === 0) await income(next(1, 500000), day(next(0, 80)));
      else {
        const approved = next(1, 90000);
        const requestId = await request({ amountApproved: approved });
        const parts = next(1, 3);
        let left = approved;
        for (let part = 0; part < parts && left > 0; part++) {
          const amount = part === parts - 1 ? left : next(1, left);
          await as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, amount, date: day(next(0, 80)) });
          left -= amount;
        }
      }
      expect((await as(ids.owner).query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(sum(await entries()));
    }

    // Month by month: each row's balance is the one before it plus the entry, and the months join up.
    const all = await entries();
    const current = await as(ids.owner).query(api.treasury.ledger, { churchId: ids.church });
    let carried = 0, seen = 0;
    for (const month of [...current.months].reverse()) {
      const view = await as(ids.owner).query(api.treasury.ledger, { churchId: ids.church, month });
      expect(view.opening).toBe(carried);
      for (const row of [...view.entries].reverse()) {
        carried += row.kind === "income" ? row.amount : -row.amount;
        expect(row.balance).toBe(carried);
        expect(row.date.slice(0, 7)).toBe(month);
      }
      expect(view.moneyIn - view.moneyOut).toBe(carried - view.opening);
      expect(view.balance).toBe(sum(all));
      seen += view.entries.length;
    }
    expect(seen).toBe(all.length);
    expect(carried).toBe(sum(all));
  });

  test("the sample conference's year adds up, and every request waiting for payment is approved and unpaid", async () => {
    const { t, ids, as } = await setup();
    const churchId = await t.mutation(internal.sampleData.load, { owner: { userId: ids.owner.userId, name: "Marisol Vega", email: "marisol.vega@neighborly.example" } });
    const all = await t.run((ctx) => ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect());
    const view = await as(ids.owner).query(api.treasury.ledger, { churchId });
    expect(view.balance).toBe(sum(all));
    expect(view.balance).toBeGreaterThan(0);

    const approved = await t.run((ctx) => ctx.db.query("assistanceRequests").withIndex("by_church_status", (q) => q.eq("churchId", churchId).eq("status", "approved")).collect());
    const waiting = await as(ids.owner).query(api.treasury.payable, { churchId });
    expect(waiting.map((row) => row.requestId).sort()).toEqual(approved.map((row) => row._id).sort());
    for (const row of waiting) expect(row).toMatchObject({ paid: 0, remaining: row.amountApproved });
  });
});
