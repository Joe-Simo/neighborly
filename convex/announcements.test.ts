/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const church = await ctx.db.insert("churches", { name: "Sample Pantry", timeZone: "UTC" });
    const other = await ctx.db.insert("churches", { name: "Other Pantry", timeZone: "UTC" });
    const add = async (churchId: typeof church, name: string, role: "owner" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId, userId, name, email: `${name}@example.org`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await add(church, "owner", "owner");
    const member = await add(church, "member", "member");
    const outsider = await add(other, "outsider", "owner");
    const announcement = await ctx.db.insert("announcements", { churchId: church, title: "Food drive", body: "Saturday at nine.", authorId: owner.memberId, createdAt: 1 });
    const invitation = await ctx.db.insert("invitations", { churchId: church, email: "late@example.org", role: "member", tokenHash: "x", expiresAt: 5, status: "pending", createdBy: owner.memberId, createdAt: 1, requestId: "r1" });
    return { church, other, owner, member, outsider, announcement, invitation };
  });
  return { t, ids, as: (id: string) => signedIn(t, id, true, `${id}@example.org`) };
}

describe("changing an announcement", () => {
  test("the owner edits it; the page shows the new words and marks it changeable", async () => {
    const { ids, as } = await setup();
    const owner = as(ids.owner.userId);
    await owner.mutation(api.announcements.edit, { churchId: ids.church, id: ids.announcement, title: " Food drive moved ", body: "Sunday at ten." });
    const page = await owner.query(api.pages.announcementsPage, { churchId: ids.church, paginationOpts: { numItems: 10, cursor: null } });
    expect(page.page).toEqual([expect.objectContaining({ title: "Food drive moved", body: "Sunday at ten.", canChange: true })]);
    const member = await as(ids.member.userId).query(api.workspace.dashboard, { churchId: ids.church });
    expect(member.announcements[0].canChange).toBe(false);
  });

  test("a member who did not write it, and another group's owner, are refused", async () => {
    const { ids, as } = await setup();
    await expect(as(ids.member.userId).mutation(api.announcements.edit, { churchId: ids.church, id: ids.announcement, title: "x", body: "y" })).rejects.toThrow("Owner access required.");
    await expect(as(ids.member.userId).mutation(api.announcements.remove, { churchId: ids.church, id: ids.announcement })).rejects.toThrow("Owner access required.");
    await expect(as(ids.outsider.userId).mutation(api.announcements.remove, { churchId: ids.other, id: ids.announcement })).rejects.toThrow("Announcement not found.");
    await expect(as(ids.outsider.userId).mutation(api.announcements.remove, { churchId: ids.church, id: ids.announcement })).rejects.toThrow("Workspace access required.");
  });

  test("an edit needs a title and a message, like posting", async () => {
    const { ids, as } = await setup();
    await expect(as(ids.owner.userId).mutation(api.announcements.edit, { churchId: ids.church, id: ids.announcement, title: " ", body: "y" })).rejects.toThrow("Enter a valid value.");
    await expect(as(ids.owner.userId).mutation(api.announcements.edit, { churchId: ids.church, id: ids.announcement, title: "x", body: "y".repeat(5001) })).rejects.toThrow("Enter a valid value.");
  });

  test("removing takes it off the page and Undo puts it back", async () => {
    const { ids, as } = await setup();
    const owner = as(ids.owner.userId);
    await owner.mutation(api.announcements.remove, { churchId: ids.church, id: ids.announcement });
    expect((await owner.query(api.workspace.dashboard, { churchId: ids.church })).announcements).toHaveLength(0);
    expect((await owner.query(api.pages.announcementsPage, { churchId: ids.church, paginationOpts: { numItems: 10, cursor: null } })).page).toHaveLength(0);
    await expect(owner.mutation(api.announcements.edit, { churchId: ids.church, id: ids.announcement, title: "x", body: "y" })).rejects.toThrow("Announcement not found.");
    await owner.mutation(api.announcements.restore, { churchId: ids.church, id: ids.announcement });
    expect((await owner.query(api.workspace.dashboard, { churchId: ids.church })).announcements).toEqual([expect.objectContaining({ title: "Food drive" })]);
  });
});

describe("removed announcements", () => {
  test("a page is filled with announcements still up, not cut short by removed ones", async () => {
    const { t, ids, as } = await setup();
    const owner = as(ids.owner.userId);
    await t.run(async ctx => {
      for (let n = 0; n < 3; n++) await ctx.db.insert("announcements", { churchId: ids.church, title: `Removed ${n}`, body: "Gone.", authorId: ids.owner.memberId, createdAt: 10 + n, removedAt: 20 });
    });
    const first = await owner.query(api.pages.announcementsPage, { churchId: ids.church, paginationOpts: { numItems: 1, cursor: null } });
    expect(first.page.map(a => a.title)).toEqual(["Food drive"]);
  });

  test("an email fan-out stops once the announcement is removed", async () => {
    const { t, ids, as } = await setup();
    await t.run(ctx => ctx.db.patch("announcements", ids.announcement, { createdAt: Date.now() + 60_000 }));
    await as(ids.owner.userId).mutation(api.announcements.remove, { churchId: ids.church, id: ids.announcement });
    await t.mutation(internal.announcementFanout.process, { announcementId: ids.announcement, cursor: null });
    expect(await t.run(ctx => ctx.db.query("outbox").collect())).toHaveLength(0);
  });

  test("an email queued before the removal is not sent after it", async () => {
    const { t, ids, as } = await setup();
    await t.run(ctx => ctx.db.patch("announcements", ids.announcement, { createdAt: Date.now() + 60_000 }));
    await t.mutation(internal.announcementFanout.process, { announcementId: ids.announcement, cursor: null });
    await as(ids.owner.userId).mutation(api.announcements.remove, { churchId: ids.church, id: ids.announcement });
    for (const [key, value] of Object.entries({ EMAIL_DELIVERY_ENABLED: "true", RESEND_API_KEY: "re_test_key", SENDER_EMAIL: "Kind Helps <test@example.org>", SITE_URL: "https://example.org" })) vi.stubEnv(key, value);
    await as(ids.owner.userId).mutation(api.notificationEvents.queuePending, { churchId: ids.church });
    vi.unstubAllEnvs();
    const rows = await t.run(ctx => ctx.db.query("outbox").collect());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => row.state === "cancelled")).toBe(true);
  });
});

describe("invitations", () => {
  test("the list carries each link's expiry so a lapsed one can say so", async () => {
    const { ids, as } = await setup();
    const owner = as(ids.owner.userId);
    const page = await owner.query(api.pages.invitationsPage, { churchId: ids.church, paginationOpts: { numItems: 10, cursor: null } });
    expect(page.page[0]).toEqual(expect.objectContaining({ status: "pending", expiresAt: 5 }));
    expect((await owner.query(api.workspace.dashboard, { churchId: ids.church })).invitations[0].expiresAt).toBe(5);
  });
});
