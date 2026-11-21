/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { DateTime } from "luxon";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import * as functions from "./visits";
import { freeToVisit, suggestPair, type Candidate } from "./visits";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
type Caller = Pick<ReturnType<ReturnType<typeof convexTest>["withIdentity"]>, "query" | "mutation">;
/** Reads a visit sheet the way the screen does: `openSheet` writes the audit line, and `sheet` is read with it. */
async function readSheet(caller: Caller, args: { churchId: Id<"churches">; visitId: Id<"visits"> }) {
  return caller.query(api.visits.sheet, { ...args, opening: await caller.mutation(api.visits.openSheet, args) });
}
const refused = "Neighbor records are open to coordinators and owners only.";
const zone = "America/New_York";
const DAY = 24 * 3600000;
const isoDay = (time: number) => DateTime.fromMillis(time, { zone }).toISODate() ?? "";
/** Ten in the morning, the given number of days from now, as the form sends it and as a moment. */
const morning = (days: number) => {
  const time = DateTime.now().setZone(zone).startOf("day").plus({ days, hours: 10 });
  return { at: time.toFormat("yyyy-MM-dd'T'HH:mm"), start: time.toMillis() };
};

/** A made-up conference: an owner, a coordinator, home visitors, and a second group to prove nothing crosses over. */
async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: zone });
    const other = await ctx.db.insert("churches", { name: "Example Conference", timeZone: "UTC" });
    const team = await ctx.db.insert("teams", { churchId: church, name: "Home visitors", description: "" });
    const join = async (group: typeof church, name: string, role: "owner" | "coordinator" | "member", extra: { approved?: boolean; language?: "en" | "es"; visitor?: boolean } = {}) => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: group, userId, name, email: `${name.toLowerCase().replaceAll(" ", ".")}@neighborly.example`, role, active: true, approved: extra.approved ?? true, coverOptIn: false, language: extra.language });
      if (extra.visitor) {
        await ctx.db.insert("teamMembers", { churchId: group, teamId: team, memberId, teamRole: "member", approved: true, status: "active" });
        await ctx.db.insert("availability", { churchId: group, memberId, start: isoDay(now), end: isoDay(now + 30 * DAY) });
      }
      return { userId, memberId };
    };
    const owner = await join(church, "Marisol Vega", "owner");
    const coordinator = await join(church, "Thomas Okafor", "coordinator");
    const daniel = await join(church, "Daniel Whitcombe", "member", { visitor: true });
    const graciela = await join(church, "Graciela Fuentes", "member", { visitor: true, language: "es" });
    const colleen = await join(church, "Colleen Marsh", "member", { visitor: true });
    const samuel = await join(church, "Samuel Adeyemi", "member", { visitor: true, approved: false });
    const stranger = await join(other, "Victor Salgado", "owner");
    const record = (group: typeof church, name: string, address: string, createdBy: typeof owner.memberId) =>
      ctx.db.insert("neighbors", { churchId: group, name, nameKey: name.toLowerCase(), phone: "(100) 555-0101", phoneKey: "1005550101", email: "", address, adults: 2, children: 2, language: "es", notes: "", createdBy, createdAt: 0 });
    const rosa = await record(church, "Benito Desrosiers", "214 Orchard St, Apt 2", owner.memberId);
    const elsewhere = await record(other, "Alma Almonte", "31 Mill Rd, Apt 4", stranger.memberId);
    const request = await ctx.db.insert("assistanceRequests", { churchId: church, neighborId: rosa, kind: "rent", summary: "Behind on this month's rent after reduced hours.", amountRequested: 45000, status: "open", decisionNote: "", payeeKind: "landlord", payeeName: "Orchard Street Apartments", source: "person", createdBy: owner.memberId, createdAt: now - DAY });
    return { church, other, owner, coordinator, daniel, graciela, colleen, samuel, stranger, rosa, elsewhere, request };
  });
  for (const person of [ids.owner, ids.coordinator, ids.daniel, ids.stranger]) emails.set(person.userId, `${person.userId}@neighborly.example`);
  const as = (person: { userId: string }) => signedIn(t, person.userId, emails.has(person.userId));
  const away = (person: { memberId: typeof ids.owner.memberId }, from: number, through: number) =>
    t.run((ctx) => ctx.db.insert("timeOff", { churchId: ids.church, memberId: person.memberId, start: isoDay(from), end: isoDay(through), note: "Visiting family." }));
  return { t, ids, as, away, now };
}

describe("who may see and plan home visits", () => {
  test("a member is refused on every function and a coordinator passes", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const pair = [ids.daniel.memberId, ids.colleen.memberId];
    const first = await as(ids.owner).mutation(api.visits.plan, { churchId, neighborId: ids.rosa, at: morning(3).at, visitorIds: pair });
    const second = await as(ids.owner).mutation(api.visits.plan, { churchId, neighborId: ids.rosa, at: morning(4).at, visitorIds: pair });
    // Daniel is a home visitor and still a member: the neighbor's details are not his to open.
    for (const person of [ids.daniel, ids.coordinator]) {
      const caller = as(person);
      const attempts = [
        () => caller.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId }),
        () => caller.query(api.visits.visitors, { churchId }),
        () => readSheet(caller, { churchId, visitId: first }),
        () => caller.mutation(api.visits.openSheet, { churchId, visitId: first }),
        () => caller.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, at: morning(5).at, visitorIds: pair }),
        () => caller.mutation(api.visits.writeUp, { churchId, visitId: first, notes: "Reviewed the bill together.", hours: 1.5, miles: 12 }),
        () => caller.mutation(api.visits.reschedule, { churchId, visitId: second, at: morning(6).at }),
        () => caller.mutation(api.visits.replaceVisitor, { churchId, visitId: second, leavingId: ids.colleen.memberId, joiningId: ids.graciela.memberId }),
        () => caller.mutation(api.visits.cancel, { churchId, visitId: second }),
        () => caller.mutation(api.visits.reinstate, { churchId, visitId: second }),
      ];
      // Every public function in the file is tried, so a new one cannot be added without its gate.
      // The two open to the visitors themselves, mine and respond, are proved in their own tests below.
      expect(attempts).toHaveLength(Object.values(functions).filter((value) => typeof value === "function" && "isPublic" in value).length - 2);
      for (const attempt of attempts) {
        if (person === ids.daniel) await expect(attempt()).rejects.toThrow(refused);
        else await attempt();
      }
    }
  });

  test("nothing crosses from one group to another", async () => {
    const { ids, as } = await setup();
    const pair = [ids.daniel.memberId, ids.colleen.memberId];
    const visitId = await as(ids.owner).mutation(api.visits.plan, { churchId: ids.church, neighborId: ids.rosa, at: morning(3).at, visitorIds: pair });
    const stranger = as(ids.stranger);
    await expect(stranger.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId: ids.church })).rejects.toThrow("Workspace access required.");
    await expect(readSheet(stranger, { churchId: ids.other, visitId })).rejects.toThrow("Visit not found.");
    await expect(stranger.mutation(api.visits.cancel, { churchId: ids.other, visitId })).rejects.toThrow("Visit not found.");
    await expect(stranger.mutation(api.visits.plan, { churchId: ids.other, neighborId: ids.rosa, at: morning(3).at, visitorIds: pair })).rejects.toThrow("Record not found.");
    await expect(stranger.mutation(api.visits.plan, { churchId: ids.other, neighborId: ids.elsewhere, at: morning(3).at, visitorIds: pair })).rejects.toThrow("Choose people from this group.");
  });
});

describe("planning a visit by hand", () => {
  test("it takes two different approved people, neither away, at a time still to come", async () => {
    const { ids, as, away, now } = await setup();
    await away(ids.colleen, now + 2 * DAY, now + 4 * DAY);
    const owner = as(ids.owner);
    const plan = (visitorIds: (typeof ids.owner.memberId)[], at = morning(3).at) => owner.mutation(api.visits.plan, { churchId: ids.church, neighborId: ids.rosa, requestId: ids.request, at, visitorIds });
    await expect(plan([ids.daniel.memberId])).rejects.toThrow("A home visit needs two people.");
    await expect(plan([ids.daniel.memberId, ids.graciela.memberId, ids.colleen.memberId])).rejects.toThrow("A home visit needs two people.");
    await expect(plan([ids.daniel.memberId, ids.daniel.memberId])).rejects.toThrow("Choose two different people.");
    await expect(plan([ids.daniel.memberId, ids.samuel.memberId])).rejects.toThrow("Samuel Adeyemi is not an approved member yet.");
    await expect(plan([ids.daniel.memberId, ids.colleen.memberId])).rejects.toThrow("Colleen Marsh is away that day.");
    await expect(plan([ids.daniel.memberId, ids.graciela.memberId], morning(-1).at)).rejects.toThrow("Choose a time that is still to come.");
    await plan([ids.daniel.memberId, ids.graciela.memberId]);
    await expect(plan([ids.daniel.memberId, ids.graciela.memberId], morning(6).at)).rejects.toThrow("A visit for this request is already planned.");

    const board = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId: ids.church });
    expect(board.suggested).toBeNull();
    expect(board.scheduled).toHaveLength(1);
    expect(board.scheduled[0]).toMatchObject({ neighborName: "Benito Desrosiers", address: "214 Orchard St, Apt 2", kind: "rent", amount: 45000, scheduledAt: morning(3).start });
    expect(board.scheduled[0].visitors.map((visitor) => visitor.name)).toEqual(["Daniel Whitcombe", "Graciela Fuentes"]);
  });

  test("writing it up records what they found with hours and miles for both, once", async () => {
    const { ids, as } = await setup();
    const owner = as(ids.owner), churchId = ids.church;
    const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    await expect(owner.mutation(api.visits.writeUp, { churchId, visitId, notes: "  ", hours: 1.5, miles: 12 })).rejects.toThrow("Write a few words about what you found.");
    await expect(owner.mutation(api.visits.writeUp, { churchId, visitId, notes: "Reviewed the bill.", hours: 0, miles: 12 })).rejects.toThrow("Enter the hours");
    await expect(owner.mutation(api.visits.writeUp, { churchId, visitId, notes: "Reviewed the bill.", hours: 1.5, miles: -1 })).rejects.toThrow("Enter the miles");
    await owner.mutation(api.visits.writeUp, { churchId, visitId, notes: "Reviewed the bill together. The amount is right.", hours: 1.5, miles: 12 });
    const board = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    expect(board.scheduled).toHaveLength(0);
    expect(board.writtenUp[0]).toMatchObject({ status: "completed", notes: "Reviewed the bill together. The amount is right." });
    expect(board.writtenUp[0].visitors.map(({ hours, miles }) => ({ hours, miles }))).toEqual([{ hours: 1.5, miles: 12 }, { hours: 1.5, miles: 12 }]);
    await expect(owner.mutation(api.visits.writeUp, { churchId, visitId, notes: "Again.", hours: 1, miles: 1 })).rejects.toThrow("already written up");

    // One car: the miles belong to the driver alone, and the next pair's sheet carries what was found.
    const next = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, at: morning(4).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    expect((await readSheet(owner, { churchId, visitId: next })).lastVisit).toMatchObject({ visitors: ["Daniel Whitcombe", "Graciela Fuentes"], notes: "Reviewed the bill together. The amount is right." });
    expect((await readSheet(owner, { churchId, visitId })).lastVisit).toBeNull();
    await expect(owner.mutation(api.visits.writeUp, { churchId, visitId: next, notes: "Follow-up.", hours: 1, miles: 8, driverId: ids.colleen.memberId })).rejects.toThrow("The driver must be one of the two visitors.");
    await owner.mutation(api.visits.writeUp, { churchId, visitId: next, notes: "Follow-up.", hours: 1, miles: 8, driverId: ids.graciela.memberId });
    const after = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    expect(after.writtenUp.find((row) => row.id === next)?.visitors.map(({ name, miles }) => ({ name, miles }))).toEqual([{ name: "Daniel Whitcombe", miles: 0 }, { name: "Graciela Fuentes", miles: 8 }]);
    await expect(owner.mutation(api.visits.cancel, { churchId, visitId })).rejects.toThrow("Only a planned visit can be called off.");
  });

  test("a visit called off sends the request back to wait for a pair", async () => {
    const { ids, as } = await setup();
    const owner = as(ids.owner), churchId = ids.church;
    const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    await owner.mutation(api.visits.cancel, { churchId, visitId });
    const board = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    expect(board.scheduled).toHaveLength(0);
    expect(board.suggested?.request.requestId).toBe(ids.request);
  });

  test("a visit called off is planned again by an undo from the one who called it off, while its line can be up", async () => {
    const { t, ids, as } = await setup();
    const owner = as(ids.owner), churchId = ids.church;
    const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    await owner.mutation(api.visits.cancel, { churchId, visitId });
    await expect(as(ids.coordinator).mutation(api.visits.reinstate, { churchId, visitId })).rejects.toThrow("no longer be undone");
    await owner.mutation(api.visits.reinstate, { churchId, visitId });
    expect((await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).scheduled).toHaveLength(1);
    await owner.mutation(api.visits.cancel, { churchId, visitId });
    await t.run((ctx) => ctx.db.patch("visits", visitId, { cancelledAt: Date.now() - 3 * 60 * 1000 }));
    await expect(owner.mutation(api.visits.reinstate, { churchId, visitId })).rejects.toThrow("no longer be undone");
  });

  test("opening the visit sheet writes one line saying who opened the neighbor's details", async () => {
    const { t, ids, as } = await setup();
    const owner = as(ids.owner), churchId = ids.church;
    const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    const sheet = await readSheet(owner, { churchId, visitId });
    expect(sheet).toMatchObject({ group: "Sample Conference", visitors: ["Daniel Whitcombe", "Graciela Fuentes"], neighbor: { name: "Benito Desrosiers", address: "214 Orchard St, Apt 2" }, request: { kind: "rent", amount: 45000, payeeName: "Orchard Street Apartments" } });
    const lines = await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church_action_target", (q) => q.eq("churchId", churchId).eq("action", "neighbor.opened").eq("targetId", ids.rosa)).collect());
    expect(lines).toHaveLength(1);
    expect(lines[0].actorId).toBe(ids.owner.userId);
    // Read again with that same line, the sheet is unchanged and nothing more is written.
    expect(await owner.query(api.visits.sheet, { churchId, visitId, opening: lines[0]._id })).toEqual(sheet);
    // Without an opening line of the reader's own, the sheet is refused and nothing is written.
    await expect(as(ids.coordinator).query(api.visits.sheet, { churchId, visitId, opening: lines[0]._id })).rejects.toThrow("Open the record again.");
    expect(await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church_action_target", (q) => q.eq("churchId", churchId).eq("action", "neighbor.opened").eq("targetId", ids.rosa)).collect())).toHaveLength(1);
  });
});

describe("each visitor accepts or declines", () => {
  test("a visitor sees the time, the street and their partner, never the name or the reason", async () => {
    const { ids, as } = await setup();
    const churchId = ids.church;
    const visitId = await as(ids.owner).mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    const own = await as(ids.daniel).query(api.visits.mine, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    expect(own).toEqual([{ id: visitId, scheduledAt: morning(3).start, street: "Orchard St", partner: "Graciela Fuentes", response: "pending" }]);
    expect(JSON.stringify(own)).not.toMatch(/Benito|Desrosiers|rent|214/);
    // Someone not on the visit sees nothing of it and cannot answer for it.
    expect(await as(ids.coordinator).query(api.visits.mine, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).toEqual([]);
    await expect(as(ids.coordinator).mutation(api.visits.respond, { churchId, visitId, response: "accepted" })).rejects.toThrow("Visit not found.");
    await expect(as(ids.stranger).mutation(api.visits.respond, { churchId, visitId, response: "accepted" })).rejects.toThrow("Workspace access required.");
  });

  test("an answer is kept, and a visitor who cannot go is replaced without losing the other's yes", async () => {
    const { ids, as, away, now } = await setup();
    const churchId = ids.church, owner = as(ids.owner);
    const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    const answers = async () => (await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).scheduled[0].visitors.map((visitor) => [visitor.name, visitor.response]);
    expect(await answers()).toEqual([["Daniel Whitcombe", "pending"], ["Graciela Fuentes", "pending"]]);
    await as(ids.daniel).mutation(api.visits.respond, { churchId, visitId, response: "accepted" });
    expect(await answers()).toEqual([["Daniel Whitcombe", "accepted"], ["Graciela Fuentes", "pending"]]);

    await away(ids.colleen, now + 2 * DAY, now + 4 * DAY);
    const replace = (joiningId: typeof ids.owner.memberId, leavingId = ids.graciela.memberId) => owner.mutation(api.visits.replaceVisitor, { churchId, visitId, leavingId, joiningId });
    await expect(replace(ids.colleen.memberId)).rejects.toThrow("Colleen Marsh is away that day.");
    await expect(replace(ids.daniel.memberId)).rejects.toThrow("Choose two different people.");
    await expect(replace(ids.samuel.memberId)).rejects.toThrow("not an approved member yet");
    await expect(replace(ids.coordinator.memberId, ids.colleen.memberId)).rejects.toThrow("Choose which of the two is being replaced.");
    await replace(ids.coordinator.memberId);
    expect(await answers()).toEqual([["Daniel Whitcombe", "accepted"], ["Thomas Okafor", "pending"]]);
    expect(await as(ids.coordinator).query(api.visits.mine, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).toHaveLength(1);
  });
});

describe("a visitor removed from the conference for good", () => {
  test("leaves a planned visit one visitor short, is never offered, and the seat is filled by replacing them", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    try {
      const { t, ids, as } = await setup();
      const churchId = ids.church, owner = as(ids.owner);
      const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
      await as(ids.daniel).mutation(api.visits.respond, { churchId, visitId, response: "accepted" });
      await owner.mutation(api.people.remove, { churchId, personId: ids.graciela.memberId, typedName: "Graciela Fuentes" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const seats = async () => (await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).scheduled[0].visitors.map((visitor) => [visitor.name, visitor.removed, visitor.response]);
      expect(await seats()).toEqual([["Daniel Whitcombe", false, "accepted"], ["A former member", true, "pending"]]);
      expect((await readSheet(owner, { churchId, visitId })).visitors).toEqual(["Daniel Whitcombe"]);
      expect((await as(ids.daniel).query(api.visits.mine, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId }))[0].partner).toBe("");
      expect((await owner.query(api.visits.visitors, { churchId })).map((person) => person.name)).not.toContain("A former member");

      await expect(owner.mutation(api.visits.reschedule, { churchId, visitId, at: morning(4).at })).rejects.toThrow("no longer in the conference");
      await expect(owner.mutation(api.visits.replaceVisitor, { churchId, visitId, leavingId: ids.daniel.memberId, joiningId: ids.colleen.memberId })).rejects.toThrow("no longer in the conference");
      await owner.mutation(api.visits.replaceVisitor, { churchId, visitId, leavingId: ids.graciela.memberId, joiningId: ids.colleen.memberId });
      expect(await seats()).toEqual([["Daniel Whitcombe", false, "accepted"], ["Colleen Marsh", false, "pending"]]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("with both of a pair removed the visit still reads, and is called off to plan again", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    try {
      const { t, ids, as } = await setup();
      const churchId = ids.church, owner = as(ids.owner);
      const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.colleen.memberId, ids.graciela.memberId] });
      await owner.mutation(api.people.remove, { churchId, personId: ids.colleen.memberId, typedName: "Colleen Marsh" });
      await owner.mutation(api.people.remove, { churchId, personId: ids.graciela.memberId, typedName: "Graciela Fuentes" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect((await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).scheduled[0].visitors.map((visitor) => visitor.removed)).toEqual([true, true]);
      expect((await readSheet(owner, { churchId, visitId })).visitors).toEqual([]);
      await owner.mutation(api.visits.cancel, { churchId, visitId });
      const board = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
      expect(board.scheduled).toEqual([]);
      expect(board.suggested?.request.requestId).toBe(ids.request);
    } finally {
      vi.useRealTimers();
    }
  });

  test("is never in a suggested pair, and keeps the visits they made under the one name", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    try {
      const { t, ids, as } = await setup();
      const churchId = ids.church, owner = as(ids.owner);
      const done = await t.run((ctx) => ctx.db.insert("visits", { churchId, neighborId: ids.rosa, scheduledAt: Date.now() - 5 * DAY, status: "completed", visitors: [{ memberId: ids.daniel.memberId, hours: 1, miles: 4, response: "accepted" }, { memberId: ids.colleen.memberId, hours: 1, miles: 0, response: "accepted" }], notes: "Rent is one month behind.", completedAt: Date.now() - 5 * DAY, createdBy: ids.owner.memberId, createdAt: Date.now() - 6 * DAY }));
      await owner.mutation(api.people.remove, { churchId, personId: ids.daniel.memberId, typedName: "Daniel Whitcombe" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const board = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
      expect(board.suggested?.pair?.map((person) => person.name)).toEqual(["Colleen Marsh", "Graciela Fuentes"]);
      expect(board.writtenUp.find((visit) => visit.id === done)?.visitors.map((visitor) => [visitor.name, visitor.hours])).toEqual([["A former member", 1], ["Colleen Marsh", 1]]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("a neighbor's record removed for good", () => {
  test("its visits keep their dates and hours and say nothing of who it was; none can be opened, changed or planned", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.church, owner = as(ids.owner);
    const visitors = (hours: number) => [{ memberId: ids.daniel.memberId, hours, miles: hours * 4, response: "accepted" as const }, { memberId: ids.colleen.memberId, hours, miles: 0, response: "accepted" as const }];
    const made = await t.run((ctx) => ctx.db.insert("visits", { churchId, neighborId: ids.rosa, requestId: ids.request, scheduledAt: Date.now() - 5 * DAY, status: "completed", visitors: visitors(1.5), notes: "Rent is one month behind.", completedAt: Date.now() - 5 * DAY, createdBy: ids.owner.memberId, createdAt: Date.now() - 6 * DAY }));
    const planned = await t.run((ctx) => ctx.db.insert("visits", { churchId, neighborId: ids.rosa, scheduledAt: morning(3).start, status: "scheduled", visitors: visitors(0), notes: "", createdBy: ids.owner.memberId, createdAt: Date.now() }));
    expect(await as(ids.daniel).query(api.visits.mine, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).toHaveLength(1);
    // The skeleton the removal leaves: no name key, no words.
    await t.run((ctx) => ctx.db.patch("neighbors", ids.rosa, { name: "Record removed", nameKey: "", phone: "", phoneKey: "", address: "", notes: "" }));

    const board = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    expect(board.suggested).toBeNull();
    expect(board.toArrange).toEqual([]);
    expect(board.scheduled).toEqual([]);
    expect(board.writtenUp).toHaveLength(1);
    expect(board.writtenUp[0]).toMatchObject({ id: made, neighborName: "Record removed", address: "", notes: "", requestId: null, kind: null, amount: null, recordRemoved: true });
    expect(board.writtenUp[0].visitors.map((visitor) => [visitor.name, visitor.hours, visitor.miles])).toEqual([["Daniel Whitcombe", 1.5, 6], ["Colleen Marsh", 1.5, 0]]);
    expect(JSON.stringify(board)).not.toMatch(/Benito|Orchard|Rent is/);
    expect(await as(ids.daniel).query(api.visits.mine, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).toEqual([]);

    for (const visitId of [made, planned]) {
      await expect(readSheet(owner, { churchId, visitId })).rejects.toThrow("Record not found.");
      await expect(owner.mutation(api.visits.openSheet, { churchId, visitId })).rejects.toThrow("Record not found.");
    }
    await expect(owner.mutation(api.visits.reschedule, { churchId, visitId: planned, at: morning(4).at })).rejects.toThrow("Record not found.");
    await expect(owner.mutation(api.visits.writeUp, { churchId, visitId: planned, notes: "Found at home.", hours: 1, miles: 2 })).rejects.toThrow("Record not found.");
    await expect(as(ids.daniel).mutation(api.visits.respond, { churchId, visitId: planned, response: "accepted" })).rejects.toThrow("Record not found.");
  });
});

describe("a visit written up long after it was made", () => {
  test("comes first under Written up, ahead of later visits written up before it", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.church, owner = as(ids.owner);
    const pair = (hours: number) => [{ memberId: ids.daniel.memberId, hours, miles: 0, response: "accepted" as const }, { memberId: ids.colleen.memberId, hours, miles: 0, response: "accepted" as const }];
    const old = await t.run(async (ctx) => {
      for (let day = 1; day <= 9; day++) await ctx.db.insert("visits", { churchId, neighborId: ids.rosa, scheduledAt: Date.now() - day * DAY, status: "completed", visitors: pair(1), notes: "Found at home.", completedAt: Date.now() - day * DAY, createdBy: ids.owner.memberId, createdAt: 0 });
      return ctx.db.insert("visits", { churchId, neighborId: ids.rosa, scheduledAt: Date.now() - 73 * DAY, status: "scheduled", visitors: pair(0), notes: "", createdBy: ids.owner.memberId, createdAt: 0 });
    });
    await owner.mutation(api.visits.writeUp, { churchId, visitId: old, notes: "Gave the pantry hours.", hours: 1.5, miles: 12, driverId: ids.daniel.memberId });
    const first = (await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).writtenUp[0];
    expect(first.id).toBe(old);
    expect(first.visitors.map((visitor) => [visitor.hours, visitor.miles])).toEqual([[1.5, 12], [1.5, 0]]);
  });
});

describe("changing the time of a planned visit", () => {
  test("both visitors are asked again, and no one is moved onto a day they are away", async () => {
    const { ids, as, away, now } = await setup();
    const churchId = ids.church, owner = as(ids.owner);
    const visitId = await owner.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at: morning(3).at, visitorIds: [ids.daniel.memberId, ids.graciela.memberId] });
    await as(ids.daniel).mutation(api.visits.respond, { churchId, visitId, response: "accepted" });
    await away(ids.graciela, now + 7 * DAY, now + 9 * DAY);
    await expect(owner.mutation(api.visits.reschedule, { churchId, visitId, at: morning(8).at })).rejects.toThrow("Graciela Fuentes is away that day.");
    await expect(owner.mutation(api.visits.reschedule, { churchId, visitId, at: morning(-1).at })).rejects.toThrow("Choose a time that is still to come.");
    await owner.mutation(api.visits.reschedule, { churchId, visitId, at: morning(5).at });
    const [visit] = (await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).scheduled;
    expect(visit.scheduledAt).toBe(morning(5).start);
    expect(visit.visitors.map((visitor) => visitor.response)).toEqual(["pending", "pending"]);
    await owner.mutation(api.visits.writeUp, { churchId, visitId, notes: "Reviewed the bill.", hours: 1, miles: 3 });
    await expect(owner.mutation(api.visits.reschedule, { churchId, visitId, at: morning(6).at })).rejects.toThrow("Only a planned visit can change its time.");
  });
});

describe("the suggested pair", () => {
  const start = DateTime.fromISO("2026-11-19T10:00", { zone }).toMillis(); // a Thursday
  const visit = { start, timeZone: zone, language: "es" as const };
  const candidate = (name: string, extra: Partial<Candidate> = {}): Candidate => ({ memberId: name, name, language: "en", active: true, approved: true, free: [{ start: "2026-11-01", end: "2026-11-30" }], away: [], busy: [], recent: 0, ...extra });

  test("never includes someone away, unapproved, inactive, not free that day or already on a visit", () => {
    const out = [
      candidate("Away", { away: [{ start: "2026-11-19", end: "2026-11-19" }] }),
      candidate("Unapproved", { approved: false }),
      candidate("Inactive", { active: false }),
      candidate("Not free", { free: [{ start: "2026-11-01", end: "2026-11-18" }] }),
      candidate("Never said", { free: [] }),
      candidate("Elsewhere", { busy: [start + 3600000] }),
    ];
    expect(freeToVisit(out, visit)).toEqual([]);
    expect(suggestPair(out, visit)).toBeNull();
    const match = suggestPair([...out, candidate("Daniel Whitcombe"), candidate("Colleen Marsh")], visit);
    expect(match?.pair.map((person) => person.name)).toEqual(["Colleen Marsh", "Daniel Whitcombe"]);
  });

  test("needs two people and never offers one person twice", () => {
    const daniel = candidate("Daniel Whitcombe");
    expect(suggestPair([daniel], visit)).toBeNull();
    expect(suggestPair([daniel, daniel, { ...daniel }], visit)).toBeNull();
    const match = suggestPair([daniel, daniel, candidate("Colleen Marsh")], visit);
    expect(new Set(match?.pair.map((person) => person.memberId)).size).toBe(2);
  });

  test("sends someone who speaks the neighbor's language, then whoever has visited least", () => {
    const people = [
      candidate("Colleen Marsh", { recent: 4 }),
      candidate("Daniel Whitcombe", { recent: 1 }),
      candidate("Graciela Fuentes", { language: "es", recent: 6 }),
      candidate("Renee Baptiste", { recent: 2 }),
    ];
    const match = suggestPair(people, visit);
    expect(match?.pair.map((person) => person.name)).toEqual(["Daniel Whitcombe", "Graciela Fuentes"]);
    expect(match?.reason).toBe("Both are free Thursday and neither is away. Graciela speaks Spanish.");
    expect(suggestPair(people, { ...visit, language: "en" })?.reason).toBe("Both are free Thursday and neither is away.");
    expect(suggestPair(people.slice(0, 2), visit)?.reason).toBe("Both are free Thursday and neither is away. No one free that day speaks Spanish.");
  });

  test("on the board it is drawn from the Home visitors team, availability and time off", async () => {
    const { ids, as, away, now } = await setup();
    const owner = as(ids.owner), churchId = ids.church;
    const first = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    // Samuel is on the team but not approved; the owner and coordinator are not home visitors.
    expect(first.suggested?.request).toMatchObject({ neighborName: "Benito Desrosiers", kind: "rent", amount: 45000 });
    expect(first.suggested?.pair?.map((person) => person.name)).toEqual(["Colleen Marsh", "Graciela Fuentes"]);
    expect(first.suggested?.reason).toContain("Graciela speaks Spanish.");
    expect(DateTime.fromMillis(first.suggested?.scheduledAt ?? 0, { zone }).hour).toBe(10);

    await away(ids.colleen, now, now + 20 * DAY);
    const second = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    expect(second.suggested?.pair?.map((person) => person.name)).toEqual(["Daniel Whitcombe", "Graciela Fuentes"]);

    await away(ids.daniel, now, now + 20 * DAY);
    const third = await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId });
    expect(third.suggested?.pair).toBeNull();
    expect(third.suggested?.reason).toContain("No two home visitors are free");

    // Asking the suggested pair plans the visit at the suggested time.
    if (!second.suggested?.pair) throw new Error("Expected a pair.");
    await planFor(owner, churchId, ids, second.suggested.at, [ids.graciela.memberId, ids.coordinator.memberId]);
    expect((await owner.query(api.visits.board, { at: Math.floor(Date.now() / 3600000) * 3600000, churchId })).suggested).toBeNull();
  });
});

type Setup = Awaited<ReturnType<typeof setup>>;
const planFor = (caller: ReturnType<Setup["as"]>, churchId: Setup["ids"]["church"], ids: Setup["ids"], at: string, visitorIds: Setup["ids"]["owner"]["memberId"][]) =>
  caller.mutation(api.visits.plan, { churchId, neighborId: ids.rosa, requestId: ids.request, at, visitorIds });
