/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const refused = "Neighbor records are open to coordinators and owners only.";
/** Every named field is cleared off the row. */
const gone = (doc: object | null, ...keys: string[]) => doc !== null && keys.every((key) => (doc as Record<string, unknown>)[key] === undefined);
const rent = { kind: "rent", summary: "Behind on November rent.", amountRequested: 45000, payeeKind: "landlord", payeeName: "Sample Property Co." } as const;

/** A made-up conference with an owner, a coordinator and a member, and a second conference to prove nothing crosses over. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
    const other = await ctx.db.insert("churches", { name: "Example Conference", timeZone: "UTC" });
    const join = async (group: typeof church, name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: group, userId, name, email: `${role}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await join(church, "Marisol Vega", "owner"), coordinator = await join(church, "Thomas Okafor", "coordinator"), member = await join(church, "Renee Baptiste", "member"), stranger = await join(other, "Victor Salgado", "owner");
    const record = (name: string) => ctx.db.insert("neighbors", { churchId: church, name, nameKey: name.toLowerCase(), phone: "", phoneKey: "", email: "", address: "14 Sample St", adults: 1, children: 0, language: "en", notes: "", createdBy: owner.memberId, createdAt: 0 });
    return { church, owner, coordinator, member, stranger, rosa: await record("Esperanza Montoya"), earl: await record("Darnell Joseph") };
  });
  const as = (person: { userId: string }) => signedIn(t, person.userId, true);
  const row = (id: Id<"assistanceRequests">) => t.run((ctx) => ctx.db.get("assistanceRequests", id));
  const church = () => t.run((ctx) => ctx.db.get("churches", ids.church));
  return { t, ids, as, row, church };
}

describe("undoing a decision from its line", () => {
  test("approving, declining and closing each go back, and the waiting figures with them", async () => {
    const { t, ids, as, row, church } = await setup();
    const churchId = ids.church;
    const undo = () => as(ids.owner).mutation(api.assistance.undoDecision, { churchId, requestId });
    const requestId = await as(ids.coordinator).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    const before = await church();
    expect(before?.waitingCount).toBe(1);

    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 40000, note: "Yes.", goods: { food: 2, furniture: 0, clothing: 0 } });
    expect((await church())?.waitingCount).toBe(0);
    await undo();
    expect(await row(requestId)).toMatchObject({ status: "open", decisionNote: "" });
    expect(gone(await row(requestId), "decidedBy", "decidedAt", "amountApproved", "goods")).toBe(true);
    expect(await church()).toMatchObject({ waitingCount: 1, waitingHouseholdIds: before?.waitingHouseholdIds });
    await expect(undo()).rejects.toThrow("can no longer be undone");

    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "declined", note: "No." });
    await undo();
    expect((await row(requestId))?.status).toBe("open");
    expect((await church())?.waitingCount).toBe(1);

    await as(ids.owner).mutation(api.assistance.closeRequest, { churchId, requestId, note: "Resolved." });
    expect((await church())?.waitingCount).toBe(0);
    await undo();
    expect((await row(requestId))?.status).toBe("open");
    expect(gone(await row(requestId), "closedBy", "closedAt", "decidedBy")).toBe(true);
    expect(await church()).toMatchObject({ waitingCount: 1, waitingHouseholdIds: [ids.rosa] });

    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 40000, note: "Yes." });
    await as(ids.owner).mutation(api.assistance.closeRequest, { churchId, requestId, note: "Resolved." });
    await undo();
    expect(await row(requestId)).toMatchObject({ status: "approved", amountApproved: 40000, decidedBy: ids.owner.memberId });
    expect(gone(await row(requestId), "closedBy", "closedAt")).toBe(true);
    expect(await church()).toMatchObject({ waitingCount: 0, waitingHouseholdIds: [] });

    const audit = await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect());
    expect(audit.filter((event) => event.targetId === requestId).map((event) => event.action)).toEqual(["request.decision_undone", "request.decision_undone", "request.close_undone", "request.close_undone"]);
  });

  test("is refused after the window, after a payment, and to anyone else", async () => {
    const { t, ids, as, row } = await setup();
    const churchId = ids.church;
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...rent });
    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId, decision: "approved", amountApproved: 40000, note: "" });
    await expect(as(ids.member).mutation(api.assistance.undoDecision, { churchId, requestId })).rejects.toThrow(refused);
    await expect(as(ids.stranger).mutation(api.assistance.undoDecision, { churchId, requestId })).rejects.toThrow();
    // Someone else with access did not take this step, so it is theirs to change the usual way.
    await expect(as(ids.coordinator).mutation(api.assistance.undoDecision, { churchId, requestId })).rejects.toThrow("can no longer be undone");
    await as(ids.owner).mutation(api.treasury.recordPayment, { paidSeen: 0, churchId, requestId, amount: 20000, date: "2026-11-10" });
    await expect(as(ids.owner).mutation(api.assistance.undoDecision, { churchId, requestId })).rejects.toThrow("A payment is recorded");
    expect((await row(requestId))?.status).toBe("approved");

    const late = await as(ids.owner).mutation(api.assistance.createRequest, { churchId, neighborId: ids.earl, ...rent });
    await as(ids.owner).mutation(api.assistance.decide, { churchId, requestId: late, decision: "declined", note: "" });
    await t.run((ctx) => ctx.db.patch("assistanceRequests", late, { decidedAt: Date.now() - 3 * 60 * 1000 }));
    await expect(as(ids.owner).mutation(api.assistance.undoDecision, { churchId, requestId: late })).rejects.toThrow("can no longer be undone");
    expect((await row(late))?.status).toBe("declined");
  });
  test("closing a voucher request before any voucher was given can be undone, as the line offers", async () => {
    const { ids, as, row, church } = await setup();
    const churchId = ids.church;
    const coats = { kind: "voucher", summary: "Two children need winter coats.", amountRequested: 0, payeeKind: "vendor", payeeName: "", voucher: { item: "Winter coat", quantity: 2 } } as const;
    const requestId = await as(ids.owner).mutation(api.assistance.createRequest, { churchId, neighborId: ids.rosa, ...coats });
    await as(ids.owner).mutation(api.assistance.closeRequest, { churchId, requestId, note: "Found coats elsewhere." });
    await as(ids.owner).mutation(api.assistance.undoDecision, { churchId, requestId });
    expect((await row(requestId))?.status).toBe("open");
    expect((await church())?.waitingCount).toBe(1);
  });
});
