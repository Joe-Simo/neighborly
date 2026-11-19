/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import * as functions from "./assistance";
import { neighborAccess } from "./access";
import { settleRequest } from "./assistance";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
type Caller = Pick<ReturnType<ReturnType<typeof convexTest>["withIdentity"]>, "query" | "mutation">;
/** Reads a record the way the screen does: `open` writes the audit line, and `record` is read with it. */
async function readRecord(caller: Caller, args: { churchId: Id<"churches">; neighborId: Id<"neighbors"> }) {
  return caller.query(api.neighbors.record, { ...args, opening: await caller.mutation(api.neighbors.open, args) });
}
/** Reads one request with the audit line of opening its neighbor's record, as `request` requires. */
async function readRequest(caller: Caller, args: { churchId: Id<"churches">; requestId: Id<"assistanceRequests"> }, neighborId: Id<"neighbors">) {
  return caller.query(api.assistance.request, { ...args, opening: await caller.mutation(api.neighbors.open, { churchId: args.churchId, neighborId }) });
}
const refused = "Neighbor records are open to coordinators and owners only.";

/** A made-up group with an owner, a coordinator and a member, and a second group to prove nothing crosses over. */
async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
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
  return { t, ids, as: (person: { userId: string }) => signedIn(t, person.userId, emails.has(person.userId)) };
}

const rent = { kind: "rent", summary: "Behind on November rent.", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co." } as const;

describe("who may use the help line and requests", () => {
  test("a member is refused on every function and a coordinator passes", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const { callId } = await as(ids.owner).mutation(api.assistance.recordCall, { churchId, callerName: "New caller", phone: "(100) 555-0119", note: "Asked about food.", callback: "needed" });
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    for (const person of [ids.member, ids.coordinator]) {
      const caller = as(person);
      const attempts = [
        () => caller.query(api.assistance.requests, { churchId }),
        async () => caller.query(api.assistance.requestsForNeighbor, { churchId, neighborId: ids.rosa, opening: await caller.mutation(api.neighbors.open, { churchId, neighborId: ids.rosa }) }),
        () => readRequest(caller, { churchId, requestId }, ids.rosa),
        () => caller.query(api.assistance.calls, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId }),
        () => caller.query(api.assistance.agencies, { churchId }),
        () => caller.mutation(api.assistance.recordCall, { churchId, callerName: "Darnell Joseph", phone: "", note: "Called back.", callback: "none" }),
        () => caller.mutation(api.assistance.linkCall, { churchId, callId, neighborId: ids.earl }),
        () => caller.mutation(api.assistance.setUrgency, { churchId, callId, reasons: ["shutoff"], day: 21, by: "assistant" }),
        () => caller.mutation(api.assistance.markReturned, { churchId, callId }),
        () => caller.mutation(api.assistance.unmarkReturned, { churchId, callId }),
        async () => {
          const fresh = await caller.mutation(api.assistance.recordCall, { churchId, callerName: "Darnell Joseph", phone: "", note: "Wrong line.", callback: "needed" });
          return caller.mutation(api.assistance.takeBackCall, { churchId, callId: fresh.callId });
        },
        () => caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.earl, ...rent }),
        () => caller.mutation(api.assistance.updateRequest, { churchId, requestId, ...rent, amountRequested: 40000 }),
        () => caller.mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 40000, note: "" }),
        () => caller.mutation(api.assistance.closeRequest, { churchId, requestId, note: "Resolved." }),
        () => caller.query(api.assistance.drafts, { churchId }),
        () => caller.mutation(api.assistance.keepDraft, { churchId, callId, draft: { kind: null, amountRequested: null, payeeKind: null, payeeName: "", quote: "", notes: [], verification: "review" } }),
        () => caller.mutation(api.assistance.discardDraft, { churchId, callId }),
      ];
      // Every public function in the file is tried, so a new one cannot be added without its gate.
      expect(attempts).toHaveLength(Object.values(functions).filter((value) => typeof value === "function" && "isPublic" in value).length);
      for (const attempt of attempts) {
        if (person === ids.member) await expect(attempt()).rejects.toThrow(refused);
        else await attempt();
      }
    }
  });

  test("a decision can name up to four places, and each is offered the next time", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church, caller = as(ids.owner);
    const requestId = await caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    await expect(caller.mutation(api.assistance.decide, { churchId, requestId, decision: "declined", note: "", referrals: ["a", "b", "c", "d", "e"] })).rejects.toThrow("at most four");
    await caller.mutation(api.assistance.decide, { churchId, requestId, decision: "declined", note: "Outside our area.", referrals: ["Sample County Rent Help", " 211 ", "sample county rent help"] });
    expect((await readRequest(caller, { churchId, requestId }, ids.rosa)).referrals).toEqual(["Sample County Rent Help", "211"]);
    expect((await caller.query(api.assistance.agencies, { churchId })).map((agency) => agency.name)).toEqual(["211", "Sample County Rent Help"]);
    const second = await caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.earl, ...rent });
    await caller.mutation(api.assistance.decide, { churchId, requestId: second, decision: "approved", amountApproved: 1000, note: "", referrals: ["SAMPLE COUNTY RENT HELP"] });
    expect(await caller.query(api.assistance.agencies, { churchId })).toHaveLength(2);
    expect((await readRequest(caller, { churchId, requestId: second }, ids.earl)).referrals).toEqual(["Sample County Rent Help"]);
  });

  test("calls to return first lead the list, and a person's word outranks a reading of the note", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.church, caller = as(ids.coordinator);
    const log = async (note: string) => (await caller.mutation(api.assistance.recordCall, { churchId, callerName: "Caller", phone: "", note, callback: "needed" })).callId;
    const rent = await log("Behind on rent."), power = await log("Shut-off notice for the 21st."), food = await log("Asked about the pantry.");
    const waiting = async () => (await caller.query(api.assistance.calls, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).waiting;
    const order = async () => (await waiting()).map((call) => call.id);
    expect(await order()).toEqual([rent, power, food]);
    await t.mutation(internal.assistance.keepReading, { churchId, callId: power, reasons: ["shutoff", "elder"], day: 21, by: "assistant" });
    expect(await order()).toEqual([power, rent, food]);
    expect((await waiting())[0].urgent).toEqual({ reasons: ["shutoff", "elder"], day: 21, by: "assistant", byName: null });
    // A person moves one up and the other back; no later reading undoes either.
    await caller.mutation(api.assistance.setUrgency, { churchId, callId: food, reasons: ["marked"] });
    await caller.mutation(api.assistance.setUrgency, { churchId, callId: power, reasons: [] });
    await t.mutation(internal.assistance.keepReading, { churchId, callId: power, reasons: ["shutoff"], day: 21, by: "assistant" });
    await t.mutation(internal.assistance.keepReading, { churchId, callId: power, reasons: ["shutoff"], day: 21, by: "rules" });
    expect(await order()).toEqual([food, rent, power]);
    expect((await waiting()).map((call) => call.urgent?.byName ?? null)).toEqual(["Thomas Okafor", null, "Thomas Okafor"]);
    await expect(caller.mutation(api.assistance.setUrgency, { churchId, callId: rent, reasons: ["marked"], day: 45 })).rejects.toThrow("day of the month");
    await expect(as(ids.stranger).mutation(api.assistance.setUrgency, { churchId: ids.other, callId: rent, reasons: [] })).rejects.toThrow("Call not found.");
  });

  test("who put a call first is the server's to say: a client's claim is ignored", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church, caller = as(ids.coordinator);
    const { callId } = await caller.mutation(api.assistance.recordCall, { churchId, callerName: "Caller", phone: "", note: "Shut-off notice for the 21st.", callback: "needed" });
    const first = async () => (await caller.query(api.assistance.calls, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).waiting[0].urgent;
    // An older client that says "assistant" or "rules" is saved as what it is: this person's own word, under their name.
    await caller.mutation(api.assistance.setUrgency, { churchId, callId, reasons: ["shutoff"], day: 21, by: "assistant" });
    expect(await first()).toEqual({ reasons: ["shutoff"], day: 21, by: "person", byName: "Thomas Okafor" });
    await as(ids.owner).mutation(api.assistance.setUrgency, { churchId, callId, reasons: ["marked"], by: "rules" });
    expect(await first()).toMatchObject({ by: "person", byName: "Marisol Vega" });
  });

  test("another group's coordinator cannot reach this group's calls or requests", async () => {
    const { ids, as } = await setup();
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId: ids.church, neighborId: ids.rosa, ...rent });
    await expect(as(ids.stranger).query(api.assistance.requests, { churchId: ids.church })).rejects.toThrow("Workspace access required.");
    await expect(readRequest(as(ids.stranger), { churchId: ids.other, requestId }, ids.elsewhere)).rejects.toThrow("Request not found.");
    await expect(as(ids.stranger).mutation(api.assistance.createRequest, { churchId: ids.other, neighborId: ids.rosa, ...rent })).rejects.toThrow("Record not found.");
  });
});

describe("the help line", () => {
  test("a call from a phone on file is matched to that neighbor; an unknown number is not", async () => {
    const { ids, as } = await setup();
    const known = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Esperanza", phone: "100.555.0104", note: "Behind on rent.", callback: "needed", ownerId: ids.owner.memberId });
    const unknown = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "", phone: "(100) 555-0119", note: "Food for five.", callback: "needed" });
    expect(known.neighborId).toBe(ids.rosa);
    expect(unknown.neighborId).toBeNull();
    // A typed name always wins: someone else calling from that number is not placed on Esperanza's record.
    const other = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Vladimir Pemberton", phone: "100.555.0104", note: "Called about a visit.", callback: "none" });
    expect(other.neighborId).toBeNull();
    const { waiting } = await as(ids.owner).query(api.assistance.calls, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId: ids.church });
    expect(waiting).toMatchObject([{ neighborName: "Esperanza Montoya", takenByName: "Thomas Okafor", ownerName: "Marisol Vega", openRequest: false }, { neighborName: null, ownerName: null }]);
    await expect(as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "", phone: "", note: "Silence.", callback: "none" })).rejects.toThrow("A name or a phone number is needed.");
  });

  test("a message goes to whoever holds the help line next, skipping cancelled and finished mornings", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.church, hour = 3600000, now = Date.now();
    const leave = async () => {
      const { callId } = await as(ids.owner).mutation(api.assistance.recordCall, { churchId, callerName: "Darnell Joseph", phone: "", note: "Shut-off notice.", callback: "needed" });
      return (await as(ids.owner).query(api.assistance.calls, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).waiting.find((call) => call.id === callId)?.ownerName;
    };
    expect(await leave()).toBeNull();
    await t.run(async (ctx) => {
      const teamId = await ctx.db.insert("teams", { churchId, name: "Help Line", description: "" });
      const morning = (start: number, assigneeId: typeof ids.owner.memberId | null, cancelled?: boolean) =>
        ctx.db.insert("commitments", { churchId, teamId, title: "Help line morning", start, end: start + 2 * hour, location: "", preparation: "", assigneeId, coordinatorId: ids.owner.memberId, version: 1, cancelled });
      await morning(now - 5 * hour, ids.member.memberId);
      await morning(now + 10 * hour, ids.member.memberId, true);
      await morning(now + 34 * hour, ids.coordinator.memberId);
      await morning(now + 58 * hour, ids.owner.memberId);
    });
    expect(await leave()).toBe("Thomas Okafor");
    // A call that needs nothing more has no one to call back.
    const { callId } = await as(ids.owner).mutation(api.assistance.recordCall, { churchId, callerName: "Darnell Joseph", phone: "", note: "Thank you.", callback: "none" });
    expect((await t.run((ctx) => ctx.db.get("calls", callId)))?.ownerId).toBeUndefined();
  });

  test("marking a call returned keeps who returned it, when, and what came of it", async () => {
    const { ids, as } = await setup();
    const { callId } = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Darnell Joseph", phone: "(100) 555-0103", note: "Shut-off notice.", callback: "needed" });
    await as(ids.owner).mutation(api.assistance.markReturned, { churchId: ids.church, callId, outcome: "Home visit planned for Thursday." });
    const { waiting, returned } = await as(ids.owner).query(api.assistance.calls, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId: ids.church });
    expect(waiting).toEqual([]);
    expect(returned).toMatchObject([{ id: callId, callback: "done", returnedByName: "Marisol Vega", outcome: "Home visit planned for Thursday." }]);
    expect(returned[0].returnedAt).toBeGreaterThan(0);
    await expect(as(ids.owner).mutation(api.assistance.markReturned, { churchId: ids.church, callId })).rejects.toThrow("not waiting");
  });

  test("a call marked returned, or one just written down, can be undone by the same member while its line is up", async () => {
    const { t, ids, as } = await setup();
    const at = Math.floor(Date.now() / 3600000) * 3600000;
    const { callId } = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Darnell Joseph", phone: "(100) 555-0103", note: "Shut-off notice.", callback: "needed" });
    await as(ids.owner).mutation(api.assistance.markReturned, { churchId: ids.church, callId, outcome: "Left a message." });
    await expect(as(ids.coordinator).mutation(api.assistance.unmarkReturned, { churchId: ids.church, callId })).rejects.toThrow("no longer be undone");
    await as(ids.owner).mutation(api.assistance.unmarkReturned, { churchId: ids.church, callId });
    const { waiting } = await as(ids.owner).query(api.assistance.calls, { at, churchId: ids.church });
    expect(waiting).toMatchObject([{ id: callId, callback: "needed" }]);
    expect(waiting[0]).not.toHaveProperty("outcome", "Left a message.");
    // Taken back by the one who wrote it down; once its line could no longer be up, it stays.
    await expect(as(ids.owner).mutation(api.assistance.takeBackCall, { churchId: ids.church, callId })).rejects.toThrow("no longer be undone");
    await t.run((ctx) => ctx.db.patch("calls", callId, { takenAt: Date.now() - 3 * 60 * 1000 }));
    await expect(as(ids.coordinator).mutation(api.assistance.takeBackCall, { churchId: ids.church, callId })).rejects.toThrow("no longer be undone");
    const fresh = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Wrong line", phone: "", note: "", callback: "none" });
    await as(ids.coordinator).mutation(api.assistance.takeBackCall, { churchId: ids.church, callId: fresh.callId });
    expect(await t.run((ctx) => ctx.db.get("calls", fresh.callId))).toBeNull();
  });

  test("the returned list holds this week only: by when a call was returned, or taken if it was settled on the spot", async () => {
    const { t, ids, as } = await setup();
    const DAY = 86400000, at = Date.UTC(2026, 10, 16, 15);
    const call = (callerName: string, takenAt: number, returnedAt?: number) => ({ churchId: ids.church, callerName, phone: "(100) 555-0190", note: "", callback: "done" as const, takenBy: ids.owner.memberId, takenAt, ...(returnedAt ? { returnedAt, returnedBy: ids.owner.memberId } : {}) });
    await t.run(async (ctx) => {
      await ctx.db.insert("calls", call("Taken long ago, returned yesterday", at - 40 * DAY, at - DAY));
      await ctx.db.insert("calls", call("Settled on the spot two days ago", at - 2 * DAY));
      await ctx.db.insert("calls", call("Returned a month ago", at - 40 * DAY, at - 30 * DAY));
      await ctx.db.insert("calls", call("Settled on the spot a month ago", at - 30 * DAY));
      await ctx.db.insert("calls", { ...call("Taken yesterday, still waiting", at - DAY), callback: "needed" });
    });
    const { waiting, returned } = await as(ids.owner).query(api.assistance.calls, { churchId: ids.church, at });
    expect(returned.map((row) => row.callerName)).toEqual(["Taken long ago, returned yesterday", "Settled on the spot two days ago"]);
    expect(waiting.map((row) => row.callerName)).toEqual(["Taken yesterday, still waiting"]);
  });
});

describe("a request for help", () => {
  test("is recorded open, tied to its call, and read back with the neighbor's household", async () => {
    const { ids, as } = await setup();
    const { callId } = await as(ids.coordinator).mutation(api.assistance.recordCall, { churchId: ids.church, callerName: "Someone", phone: "(100) 555-0119", note: "Rent.", callback: "needed" });
    const requestId = await as(ids.coordinator).mutation(api.assistance.createRequest, { churchId: ids.church, neighborId: ids.rosa, callId, ...rent });
    expect(await readRequest(as(ids.owner), { churchId: ids.church, requestId }, ids.rosa)).toMatchObject({
      neighborName: "Esperanza Montoya", neighborAddress: "14 Sample St, Apt 2", neighborLanguage: "es", householdSize: 4, callId, kind: "rent", amountRequested: 45000, amountApproved: null,
      status: "open", payeeKind: "landlord", payeeName: "Sample Property Co.", source: "person", createdByName: "Thomas Okafor", decidedByName: null, referral: "",
    });
    // The call from an unknown number now belongs to the neighbor it was about.
    expect((await as(ids.owner).query(api.assistance.calls, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId: ids.church })).waiting[0]).toMatchObject({ neighborId: ids.rosa, openRequest: true });
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
    expect(await readRequest(as(ids.owner), { churchId, requestId }, ids.rosa)).toMatchObject({ status: "approved", amountApproved: 40000, decidedByName: "Marisol Vega", decisionNote: "Approved after the home visit." });
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
    expect(await readRequest(as(ids.owner), { churchId, requestId }, ids.earl)).toMatchObject({ status: "declined", referral: "Referred to 211.", amountApproved: null });
  });

  test("a voucher request takes from the shelf when approved and gives back when closed", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.church, caller = as(ids.owner);
    const coats = { kind: "voucher", summary: "Two children need winter coats.", amountRequested: 0, payeeKind: "vendor", payeeName: "", voucher: { item: "Winter coat", quantity: 2 } } as const;
    const onHand = async () => (await caller.query(api.treasury.voucherShelf, { churchId })).items.map((line) => [line.item, line.onHand]);
    await caller.mutation(api.treasury.recordVouchers, { churchId, item: "Winter coat", change: 10, date: "2026-11-02" });
    await expect(caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...coats, kind: "rent" })).rejects.toThrow("Only a voucher request");
    await expect(caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...coats, voucher: { item: "Winter coat", quantity: 1.5 } })).rejects.toThrow("how many vouchers");
    const requestId = await caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...coats });
    expect(await readRequest(caller, { churchId, requestId }, ids.rosa)).toMatchObject({ voucher: coats.voucher, amountRequested: 0, status: "open" });
    expect(await onHand()).toEqual([["Winter coat", 10]]);

    await caller.mutation(api.assistance.decide, { churchId, requestId, decision: "approved", quantity: 3, note: "" });
    expect(await readRequest(caller, { churchId, requestId }, ids.rosa)).toMatchObject({ voucher: { item: "Winter coat", quantity: 3 }, amountApproved: 0, status: "paid" });
    expect(await onHand()).toEqual([["Winter coat", 7]]);
    const history = async () => (await readRecord(caller, { churchId, neighborId: ids.rosa })).history;
    expect(await history()).toContainEqual(expect.objectContaining({ type: "voucher", requestId, item: "Winter coat", quantity: 3 }));
    expect((await caller.query(api.treasury.payable, { churchId })).map((row) => row.requestId)).not.toContain(requestId);

    await caller.mutation(api.assistance.closeRequest, { churchId, requestId, note: "Coats came from a relative instead." });
    expect(await onHand()).toEqual([["Winter coat", 10]]);
    await expect(caller.mutation(api.assistance.closeRequest, { churchId, requestId, note: "" })).rejects.toThrow("already finished");
    expect(await history()).toEqual([expect.objectContaining({ type: "voucher", takenBack: true, takeBackUntil: null, who: "Marisol Vega", closedBy: "Marisol Vega", note: "Coats came from a relative instead." })]);

    const old = await caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.earl, ...coats });
    await caller.mutation(api.assistance.decide, { churchId, requestId: old, decision: "approved", note: "" });
    await t.run((ctx) => ctx.db.patch("assistanceRequests", old, { decidedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 }));
    await expect(caller.mutation(api.assistance.closeRequest, { churchId, requestId: old, note: "Too late." })).rejects.toThrow("30 days");
    await caller.mutation(api.treasury.recordVouchers, { churchId, item: "Winter coat", change: 2, date: "2026-11-03" });

    const declined = await caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.earl, ...coats });
    await caller.mutation(api.assistance.decide, { churchId, requestId: declined, decision: "declined", note: "Outside our area." });
    expect(await onHand()).toEqual([["Winter coat", 10]]);
  });

  test("closing a part-paid request keeps what was paid and who closed it", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const requestId = await as(ids.coordinator).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    await as(ids.coordinator).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 45000, note: "" });
    await as(ids.owner).mutation(api.treasury.recordPayment, { churchId, requestId, amount: 20000, date: "2026-11-10" });
    await as(ids.owner).mutation(api.assistance.closeRequest, { churchId, requestId, note: "Moved in with family." });
    const { history } = await readRecord(as(ids.owner), { churchId, neighborId: ids.rosa });
    expect(history).toContainEqual(expect.objectContaining({ type: "decision", status: "closed", approved: 45000, paid: 20000, who: "Marisol Vega", approvedBy: "Thomas Okafor", note: "Moved in with family." }));
    expect(history).toContainEqual(expect.objectContaining({ type: "payment", amount: 20000 }));
    expect(await readRequest(as(ids.owner), { churchId, requestId }, ids.rosa)).toMatchObject({ status: "closed", decidedByName: "Thomas Okafor", closedByName: "Marisol Vega" });
  });

  test("a draft is kept for its call until it is approved or discarded", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church, caller = as(ids.owner);
    const draft = { kind: "rent", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co.", quote: "Behind on November rent.", notes: [] as string[], verification: "checked" } as const;
    const log = async (phone: string) => (await caller.mutation(api.assistance.recordCall, { churchId, callerName: "", phone, note: "Behind on November rent.", callback: "needed" })).callId;
    const first = await log("(100) 555-0119"), second = await log("(100) 555-0120");
    await caller.mutation(api.assistance.keepDraft, { churchId, callId: first, draft });
    await caller.mutation(api.assistance.keepDraft, { churchId, callId: second, draft: { ...draft, kind: null, amountRequested: null } });
    await caller.mutation(api.assistance.keepDraft, { churchId, callId: first, draft: { ...draft, amountRequested: 40000 } });
    const waiting = async () => (await as(ids.coordinator).query(api.assistance.drafts, { churchId })).map((row) => [row.call.id, row.draft.kind, row.draft.amountRequested]);
    expect(await waiting()).toEqual([[first, "rent", 40000], [second, null, null]]);
    await expect(as(ids.member).query(api.assistance.drafts, { churchId })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.assistance.keepDraft, { churchId, callId: first, draft })).rejects.toThrow(refused);
    await expect(as(ids.stranger).mutation(api.assistance.discardDraft, { churchId: ids.other, callId: first })).rejects.toThrow("Call not found.");

    await caller.mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, callId: first, ...rent });
    expect(await waiting()).toEqual([[second, null, null]]);
    await caller.mutation(api.assistance.discardDraft, { churchId, callId: second });
    expect(await waiting()).toEqual([]);
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
    expect((await readRequest(as(ids.owner), { churchId, requestId }, ids.rosa)).status).toBe("paid");
    await expect(as(ids.owner).mutation(api.assistance.closeRequest, { churchId, requestId, note: "" })).rejects.toThrow("already finished");
    await settle(ids.owner, churchId, false);
    expect((await readRequest(as(ids.owner), { churchId, requestId }, ids.rosa)).status).toBe("approved");
  });
});
