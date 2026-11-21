/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: "America/New_York" });
    const other = await ctx.db.insert("churches", { name: "Other Example Conference", timeZone: "America/New_York" });
    const join = async (name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("memberships", { churchId: church, userId, name, email: `${name.toLowerCase()}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId };
    };
    const elsewhere = await ctx.db.insert("referralAgencies", { churchId: other, name: "Elsewhere Pantry", phone: "", helpsWith: "" });
    return { church, coordinator: await join("Thomas", "coordinator"), member: await join("Renee", "member"), elsewhere };
  });
  return { t, ids, as: (person: { userId: string }) => signedIn(t, person.userId, true) };
}

describe("keeping the list of referral agencies", () => {
  test("a coordinator adds, edits and removes an agency", async () => {
    const { ids, as } = await setup();
    const coordinator = as(ids.coordinator);
    const id = await coordinator.mutation(api.referralAgencies.add, { churchId: ids.church, name: " Example Food Pantry ", phone: "(100) 555-0100", helpsWith: "Groceries" });
    expect(await coordinator.query(api.referralAgencies.list, { churchId: ids.church })).toEqual([{ id, name: "Example Food Pantry", phone: "(100) 555-0100", helpsWith: "Groceries" }]);
    await expect(coordinator.mutation(api.referralAgencies.add, { churchId: ids.church, name: "example food pantry", phone: "", helpsWith: "" })).rejects.toThrow("example food pantry is already on the list of agencies.");
    await coordinator.mutation(api.referralAgencies.edit, { churchId: ids.church, id, name: "Example Food Bank", phone: "", helpsWith: "Food" });
    expect((await coordinator.query(api.referralAgencies.list, { churchId: ids.church }))[0]).toMatchObject({ name: "Example Food Bank", helpsWith: "Food" });
    await expect(coordinator.mutation(api.referralAgencies.edit, { churchId: ids.church, id, name: " ", phone: "", helpsWith: "" })).rejects.toThrow("An agency needs a name.");
    await coordinator.mutation(api.referralAgencies.remove, { churchId: ids.church, id });
    expect(await coordinator.query(api.referralAgencies.list, { churchId: ids.church })).toEqual([]);
  });

  test("a member is refused, and another group's agency cannot be touched", async () => {
    const { ids, as } = await setup();
    await expect(as(ids.member).mutation(api.referralAgencies.add, { churchId: ids.church, name: "Example Shelter", phone: "", helpsWith: "" })).rejects.toThrow();
    await expect(as(ids.member).query(api.referralAgencies.list, { churchId: ids.church })).rejects.toThrow();
    await expect(as(ids.coordinator).mutation(api.referralAgencies.remove, { churchId: ids.church, id: ids.elsewhere })).rejects.toThrow("That agency was not found.");
    await expect(as(ids.coordinator).mutation(api.referralAgencies.edit, { churchId: ids.church, id: ids.elsewhere, name: "Taken over", phone: "", helpsWith: "" })).rejects.toThrow("That agency was not found.");
  });
});
