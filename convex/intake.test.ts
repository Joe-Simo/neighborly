/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { LIMITS, businessDaysBetween, nextBusinessDay, statusKeyHash, webCallDoc } from "./intake";
import { firstMatch } from "./geocode";
import { circlePolygon, covering, covers, distanceMiles, nearestCovering, reachOf, validArea } from "./area";
import { hasLink, readCode, readSubmission } from "../src/lib/intake-rules";

// Every email the code channel would write, so a test can read its language.
const written = vi.hoisted(() => [] as { language: string; kind: string }[]);
vi.mock("../src/lib/email/paper-email", async (load) => {
  const real = await load<typeof import("../src/lib/email/paper-email")>();
  return { ...real, paperEmail: (input: Parameters<typeof real.paperEmail>[0]) => { written.push({ language: input.language, kind: input.kind }); return real.paperEmail(input); } };
});

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
// Made-up centre points, near enough to the real ones for these distances.
const zips = [
  { zip: "48201", lat: 42.347, lng: -83.06 }, // Detroit
  { zip: "48124", lat: 42.298, lng: -83.253 }, // Dearborn, about 10.5 miles west
  { zip: "48067", lat: 42.49, lng: -83.137 }, // Royal Oak, about 10.5 miles north
  { zip: "94103", lat: 37.772, lng: -122.411 }, // San Francisco
];

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.intake.seedZips, { rows: zips });
  const ids = await t.run(async (ctx) => {
    const join = async (name: string) => {
      const churchId = await ctx.db.insert("churches", { name, timeZone: "America/Detroit" });
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("memberships", { churchId, userId, name: `${name} owner`, email: `${userId}@example.org`, role: "owner", active: true, approved: true, coverOptIn: false });
      const member = await ctx.db.insert("users", {});
      await ctx.db.insert("memberships", { churchId, userId: member, name: `${name} member`, email: `${member}@example.org`, role: "member", active: true, approved: true, coverOptIn: false });
      return { churchId, userId, member };
    };
    return { detroit: await join("St. Example Detroit"), dearborn: await join("St. Sample Dearborn") };
  });
  const as = (userId: string) => signedIn(t, userId);
  await as(ids.detroit.userId).mutation(api.intake.saveSettings, { churchId: ids.detroit.churchId, enabled: true, address: "1 Example St, Detroit, MI 48201", miles: 10 });
  await as(ids.dearborn.userId).mutation(api.intake.saveSettings, { churchId: ids.dearborn.churchId, enabled: true, address: "48124", miles: 5 });
  return { t, ids, as };
}

const NOW_HOUR = Math.floor(Date.now() / 3_600_000) * 3_600_000;
let serial = 0;
function ask(overrides: Partial<{ zip: string; contactHash: string; ipHash: string; deviceHash: string; need: string; email: string }> = {}) {
  serial++;
  return {
    kinds: ["rent" as const], safe: true, urgent: false, need: overrides.need ?? "Behind on rent this month.", email: overrides.email ?? `person${serial}@example.org`, phone: "", zip: overrides.zip ?? "48201", language: "en" as const,
    ipHash: overrides.ipHash ?? `ip${serial}`, deviceHash: overrides.deviceHash ?? `device${serial}`, contactHash: overrides.contactHash ?? `contact${serial}`,
    statusKeyHash: `key${serial}`, codeHash: `code${serial}`, code: "123456", statusLink: "https://example.org/help/status#x",
  };
}

describe("areas and routing", () => {
  test("a circle polygon covers what is inside its miles and not what is outside", () => {
    const center = zips[0];
    const area = circlePolygon(center, 10);
    expect(validArea(area)).toBe(true);
    expect(covers(area, zips[1])).toBe(distanceMiles(center, zips[1]) <= 10);
    expect(covers(area, { lat: center.lat + 0.1, lng: center.lng })).toBe(true);
    expect(covers(area, zips[3])).toBe(false);
  });
  test("the nearest church wins where areas overlap", () => {
    const teams = [
      { id: "far", area: circlePolygon(zips[1], 25), center: zips[1] },
      { id: "near", area: circlePolygon(zips[0], 25), center: zips[0] },
    ];
    expect(nearestCovering(teams, { lat: 42.35, lng: -83.07 })).toBe("near");
    expect(nearestCovering(teams, zips[3])).toBe(null);
  });
  test("an open ring or too many vertices is refused", () => {
    expect(validArea({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] })).toBe(false);
    const ring = Array.from({ length: 6000 }, (_, i) => [Math.cos(i), Math.sin(i)]);
    ring.push(ring[0]);
    expect(validArea({ type: "Polygon", coordinates: [ring] })).toBe(false);
  });
  test("a zip goes to the team that covers it; out of area and unknown keep nothing", async () => {
    const { t, ids } = await setup();
    expect((await t.mutation(internal.intake.receive, ask({ zip: "48124" }))).result).toBe("sent");
    expect((await t.mutation(internal.intake.receive, ask({ zip: "94103" }))).result).toBe("no_team");
    expect((await t.mutation(internal.intake.receive, ask({ zip: "99999" }))).result).toBe("unknown_zip");
    const rows = await t.run((ctx) => ctx.db.query("webRequests").collect());
    expect(rows.map((row) => row.churchId)).toEqual([ids.dearborn.churchId]);
  });
  test("a phone-only ask with a mistyped zip does not spend that device's one unverified ask of the day", async () => {
    const { t } = await setup();
    const phoneOnly = (zip: string) => ({ ...ask({ zip, ipHash: "ip-typo", deviceHash: "device-typo" }), email: "", phone: "313-555-0100" });
    expect((await t.mutation(internal.intake.receive, phoneOnly("94103"))).result).toBe("no_team");
    expect((await t.mutation(internal.intake.receive, phoneOnly("99999"))).result).toBe("unknown_zip");
    expect((await t.mutation(internal.intake.receive, phoneOnly("48201"))).result).toBe("landed");
    expect((await t.mutation(internal.intake.receive, phoneOnly("48201"))).result).toBe("slow");
  });
  test("a team that switches the form off is skipped", async () => {
    const { t, ids, as } = await setup();
    await as(ids.dearborn.userId).mutation(api.intake.saveSettings, { churchId: ids.dearborn.churchId, enabled: false, address: "48124", miles: 5 });
    // Dearborn's centre is about 10.5 miles from Detroit's, outside Detroit's 10: with Dearborn off, nobody serves it.
    expect((await t.mutation(internal.intake.receive, ask({ zip: "48124" }))).result).toBe("no_team");
  });
  test("settings refuse a distance outside 1 to 100 miles and a zip not on the list", async () => {
    const { ids, as } = await setup();
    for (const miles of [0, 101, 2.5]) await expect(as(ids.detroit.userId).mutation(api.intake.saveSettings, { churchId: ids.detroit.churchId, enabled: true, address: "1 Example St, Detroit, MI 48201", miles })).rejects.toThrow("1 to 100");
    await expect(as(ids.detroit.userId).mutation(api.intake.saveSettings, { churchId: ids.detroit.churchId, enabled: true, address: "00000", miles: 10 })).rejects.toThrow("Census");
  });
  test("first contact is due one business day later, Friday's on Monday", () => {
    const friday = Date.UTC(2026, 10, 20, 15);
    expect(new Date(nextBusinessDay(friday, "America/Detroit")).getUTCDay()).toBe(1);
  });
});

describe("limits, blocks and confirmation", () => {
  test("an address is slowed after ten in an hour", async () => {
    const { t } = await setup();
    for (let i = 0; i < LIMITS.ipPerHour; i++) expect((await t.mutation(internal.intake.receive, ask({ ipHash: "same-ip" }))).result).toBe("sent");
    expect((await t.mutation(internal.intake.receive, ask({ ipHash: "same-ip" }))).result).toBe("slow");
  });
  test("a contact past three a day still hears 'sent', and nothing more is kept or emailed", async () => {
    const { t } = await setup();
    for (let i = 0; i < 4; i++) expect((await t.mutation(internal.intake.receive, ask({ contactHash: "same-contact" }))).result).toBe("sent");
    const outbox = await t.run((ctx) => ctx.db.query("outbox").collect());
    expect(outbox).toHaveLength(3);
  });
  test("the right code makes a call on that team's Help line; a wrong code five times shuts it", async () => {
    const { t, ids, as } = await setup();
    const right = ask();
    await t.mutation(internal.intake.receive, right);
    expect(await t.mutation(internal.intake.confirm, { statusKeyHash: right.statusKeyHash, codeHash: "nope", ipHash: "x" })).toBe(null);
    expect(await t.mutation(internal.intake.confirm, { statusKeyHash: right.statusKeyHash, codeHash: right.codeHash, ipHash: "x" })).toMatchObject({ team: "St. Example Detroit" });
    const calls = await t.run((ctx) => ctx.db.query("calls").collect());
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ churchId: ids.detroit.churchId, callback: "needed", fromWeb: true });
    expect(calls[0].note).toContain("Behind on rent");
    const seen = await as(ids.detroit.userId).query(api.intake.forTeam, { churchId: ids.detroit.churchId, at: NOW_HOUR });
    expect(seen.waiting).toHaveLength(1);

    const wrong = ask();
    await t.mutation(internal.intake.receive, wrong);
    for (let i = 0; i < LIMITS.codeTries; i++) await t.mutation(internal.intake.confirm, { statusKeyHash: wrong.statusKeyHash, codeHash: "nope", ipHash: "y" });
    expect(await t.mutation(internal.intake.confirm, { statusKeyHash: wrong.statusKeyHash, codeHash: wrong.codeHash, ipHash: "y" })).toBe(null);
  });
  test("the same contact twice joins its open request instead of a second call", async () => {
    const { t } = await setup();
    for (const need of ["Rent is late.", "Also the light bill."]) {
      const one = ask({ contactHash: "one-person", need });
      await t.mutation(internal.intake.receive, one);
      await t.mutation(internal.intake.confirm, { statusKeyHash: one.statusKeyHash, codeHash: one.codeHash, ipHash: "z" });
    }
    const calls = await t.run((ctx) => ctx.db.query("calls").collect());
    expect(calls).toHaveLength(1);
    expect(calls[0].note).toContain("Also the light bill.");
  });
  test("a blocked contact hears 'sent' and nothing is kept", async () => {
    const { t, ids, as } = await setup();
    const first = ask({ contactHash: "pest" });
    await t.mutation(internal.intake.receive, first);
    await t.mutation(internal.intake.confirm, { statusKeyHash: first.statusKeyHash, codeHash: first.codeHash, ipHash: "z" });
    const row = await t.run((ctx) => ctx.db.query("webRequests").first());
    await as(ids.detroit.userId).mutation(api.intake.block, { churchId: ids.detroit.churchId, requestId: row!._id });
    expect((await t.mutation(internal.intake.receive, ask({ contactHash: "pest" }))).result).toBe("sent");
    expect(await t.run((ctx) => ctx.db.query("webRequests").filter((q) => q.eq(q.field("stage"), "pending")).collect())).toHaveLength(0);
  });
  test("in a flood, a contact confirmed before is not held", async () => {
    const { t } = await setup();
    const known = ask({ contactHash: "known" });
    await t.mutation(internal.intake.receive, known);
    await t.mutation(internal.intake.confirm, { statusKeyHash: known.statusKeyHash, codeHash: known.codeHash, ipHash: "k" });
    await t.run(async (ctx) => { for (const row of await ctx.db.query("webRequests").collect()) await ctx.db.patch("webRequests", row._id, { stage: "closed" }); });
    for (let i = 0; i < LIMITS.floodPerTeamHour; i++) {
      const one = ask();
      await t.mutation(internal.intake.receive, one);
      await t.mutation(internal.intake.confirm, { statusKeyHash: one.statusKeyHash, codeHash: one.codeHash, ipHash: `f${i}` });
    }
    const again = ask({ contactHash: "known" });
    await t.mutation(internal.intake.receive, again);
    await t.mutation(internal.intake.confirm, { statusKeyHash: again.statusKeyHash, codeHash: again.codeHash, ipHash: "k2" });
    const row = await t.run((ctx) => ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", again.statusKeyHash)).unique());
    expect(row?.stage).toBe("received");
  });
  test("phone only lands at once, unverified, three a team a day; then held", async () => {
    const { t } = await setup();
    for (let i = 0; i < 4; i++) {
      const answer = await t.mutation(internal.intake.receive, { ...ask(), email: "", phone: "3135550100", safe: false, callAt: "after six" });
      expect(answer).toMatchObject({ result: "landed", team: "St. Example Detroit" });
    }
    const rows = await t.run((ctx) => ctx.db.query("webRequests").collect());
    expect(rows.map((row) => row.stage).sort()).toEqual(["held", "received", "received", "received"]);
    expect(await t.run((ctx) => ctx.db.query("outbox").collect())).toHaveLength(0);
    const calls = await t.run((ctx) => ctx.db.query("calls").collect());
    expect(calls[0].note).toContain("Do not text, email or leave a message. Call only: after six.");
  });
  test("one device or network gets one unverified request a day", async () => {
    const { t } = await setup();
    const phoneOnly = (ipHash: string) => ({ ...ask({ ipHash, deviceHash: `d-${ipHash}` }), email: "", phone: "3135550100" });
    expect((await t.mutation(internal.intake.receive, phoneOnly("same"))).result).toBe("landed");
    expect((await t.mutation(internal.intake.receive, phoneOnly("same"))).result).toBe("slow");
  });
  test("past twenty in an hour, a team's requests are held for a coordinator", async () => {
    const { t, ids, as } = await setup();
    for (let i = 0; i <= LIMITS.floodPerTeamHour; i++) {
      const one = ask();
      await t.mutation(internal.intake.receive, one);
      await t.mutation(internal.intake.confirm, { statusKeyHash: one.statusKeyHash, codeHash: one.codeHash, ipHash: `c${i}` });
    }
    const held = await t.run((ctx) => ctx.db.query("webRequests").filter((q) => q.eq(q.field("stage"), "held")).collect());
    expect(held).toHaveLength(1);
    await as(ids.detroit.userId).mutation(api.intake.release, { churchId: ids.detroit.churchId, requestId: held[0]._id });
    expect(await t.run((ctx) => ctx.db.query("calls").collect())).toHaveLength(LIMITS.floodPerTeamHour + 1);
  });
  test("the status page shows only where the request stands", async () => {
    const { t } = await setup();
    const key = "0123456789abcdef0123456789abcdef";
    const one = { ...ask(), statusKeyHash: await statusKeyHash(key) };
    await t.mutation(internal.intake.receive, one);
    expect(await t.query(api.intake.status, { key })).toMatchObject({ status: "pending" });
    await t.mutation(internal.intake.confirm, { statusKeyHash: one.statusKeyHash, codeHash: one.codeHash, ipHash: "s" });
    expect(await t.query(api.intake.status, { key })).toMatchObject({ status: "received", timeZone: "America/Detroit" });
    expect(await t.query(api.intake.status, { key: "f".repeat(32) })).toBe(null);
  });
});

describe("each team sees only its own", () => {
  async function confirmed() {
    const ready = await setup();
    const one = ask();
    await ready.t.mutation(internal.intake.receive, one);
    await ready.t.mutation(internal.intake.confirm, { statusKeyHash: one.statusKeyHash, codeHash: one.codeHash, ipHash: "i" });
    const row = await ready.t.run((ctx) => ctx.db.query("webRequests").first());
    return { ...ready, requestId: row!._id as Id<"webRequests"> };
  }
  test("another team and a plain member are refused", async () => {
    const { ids, as, requestId } = await confirmed();
    const dearborn = as(ids.dearborn.userId);
    await expect(dearborn.mutation(api.intake.close, { churchId: ids.dearborn.churchId, requestId })).rejects.toThrow("no longer here");
    await expect(dearborn.query(api.intake.forTeam, { churchId: ids.detroit.churchId, at: 3_600_000 })).rejects.toThrow();
    await expect(as(ids.detroit.member).query(api.intake.forTeam, { churchId: ids.detroit.churchId, at: 3_600_000 })).rejects.toThrow("coordinators and owners");
    expect((await dearborn.query(api.intake.forTeam, { churchId: ids.dearborn.churchId, at: 3_600_000 })).waiting).toHaveLength(0);
  });
  test("passing on moves the request and its call, leaving only a one-line trace", async () => {
    const { t, ids, as, requestId } = await confirmed();
    const detroit = as(ids.detroit.userId);
    const targets = await detroit.query(api.intake.passTargets, { churchId: ids.detroit.churchId, requestId });
    expect(targets.map((team) => team.id)).toEqual([ids.dearborn.churchId]);
    await detroit.mutation(api.intake.passOn, { churchId: ids.detroit.churchId, requestId, toChurchId: ids.dearborn.churchId, reason: "They live closer to Dearborn." });
    const calls = await t.run((ctx) => ctx.db.query("calls").collect());
    expect(calls.map((call) => call.churchId)).toEqual([ids.dearborn.churchId]);
    const left = await detroit.query(api.intake.forTeam, { churchId: ids.detroit.churchId, at: NOW_HOUR });
    expect(left.waiting).toHaveLength(0);
    expect(left.passedOn).toEqual([expect.objectContaining({ toName: "St. Sample Dearborn", reason: "They live closer to Dearborn." })]);
    expect(JSON.stringify(left)).not.toContain("example.org");
    const there = await as(ids.dearborn.userId).query(api.intake.forTeam, { churchId: ids.dearborn.churchId, at: NOW_HOUR });
    expect(there.waiting[0].passedFrom).toEqual({ name: "St. Example Detroit", reason: "They live closer to Dearborn." });
  });
});

describe("what the form accepts", () => {
  const good = { adult: true, kinds: ["food", "rent"], need: "We need groceries.", email: "Ana@Example.org", phone: "(313) 555-0100", zip: "48201-1234", language: "es", safe: "yes" };
  test("a good submission is read and tidied", () => {
    expect(readSubmission(good)).toEqual({ ok: true, value: { kinds: ["food", "rent"], need: "We need groceries.", email: "ana@example.org", phone: "3135550100", zip: "48201", language: "es", safe: true } });
  });
  test.each([
    [{ adult: false }, "adult"], [{ kinds: ["cash"] }, "needs"], [{ email: "not-an-email" }, "email"], [{ phone: "555" }, "phone"], [{ email: "", phone: "" }, "reach"],
    [{ zip: "4820" }, "zip"], [{ zip: "", nearby: "the library on Main" }, "nearby"], [{ safe: "maybe" }, "safe"], [{ safe: "no" }, "when"],
  ])("refuses %o", (change, problem) => {
    const read = readSubmission({ ...good, ...change });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.problems).toContain(problem);
  });
  test("a nearby zip places someone with no address; links are taken out of the words", () => {
    const read = readSubmission({ ...good, zip: "", nearby: "48124", need: "Call me, or see bit . ly/x for my story" });
    expect(read.ok && read.value.zip).toBe("48124");
    expect(read.ok && read.value.need).toBe("Call me, or see [link removed] for my story");
  });
  test("not safe to message needs a phone and a time", () => {
    expect(readSubmission({ ...good, safe: "no", callAt: "after 6pm", phone: "" })).toMatchObject({ ok: false, problems: ["reach"] });
    expect(readSubmission({ ...good, safe: "no", callAt: "after 6pm" })).toMatchObject({ ok: true, value: { safe: false, callAt: "after 6pm" } });
  });
  test("links are caught in disguise, everyday sentences are not", () => {
    for (const spam of ["see bit . ly/x", "kindhelps dot com", "www .example", "visit exаmple.com", "hxxps://x"]) expect(hasLink(spam)).toBe(true);
    for (const real of ["I need help. Me and my kids", "Necesito ayuda. Me cortaron la luz.", "Rent is due on the 1st. Us too", "We moved to Detroit"]) expect(hasLink(real)).toBe(false);
  });
  test("a code is six digits", () => {
    expect(readCode("123 456")).toBe("123456");
    expect(readCode("12345")).toBe(null);
  });
});

describe("the second round: geocoding, order, rural reach, weekly limits, holidays", () => {
  test("the Census answer's first match is read; anything else is no point", () => {
    expect(firstMatch({ result: { addressMatches: [{ coordinates: { x: -83.05, y: 42.33 } }] } })).toEqual({ lat: 42.33, lng: -83.05 });
    expect(firstMatch({ result: { addressMatches: [] } })).toBe(null);
    expect(firstMatch("nope")).toBe(null);
  });
  test("an overlap order wins before distance; a big zip reaches a circle near it, marked to check", () => {
    const teams = [
      { id: "near", area: circlePolygon(zips[0], 25), center: zips[0], miles: 25 },
      { id: "council", area: circlePolygon(zips[1], 25), center: zips[1], miles: 25, order: 1 },
    ];
    expect(covering(teams, { lat: 42.35, lng: -83.07 })[0]).toEqual({ id: "council", checkArea: false });
    const far = { lat: 42.347, lng: -83.06 + 0.6 }; // about 31 miles east of Detroit's centre
    expect(covering([teams[0]], far)).toEqual([]);
    expect(covering([teams[0]], far, reachOf(200))).toEqual([{ id: "near", checkArea: true }]);
  });
  test("a full team's requests go to the next team that serves the zip, or the person hears it is full", async () => {
    const { t, ids, as } = await setup();
    await as(ids.dearborn.userId).mutation(api.intake.saveSettings, { churchId: ids.dearborn.churchId, enabled: true, address: "48124", miles: 25, weeklyLimit: 1 });
    await as(ids.detroit.userId).mutation(api.intake.saveSettings, { churchId: ids.detroit.churchId, enabled: true, address: "48201", miles: 25, weeklyLimit: 1 });
    const land = async () => {
      const one = { ...ask({ zip: "48124" }), email: "", phone: "3135550100" };
      const answer = await t.mutation(internal.intake.receive, one);
      return "team" in answer ? answer.team : answer.result;
    };
    expect(await land()).toBe("St. Sample Dearborn");
    expect(await land()).toBe("St. Example Detroit");
    expect((await t.mutation(internal.intake.receive, { ...ask({ zip: "48124" }), email: "", phone: "3135550100" })).result).toBe("full");
  });
  test("a geocoded street address routes by its own point", async () => {
    const { t } = await setup();
    const one = { ...ask({ zip: "94103" }), email: "", phone: "3135550100", at: { lat: 42.35, lng: -83.06 } };
    expect(await t.mutation(internal.intake.receive, one)).toMatchObject({ result: "landed", team: "St. Example Detroit" });
  });
  test("holidays are skipped when counting business days", () => {
    const wednesday = Date.UTC(2026, 11, 23, 15);
    expect(new Date(nextBusinessDay(wednesday, "America/Detroit", ["2026-12-24", "2026-12-25"])).getUTCDate()).toBe(28);
    expect(businessDaysBetween(wednesday, Date.UTC(2026, 11, 30, 16), "America/Detroit", ["2026-12-24", "2026-12-25"])).toBe(3);
  });
});

describe("passing, marking, deleting", () => {
  async function landed() {
    const ready = await setup();
    await ready.t.mutation(internal.intake.receive, { ...ask(), email: "", phone: "3135550100" });
    const row = await ready.t.run((ctx) => ctx.db.query("webRequests").first());
    return { ...ready, requestId: row!._id as Id<"webRequests"> };
  }
  test("the team it was passed to can return it within a business day, with a reason", async () => {
    const { t, ids, as, requestId } = await landed();
    await as(ids.detroit.userId).mutation(api.intake.passOn, { churchId: ids.detroit.churchId, requestId, toChurchId: ids.dearborn.churchId, reason: "Closer to you." });
    const there = await as(ids.dearborn.userId).query(api.intake.forTeam, { churchId: ids.dearborn.churchId, at: NOW_HOUR });
    expect(there.waiting[0].acceptBy).not.toBe(null);
    await as(ids.dearborn.userId).mutation(api.intake.giveBack, { churchId: ids.dearborn.churchId, requestId, reason: "Outside our parish." });
    const row = await t.run((ctx) => ctx.db.get("webRequests", requestId));
    expect(row).toMatchObject({ churchId: ids.detroit.churchId, passes: 1, passedFrom: { reason: "Outside our parish." } });
    await expect(as(ids.detroit.userId).mutation(api.intake.giveBack, { churchId: ids.detroit.churchId, requestId, reason: "No." })).rejects.toThrow("no longer be returned");
  });
  test("two teams marking one contact 'not genuine' puts it in the admin queue, with no details", async () => {
    const { t, ids, as } = await setup();
    for (const zip of ["48201", "48124"]) {
      await t.mutation(internal.intake.receive, { ...ask({ zip, contactHash: "same-person", ipHash: zip, deviceHash: zip }), email: "", phone: "3135550100" });
    }
    const rows = await t.run((ctx) => ctx.db.query("webRequests").collect());
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const owner = row.churchId === ids.detroit.churchId ? ids.detroit.userId : ids.dearborn.userId;
      await as(owner).mutation(api.intake.notGenuine, { churchId: row.churchId, requestId: row._id });
    }
    const queue = await t.query(internal.intakeCare.reviews, {});
    expect(queue).toEqual([expect.objectContaining({ teams: 2 })]);
  });
  test("the owner reviews the team's own marks and the shared cases, seeing only a hash and a count of the others", async () => {
    const { t, ids, as } = await setup();
    for (const zip of ["48201", "48124"]) {
      await t.mutation(internal.intake.receive, { ...ask({ zip, contactHash: "same-person", ipHash: zip, deviceHash: zip, need: `Secret words ${zip}` }), email: "", phone: "3135550100" });
    }
    const rows = await t.run((ctx) => ctx.db.query("webRequests").collect());
    for (const row of rows) await as(row.churchId === ids.detroit.churchId ? ids.detroit.userId : ids.dearborn.userId).mutation(api.intake.notGenuine, { churchId: row.churchId, requestId: row._id });
    const detroit = { churchId: ids.detroit.churchId };
    const seen = await as(ids.detroit.userId).query(api.intakeReview.forOwner, detroit);
    expect(seen?.marked).toHaveLength(1);
    expect(seen?.shared).toEqual([{ id: expect.any(String), hash: "same-per", teams: 2, at: expect.any(Number) }]);
    // Nothing of the other team: not its name, not its request's words.
    expect(JSON.stringify(seen)).not.toContain("Dearborn");
    expect(JSON.stringify(seen)).not.toContain("Secret words 48124");
    await expect(as(ids.detroit.member).query(api.intakeReview.forOwner, detroit)).rejects.toThrow();
    await expect(as(ids.dearborn.userId).mutation(api.intakeReview.decideShared, { churchId: ids.dearborn.churchId, flagId: seen!.shared[0].id, genuine: true })).rejects.toThrow("not waiting for a review");

    // "Genuine" on the team's own request takes back its blocks and its mark; the shared case falls under two teams.
    const mine = seen!.marked[0].id;
    await as(ids.detroit.userId).mutation(api.intakeReview.decideMarked, { ...detroit, requestId: mine, genuine: true });
    const after = await t.run(async (ctx) => ({
      blocks: (await ctx.db.query("webBlocks").collect()).filter((row) => row.churchId === ids.detroit.churchId),
      flags: await ctx.db.query("webFlags").collect(),
      review: await ctx.db.query("webReviews").first(),
    }));
    expect(after.blocks).toEqual([]);
    expect(after.flags.map((flag) => flag.churchId)).toEqual([ids.dearborn.churchId]);
    expect(after.review).toMatchObject({ teams: 1, settled: true });
    expect(await as(ids.detroit.userId).query(api.intakeReview.forOwner, detroit)).toEqual({ marked: [], shared: [] });
    // Dearborn's own mark and blocks stand.
    const dearborn = await as(ids.dearborn.userId).query(api.intakeReview.forOwner, { churchId: ids.dearborn.churchId });
    expect(dearborn?.marked).toHaveLength(1);
    expect(dearborn?.shared).toEqual([]);
    await as(ids.dearborn.userId).mutation(api.intakeReview.decideMarked, { churchId: ids.dearborn.churchId, requestId: dearborn!.marked[0].id, genuine: false });
    expect((await t.run((ctx) => ctx.db.query("webBlocks").collect())).length).toBeGreaterThan(0);
  });
  test("'Not genuine' on a shared case keeps the team's mark and takes it off the owner's list", async () => {
    const { t, ids, as } = await setup();
    for (const zip of ["48201", "48124"]) await t.mutation(internal.intake.receive, { ...ask({ zip, contactHash: "twice", ipHash: zip, deviceHash: zip }), email: "", phone: "3135550101" });
    for (const row of await t.run((ctx) => ctx.db.query("webRequests").collect())) await as(row.churchId === ids.detroit.churchId ? ids.detroit.userId : ids.dearborn.userId).mutation(api.intake.notGenuine, { churchId: row.churchId, requestId: row._id });
    const detroit = { churchId: ids.detroit.churchId };
    const [shared] = (await as(ids.detroit.userId).query(api.intakeReview.forOwner, detroit))!.shared;
    await as(ids.detroit.userId).mutation(api.intakeReview.decideShared, { ...detroit, flagId: shared.id, genuine: false });
    expect((await as(ids.detroit.userId).query(api.intakeReview.forOwner, detroit))?.shared).toEqual([]);
    expect(await t.query(internal.intakeCare.reviews, {})).toEqual([expect.objectContaining({ teams: 2 })]);
  });
  test("a team's public phone is checked when saved, and shown once a request has reached the team", async () => {
    const { t, ids, as } = await setup();
    const save = (phone: string | null) => as(ids.detroit.userId).mutation(api.intake.saveSettings, { churchId: ids.detroit.churchId, enabled: true, address: "1 Example St, Detroit, MI 48201", miles: 10, phone });
    await expect(save("555-0100")).rejects.toThrow("A team phone has 10 numbers");
    await expect(save("call 313 555 0100")).rejects.toThrow("A team phone has 10 numbers");
    await save("+1 313.555.0100");
    expect((await as(ids.detroit.userId).query(api.intake.settings, { churchId: ids.detroit.churchId }))?.phone).toBe("(313) 555-0100");
    // Pending (a code is on its way): no phone yet. Landed or confirmed: the team's phone.
    const pending = ask();
    expect(await t.mutation(internal.intake.receive, pending)).toEqual({ result: "sent" });
    expect(await t.mutation(internal.intake.confirm, { statusKeyHash: pending.statusKeyHash, codeHash: pending.codeHash, ipHash: "c" })).toMatchObject({ phone: "(313) 555-0100" });
    expect(await t.mutation(internal.intake.receive, { ...ask(), email: "", phone: "3135550111" })).toMatchObject({ result: "landed", phone: "(313) 555-0100" });
    await save(null);
    expect((await as(ids.detroit.userId).query(api.intake.settings, { churchId: ids.detroit.churchId }))?.phone).toBe(null);
  });
  test("deleting from the status page needs the code sent to the request's own email", async () => {
    const { t } = await setup();
    const one = ask();
    await t.mutation(internal.intake.receive, one);
    await t.mutation(internal.intake.confirm, { statusKeyHash: one.statusKeyHash, codeHash: one.codeHash, ipHash: "d" });
    expect(await t.mutation(internal.intake.askToRemove, { statusKeyHash: one.statusKeyHash, codeHash: "delete-code", code: "654321", statusLink: "https://example.org/help/status?k=x", ipHash: "d" })).toBe("code");
    expect(await t.mutation(internal.intake.removeWithCode, { statusKeyHash: one.statusKeyHash, codeHash: "wrong" })).toBe(false);
    expect(await t.mutation(internal.intake.removeWithCode, { statusKeyHash: one.statusKeyHash, codeHash: "delete-code" })).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("webRequests").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("calls").collect())).toHaveLength(0);
  });
});

describe("partners", () => {
  test("a partner added in Spanish gets its sign-in code in Spanish", async () => {
    const { t, ids, as } = await setup();
    await as(ids.detroit.userId).mutation(internal.intakePartners.add, { churchId: ids.detroit.churchId, name: "Refugio", email: "mesa@example.org", linkHash: "es-link", language: "es" });
    written.length = 0;
    await t.mutation(internal.intakePartners.startSignIn, { linkHash: "es-link", codeHash: "pc", code: "222222", link: "https://example.org/ayuda?p=x" });
    expect(written).toEqual([{ language: "es", kind: "help_code" }]);
  });

  test("a partner signs in with a code to its own email, sends without a bot check, and stops when revoked", async () => {
    const { t, ids, as } = await setup();
    const partnerId = await as(ids.detroit.userId).mutation(internal.intakePartners.add, { churchId: ids.detroit.churchId, name: "Example Shelter", email: "Desk@Example.org", linkHash: "link" });
    expect(await t.mutation(internal.intakePartners.startSignIn, { linkHash: "link", codeHash: "pc", code: "111111", link: "https://example.org/help?p=x" })).toBe("d•••@example.org");
    expect(await t.mutation(internal.intakePartners.startSignIn, { linkHash: "other", codeHash: "pc", code: "111111", link: "x" })).toBe(null);
    expect(await t.mutation(internal.intakePartners.finishSignIn, { linkHash: "link", codeHash: "pc", sessionHash: "s" })).toBe(true);
    expect(await t.query(internal.intakePartners.signedIn, { linkHash: "link", sessionHash: "s" })).toBe(partnerId);
    const sent = await t.mutation(internal.intake.receive, { ...ask({ zip: "94103" }), partnerId });
    expect(sent).toMatchObject({ result: "landed", team: "St. Example Detroit" });
    const row = await t.run((ctx) => ctx.db.query("webRequests").first());
    expect(row).toMatchObject({ partnerId, referredBy: "Example Shelter", stage: "received" });
    await as(ids.detroit.userId).mutation(api.intakePartners.revoke, { churchId: ids.detroit.churchId, partnerId });
    expect(await t.query(internal.intakePartners.signedIn, { linkHash: "link", sessionHash: "s" })).toBe(null);
    expect((await t.mutation(internal.intake.receive, { ...ask(), partnerId })).result).toBe("slow");
  });
  test("a partner sends at most ten a day", async () => {
    const { t, ids, as } = await setup();
    const partnerId = await as(ids.detroit.userId).mutation(internal.intakePartners.add, { churchId: ids.detroit.churchId, name: "Example Shelter", email: "desk@example.org", linkHash: "link" });
    for (let i = 0; i < LIMITS.partnerPerDay; i++) expect((await t.mutation(internal.intake.receive, { ...ask(), partnerId })).result).toBe("landed");
    expect((await t.mutation(internal.intake.receive, { ...ask(), partnerId })).result).toBe("slow");
  });
  test("another team cannot revoke a team's partner", async () => {
    const { ids, as } = await setup();
    const partnerId = await as(ids.detroit.userId).mutation(internal.intakePartners.add, { churchId: ids.detroit.churchId, name: "Example Shelter", email: "desk@example.org", linkHash: "link" });
    await expect(as(ids.dearborn.userId).mutation(api.intakePartners.revoke, { churchId: ids.dearborn.churchId, partnerId })).rejects.toThrow("Partner not found");
  });
});

describe("daily care", () => {
  test("a team silent for 30 days is paused, its open requests passed on, its owner told", async () => {
    const { t, ids } = await setup();
    await t.mutation(internal.intake.receive, { ...ask({ zip: "48124" }), email: "", phone: "3135550100" });
    await t.run(async (ctx) => {
      const church = await ctx.db.get("churches", ids.dearborn.churchId);
      await ctx.db.patch("churches", ids.dearborn.churchId, { intake: { ...church!.intake!, seenAt: 0 } });
      const detroit = await ctx.db.get("churches", ids.detroit.churchId);
      await ctx.db.patch("churches", ids.detroit.churchId, { intake: { ...detroit!.intake!, area: circlePolygon(zips[0], 25), miles: 25, bbox: [-180, -90, 180, 90], seenAt: Date.now() } });
    });
    await t.mutation(internal.intakeCare.daily, {});
    const church = await t.run((ctx) => ctx.db.get("churches", ids.dearborn.churchId));
    expect(church?.intake).toMatchObject({ enabled: false, pausedBy: "auto" });
    const row = await t.run((ctx) => ctx.db.query("webRequests").first());
    expect(row?.churchId).toBe(ids.detroit.churchId);
    const told = await t.run((ctx) => ctx.db.query("outbox").collect());
    expect(told.filter((one) => one.kind === "intake_notice")).toHaveLength(1);
  });
  test("closed requests are erased after a year; the row stays for counts", async () => {
    const { t } = await setup();
    await t.mutation(internal.intake.receive, { ...ask(), email: "", phone: "3135550100" });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("webRequests").first();
      await ctx.db.patch("webRequests", row!._id, { stage: "closed", closedAt: 0, createdAt: 0 });
      await ctx.db.patch("calls", row!.callId!, { callback: "done" });
    });
    await t.mutation(internal.intakeCare.daily, {});
    const row = await t.run((ctx) => ctx.db.query("webRequests").first());
    expect(row).toMatchObject({ erased: true, need: "", phone: "", email: "" });
    const call = await t.run((ctx) => ctx.db.query("calls").first());
    expect(call).toMatchObject({ callerName: "", phone: "", note: "" });
  });
});
describe("a confirmed request from a household on file", () => {
  test("is marked with that household for a person to confirm; a phone two households share is not", async () => {
    const { t, ids, as } = await setup();
    const churchId = ids.detroit.churchId;
    const [owner] = await t.run((ctx) => ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect());
    const household = (name: string, phone: string) => t.run((ctx) => ctx.db.insert("neighbors", { churchId, name, nameKey: name.toLowerCase(), phone, phoneKey: phone.replace(/\D/g, ""), email: "", address: "", adults: 1, children: 0, language: "en", notes: "", createdBy: owner._id, createdAt: 0 }));
    const rosa = await household("Rosa Fontaine", "(100) 555-0101");
    await household("Denise Walker", "(100) 555-0102");
    await household("Marcus Bellamy", "(100) 555-0102");
    const send = async (phone: string) => {
      const one = { ...ask(), phone };
      await t.mutation(internal.intake.receive, one);
      await t.mutation(internal.intake.confirm, { statusKeyHash: one.statusKeyHash, codeHash: one.codeHash, ipHash: `m${phone}` });
    };
    await send("100.555.0101");
    await send("100-555-0102");
    const calls = await t.run((ctx) => ctx.db.query("calls").collect());
    expect(calls.map((call) => call.likelyNeighborId ?? null)).toEqual([rosa, null]);
    expect(calls.every((call) => !call.neighborId)).toBe(true);
    const caller = as(ids.detroit.userId);
    const row = (await caller.query(api.assistance.calls, { churchId, at: NOW_HOUR })).waiting.find((call) => call.id === calls[0]._id);
    expect(row?.likely).toEqual({ id: rosa, name: "Rosa Fontaine" });
    await caller.mutation(api.assistance.linkCall, { churchId, callId: calls[0]._id, neighborId: rosa });
    expect((await caller.query(api.assistance.calls, { churchId, at: NOW_HOUR })).waiting.find((call) => call.id === calls[0]._id)).toMatchObject({ neighborId: rosa, likely: null });
  });
});


describe("the call a web request becomes", () => {
  test("names its phone as the app shows a phone", () => {
    const doc = webCallDoc({ churchId: "c" as Id<"churches">, kind: "rent", need: "Rent", phone: "1015550131", email: "a@example.org", zip: "48201", language: "en" } as Parameters<typeof webCallDoc>[0], Date.now(), undefined);
    expect(doc.note).toContain("Phone: (101) 555-0131 · Email: a@example.org");
    expect(doc.note).not.toContain("1015550131");
  });
});
