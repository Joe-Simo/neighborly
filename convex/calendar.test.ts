/// <reference types="vite/client" />
import { beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { httpRouter } from "convex/server";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";
import { feed, streetOnly } from "./calendar";

// The route lives in the shared http.ts; the test mounts the same line itself so it does not depend on that file.
const router = httpRouter();
router.route({ pathPrefix: "/calendar/", method: "GET", handler: feed });
const modules = { ...import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]), "./http.ts": async () => ({ default: router }) };
const HOUR = 3600000, DAY = 24 * HOUR;
const site = "https://sample-deployment.convex.site";
beforeEach(() => { vi.stubEnv("CONVEX_SITE_URL", site); });

async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: "America/New_York" });
    const join = async (name: string) => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: church, userId, name, email: `${name.toLowerCase()}@neighborly.example`, role: "member", active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const marisol = await join("Marisol"), thomas = await join("Thomas"), renee = await join("Renee");
    const team = await ctx.db.insert("teams", { churchId: church, name: "Help line", description: "" });
    const shift = (assigneeId: typeof marisol.memberId, start: number, extra: { cancelled?: boolean } = {}) => ctx.db.insert("commitments", { churchId: church, teamId: team, title: "Help line morning", start, end: start + 3 * HOUR, location: "Parish office", preparation: "Check the callback list first; record every call, even a wrong number.", assigneeId, coordinatorId: thomas.memberId, version: 1, ...extra });
    await shift(marisol.memberId, now + 2 * DAY);
    await shift(marisol.memberId, now + 9 * DAY, { cancelled: true });
    await shift(marisol.memberId, now - 90 * DAY);
    await shift(thomas.memberId, now + 3 * DAY);
    const neighbor = await ctx.db.insert("neighbors", { churchId: church, name: "Celeste Hyppolite", nameKey: "celeste hyppolite", phone: "(100) 555-0142", phoneKey: "1005550142", email: "celeste.hyppolite@neighborly.example", address: "412 Placeholder Rd, Apt 7", adults: 1, children: 2, language: "ht", notes: "Prefers afternoon visits.", createdBy: thomas.memberId, createdAt: now });
    const request = await ctx.db.insert("assistanceRequests", { churchId: church, neighborId: neighbor, kind: "utility", summary: "Shut-off notice on the electric bill", amountRequested: 18000, status: "open", decisionNote: "", payeeKind: "utility", payeeName: "Demo Power & Light", source: "person", createdBy: thomas.memberId, createdAt: now });
    const visit = (visitors: (typeof marisol.memberId)[], status: "scheduled" | "cancelled" = "scheduled") => ctx.db.insert("visits", { churchId: church, neighborId: neighbor, requestId: request, scheduledAt: now + 4 * DAY, status, visitors: visitors.map((memberId) => ({ memberId, hours: 0, miles: 0 })), notes: "Bring the utility pledge form.", createdBy: thomas.memberId, createdAt: now });
    await visit([marisol.memberId, renee.memberId]);
    await visit([thomas.memberId, renee.memberId]);
    await visit([marisol.memberId, thomas.memberId], "cancelled");
    // A visit already made, to someone on another street: once it is done it leaves the feed.
    const earlier = await ctx.db.insert("neighbors", { churchId: church, name: "Wendell Orlov", nameKey: "wendell orlov", phone: "(100) 555-0177", phoneKey: "1005550177", email: "", address: "88 Fixture Ln", adults: 2, children: 0, language: "en", notes: "", createdBy: thomas.memberId, createdAt: now });
    await ctx.db.insert("visits", { churchId: church, neighborId: earlier, scheduledAt: now - 3 * DAY, status: "completed", visitors: [marisol.memberId, renee.memberId].map((memberId) => ({ memberId, hours: 1.5, miles: 8 })), notes: "Reviewed the lease together.", completedAt: now - 3 * DAY, createdBy: thomas.memberId, createdAt: now });
    // Another group entirely, with its own neighbor and visit.
    const elsewhere = await ctx.db.insert("churches", { name: "St. Sample Conference", timeZone: "America/New_York" });
    const strangerUser = await ctx.db.insert("users", {});
    const stranger = await ctx.db.insert("memberships", { churchId: elsewhere, userId: strangerUser, name: "Walter", email: "walter@neighborly.example", role: "owner", active: true, approved: true, coverOptIn: false });
    const far = await ctx.db.insert("neighbors", { churchId: elsewhere, name: "Odalys Montoya", nameKey: "odalys montoya", phone: "(100) 555-0188", phoneKey: "1005550188", email: "", address: "7 Mockingbird Way", adults: 1, children: 1, language: "es", notes: "", createdBy: stranger, createdAt: now });
    await ctx.db.insert("visits", { churchId: elsewhere, neighborId: far, scheduledAt: now + 4 * DAY, status: "scheduled", visitors: [{ memberId: stranger, hours: 0, miles: 0 }, { memberId: marisol.memberId, hours: 0, miles: 0 }], notes: "", createdBy: stranger, createdAt: now });
    return { church, marisol, thomas, renee };
  });
  for (const person of [ids.marisol, ids.thomas, ids.renee]) emails.set(person.userId, `${person.userId}@neighborly.example`);
  return { t, ids, as: (person: { userId: string }) => { emails.set(person.userId, `${person.userId}@neighborly.example`); return signedIn(t, person.userId); } };
}
const path = (address: string) => address.slice(site.length);
/** Folded lines joined back together, as a calendar app reads them. */
const unfolded = (text: string) => text.replace(/\r\n[ \t]/g, "");
/** Everything a person could read in the feed: the clock times and record ids are digits that prove nothing. */
const readable = (text: string) => unfolded(text).split("\r\n").filter((line) => !/^(?:UID|DTSTAMP|DTSTART|DTEND):/.test(line)).join("\r\n");

describe("a member's calendar feed", () => {
  test("is valid iCalendar holding their own shifts and visits, and nobody else's", async () => {
    const { t, ids, as } = await setup();
    const address = await as(ids.marisol).action(api.calendar.createAddress, { churchId: ids.church });
    expect(address).toMatch(/^https:\/\/sample-deployment\.convex\.site\/calendar\/[0-9a-f]{64}\.ics$/);
    expect(await as(ids.marisol).query(api.calendar.address, { churchId: ids.church })).toBe(address);

    const response = await t.fetch(path(address));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    const text = await response.text();

    // RFC 5545: CRLF line ends, no line over 75 octets, one calendar wrapping whole events.
    const lines = text.split("\r\n");
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.filter(Boolean).at(-1)).toBe("END:VCALENDAR");
    const body = unfolded(text);
    expect(body).toMatch(/\r\nVERSION:2\.0\r\n/);
    expect(body).toMatch(/\r\nPRODID:.+\r\n/);
    const events = body.split("BEGIN:VEVENT").slice(1).map((event) => event.split("END:VEVENT")[0]);
    expect(body.match(/END:VEVENT/g)).toHaveLength(events.length);
    for (const event of events) for (const property of ["UID", "DTSTAMP", "DTSTART", "DTEND", "SUMMARY"]) expect(event).toMatch(new RegExp(`\\r\\n${property}[:;]`));
    for (const event of events) expect(event).toMatch(/\r\nDTSTART:\d{8}T\d{6}Z\r\n/);
    expect(new Set(events.map((event) => event.match(/\r\nUID:(.+)\r\n/)?.[1])).size).toBe(events.length);

    // Her coming shift and her visit. Not the cancelled ones, not the one from three months ago, not Thomas's.
    expect(events.map((event) => event.match(/\r\nSUMMARY:(.+)\r\n/)?.[1]).sort()).toEqual(["Help line morning", "Home visit"]);
    expect(body).toContain("LOCATION:Parish office");
    expect(body).toContain(String.raw`DESCRIPTION:Check the callback list first\; record every call\, even a wrong number.`);
    expect(body).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
  });

  test("a visit shows the time and the street, never who or why", async () => {
    const { t, ids, as } = await setup();
    const text = unfolded(await (await t.fetch(path(await as(ids.marisol).action(api.calendar.createAddress, { churchId: ids.church })))).text());
    expect(text).toContain("LOCATION:Placeholder Rd\r\n");
    for (const secret of ["Celeste", "Hyppolite", "412", "Apt", "0142", "celeste.hyppolite", "electric", "Shut-off", "utility", "Demo Power", "pledge", "afternoon", "Renee"]) expect(readable(text)).not.toContain(secret);
    // Done visits and other groups' visits are not there at all, even with her name on them.
    for (const absent of ["Fixture", "Wendell", "Orlov", "lease", "Mockingbird", "Odalys", "Montoya", "St. Sample"]) expect(text).not.toContain(absent);
    expect(text.match(/SUMMARY:Home visit/g)).toHaveLength(1);
    expect(streetOnly("412 Placeholder Rd, Apt 7")).toBe("Placeholder Rd");
    expect(streetOnly("12B Sample St")).toBe("Sample St");
    expect(streetOnly("Mockingbird Way")).toBe("Mockingbird Way");
    expect(streetOnly("412/7 Placeholder Rd")).toBe("Placeholder Rd");
    expect(streetOnly("Placeholder Rd 412")).toBe("Placeholder Rd");
    expect(streetOnly("412 Placeholder Rd Apt 7")).toBe("Placeholder Rd");
    expect(streetOnly("9 Sample Ct #3B")).toBe("Sample Ct");
    expect(streetOnly("1200 SW 22nd Ave Lot 14")).toBe("SW 22nd Ave");
    expect(streetOnly("5150 US 41")).toBe("US 41");
    expect(streetOnly("412")).toBe("");
  });

  test("a commitment typed with a neighbor in it leaves without them", async () => {
    const { t, ids, as } = await setup();
    await t.run(async (ctx) => {
      const shift = (await ctx.db.query("commitments").withIndex("by_assignee_end", (q) => q.eq("assigneeId", ids.marisol.memberId)).order("desc").collect()).find((one) => !one.cancelled);
      await ctx.db.insert("commitments", { ...shift!, _id: undefined, _creationTime: undefined, title: "Home visit with Celeste Hyppolite", location: "412 Placeholder Rd, Apt 7", preparation: "Call Celeste at (100) 555-0142 or celeste.hyppolite@neighborly.example first.", start: shift!.start + DAY, end: shift!.end + DAY } as never);
    });
    const text = unfolded(await (await t.fetch(path(await as(ids.marisol).action(api.calendar.createAddress, { churchId: ids.church })))).text());
    for (const secret of ["Celeste", "Hyppolite", "412 Placeholder", "0142", "neighborly.example"]) expect(readable(text)).not.toContain(secret);
    expect(text).toContain("SUMMARY:Home visit with [name]");
    expect(text).toContain("LOCATION:[address]");
    expect(text).toContain("Call [name] at [phone] or [email] first.");
    // What names no neighbor is left as typed.
    expect(text).toContain("SUMMARY:Help line morning");
    expect(text).toContain("LOCATION:Parish office");
  });

  test("the week on paper names no neighbor", async () => {
    const { t, ids, as } = await setup();
    const id = await t.run(async (ctx) => {
      const shift = (await ctx.db.query("commitments").withIndex("by_assignee_end", (q) => q.eq("assigneeId", ids.marisol.memberId)).collect()).find((one) => !one.cancelled)!;
      return ctx.db.insert("commitments", { ...shift, _id: undefined, _creationTime: undefined, title: "Ride for Celeste Hyppolite", location: "412 Placeholder Rd, Apt 7" } as never);
    });
    const [row] = await as(ids.marisol).query(api.calendar.printedWeek, { churchId: ids.church, ids: [id] });
    expect(row).toEqual({ id, title: "Ride for [name] [name]", location: "[address]" });
  });

  test("one address opens one member's calendar: a visitor on no visit sees no street at all", async () => {
    const { t, ids, as } = await setup();
    const none = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      return { userId, memberId: await ctx.db.insert("memberships", { churchId: ids.church, userId, name: "Daniel", email: "daniel@neighborly.example", role: "coordinator", active: true, approved: true, coverOptIn: false }) };
    });
    const text = unfolded(await (await t.fetch(path(await as(none).action(api.calendar.createAddress, { churchId: ids.church })))).text());
    expect(text).not.toContain("BEGIN:VEVENT");
    expect(text).not.toContain("LOCATION");
    // Renee is on two planned visits and no shift: she gets exactly those two, and still only the street.
    const hers = unfolded(await (await t.fetch(path(await as(ids.renee).action(api.calendar.createAddress, { churchId: ids.church })))).text());
    expect(hers.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(hers.match(/LOCATION:Placeholder Rd\r\n/g)).toHaveLength(2);
    expect(hers).not.toContain("Help line morning");
    expect(hers).not.toContain("Celeste");
  });

  test("a wrong address gets nothing", async () => {
    const { t, ids, as } = await setup();
    const address = await as(ids.marisol).action(api.calendar.createAddress, { churchId: ids.church });
    const token = address.match(/[0-9a-f]{64}/)![0];
    const flipped = token.replace(/.$/, (last) => (last === "0" ? "1" : "0"));
    for (const wrong of [`/calendar/${flipped}.ics`, `/calendar/${token}`, `/calendar/${token.toUpperCase()}.ics`, `/calendar/${token.slice(0, 32)}.ics`, "/calendar/.ics", `/calendar/${token}.ics/extra`]) {
      const response = await t.fetch(wrong);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
    }
  });

  test("a new address switches the old one off, and a member who has left loses theirs", async () => {
    const { t, ids, as } = await setup();
    const first = await as(ids.marisol).action(api.calendar.createAddress, { churchId: ids.church });
    const second = await as(ids.marisol).action(api.calendar.createAddress, { churchId: ids.church });
    expect(second).not.toBe(first);
    expect((await t.fetch(path(first))).status).toBe(404);
    expect((await t.fetch(path(second))).status).toBe(200);
    await t.run((ctx) => ctx.db.patch("memberships", ids.marisol.memberId, { active: false }));
    expect((await t.fetch(path(second))).status).toBe(404);
  });

  test("only a signed-in member of the group can make or read an address", async () => {
    const { t, ids, as } = await setup();
    await expect(t.action(api.calendar.createAddress, { churchId: ids.church })).rejects.toThrow("Sign in required.");
    await expect(t.query(api.calendar.address, { churchId: ids.church })).rejects.toThrow("Sign in required.");
    expect(await as(ids.thomas).query(api.calendar.address, { churchId: ids.church })).toBeNull();
    await as(ids.marisol).action(api.calendar.createAddress, { churchId: ids.church });
    expect(await as(ids.thomas).query(api.calendar.address, { churchId: ids.church })).toBeNull();
  });
});
