/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { DateTime } from "luxon";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import { voucherGiven } from "./treasury";
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
  return { t, ids, request, income, entries, as: (person: { userId: string }) => signedIn(t, person.userId, emails.has(person.userId)) };
}

const sum = (rows: Pick<Doc<"ledgerEntries">, "kind" | "amount">[]) => rows.reduce((total, row) => total + (row.kind === "income" ? row.amount : -row.amount), 0);

describe("who may see and use the ledger", () => {
  test("a member is refused on every function; a coordinator and an owner pass", async () => {
    const { ids, as, request, income, entries } = await setup();
    const requestId = await request();
    await income(50000, day(3));
    const payment = { paidSeen: 0, churchId: ids.church, requestId, amount: 1000, date: day() };
    await expect(as(ids.member).query(api.treasury.ledger, { churchId: ids.church })).rejects.toThrow(refused);
    await expect(as(ids.member).query(api.treasury.payable, { churchId: ids.church })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.treasury.recordPayment, payment)).rejects.toThrow(refused);
    const gift = { churchId: ids.church, amount: 15000, date: day(), to: "St. Placeholder Conference" };
    const collection = { churchId: ids.church, source: "collection" as const, amount: 64000, date: day(), from: "St. Sample Parish" };
    await expect(as(ids.member).mutation(api.treasury.recordIncome, collection)).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.treasury.recordTwinningGift, gift)).rejects.toThrow(refused);
    await expect(as(ids.stranger).mutation(api.treasury.recordIncome, collection)).rejects.toThrow("Workspace access required.");
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
    await expect(as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: theirs, amount: 1000, date: day() })).rejects.toThrow("Request not found.");
  });
});

describe("paying an approved request", () => {
  test("the payment goes to the payee on the request and is tied to the request and the neighbor", async () => {
    const { ids, as, request, income, entries } = await setup();
    const requestId = await request();
    await income(100000, day(5));
    const id = await as(ids.coordinator).mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId, amount: 21460, date: day(1), memo: " Check 1042 " });
    expect((await entries()).find((entry) => entry._id === id)).toMatchObject({ kind: "expense", amount: 21460, date: day(1), category: "utility", payee: "Demo Power & Light", memo: "Check 1042", requestId, neighborId: ids.neighbor, recordedBy: ids.coordinator.memberId });

    const view = await as(ids.coordinator).query(api.treasury.ledger, { churchId: ids.church, month: day(1).slice(0, 7) });
    expect(view.balance).toBe(78540);
    expect(view.entries.find((entry) => entry.id === id)).toMatchObject({ summary: "Shut-off notice on the electric bill", payee: "Demo Power & Light", neighbor: { id: ids.neighbor, name: "Alma Figueroa" } });
  });

  test("payments in parts never pass the approved amount", async () => {
    const { t, ids, as, request } = await setup();
    const requestId = await request({ amountApproved: 60000 });
    const pay = async (amount: number) => as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: await t.run((ctx) => paidTowardRequest(ctx, requestId)), churchId: ids.church, requestId, amount, date: day() });
    const owed = async () => (await as(ids.owner).query(api.treasury.payable, { churchId: ids.church })).map(({ paid, remaining }) => ({ paid, remaining }));

    await expect(pay(60001)).rejects.toThrow("more than what is left");
    await pay(25000);
    expect(await owed()).toEqual([{ paid: 25000, remaining: 35000 }]);
    expect((await t.run((ctx) => ctx.db.get("assistanceRequests", requestId)))?.status).toBe("approved");
    await expect(pay(35001)).rejects.toThrow("more than what is left");
    await pay(35000);
    expect(await owed()).toEqual([]);
    // The last payment marks the request paid; a part payment leaves it approved.
    await expect(pay(1)).rejects.toThrow("Only an approved request can be paid.");
    expect(await t.run((ctx) => paidTowardRequest(ctx, requestId))).toBe(60000);
    expect((await t.run((ctx) => ctx.db.get("assistanceRequests", requestId)))?.status).toBe("paid");
  });

  test("only an approved request can be paid", async () => {
    const { ids, as, request } = await setup();
    for (const status of ["open", "declined", "paid", "closed"] as const) {
      const requestId = await request({ status });
      await expect(as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId, amount: 1000, date: day() })).rejects.toThrow("Only an approved request can be paid.");
    }
    const noAmount = await request({ amountApproved: undefined });
    await expect(as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: noAmount, amount: 1000, date: day() })).rejects.toThrow("Only an approved request can be paid.");
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
      await expect(as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId, amount: 1000, date: day() })).rejects.toThrow(message);
    }
    expect(await entries()).toHaveLength(0);
  });

  test("cents never become fractions, and a payment is never dated ahead", async () => {
    const { ids, as, request, entries } = await setup();
    const requestId = await request();
    const pay = (amount: number, date = day()) => as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId, amount, date });
    for (const amount of [10.5, 0.1 + 0.2, 0, -500, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])
      await expect(pay(amount)).rejects.toThrow("Enter an amount");
    await expect(pay(1000, day(-1))).rejects.toThrow("cannot be dated in the future");
    for (const date of ["", "2026-02-30", "11/15/2026"]) await expect(pay(1000, date)).rejects.toThrow("Choose the day");
    expect(await entries()).toHaveLength(0);
    await pay(1);
    expect((await entries()).every((entry) => Number.isInteger(entry.amount))).toBe(true);
  });
});

describe("money in and twinning gifts", () => {
  test("each source is stored under its plain name and raises the balance; a gift out lowers it", async () => {
    const { ids, as, entries } = await setup();
    const owner = as(ids.owner);
    const sources = [["opening", "Opening balance"], ["collection", "Parish collection"], ["walk", "Friends of the Poor Walk"], ["donation", "Donation"], ["twinning", "Twinning received"]] as const;
    for (const [source] of sources) await owner.mutation(api.treasury.recordIncome, { churchId: ids.church, source, amount: 10001, date: day(2), from: " St. Sample Parish " });
    await owner.mutation(api.treasury.recordTwinningGift, { churchId: ids.church, amount: 15000, date: day(1), to: "St. Placeholder Conference", memo: "Quarterly gift" });

    const all = await entries();
    expect(all.filter((entry) => entry.kind === "income").map((entry) => entry.category)).toEqual(sources.map(([, label]) => label));
    expect(all.at(-1)).toMatchObject({ kind: "expense", amount: 15000, category: "Twinning gift", payee: "St. Placeholder Conference", memo: "Quarterly gift", recordedBy: ids.owner.memberId });
    expect(all.every((entry) => entry.payee === entry.payee.trim() && !entry.requestId && !entry.neighborId)).toBe(true);
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(5 * 10001 - 15000);
  });

  test("an entry needs whole cents, a real day not ahead of today, and a name", async () => {
    const { ids, as, entries } = await setup();
    const owner = as(ids.owner);
    const income = (fields: { amount?: number; date?: string; from?: string }) => owner.mutation(api.treasury.recordIncome, { churchId: ids.church, source: "donation", amount: 5000, date: day(), from: "Anonymous gift", ...fields });
    const gift = (fields: { amount?: number; date?: string; to?: string }) => owner.mutation(api.treasury.recordTwinningGift, { churchId: ids.church, amount: 5000, date: day(), to: "St. Placeholder Conference", ...fields });
    for (const record of [income, gift]) {
      for (const amount of [99.5, 0, -1, Number.NaN]) await expect(record({ amount })).rejects.toThrow("Enter an amount");
      await expect(record({ date: day(-1) })).rejects.toThrow("cannot be dated in the future");
      await expect(record({ date: "2026-13-01" })).rejects.toThrow("Choose the day");
    }
    await expect(income({ from: "  " })).rejects.toThrow("Say where the money came from.");
    await expect(gift({ to: "" })).rejects.toThrow("Say which conference");
    expect(await entries()).toHaveLength(0);
  });
});

describe("spending that is not for a neighbor", () => {
  test("each kind is stored under its plain name, lowers the balance and is tied to no request", async () => {
    const { ids, as, income, entries } = await setup();
    const owner = as(ids.owner);
    await income(100000, day(5));
    const kinds = [["pantry", "Pantry purchase"], ["supplies", "Supplies"], ["dues", "Council dues"], ["fee", "Bank fee"], ["twinning", "Twinning gift"], ["other", "Other spending"]] as const;
    for (const [kind] of kinds) await owner.mutation(api.treasury.recordSpending, { churchId: ids.church, kind, amount: 1250, date: day(1), to: " Fixture Family Market ", memo: "Receipt 88" });
    const spent = (await entries()).filter((entry) => entry.kind === "expense");
    expect(spent.map((entry) => entry.category)).toEqual(kinds.map(([, label]) => label));
    expect(spent.every((entry) => entry.payee === "Fixture Family Market" && entry.memo === "Receipt 88" && !entry.requestId && !entry.neighborId && entry.recordedBy === ids.owner.memberId)).toBe(true);
    const view = await owner.query(api.treasury.ledger, { churchId: ids.church });
    expect(view).toMatchObject({ balance: 100000 - 6 * 1250, neighborsHelped: 0 });
  });

  test("it is refused to a member, and needs whole cents, a real day and a payee", async () => {
    const { ids, as, entries } = await setup();
    const spend = (person: { userId: string }, fields: { amount?: number; date?: string; to?: string } = {}) => as(person).mutation(api.treasury.recordSpending, { churchId: ids.church, kind: "pantry", amount: 5000, date: day(), to: "Fixture Family Market", ...fields });
    await expect(spend(ids.member)).rejects.toThrow(refused);
    await expect(spend(ids.stranger)).rejects.toThrow("Workspace access required.");
    for (const amount of [12.34, 0, -1]) await expect(spend(ids.owner, { amount })).rejects.toThrow("Enter an amount");
    await expect(spend(ids.owner, { date: day(-1) })).rejects.toThrow("cannot be dated in the future");
    await expect(spend(ids.owner, { to: " " })).rejects.toThrow("Say who was paid.");
    expect(await entries()).toHaveLength(0);
  });
});

describe("cash in and cash out by kind", () => {
  test("a period adds up by kind, joins the balance before to the balance after, and nets reversals", async () => {
    const { ids, as, request, income } = await setup();
    const owner = as(ids.owner);
    await income(300000, day(40), "Opening balance");
    await income(64000, day(9));
    await income(36000, day(8));
    await income(15000, day(7), "Donation");
    const paymentId = await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: await request({ amountApproved: 20000 }), amount: 20000, date: day(6) });
    await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: await request({ amountApproved: 9000 }), amount: 9000, date: day(6) });
    await owner.mutation(api.treasury.recordSpending, { churchId: ids.church, kind: "pantry", amount: 4250, date: day(5), to: "Fixture Family Market" });
    const doubled = await owner.mutation(api.treasury.recordIncome, { churchId: ids.church, source: "donation", amount: 15000, date: day(4), from: "Anonymous gift" });
    await owner.mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: doubled, reason: "Entered twice" });
    await owner.mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: paymentId, reason: "Check never cashed" });

    const flow = await owner.query(api.treasury.cashFlow, { churchId: ids.church, from: day(10), to: day() });
    expect(flow).toEqual({
      opening: 300000,
      closing: 300000 + 115000 - 13250,
      moneyIn: 115000,
      moneyOut: 13250,
      kinds: [
        { category: "Parish collection", direction: "in", amount: 100000, entries: 2 },
        { category: "Donation", direction: "in", amount: 15000, entries: 1 },
        { category: "utility", direction: "out", amount: 9000, entries: 1 },
        { category: "Pantry purchase", direction: "out", amount: 4250, entries: 1 },
      ],
    });
    expect(flow.closing).toBe((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance);
    // Before anything was recorded there is nothing, and a later period opens where the earlier one closed.
    expect(await owner.query(api.treasury.cashFlow, { churchId: ids.church, from: day(90), to: day(41) })).toEqual({ opening: 0, closing: 0, moneyIn: 0, moneyOut: 0, kinds: [] });
    expect((await owner.query(api.treasury.cashFlow, { churchId: ids.church, from: day(6), to: day(6) })).opening).toBe(415000);
  });

  test("it is refused to a member and needs two real days in order", async () => {
    const { ids, as } = await setup();
    await expect(as(ids.member).query(api.treasury.cashFlow, { churchId: ids.church, from: day(5), to: day() })).rejects.toThrow(refused);
    await expect(as(ids.owner).query(api.treasury.cashFlow, { churchId: ids.church, from: day(), to: day(5) })).rejects.toThrow("on or after the first day");
    await expect(as(ids.owner).query(api.treasury.cashFlow, { churchId: ids.church, from: "soon", to: day() })).rejects.toThrow("Choose the day.");
  });
});

describe("checks", () => {
  test("a check number is kept as written, and the register lists checks in number order", async () => {
    const { ids, as, request, income, entries } = await setup();
    const owner = as(ids.owner);
    await income(200000, day(20));
    const first = await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: await request({ amountApproved: 30000 }), amount: 30000, date: day(3), checkNumber: " 1042 " });
    await owner.mutation(api.treasury.recordSpending, { churchId: ids.church, kind: "pantry", amount: 4250, date: day(4), to: "Fixture Family Market", checkNumber: "998" });
    await owner.mutation(api.treasury.recordSpending, { churchId: ids.church, kind: "fee", amount: 500, date: day(2), to: "Sample Savings Bank" });
    await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: await request({ amountApproved: 9000 }), amount: 9000, date: day(15), checkNumber: "990" });
    const reversal = await owner.mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: first, reason: "Check was lost in the mail" });
    expect((await entries()).find((entry) => entry._id === reversal)?.checkNumber).toBeUndefined();

    const register = await owner.query(api.treasury.checkRegister, { churchId: ids.church, from: day(10), to: day() });
    expect(register.map(({ checkNumber, payee, amount, reversed, clearedOn }) => ({ checkNumber, payee, amount, reversed, clearedOn }))).toEqual([
      { checkNumber: "998", payee: "Fixture Family Market", amount: 4250, reversed: false, clearedOn: null },
      { checkNumber: "1042", payee: "Demo Power & Light", amount: 30000, reversed: true, clearedOn: null },
    ]);
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church, month: day(3).slice(0, 7) })).entries.find((entry) => entry.id === first)).toMatchObject({ checkNumber: "1042", clearedOn: null });
    await expect(owner.mutation(api.treasury.recordSpending, { churchId: ids.church, kind: "fee", amount: 500, date: day(), to: "Sample Savings Bank", checkNumber: "1".repeat(21) })).rejects.toThrow("Keep the check number");
    await expect(as(ids.member).query(api.treasury.checkRegister, { churchId: ids.church, from: day(10), to: day() })).rejects.toThrow(refused);
  });
});

describe("matching the bank", () => {
  test("the books are always what has cleared plus what is on its way, and marking changes no money", async () => {
    const { ids, as, request, income, entries } = await setup();
    const owner = as(ids.owner);
    const deposit = await income(100000, day(12));
    const check = await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: await request({ amountApproved: 30000 }), amount: 30000, date: day(8), checkNumber: "1042" });
    await owner.mutation(api.treasury.recordSpending, { churchId: ids.church, kind: "pantry", amount: 4250, date: day(6), to: "Fixture Family Market" });
    const late = await income(5000, day(1));
    const adds = async (asOf?: string) => {
      const view = await owner.query(api.treasury.reconciliation, { churchId: ids.church, asOf });
      expect(view.books).toBe(view.cleared + view.onItsWayIn - view.onItsWayOut);
      expect(view.waitingCount).toBe(view.waiting.length);
      return view;
    };
    expect(await adds()).toMatchObject({ books: 70750, cleared: 0, onItsWayIn: 105000, onItsWayOut: 34250, waitingCount: 4, lately: [] });

    const before = await entries();
    await owner.mutation(api.treasury.setCleared, { churchId: ids.church, entryId: deposit, clearedOn: day(11) });
    await owner.mutation(api.treasury.setCleared, { churchId: ids.church, entryId: check, clearedOn: day(5) });
    const strip = (rows: typeof before) => rows.map((row) => ({ ...row, clearedOn: undefined }));
    expect(strip(await entries())).toEqual(strip(before));
    const now = await adds();
    expect(now).toMatchObject({ books: 70750, cleared: 70000, onItsWayIn: 5000, onItsWayOut: 4250, waitingCount: 2 });
    expect(now.lately.map((row) => row.id)).toEqual([check, deposit]);
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(70750);

    // As of an earlier statement: the check had been written but had not cleared yet, and the late gift did not exist.
    expect(await adds(day(7))).toMatchObject({ books: 70000, cleared: 100000, onItsWayIn: 0, onItsWayOut: 30000, waitingCount: 1 });
    expect(await adds(day(30))).toMatchObject({ books: 0, cleared: 0, waitingCount: 0 });

    await owner.mutation(api.treasury.setCleared, { churchId: ids.church, entryId: check, clearedOn: null });
    expect(await adds()).toMatchObject({ cleared: 100000, onItsWayOut: 34250, waitingCount: 3 });
    expect(await owner.mutation(api.treasury.clearThrough, { churchId: ids.church, through: day(2) })).toEqual({ marked: 2, more: false });
    expect(await adds()).toMatchObject({ books: 70750, cleared: 65750, onItsWayIn: 5000, onItsWayOut: 0, waitingCount: 1 });
    expect((await entries()).find((entry) => entry._id === late)?.clearedOn).toBeUndefined();
    expect((await entries()).find((entry) => entry._id === deposit)?.clearedOn).toBe(day(11));
  });

  test("a statement day is real, not ahead of today and not before the entry; a member is refused", async () => {
    const { ids, as, income, entries } = await setup();
    const entryId = await income(40000, day(5));
    const mark = (person: { userId: string }, clearedOn: string | null, churchId = ids.church) => as(person).mutation(api.treasury.setCleared, { churchId, entryId, clearedOn });
    await expect(mark(ids.member, day(4))).rejects.toThrow(refused);
    await expect(mark(ids.stranger, day(4), ids.other)).rejects.toThrow("Entry not found.");
    await expect(mark(ids.owner, day(6))).rejects.toThrow("before the day it was made");
    await expect(mark(ids.owner, day(-1))).rejects.toThrow("cannot be dated in the future");
    await expect(mark(ids.owner, "last week")).rejects.toThrow("Choose the statement day.");
    await expect(as(ids.member).mutation(api.treasury.clearThrough, { churchId: ids.church, through: day() })).rejects.toThrow(refused);
    await expect(as(ids.owner).mutation(api.treasury.clearThrough, { churchId: ids.church, through: day(-1) })).rejects.toThrow("cannot be dated in the future");
    await expect(as(ids.member).query(api.treasury.reconciliation, { churchId: ids.church })).rejects.toThrow(refused);
    expect((await entries())[0].clearedOn).toBeUndefined();
    await mark(ids.coordinator, day(5));
    expect((await entries())[0].clearedOn).toBe(day(5));
  });
});

describe("statements kept", () => {
  test("a statement is kept only when it agrees with what has cleared, and names who matched it", async () => {
    const { ids, as, income } = await setup();
    const owner = as(ids.owner);
    const gift = await income(64000, day(20));
    await income(5000, day(2));
    await owner.mutation(api.treasury.setCleared, { churchId: ids.church, entryId: gift, clearedOn: day(10) });
    await expect(owner.mutation(api.treasury.agreeStatement, { churchId: ids.church, endsOn: day(10), balance: 69000 })).rejects.toThrow("do not agree");
    await expect(owner.mutation(api.treasury.agreeStatement, { churchId: ids.church, endsOn: day(-1), balance: 64000 })).rejects.toThrow("future");
    await expect(as(ids.member).mutation(api.treasury.agreeStatement, { churchId: ids.church, endsOn: day(10), balance: 64000 })).rejects.toThrow(refused);
    await expect(as(ids.member).query(api.treasury.statements, { churchId: ids.church })).rejects.toThrow(refused);
    expect(await owner.query(api.treasury.statements, { churchId: ids.church })).toEqual([]);

    await owner.mutation(api.treasury.agreeStatement, { churchId: ids.church, endsOn: day(10), balance: 64000 });
    await as(ids.coordinator).mutation(api.treasury.agreeStatement, { churchId: ids.church, endsOn: day(10), balance: 64000 });
    const kept = await owner.query(api.treasury.statements, { churchId: ids.church });
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ endsOn: day(10), balance: 64000, agreedBy: "Sample coordinator" });
    expect(await as(ids.stranger).query(api.treasury.statements, { churchId: ids.other })).toEqual([]);
  });
});

describe("deposits", () => {
  test("gifts go to the bank as one line that clears together, and no money changes", async () => {
    const { ids, as, income, entries } = await setup();
    const owner = as(ids.owner);
    const opening = await owner.mutation(api.treasury.recordIncome, { churchId: ids.church, source: "opening", amount: 100000, date: day(30), from: "Carried over" });
    const a = await income(64000, day(6)), b = await income(2500, day(5), "Donation"), c = await income(1000, day(1), "Donation");
    expect((await owner.query(api.treasury.undeposited, { churchId: ids.church })).map((row) => row.id)).toEqual([a, b, c]);
    const before = (await owner.query(api.treasury.ledger, { churchId: ids.church })).balance;

    await expect(owner.mutation(api.treasury.recordDeposit, { churchId: ids.church, entryIds: [], date: day(4) })).rejects.toThrow("Choose the gifts");
    await expect(owner.mutation(api.treasury.recordDeposit, { churchId: ids.church, entryIds: [a, c], date: day(4) })).rejects.toThrow("before the day it was received");
    await expect(as(ids.member).mutation(api.treasury.recordDeposit, { churchId: ids.church, entryIds: [a], date: day(4) })).rejects.toThrow(refused);
    const depositId = await owner.mutation(api.treasury.recordDeposit, { churchId: ids.church, entryIds: [a, b, a], date: day(4), memo: "Night drop" });
    await expect(owner.mutation(api.treasury.recordDeposit, { churchId: ids.church, entryIds: [b], date: day(4) })).rejects.toThrow("already in a deposit");
    expect((await owner.query(api.treasury.undeposited, { churchId: ids.church })).map((row) => row.id)).toEqual([c]);

    const bank = await owner.query(api.treasury.reconciliation, { churchId: ids.church });
    expect(bank.deposits).toEqual([{ id: depositId, date: day(4), total: 66500, memo: "Night drop", count: 2 }]);
    expect(bank.waiting.map((row) => row.id)).toEqual([opening, c]);
    expect(bank).toMatchObject({ waitingCount: 3, onItsWayIn: 167500, books: before });

    await expect(owner.mutation(api.treasury.clearDeposit, { churchId: ids.church, depositId, clearedOn: day(5) })).rejects.toThrow("before the day it was made");
    await owner.mutation(api.treasury.clearDeposit, { churchId: ids.church, depositId, clearedOn: day(3) });
    expect(await owner.query(api.treasury.reconciliation, { churchId: ids.church })).toMatchObject({ cleared: 66500, deposits: [], waitingCount: 2, books: before });
    await expect(owner.mutation(api.treasury.undoDeposit, { churchId: ids.church, depositId })).rejects.toThrow("has cleared the bank");
    await owner.mutation(api.treasury.clearDeposit, { churchId: ids.church, depositId, clearedOn: null });
    await expect(as(ids.stranger).mutation(api.treasury.undoDeposit, { churchId: ids.other, depositId })).rejects.toThrow("Deposit not found");
    await owner.mutation(api.treasury.undoDeposit, { churchId: ids.church, depositId });
    expect((await owner.query(api.treasury.undeposited, { churchId: ids.church })).map((row) => row.id)).toEqual([a, b, c]);
    expect(sum(await entries())).toBe(before);
  });
});

describe("the voucher shelf", () => {
  test("the count is what came in less what was given, and giving on a request is counted once", async () => {
    const { t, ids, as, request } = await setup();
    const owner = as(ids.owner);
    const shelf = async () => (await owner.query(api.treasury.voucherShelf, { churchId: ids.church })).items;
    await owner.mutation(api.treasury.recordVouchers, { churchId: ids.church, item: "Winter coat", change: 10, date: day(3) });
    await owner.mutation(api.treasury.recordVouchers, { churchId: ids.church, item: "Furniture", change: 4, date: day(3) });
    await expect(owner.mutation(api.treasury.recordVouchers, { churchId: ids.church, item: "Winter coat", change: 1.5, date: day(3) })).rejects.toThrow("whole number");
    await expect(owner.mutation(api.treasury.recordVouchers, { churchId: ids.church, item: "Winter coat", change: -1, date: day(3) })).rejects.toThrow("Say why");
    await expect(as(ids.member).mutation(api.treasury.recordVouchers, { churchId: ids.church, item: "Winter coat", change: 1, date: day(3) })).rejects.toThrow(refused);
    await expect(as(ids.member).query(api.treasury.voucherShelf, { churchId: ids.church })).rejects.toThrow(refused);

    const requestId = await request({ payeeKind: "vendor", payeeName: "Conference thrift store" });
    const give = (item: string, quantity: number) => t.run(async (ctx) => voucherGiven(ctx, (await ctx.db.get("memberships", ids.owner.memberId))!, { requestId, item, quantity }));
    await give("winter coat", 3);
    await give("Winter Coat", 3);
    expect(await shelf()).toEqual([{ item: "Furniture", onHand: 4, received: 4, given: 0 }, { item: "Winter coat", onHand: 7, received: 10, given: 3 }]);
    await give("Winter coat", 2);
    expect((await shelf())[1]).toMatchObject({ onHand: 8, given: 2 });
    // The request is changed to furniture: the coats go back whole.
    await give("Furniture", 1);
    expect(await shelf()).toEqual([{ item: "Furniture", onHand: 3, received: 4, given: 1 }, { item: "Winter coat", onHand: 10, received: 10, given: 0 }]);
    await give("Furniture", 0);
    expect((await shelf())[0]).toMatchObject({ onHand: 4, given: 0 });

    await owner.mutation(api.treasury.recordVouchers, { churchId: ids.church, item: "Winter coat", change: -1, date: day(0), note: "Counted nine by hand" });
    expect((await shelf())[1]).toMatchObject({ onHand: 9, received: 9 });
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(0);
  });
});

describe("a voucher taken back", () => {
  test("its worth leaves the money paid out by a reversing entry, once, and the first entry stays", async () => {
    const { t, ids, as, request, income, entries } = await setup();
    const owner = as(ids.owner);
    await income(50000, day(9));
    const requestId = await request({ payeeKind: "vendor", payeeName: "Conference thrift store", amountApproved: 3000 });
    const paid = await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId, amount: 3000, date: day(3), memo: "" });
    const give = (quantity: number) => t.run(async (ctx) => voucherGiven(ctx, (await ctx.db.get("memberships", ids.owner.memberId))!, { requestId, item: "Clothing voucher", quantity }));
    await give(1);
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(47000);

    await give(0);
    await give(0);
    const all = await entries();
    expect(all).toHaveLength(3);
    expect(all.find((row) => row._id === paid)).toMatchObject({ kind: "expense", amount: 3000 });
    expect(all.find((row) => row.reverses === paid)).toMatchObject({ kind: "income", amount: 3000, memo: "Voucher taken back", requestId, date: day(0) });
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(50000);
    expect(await t.run((ctx) => paidTowardRequest(ctx, requestId))).toBe(0);
    const flow = await owner.query(api.treasury.cashFlow, { churchId: ids.church, from: day(30), to: day(0) });
    expect(flow.moneyOut).toBe(0);
    expect((await owner.query(api.treasury.voucherShelf, { churchId: ids.church })).items).toEqual([{ item: "Clothing voucher", onHand: 0, received: 0, given: 0 }]);
  });
});

describe("a conference's own kinds", () => {
  test("a kind is added once, moves money its own way, and stops being offered when retired", async () => {
    const { ids, as } = await setup();
    const owner = as(ids.owner);
    const add = (direction: "income" | "expense", name: string) => owner.mutation(api.treasury.addKind, { churchId: ids.church, direction, name });
    const raffle = await add("income", "Fall raffle");
    const gas = await add("expense", "Gas cards");
    await expect(add("income", "  fall RAFFLE ")).rejects.toThrow("already have a kind");
    await expect(add("income", "Donation")).rejects.toThrow("already has a kind");
    await expect(add("income", " ")).rejects.toThrow("Give the kind a name");
    await expect(as(ids.member).mutation(api.treasury.addKind, { churchId: ids.church, direction: "income", name: "Bake sale" })).rejects.toThrow(refused);

    const record = (kindId: typeof raffle, amount: number, name: string) => owner.mutation(api.treasury.recordOwnKind, { churchId: ids.church, kindId, amount, date: day(1), name, checkNumber: "2051" });
    await record(raffle, 30000, "Raffle tickets");
    await record(gas, 4000, "Sample Fuel Stop");
    const view = await owner.query(api.treasury.ledger, { churchId: ids.church });
    expect(view.balance).toBe(26000);
    expect(view.entries.map((row) => [row.category, row.kind, row.checkNumber])).toEqual([["Gas cards", "expense", "2051"], ["Fall raffle", "income", null]]);
    await expect(record(raffle, 12.5, "Raffle tickets")).rejects.toThrow("dollars and cents");
    await expect(as(ids.stranger).mutation(api.treasury.recordOwnKind, { churchId: ids.other, kindId: raffle, amount: 100, date: day(1), name: "x" })).rejects.toThrow("no longer offered");

    await owner.mutation(api.treasury.retireKind, { churchId: ids.church, kindId: gas });
    expect(await owner.query(api.treasury.kinds, { churchId: ids.church })).toEqual([{ id: raffle, direction: "income", name: "Fall raffle" }]);
    await expect(record(gas, 4000, "Sample Fuel Stop")).rejects.toThrow("no longer offered");
    expect(await add("expense", "Gas cards")).toBe(gas);
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(26000);
  });
});

describe("taking an entry back", () => {
  test("a reversal is a new entry that restores the balance and leaves the original untouched", async () => {
    const { t, ids, as, request, income, entries } = await setup();
    const owner = as(ids.owner);
    const status = async () => (await t.run((ctx) => ctx.db.get("assistanceRequests", requestId)))?.status;
    await income(100000, day(9));
    const requestId = await request({ amountApproved: 30000 });
    const paymentId = await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId, amount: 30000, date: day(3) });
    const before = await entries();
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(70000);
    expect(await owner.query(api.treasury.payable, { churchId: ids.church })).toEqual([]);
    expect(await status()).toBe("paid");

    const reversalId = await owner.mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: paymentId, reason: " Check was lost in the mail " });
    const after = await entries();
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.at(-1)).toMatchObject({ _id: reversalId, kind: "income", amount: 30000, date: day(), category: "utility", payee: "Demo Power & Light", memo: "Check was lost in the mail", requestId, neighborId: ids.neighbor, reverses: paymentId });
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(100000);

    // The request is owed again in full and can be paid again.
    expect(await status()).toBe("approved");
    expect(await owner.query(api.treasury.payable, { churchId: ids.church })).toMatchObject([{ requestId, paid: 0, remaining: 30000 }]);
    await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId, amount: 30000, date: day() });
    expect((await owner.query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(70000);
    expect(await status()).toBe("paid");
  });

  test("the month counts a payment taken back as less paid out, not as money in", async () => {
    const { ids, as, request, income } = await setup();
    const owner = as(ids.owner);
    await income(50000, day());
    const paymentId = await owner.mutation(api.treasury.recordPayment, { paidSeen: 0, churchId: ids.church, requestId: await request(), amount: 20000, date: day() });
    const giftId = await owner.mutation(api.treasury.recordIncome, { churchId: ids.church, source: "donation", amount: 7000, date: day(), from: "Anonymous gift" });
    expect(await owner.query(api.treasury.ledger, { churchId: ids.church })).toMatchObject({ moneyIn: 57000, moneyOut: 20000, neighborsHelped: 1 });
    await owner.mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: paymentId, reason: "Paid twice by mistake" });
    await owner.mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: giftId, reason: "Entered twice" });
    const view = await owner.query(api.treasury.ledger, { churchId: ids.church });
    expect(view).toMatchObject({ balance: 50000, moneyIn: 50000, moneyOut: 0, neighborsHelped: 0, incomeSources: ["Parish collection"] });
    expect(view.entries.map((entry) => [entry.reversed, entry.reverses !== null])).toEqual([[false, true], [false, true], [true, false], [true, false], [false, false]]);
  });

  test("an entry is reversed once, with a reason, by someone allowed, inside their own group", async () => {
    const { ids, as, income, entries } = await setup();
    const entryId = await income(40000, day(1));
    const reverse = (person: { userId: string }, reason = "Entered twice", churchId = ids.church) => as(person).mutation(api.treasury.reverseEntry, { churchId, entryId, reason });
    await expect(reverse(ids.member)).rejects.toThrow(refused);
    await expect(reverse(ids.stranger)).rejects.toThrow("Workspace access required.");
    await expect(reverse(ids.stranger, "Entered twice", ids.other)).rejects.toThrow("Entry not found.");
    await expect(reverse(ids.owner, "  ")).rejects.toThrow("Say why");
    const reversalId = await reverse(ids.coordinator);
    await expect(reverse(ids.owner)).rejects.toThrow("already been reversed");
    await expect(as(ids.owner).mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: reversalId, reason: "Undo" })).rejects.toThrow("A reversal cannot be reversed.");
    expect(await entries()).toHaveLength(2);
    expect((await as(ids.owner).query(api.treasury.ledger, { churchId: ids.church })).balance).toBe(0);
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
    for (let step = 0; step < 60; step++) {
      const move = next(0, 6);
      if (move === 0) await income(next(1, 500000), day(next(0, 80)));
      else if (move === 1) await as(ids.owner).mutation(api.treasury.recordIncome, { churchId: ids.church, source: "collection", amount: next(1, 500000), date: day(next(0, 80)), from: "St. Sample Parish" });
      else if (move === 3) {
        const open = (await entries()).filter((entry, _, all) => !entry.reverses && !all.some((other) => other.reverses === entry._id));
        if (open.length) await as(ids.owner).mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId: open[next(0, open.length - 1)]._id, reason: "Entered by mistake" });
      } else if (move === 2) await as(ids.owner).mutation(api.treasury.recordTwinningGift, { churchId: ids.church, amount: next(1, 50000), date: day(next(0, 80)), to: "St. Placeholder Conference" });
      else {
        const approved = next(1, 90000);
        const requestId = await request({ amountApproved: approved });
        const parts = next(1, 3);
        let left = approved;
        for (let part = 0; part < parts && left > 0; part++) {
          const amount = part === parts - 1 ? left : next(1, left);
          await as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: approved - left, churchId: ids.church, requestId, amount, date: day(next(0, 80)) });
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

describe("the same payment is never recorded twice", () => {
  test("a payment recorded since the screen showed the request is refused, naming who and how much", async () => {
    const { ids, as, request, entries } = await setup();
    const requestId = await request({ amountApproved: 45000 });
    const pay = (who: typeof ids.owner, fields: { amount: number; paidSeen: number; checkNumber?: string }) =>
      as(who).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, date: day(), ...fields });
    // Both screens showed nothing paid. The first goes through; the second is refused, not recorded.
    await pay(ids.coordinator, { amount: 20000, paidSeen: 0 });
    const refusal = await pay(ids.owner, { amount: 20000, paidSeen: 0 }).then(() => null, (cause: unknown) => cause);
    expect(refusal).toBeInstanceOf(ConvexError);
    expect((refusal as { data: unknown }).data).toEqual({ message: "This payment is already recorded.", paid: 20000, last: { amount: 20000, by: "Sample coordinator" } });
    expect((await entries()).filter((entry) => entry.requestId === requestId)).toHaveLength(1);
  });

  test("a real second payment goes through once the person sends it with the total the refusal gave", async () => {
    const { t, ids, as, request } = await setup();
    const requestId = await request({ amountApproved: 45000 });
    const pay = (who: typeof ids.owner, amount: number, paidSeen: number) =>
      as(who).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, date: day(), amount, paidSeen });
    await pay(ids.coordinator, 20000, 0);
    await expect(pay(ids.owner, 15000, 0)).rejects.toThrow("This payment is already recorded.");
    await pay(ids.owner, 15000, 20000);
    expect(await t.run((ctx) => paidTowardRequest(ctx, requestId))).toBe(35000);
  });

  test("the same check number on the same request is always refused, even when the screen is current", async () => {
    const { t, ids, as, request } = await setup();
    const requestId = await request({ amountApproved: 45000 });
    const pay = (amount: number, paidSeen: number, checkNumber: string) =>
      as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, date: day(), amount, paidSeen, checkNumber });
    await pay(20000, 0, "1042");
    await expect(pay(20000, 20000, " 1042 ")).rejects.toThrow("This payment is already recorded.");
    expect(await t.run((ctx) => paidTowardRequest(ctx, requestId))).toBe(20000);
    // Another check is another payment.
    await pay(5000, 20000, "1043");
    expect(await t.run((ctx) => paidTowardRequest(ctx, requestId))).toBe(25000);
  });

  test("a check taken back can be recorded again", async () => {
    const { t, ids, as, request } = await setup();
    const requestId = await request({ amountApproved: 45000 });
    const entryId = await as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, date: day(), amount: 20000, paidSeen: 0, checkNumber: "1042" });
    await as(ids.owner).mutation(api.treasury.reverseEntry, { churchId: ids.church, entryId, reason: "Wrong amount" });
    await as(ids.owner).mutation(api.treasury.recordPayment, { churchId: ids.church, requestId, date: day(), amount: 21000, paidSeen: 0, checkNumber: "1042" });
    expect(await t.run((ctx) => paidTowardRequest(ctx, requestId))).toBe(21000);
  });
});
