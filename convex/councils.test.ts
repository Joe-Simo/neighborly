/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { figures, sum } from "./councils";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const at = Date.parse("2026-11-15T15:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date(at));
});
afterEach(() => void vi.useRealTimers());

/** The made-up conference, a second plain conference, and a council owned by someone outside both. */
async function setting() {
  const t = convexTest(schema, modules);
  const sampleId = await t.mutation(internal.sampleData.load, {});
  const ids = await t.run(async (ctx) => {
    const sampleOwner = (await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", sampleId)).collect()).find((member) => member.role === "owner");
    if (!sampleOwner) throw new Error("The sample has no owner.");
    const councilUser = await ctx.db.insert("users", {});
    const otherOwner = await ctx.db.insert("users", {});
    const coordinator = await ctx.db.insert("users", {});
    const other = await ctx.db.insert("churches", { name: "Holy Family Conference", timeZone: "America/Chicago" });
    await ctx.db.insert("memberships", { churchId: other, userId: otherOwner, name: "Pat Owner", email: "pat@example.org", role: "owner", active: true, approved: true, coverOptIn: false });
    await ctx.db.insert("memberships", { churchId: other, userId: coordinator, name: "Lee Coordinator", email: "lee@example.org", role: "coordinator", active: true, approved: true, coverOptIn: false });
    return { sampleOwner: sampleOwner.userId, councilUser, otherOwner, coordinator, other };
  });
  const as = (userId: Id<"users">) => signedIn(t, userId);
  const councilId = await as(ids.councilUser).mutation(api.councils.create, { name: "Lee County District Council", timeZone: "America/New_York" });
  return { t, as, sampleId, councilId, ...ids };
}

describe("a council", () => {
  test("a conference joins only when its owner accepts, and either side can leave", async () => {
    const { as, councilId, councilUser, otherOwner, coordinator, other } = await setting();
    await as(councilUser).mutation(api.councils.invite, { councilId, code: other });
    await expect(as(councilUser).mutation(api.councils.invite, { councilId, code: other })).rejects.toThrow("That conference is already invited.");
    await expect(as(councilUser).mutation(api.councils.invite, { councilId, code: "not-a-code" })).rejects.toThrow("No conference has that code.");

    const seen = await as(otherOwner).query(api.councils.forConference, { churchId: other });
    expect(seen.code).toBe(other);
    expect(seen.councils).toEqual([expect.objectContaining({ name: "Lee County District Council", status: "pending" })]);
    const linkId = seen.councils[0].id;

    // The council cannot accept on the conference's behalf, nor can a coordinator.
    await expect(as(councilUser).mutation(api.councils.accept, { linkId })).rejects.toThrow();
    await expect(as(coordinator).mutation(api.councils.accept, { linkId })).rejects.toThrow("Church owner access required.");
    await expect(as(coordinator).query(api.councils.forConference, { churchId: other })).rejects.toThrow("Church owner access required.");
    await as(otherOwner).mutation(api.councils.accept, { linkId });
    expect((await as(councilUser).query(api.councils.mine, {}))[0].conferences).toEqual([{ id: linkId, name: "Holy Family Conference", status: "accepted" }]);

    await expect(as(coordinator).mutation(api.councils.unlink, { linkId })).rejects.toThrow("Church owner access required.");
    await as(councilUser).mutation(api.councils.unlink, { linkId });
    expect((await as(otherOwner).query(api.councils.forConference, { churchId: other })).councils).toEqual([]);
  });

  test("adds up each accepted conference's year, and passes on only counts and sums", async () => {
    const { t, as, councilId, councilUser, sampleId, sampleOwner, other } = await setting();
    // The sample cannot be invited by code, so its link is written here, as an accepted invitation would leave it.
    await t.run(async (ctx) => {
      await ctx.db.insert("councilLinks", { councilId, churchId: sampleId, status: "accepted", createdAt: at });
      await ctx.db.insert("councilLinks", { councilId, churchId: other, status: "pending", createdAt: at });
    });
    const hourAt = Math.floor(at / 3_600_000) * 3_600_000;
    // No stored year yet: the conference shows, with nothing added up, as being updated.
    const before = await as(councilUser).query(api.councils.yearReport, { councilId, year: 2026, at: hourAt });
    expect(before.updating).toBe(true);
    expect(before.conferences).toEqual([{ name: "St. Example Conference", figures: sum([]), updating: true }]);
    await as(councilUser).mutation(api.councils.refresh, { councilId, year: 2026 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const report = await as(councilUser).query(api.councils.yearReport, { councilId, year: 2026, at: hourAt });
    expect(report.updating).toBe(false);
    const own = await as(sampleOwner).query(api.reports.year, { churchId: sampleId, year: 2026, at: hourAt });

    // A pending conference is not counted.
    expect(report.conferences.map((row) => row.name)).toEqual(["St. Example Conference"]);
    expect(report.conferences[0].figures).toEqual(figures(own));
    expect(report.total).toEqual(figures(own));
    expect(report.total.households).toBeGreaterThan(0);

    // Nothing that names a neighbor, a member or a team leaves the conference.
    const sent = JSON.stringify(report);
    const records = await t.run(async (ctx) => ({
      neighbors: await ctx.db.query("neighbors").collect(),
      members: await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", sampleId)).collect(),
      teams: await ctx.db.query("teams").collect(),
      calls: await ctx.db.query("calls").collect(),
    }));
    for (const neighbor of records.neighbors) {
      for (const field of [neighbor.name, neighbor.phone, neighbor.email, neighbor.address, neighbor.notes]) if (field.length > 3) expect(sent).not.toContain(field);
      expect(sent).not.toContain(neighbor._id);
    }
    for (const member of records.members) if (member.name.length > 3) expect(sent).not.toContain(member.name);
    for (const team of records.teams) expect(sent).not.toContain(team.name);
    for (const call of records.calls) expect(sent).not.toContain(call._id);
    const keys = new Set<string>();
    JSON.parse(sent, (key: string, value: unknown) => (keys.add(key), value));
    for (const key of ["neighborId", "memberId", "teamId", "members", "teams", "kinds", "householdsByOtherLanguage", "phone", "address", "notes"]) expect(keys.has(key), key).toBe(false);
  });

  test("a write marks the conference's stored years stale and schedules one recompute each", async () => {
    const { t, as, councilId, councilUser, otherOwner, other } = await setting();
    await as(councilUser).mutation(api.councils.invite, { councilId, code: other });
    const [link] = (await as(otherOwner).query(api.councils.forConference, { churchId: other })).councils;
    await as(otherOwner).mutation(api.councils.accept, { linkId: link.id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const kept = () => t.run((ctx) => ctx.db.query("yearRollups").withIndex("by_church_year", (q) => q.eq("churchId", other)).collect());
    const waiting = () =>
      t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => job.name.includes("recompute") && job.state.kind === "pending").length);
    // Accepting adds up this fiscal year (November is in 2027's) and the last.
    expect((await kept()).map((row) => [row.year, row.dirty])).toEqual([[2026, false], [2027, false]]);

    const pat = { name: "Fabrice Pemberton", phone: "(100) 555-0105", email: "", address: "220 Placeholder Rd", adults: 2, children: 4, language: "es", notes: "" } as const;
    await as(otherOwner).mutation(api.neighbors.create, { churchId: other, ...pat });
    expect((await kept()).every((row) => row.dirty)).toBe(true);
    expect(await waiting()).toBe(2);
    await as(otherOwner).mutation(api.neighbors.create, { churchId: other, ...pat, name: "Rosa Example", phone: "(100) 555-0177", address: "9 Other Ln" });
    expect(await waiting()).toBe(2);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await kept()).some((row) => row.dirty)).toBe(false);

    // Once no council counts the conference, its stored years go.
    await as(otherOwner).mutation(api.councils.unlink, { linkId: link.id });
    expect(await kept()).toEqual([]);
  });

  test("the council's year is read from the stored rows, not the conference's records", async () => {
    const { t, as, councilId, councilUser, sampleId, sampleOwner } = await setting();
    await t.run((ctx) => ctx.db.insert("councilLinks", { councilId, churchId: sampleId, status: "accepted", createdAt: at }));
    await as(councilUser).mutation(api.councils.refresh, { councilId, year: 2026 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const hourAt = Math.floor(at / 3_600_000) * 3_600_000;
    const own = await as(sampleOwner).query(api.reports.year, { churchId: sampleId, year: 2026, at: hourAt });
    expect((await t.run((ctx) => ctx.db.query("yearRollups").collect())).map((row) => row.figures)).toEqual([figures(own)]);

    // A row written past the watched builders changes nothing until the stored year is added up again.
    await t.run(async (ctx) => {
      const row = await ctx.db.query("yearRollups").first();
      if (row) await ctx.db.patch("yearRollups", row._id, { figures: { ...row.figures, households: 12345 }, dirty: true });
    });
    const report = await as(councilUser).query(api.councils.yearReport, { councilId, year: 2026, at: hourAt });
    expect(report.total.households).toBe(12345);
    expect(report.updating).toBe(true);
    expect(report.conferences[0].updating).toBe(true);
    // The hourly sweep picks up what is still stale.
    await t.mutation(internal.councils.recomputeDirty, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const fresh = await as(councilUser).query(api.councils.yearReport, { councilId, year: 2026, at: hourAt });
    expect(fresh.total).toEqual(figures(own));
    expect(fresh.updating).toBe(false);
  });

  test("only its owner reads the council's year", async () => {
    const { as, councilId, otherOwner, sampleOwner } = await setting();
    const hourAt = Math.floor(at / 3_600_000) * 3_600_000;
    for (const someone of [otherOwner, sampleOwner])
      await expect(as(someone).query(api.councils.yearReport, { councilId, year: 2026, at: hourAt })).rejects.toThrow("Council owner access required.");
    await expect(as(otherOwner).mutation(api.councils.invite, { councilId, code: "x" })).rejects.toThrow("Council owner access required.");
    expect(await as(otherOwner).query(api.councils.mine, {})).toEqual([]);
  });

  test("sums each figure across conferences", () => {
    const one = { households: 2, people: 5, adults: 3, children: 2, visits: 1, peopleVisited: 5, visitHours: 1.1, visitMiles: 4, requestsReceived: 2, amountRequested: 10000, helpPaid: 5000, callsTaken: 3, hoursOfService: 2.2, activeMembers: 4, membersServing: 2, moneyReceived: 9000, moneySpent: 5000, endingBalance: 4000 };
    const total = sum([one, one]);
    expect(total.households).toBe(4);
    expect(total.visitHours).toBe(2.2);
    expect(total.hoursOfService).toBe(4.4);
    expect(total.helpPaid).toBe(10000);
  });
});
