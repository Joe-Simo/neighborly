import { DateTime } from "luxon";
/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const tables = ["churches", "users", "memberships", "teams", "teamMembers", "commitments", "availability", "timeOff", "tasks", "announcements", "neighbors", "calls", "assistanceRequests", "visits", "ledgerEntries", "deposits", "voucherStock", "ledgerKinds", "bankStatements"] as const;

const start = () => convexTest(schema, modules);

async function everything(t: ReturnType<typeof start>) {
  return t.run(async (ctx) => ({
    churches: await ctx.db.query("churches").collect(),
    users: await ctx.db.query("users").collect(),
    memberships: await ctx.db.query("memberships").collect(),
    teams: await ctx.db.query("teams").collect(),
    teamMembers: await ctx.db.query("teamMembers").collect(),
    commitments: await ctx.db.query("commitments").collect(),
    availability: await ctx.db.query("availability").collect(),
    timeOff: await ctx.db.query("timeOff").collect(),
    tasks: await ctx.db.query("tasks").collect(),
    announcements: await ctx.db.query("announcements").collect(),
    neighbors: await ctx.db.query("neighbors").collect(),
    calls: await ctx.db.query("calls").collect(),
    assistanceRequests: await ctx.db.query("assistanceRequests").collect(),
    visits: await ctx.db.query("visits").collect(),
    ledgerEntries: await ctx.db.query("ledgerEntries").collect(),
    deposits: await ctx.db.query("deposits").collect(),
    voucherStock: await ctx.db.query("voucherStock").collect(),
    ledgerKinds: await ctx.db.query("ledgerKinds").collect(),
    bankStatements: await ctx.db.query("bankStatements").collect(),
  }));
}

describe("sample conference", () => {
  test("loads a year of activity that adds up", async () => {
    const t = start();
    const churchId = await t.mutation(internal.sampleData.load, {});
    const data = await everything(t);
    expect(data.churches).toMatchObject([{ _id: churchId, sample: true }]);
    expect(data.memberships.filter((member) => member.role === "owner")).toHaveLength(1);
    // 200 households, and one of them entered a second time for the duplicate check to find.
    expect(data.neighbors).toHaveLength(201);
    // The overview reads at most 200 commitments, so the coming weeks must come first and the total stay under it.
    expect(data.commitments.length).toBeLessThanOrEqual(200);
    const finished = data.commitments.filter((shift) => shift.end < Date.now());
    expect(finished.length).toBeGreaterThanOrEqual(150);
    expect(finished.every((shift) => shift.assigneeId !== null)).toBe(true);
    expect(data.commitments.findIndex((shift) => shift.end < Date.now())).toBeGreaterThan(0);
    expect(data.teams.map((team) => team.name).sort()).toEqual(["Help line", "Home visitors", "Pantry"]);
    expect(data.calls.length).toBeGreaterThanOrEqual(400);
    // Every month of the last year and more has calls, and money both in and out.
    const monthOf = (time: number) => new Date(time).toISOString().slice(0, 7);
    const months = Array.from({ length: 12 }, (_, back) => { const day = new Date(); day.setUTCDate(1); day.setUTCMonth(day.getUTCMonth() - back - 1); return day.toISOString().slice(0, 7); });
    for (const month of months) {
      expect(data.calls.some((call) => monthOf(call.takenAt) === month), `calls in ${month}`).toBe(true);
      for (const kind of ["income", "expense"] as const) expect(data.ledgerEntries.some((entry) => entry.kind === kind && entry.date.startsWith(month)), `${kind} in ${month}`).toBe(true);
    }
    // The conference gives away most of what it receives, and some approved help is still waiting to be paid.
    const total = (kind: "income" | "expense") => data.ledgerEntries.filter((entry) => entry.kind === kind && entry.category !== "Opening balance").reduce((sum, entry) => sum + entry.amount, 0);
    expect(total("expense") / total("income")).toBeGreaterThan(0.75);
    expect(total("expense")).toBeLessThanOrEqual(total("income"));
    expect(data.ledgerEntries.filter((entry) => entry.category === "Opening balance")).toHaveLength(1);
    expect(data.assistanceRequests.filter((request) => request.status === "approved").length).toBeGreaterThanOrEqual(3);
    for (const status of ["open", "approved", "declined", "paid", "closed"] as const)
      expect(data.assistanceRequests.some((request) => request.status === status), status).toBe(true);
    const span = Math.max(...data.calls.map((call) => call.takenAt)) - Math.min(...data.calls.map((call) => call.takenAt));
    expect(span).toBeGreaterThan(300 * 86400000);
    expect(Math.max(...data.calls.map((call) => call.takenAt))).toBeLessThanOrEqual(Date.now());

    // Every payment is tied to a paid request, for the approved amount, and every paid request has exactly one payment.
    const expenses = data.ledgerEntries.filter((entry) => entry.kind === "expense" && entry.requestId);
    // A voucher that was given is "paid" from the shelf: no amount, no payee and no ledger entry.
    const vouchers = data.assistanceRequests.filter((request) => request.kind === "voucher");
    expect(vouchers.length).toBeGreaterThan(5);
    for (const request of vouchers) {
      expect(request).toMatchObject({ amountRequested: 0, payeeName: "", voucher: { quantity: 1 } });
      expect(request.status).not.toBe("approved");
      expect(data.ledgerEntries.some((entry) => entry.requestId === request._id)).toBe(false);
      expect(data.voucherStock.filter((line) => line.requestId === request._id).length).toBe(request.status === "paid" ? 1 : 0);
    }
    const paid = data.assistanceRequests.filter((request) => request.status === "paid" && request.kind !== "voucher");
    expect(expenses).toHaveLength(paid.length);
    for (const request of paid) {
      const payments = expenses.filter((entry) => entry.requestId === request._id);
      expect(payments).toMatchObject([{ amount: request.amountApproved, neighborId: request.neighborId, payee: request.payeeName }]);
      expect(request.amountApproved).toBeLessThanOrEqual(request.amountRequested);
    }
    // The balance never goes below zero on any day of the year.
    let balance = 0;
    for (const entry of [...data.ledgerEntries].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "income" ? -1 : 1))) {
      expect(Number.isInteger(entry.amount) && entry.amount > 0).toBe(true);
      balance += entry.kind === "income" ? entry.amount : -entry.amount;
      expect(balance, entry.date).toBeGreaterThanOrEqual(0);
    }

    // Visits are always two different people; only completed visits carry hours and miles.
    expect(data.visits.some((visit) => visit.status === "scheduled")).toBe(true);
    let late = 0;
    for (const visit of data.visits) {
      expect(new Set(visit.visitors.map((visitor) => visitor.memberId)).size).toBe(2);
      const logged = visit.visitors.every((visitor) => visitor.hours > 0 && visitor.miles > 0);
      expect(logged).toBe(visit.status === "completed");
      // One past visit is left unmarked on purpose, for the year check to find.
      // The other is last week's visit, waiting for its write-up.
      if (visit.status === "scheduled" && !visit.notes && visit.scheduledAt < Date.now()) late++;
    }
    expect(late).toBe(1);
  });

  test("the side columns have something to show", async () => {
    const t = start();
    await t.mutation(internal.sampleData.load, { owner: await t.run(async (ctx) => ({ userId: await ctx.db.insert("users", {}), name: "Sample Owner", email: "owner@kindhelps.example" })) });
    const found = await t.run(async (ctx) => ({
      owner: (await ctx.db.query("memberships").collect()).find((member) => member.role === "owner")!,
      teams: await ctx.db.query("teams").collect(),
      commitments: await ctx.db.query("commitments").collect(),
      timeOff: await ctx.db.query("timeOff").collect(),
      meetings: await ctx.db.query("meetings").collect(),
      invitees: await ctx.db.query("meetingInvitees").collect(),
      responses: await ctx.db.query("meetingResponses").collect(),
    }));
    const zone = "America/New_York";
    const today = DateTime.now().setZone(zone).toFormat("yyyy-MM-dd");
    const helpLine = found.teams.find((team) => team.name === "Help line")!;
    const turns = found.commitments.filter((shift) => shift.teamId === helpLine._id && DateTime.fromMillis(shift.start, { zone }).toFormat("yyyy-MM-dd") === today);
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(turns.some((shift) => shift.assigneeId !== null)).toBe(true);
    // The owner is away two days this month, on no day they are committed or asked for.
    const away = found.timeOff.filter((span) => span.memberId === found.owner._id);
    expect(away).toHaveLength(1);
    expect(away[0].start.slice(0, 7)).toBe(today.slice(0, 7));
    const busy = found.commitments.filter((shift) => shift.assigneeId === found.owner._id || (shift.assigneeId === null && shift.title === "Pantry morning")).map((shift) => DateTime.fromMillis(shift.start, { zone }).toFormat("yyyy-MM-dd"));
    expect(busy.some((day) => day >= away[0].start && day <= away[0].end)).toBe(false);
    // One meeting ahead, the owner invited and yet to answer.
    expect(found.meetings).toHaveLength(1);
    expect(found.meetings[0].end).toBeGreaterThan(Date.now());
    expect(found.invitees.some((row) => row.memberId === found.owner._id)).toBe(true);
    expect(found.responses.some((row) => row.memberId === found.owner._id)).toBe(false);
    expect(found.responses.length).toBeGreaterThan(3);
  });

  test("the fuller record is there and leaves the head counts as they were", async () => {
    const t = start();
    await t.mutation(internal.sampleData.load, {});
    const found = await t.run(async (ctx) => ({
      neighbors: await ctx.db.query("neighbors").collect(),
      notes: await ctx.db.query("neighborNotes").collect(),
      places: await ctx.db.query("referralAgencies").collect(),
    }));
    expect(found.places).toHaveLength(6);
    // Twenty records noted over the year, and Rosa's, Marcus's and Yolanda's, which the week's story adds (Denise's was already noted).
    expect(new Set(found.notes.map((note) => note.neighborId)).size).toBe(23);
    expect(found.notes.every((note) => note.createdAt < Date.now())).toBe(true);
    const listed = found.neighbors.filter((neighbor) => neighbor.household);
    expect(listed.length).toBeGreaterThanOrEqual(60);
    // Who lives there agrees with the adults and children already counted.
    for (const neighbor of listed) {
      expect(neighbor.household!.filter((person) => !person.child)).toHaveLength(neighbor.adults);
      expect(neighbor.household!.filter((person) => person.child)).toHaveLength(neighbor.children);
    }
    expect(found.neighbors.filter((neighbor) => neighbor.alert)).toHaveLength(5);
    expect(found.neighbors.filter((neighbor) => neighbor.accounts?.length)).toHaveLength(12);
    // Every phone number is in the reserved range.
    for (const place of found.places) expect(place.phone).toMatch(/^\(10[0-2]\) 555-01\d\d$/);
  });

  test("the bank side agrees with the ledger", async () => {
    const t = start();
    await t.mutation(internal.sampleData.load, {});
    const data = await everything(t);
    const signed = (entry: (typeof data.ledgerEntries)[number]) => (entry.kind === "income" ? entry.amount : -entry.amount);
    // A kept statement's balance is exactly what had cleared by its last day: the treasury's own rule.
    expect(data.bankStatements.length).toBeGreaterThanOrEqual(3);
    for (const statement of data.bankStatements) {
      const cleared = data.ledgerEntries.reduce((sum, entry) => (entry.date <= statement.endsOn && entry.clearedOn && entry.clearedOn <= statement.endsOn ? sum + signed(entry) : sum), 0);
      expect(statement.balance, statement.endsOn).toBe(cleared);
    }
    // A deposit's total is the gifts it carries, none dated after it, and only money in.
    expect(data.deposits.length).toBeGreaterThanOrEqual(12);
    for (const deposit of data.deposits) {
      const carried = data.ledgerEntries.filter((entry) => entry.depositId === deposit._id);
      expect(carried.length).toBeGreaterThan(0);
      expect(carried.every((entry) => entry.kind === "income" && entry.date <= deposit.date)).toBe(true);
      expect(deposit.total).toBe(carried.reduce((sum, entry) => sum + entry.amount, 0));
    }
    // Some gifts are still waiting to go to the bank, and some entries are still to be matched.
    const waiting = data.ledgerEntries.filter((entry) => entry.kind === "income" && !entry.depositId && !entry.clearedOn && entry.category !== "Opening balance");
    expect(waiting.length).toBeGreaterThanOrEqual(1);
    expect(data.ledgerEntries.some((entry) => !entry.clearedOn)).toBe(true);
    // The shelf never goes below zero, and each voucher given is tied to a request that says so.
    const shelf = new Map<string, number>();
    for (const line of [...data.voucherStock].sort((a, b) => a.date.localeCompare(b.date) || b.change - a.change)) {
      shelf.set(line.item, (shelf.get(line.item) ?? 0) + line.change);
      expect(shelf.get(line.item), `${line.item} on ${line.date}`).toBeGreaterThanOrEqual(0);
      if (line.change < 0) expect(data.assistanceRequests.find((request) => request._id === line.requestId)?.voucher).toEqual({ item: line.item, quantity: 1 });
    }
    expect(data.voucherStock.some((line) => line.change < 0)).toBe(true);
    // Every listed payee is one the conference has actually paid.
    const payees = await t.run((ctx) => ctx.db.query("payees").collect());
    expect(payees.map((payee) => payee.kind).sort()).toEqual(["landlord", "landlord", "utility", "utility", "vendor"]);
    for (const payee of payees) expect(data.ledgerEntries.some((entry) => entry.payee === payee.name), payee.name).toBe(true);
    // One kind of its own each way, each with an entry under its name.
    expect(data.ledgerKinds.map((kind) => `${kind.direction}:${kind.name}`).sort()).toEqual(["expense:Bus tokens", "income:Bake sale"]);
    for (const kind of data.ledgerKinds) expect(data.ledgerEntries.some((entry) => entry.category === kind.name && entry.kind === kind.direction)).toBe(true);
  });

  test("uses only invented contact details", async () => {
    const t = start();
    await t.mutation(internal.sampleData.load, {});
    const data = await everything(t);
    for (const member of data.memberships) expect(member.email).toMatch(/@kindhelps\.example$/);
    for (const neighbor of data.neighbors) {
      // Area codes cannot begin with 1, so these numbers cannot belong to anyone.
      expect(neighbor.phone).toMatch(/^\(10[01]\) 555-01\d\d$/);
      if (neighbor.email) expect(neighbor.email).toMatch(/@kindhelps\.example$/);
    }
    expect(new Set(data.neighbors.map((neighbor) => neighbor.nameKey)).size).toBe(201);
    // The double shares its phone with the household it repeats.
    expect(new Set(data.neighbors.map((neighbor) => neighbor.phoneKey)).size).toBe(200);
  });

  test("is the same conference every time", async () => {
    const shape = async () => {
      const t = start();
      await t.mutation(internal.sampleData.load, {});
      const data = await everything(t);
      return { neighbors: data.neighbors.map((neighbor) => [neighbor.name, neighbor.address]), requests: data.assistanceRequests.map((request) => [request.kind, request.amountRequested]) };
    };
    expect(await shape()).toEqual(await shape());
  });

  test("a real owner keeps their account when the sample is cleared, and nothing else is touched", async () => {
    const t = start();
    const kept = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const churchId = await ctx.db.insert("churches", { name: "Real", timeZone: "UTC" });
      await ctx.db.insert("memberships", { churchId, userId, name: "Judge", email: "judge@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
      return { userId, churchId };
    });
    const sample = await t.mutation(internal.sampleData.load, { owner: { userId: kept.userId, name: "Judge", email: "judge@example.org" } });
    const loaded = await everything(t);
    expect(loaded.memberships.filter((member) => member.churchId === sample && member.role === "owner")).toMatchObject([{ userId: kept.userId }]);

    await expect(t.mutation(internal.sampleData.clear, { churchId: kept.churchId })).rejects.toThrow("Only a sample group can be cleared.");
    // What a visitor might add during the day goes too, including rows reached only through a parent.
    await t.run(async (ctx) => {
      const member = (await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", sample)).first())!;
      const commitment = (await ctx.db.query("commitments").withIndex("by_church", (q) => q.eq("churchId", sample)).first())!;
      const meeting = await ctx.db.insert("meetings", { churchId: sample, fanoutStatus: "complete", cutoff: 0, title: "Visitor's meeting", start: 0, end: 1, location: "" });
      await ctx.db.insert("meetingInvitees", { churchId: sample, meetingId: meeting, memberId: member._id });
      await ctx.db.insert("meetingResponses", { churchId: sample, meetingId: meeting, memberId: member._id, response: "accepted" });
      await ctx.db.insert("commitmentHistory", { churchId: sample, commitmentId: commitment._id, actorId: member.userId, action: "revised", version: 2, title: "x", start: 0, end: 1, location: "", preparation: "", assigneeId: null, at: 0 });
      await ctx.db.insert("series", { churchId: sample, teamId: commitment.teamId, intervalWeeks: 1, count: 2 });
      await ctx.db.insert("invitations", { churchId: sample, email: "visitor@kindhelps.example", role: "member", tokenHash: "x", expiresAt: 0, status: "pending", createdBy: member._id, createdAt: 0, requestId: "x" });
      await ctx.db.insert("outbox", { churchId: sample, kind: "invitation", recipient: "visitor@kindhelps.example", state: "awaiting_configuration", createdAt: 0 });
      const call = (await ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", sample)).first())!;
      await ctx.db.insert("requestDrafts", { churchId: sample, callId: call._id, payeeName: "", quote: "x", notes: [], verification: "review", createdBy: member._id, createdAt: 0 });
    });
    await t.mutation(internal.sampleData.clear, { churchId: sample });
    const leftovers = await t.run(async (ctx) => ({ drafts: await ctx.db.query("requestDrafts").collect(), meetings: await ctx.db.query("meetings").collect(), invitees: await ctx.db.query("meetingInvitees").collect(), responses: await ctx.db.query("meetingResponses").collect(), history: await ctx.db.query("commitmentHistory").collect(), series: await ctx.db.query("series").collect(), invitations: await ctx.db.query("invitations").collect(), outbox: await ctx.db.query("outbox").collect() }));
    for (const [table, rows] of Object.entries(leftovers)) expect(rows, table).toHaveLength(0);
    const after = await everything(t);
    expect(after.churches.map((church) => church._id)).toEqual([kept.churchId]);
    expect(after.users.map((user) => user._id)).toEqual([kept.userId]);
    expect(after.memberships).toHaveLength(1);
    for (const table of tables.slice(3)) expect(after[table], table).toHaveLength(0);
  });
});

describe("nightly reset", () => {
  afterEach(() => void vi.useRealTimers());
  const tablesOf = (t: ReturnType<typeof start>, churchId: Id<"churches">) => t.run(async (ctx) => {
    const rows: string[] = [];
    for (const table of ["memberships", "teams", "commitments", "neighbors", "calls", "assistanceRequests", "visits", "ledgerEntries", "deposits", "voucherStock", "tasks", "invitations", "requestDrafts", "meetings"] as const)
      rows.push(...(await ctx.db.query(table).withIndex("by_church", (q) => q.eq("churchId", churchId)).collect()).map(() => table));
    return rows.sort();
  });

  test("writes only what moved, drops what a visitor added, and keeps the conference's id", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-16T09:00:00Z"));
    const t = start();
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    const owner = { userId, name: "Sample Owner", email: "demo@kindhelps.com" };
    const churchId = await t.mutation(internal.sampleData.load, { owner });
    // A visitor changes a household and adds a call during the day.
    await t.run(async (ctx) => {
      const neighbor = (await ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", churchId)).first())!;
      await ctx.db.patch("neighbors", neighbor._id, { name: "Typed by a visitor" });
      const member = (await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).first())!;
      await ctx.db.insert("tasks", { churchId, title: "A visitor's task", dueAt: null, assigneeId: member._id, complete: false });
    });

    vi.setSystemTime(new Date("2026-11-17T09:00:00Z"));
    const result = await t.mutation(internal.sampleData.renew, { churchId, owner });
    const renewed = await tablesOf(t, churchId);
    // The same rows as a fresh load on that day, so the six standing items are there as they would be.
    const fresh = start();
    const freshUser = await fresh.run((ctx) => ctx.db.insert("users", {}));
    const freshId = await fresh.mutation(internal.sampleData.load, { owner: { ...owner, userId: freshUser } });
    expect(renewed).toEqual(await tablesOf(fresh, freshId));
    await t.run(async (ctx) => {
      expect(await ctx.db.query("neighbors").filter((q) => q.eq(q.field("name"), "Typed by a visitor")).collect()).toHaveLength(0);
      expect(await ctx.db.query("tasks").filter((q) => q.eq(q.field("title"), "A visitor's task")).collect()).toHaveLength(0);
      expect((await ctx.db.query("churches").collect()).map((church) => church._id)).toEqual([churchId]);
    });
    // Most of the year holds still: far fewer rows are written than kept.
    // Most of the year holds still: of about 2,100 rows, under a tenth are written (97 on this day).
    expect(result.written).toBeLessThan(result.kept / 10);
  });
});
