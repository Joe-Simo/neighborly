/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York", householdCount: 4, waitingCount: 1 });
    const join = async (name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: church, userId, name, email: `${role}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const coordinator = await join("Thomas Okafor", "coordinator"), member = await join("Renee Baptiste", "member");
    const record = (name: string, phone: string, address: string, notes = "") =>
      ctx.db.insert("neighbors", { churchId: church, name, nameKey: name.toLowerCase(), phone, phoneKey: phone.replace(/\D/g, ""), email: "", address, adults: 1, children: 2, language: "en", notes, createdBy: coordinator.memberId, createdAt: 0 });
    const esperanza = await record("Esperanza Montoya", "(100) 555-0104", "14 Sample St, Apt 2", "Works nights.");
    const typo = await record("Esperanza Montolla", "100-555-0104", "14 Sample Street #2", "Night shift.");
    const sharedPhone = await record("Darnell Joseph", "(100) 555-0104", "8 Example Ave");
    const stranger = await record("Fabrice Pemberton", "(100) 555-0105", "220 Placeholder Rd");
    const requestId = await ctx.db.insert("assistanceRequests", { churchId: church, neighborId: typo, kind: "rent", amountRequested: 5000, summary: "Rent", status: "open", decisionNote: "", payeeKind: "landlord", payeeName: "", source: "person", createdBy: coordinator.memberId, createdAt: 0 });
    await ctx.db.patch("churches", church, { waitingHouseholdIds: [typo] });
    return { church, coordinator, member, esperanza, typo, sharedPhone, stranger, requestId };
  });
  const as = (person: { userId: string }) => signedIn(t, person.userId, true);
  return { t, ids, as };
}

describe("possible duplicate households", () => {
  test("a member is refused", async () => {
    const { ids, as } = await setup();
    await expect(as(ids.member).query(api.duplicates.forRecord, { churchId: ids.church, neighborId: ids.esperanza })).rejects.toThrow("coordinators and owners");
  });

  test("two things in common show at once; one waits for the notes; a dismissal hides the pair", async () => {
    const { t, ids, as } = await setup();
    const caller = as(ids.coordinator);
    const args = { churchId: ids.church, neighborId: ids.esperanza };
    const first = await caller.query(api.duplicates.forRecord, args);
    expect(first.shown.map((row) => [row.id, row.sameBy])).toEqual([[ids.typo, ["phone", "address", "name"]]]);
    expect(first.unread.sort()).toEqual([ids.typo, ids.sharedPhone].sort());
    await t.mutation(internal.duplicates.keepRead, { ...args, otherId: ids.sharedPhone, same: 0.95 });
    expect((await caller.query(api.duplicates.forRecord, args)).shown.map((row) => row.id)).toContain(ids.sharedPhone);
    await caller.mutation(api.duplicates.dismiss, { ...args, otherId: ids.sharedPhone });
    expect((await caller.query(api.duplicates.forRecord, args)).shown.map((row) => row.id)).toEqual([ids.typo]);
  });

  test("merging moves the other record's history, keeps both notes and the figures straight", async () => {
    const { t, ids, as } = await setup();
    const caller = as(ids.coordinator);
    const moving = { calls: 0, requests: 1, visits: 0, ledger: 0, notes: 0 };
    expect(await caller.query(api.duplicates.mergeCounts, { churchId: ids.church, otherId: ids.typo })).toEqual(moving);
    await caller.mutation(api.duplicates.merge, { churchId: ids.church, neighborId: ids.esperanza, otherId: ids.typo });
    expect(await caller.query(api.duplicates.merges, { churchId: ids.church, neighborId: ids.esperanza })).toMatchObject([{ name: "Esperanza Montolla", who: "Thomas Okafor", moved: moving }]);
    const after = await t.run(async (ctx) => ({
      gone: await ctx.db.get("neighbors", ids.typo),
      kept: await ctx.db.get("neighbors", ids.esperanza),
      request: await ctx.db.get("assistanceRequests", ids.requestId),
      church: await ctx.db.get("churches", ids.church),
      audit: await ctx.db.query("auditEvents").collect(),
    }));
    expect(after.gone).toBeNull();
    expect(after.request?.neighborId).toBe(ids.esperanza);
    expect(after.kept?.notes).toBe("Works nights.\n\nNight shift.");
    expect(after.church?.householdCount).toBe(3);
    expect(after.church?.waitingCount).toBe(1);
    expect(after.church?.waitingHouseholdIds).toEqual([ids.esperanza]);
    expect(after.audit.map((row) => row.action)).toEqual(["neighbor.merged"]);
  });
});

describe("the records check in Tools", () => {
  test("a person signed up twice, and one phone under different names, until a person says it is fine", async () => {
    const { t, ids, as } = await setup();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("memberships", { churchId: ids.church, userId, name: "Tomas Okafor", email: "COORDINATOR@neighborly.example", role: "member", active: true, approved: true, coverOptIn: false });
    });
    const caller = as(ids.coordinator);
    const found = await caller.query(api.duplicates.recordsCheck, { churchId: ids.church });
    expect(found.people.map((row) => row.sameBy)).toEqual([["email", "name"]]);
    expect(found.phones).toHaveLength(1);
    expect(found.phones[0].households.map((row) => row.name).sort()).toEqual(["Darnell Joseph", "Esperanza Montolla", "Esperanza Montoya"]);
    await caller.mutation(api.duplicates.dismissCheck, { churchId: ids.church, kind: "phone", key: found.phones[0].key });
    await caller.mutation(api.duplicates.dismissCheck, { churchId: ids.church, kind: "person", key: found.people[0].key });
    expect(await caller.query(api.duplicates.recordsCheck, { churchId: ids.church })).toEqual({ people: [], phones: [] });
    await expect(as(ids.member).query(api.duplicates.recordsCheck, { churchId: ids.church })).rejects.toThrow("coordinators and owners");
  });
});
