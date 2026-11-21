/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { allowedType } from "./files";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const refused = "Neighbor records are open to coordinators and owners only.";

/** A made-up conference with an owner, a coordinator, a member and one neighbor, and a second conference. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "Sample Conference", timeZone: "America/New_York" });
    const other = await ctx.db.insert("churches", { name: "Example Conference", timeZone: "UTC" });
    const join = async (group: typeof church, name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: group, userId, name, email: `${name.split(" ")[0].toLowerCase()}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await join(church, "Marisol Vega", "owner");
    const coordinator = await join(church, "Thomas Okafor", "coordinator");
    const member = await join(church, "Renee Baptiste", "member");
    const stranger = await join(other, "Victor Salgado", "owner");
    const neighbor = await ctx.db.insert("neighbors", { churchId: church, name: "Esperanza Montoya", nameKey: "esperanza montoya", phone: "(100) 555-0104", phoneKey: "1005550104", email: "", address: "14 Sample St", adults: 1, children: 0, language: "es", notes: "", createdBy: owner.memberId, createdAt: 0 });
    return { church, other, owner, coordinator, member, stranger, neighbor };
  });
  return { t, ids, as: (person: { userId: string }) => signedIn(t, person.userId, true) };
}

type Setup = Awaited<ReturnType<typeof setup>>;
/** Stands in for the browser's upload: the bytes go straight into storage. */
const stored = (t: Setup["t"], body: string | Uint8Array<ArrayBuffer>, type: string) => t.run((ctx) => ctx.storage.store(new Blob([body], { type })));
const blobs = (t: Setup["t"]) => t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length);

describe("uploaded files", () => {
  test("a coordinator keeps, lists and removes a conference file; the bytes go with it", async () => {
    const { t, ids, as } = await setup();
    const coordinator = as(ids.coordinator);
    expect(typeof (await coordinator.mutation(api.files.uploadUrl, { churchId: ids.church }))).toBe("string");
    const storageId = await stored(t, "%PDF-1.4 sample minutes", "application/pdf");
    const id = await coordinator.action(api.files.save, { churchId: ids.church, storageId, name: " November minutes.pdf " });
    const listed = await coordinator.query(api.files.conference, { churchId: ids.church });
    expect(listed).toMatchObject([{ id, name: "November minutes.pdf", contentType: "application/pdf", uploadedBy: "Thomas Okafor" }]);
    expect(listed[0].url).toEqual(expect.any(String));
    await coordinator.mutation(api.files.remove, { churchId: ids.church, id });
    expect(await coordinator.query(api.files.conference, { churchId: ids.church })).toEqual([]);
    expect(await blobs(t)).toBe(0);
    const audit = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(audit.some((line) => line.action === "file.removed" && line.targetId === id)).toBe(true);
  });

  test("a member and another conference are refused everywhere", async () => {
    const { t, ids, as } = await setup();
    const storageId = await stored(t, "form", "application/pdf");
    const id = await as(ids.owner).action(api.files.save, { churchId: ids.church, storageId, name: "Form.pdf" });
    const member = as(ids.member);
    await expect(member.mutation(api.files.uploadUrl, { churchId: ids.church })).rejects.toThrow(refused);
    await expect(member.query(api.files.conference, { churchId: ids.church })).rejects.toThrow(refused);
    await expect(member.mutation(api.files.remove, { churchId: ids.church, id })).rejects.toThrow(refused);
    const stranger = as(ids.stranger);
    await expect(stranger.mutation(api.files.remove, { churchId: ids.other, id })).rejects.toThrow("Record not found.");
    await expect(stranger.mutation(api.files.uploadUrl, { churchId: ids.other, neighborId: ids.neighbor })).rejects.toThrow("Record not found.");
  });

  test("too large or the wrong kind is refused", async () => {
    const { t, ids, as } = await setup();
    const owner = as(ids.owner);
    const big = await stored(t, new Uint8Array(10 * 1024 * 1024 + 1), "application/pdf");
    await expect(owner.action(api.files.save, { churchId: ids.church, storageId: big, name: "Big.pdf" })).rejects.toThrow("Enter a valid value.");
    const script = await stored(t, "<script>", "text/html");
    await expect(owner.action(api.files.save, { churchId: ids.church, storageId: script, name: "page.html" })).rejects.toThrow("Enter a valid value.");
    expect(await owner.query(api.files.conference, { churchId: ids.church })).toEqual([]);
    // A refused file's bytes are gone, not left behind in storage.
    expect(await blobs(t)).toBe(0);
  });

  test("a neighbor's files need the record opened, and go when the record is removed", async () => {
    const { t, ids, as } = await setup();
    const owner = as(ids.owner);
    const args = { churchId: ids.church, neighborId: ids.neighbor };
    const storageId = await stored(t, "lease", "image/jpeg");
    const id = await owner.action(api.files.save, { ...args, storageId, name: "Lease.jpg" });
    expect(await owner.query(api.files.conference, { churchId: ids.church })).toEqual([]);
    const opening = await owner.mutation(api.neighbors.open, args);
    expect(await owner.query(api.files.neighbor, { ...args, opening })).toMatchObject([{ id, name: "Lease.jpg" }]);
    const coordinatorOpening: Id<"auditEvents"> = await as(ids.coordinator).mutation(api.neighbors.open, args);
    await expect(owner.query(api.files.neighbor, { ...args, opening: coordinatorOpening })).rejects.toThrow("Open the record again.");
    await owner.mutation(api.neighbors.remove, { ...args, typedName: "Esperanza Montoya" });
    expect(await t.run((ctx) => ctx.db.query("files").collect())).toEqual([]);
    expect(await blobs(t)).toBe(0);
  });

  test("the kind is read from the name only when the browser said nothing", () => {
    expect(allowedType("", "photo.HEIC")).toBe("image/heic");
    expect(allowedType("application/octet-stream", "sheet.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(allowedType("text/html", "sneaky.pdf")).toBeNull();
    expect(allowedType("", "notes.txt")).toBeNull();
  });
});

describe("reading a kept file", () => {
  afterEach(() => vi.useRealTimers());
  const read = (who: { fetch: (path: string, init?: RequestInit) => Promise<Response> }, url: string) => who.fetch(new URL(url, "https://sample.convex.site").pathname + new URL(url, "https://sample.convex.site").search, { method: "GET" });

  test("the address is the checked route, never a lasting storage link, and it streams only with access", async () => {
    const { t, ids, as } = await setup();
    const storageId = await stored(t, "%PDF-1.4 minutes", "application/pdf");
    const id = await as(ids.owner).action(api.files.save, { churchId: ids.church, storageId, name: "Minutes.pdf" });
    const [row] = await as(ids.coordinator).query(api.files.conference, { churchId: ids.church });
    expect(row.url).toMatch(new RegExp(`/files/${id}$`));
    const opened = await read(as(ids.coordinator), row.url);
    expect(opened.status).toBe(200);
    expect(opened.headers.get("Content-Type")).toBe("application/pdf");
    expect(opened.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await opened.text()).toBe("%PDF-1.4 minutes");
    // The same link, copied: nobody signed in, a member, and another conference's owner all get nothing.
    expect((await read(t, row.url)).status).toBe(404);
    expect((await read(as(ids.member), row.url)).status).toBe(404);
    expect((await read(as(ids.stranger), row.url)).status).toBe(404);
    expect((await read(as(ids.owner), "/files/not-an-id")).status).toBe(404);
  });

  test("a neighbor's file needs the reader's own opening line", async () => {
    const { t, ids, as } = await setup();
    const args = { churchId: ids.church, neighborId: ids.neighbor };
    const storageId = await stored(t, "lease", "image/jpeg");
    const id = await as(ids.owner).action(api.files.save, { ...args, storageId, name: "Lease.jpg" });
    const opening = await as(ids.owner).mutation(api.neighbors.open, args);
    const [row] = await as(ids.owner).query(api.files.neighbor, { ...args, opening });
    expect(row.url).toMatch(new RegExp(`/files/${id}\\?opening=${opening}$`));
    expect((await read(as(ids.owner), row.url)).status).toBe(200);
    expect((await read(as(ids.owner), `/files/${id}`)).status).toBe(404);
    // A coordinator may open the record, but not with the owner's line.
    expect((await read(as(ids.coordinator), row.url)).status).toBe(404);
  });

  test("bytes no row names are swept after a day; kept files and fresh uploads stay", async () => {
    vi.useFakeTimers();
    const { t, ids, as } = await setup();
    const kept = await stored(t, "kept", "application/pdf");
    await as(ids.owner).action(api.files.save, { churchId: ids.church, storageId: kept, name: "Kept.pdf" });
    await stored(t, "abandoned", "application/pdf");
    expect(await t.mutation(internal.files.sweep, {})).toBe(0);
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    await stored(t, "fresh", "application/pdf");
    expect(await t.mutation(internal.files.sweep, {})).toBe(1);
    expect(await blobs(t)).toBe(2);
    expect(await as(ids.owner).query(api.files.conference, { churchId: ids.church })).toHaveLength(1);
  });
});
