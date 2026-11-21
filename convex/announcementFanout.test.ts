/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import resendTest from "@convex-dev/resend/test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import type { EmailId } from "@convex-dev/resend";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
// The Resend client reads its key once, when the module first loads; delivery itself stays off until a test turns it on.
process.env.RESEND_API_KEY = "re_test_key";

/** A made-up group: an owner, a Spanish speaker, and people who should never get the email. */
async function setup(extra = 0) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const church = await ctx.db.insert("churches", { name: "Sample Pantry", timeZone: "UTC" });
    const add = async (name: string, over: { active?: boolean; approved?: boolean; removedAt?: number; language?: "en" | "es" } = {}) => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: church, userId, name, email: `${name}@example.org`, role: name === "owner" ? "owner" : "member", active: over.active ?? true, approved: over.approved ?? true, coverOptIn: false, language: over.language, removedAt: over.removedAt });
      return { userId, memberId };
    };
    const owner = await add("owner");
    const spanish = await add("ana", { language: "es" });
    const inactive = await add("inactive", { active: false });
    const unapproved = await add("unapproved", { approved: false });
    const removed = await add("removed", { removedAt: 1 });
    for (let i = 0; i < extra; i++) await add(`member${i}`);
    return { church, owner, spanish, inactive, unapproved, removed };
  });
  return { t, ids, as: (id: string) => signedIn(t, id, true, `${id}@example.org`) };
}
const outbox = (t: Awaited<ReturnType<typeof setup>>["t"], churchId: Awaited<ReturnType<typeof setup>>["ids"]["church"]) =>
  t.run(ctx => ctx.db.query("outbox").withIndex("by_church", q => q.eq("churchId", churchId)).collect());

describe("emailing an announcement", () => {
  test("posting without the choice sends nothing", async () => {
    const { t, ids, as } = await setup();
    await as(ids.owner.userId).mutation(api.workspace.execute, { churchId: ids.church, command: { type: "createAnnouncement", title: "Food drive", body: "Saturday at nine." } });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(await outbox(t, ids.church)).toHaveLength(0);
  });

  test("the choice reaches active, approved members once, across pages, waiting for configuration", async () => {
    vi.useFakeTimers();
    try {
      const { t, ids, as } = await setup(45);
      vi.advanceTimersByTime(1000);
      await as(ids.owner.userId).mutation(api.workspace.execute, { churchId: ids.church, command: { type: "createAnnouncement", title: "Food drive", body: "Saturday at nine.", emailEveryone: true } });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const rows = await outbox(t, ids.church);
      expect(rows).toHaveLength(47);
      expect(rows.every(r => r.kind === "announcement" && r.state === "awaiting_configuration")).toBe(true);
      const recipients = new Set(rows.map(r => r.memberId));
      for (const left of [ids.inactive, ids.unapproved, ids.removed]) expect(recipients.has(left.memberId)).toBe(false);
      // Running the fan-out again adds nothing: each member's event key is used once.
      const announcementId = rows[0].announcementId!;
      await t.mutation(internal.announcementFanout.process, { announcementId, cursor: null });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await outbox(t, ids.church)).toHaveLength(47);
    } finally { vi.useRealTimers(); }
  });

  test("with delivery on, each member gets the words in their own language", async () => {
    vi.useFakeTimers();
    vi.stubEnv("EMAIL_DELIVERY_ENABLED", "true");
    vi.stubEnv("SENDER_EMAIL", "Kind Helps <test@example.org>");
    vi.stubEnv("SITE_URL", "https://example.org");
    try {
      const { t, ids, as } = await setup();
      resendTest.register(t);
      vi.advanceTimersByTime(1000);
      await as(ids.owner.userId).mutation(api.workspace.execute, { churchId: ids.church, command: { type: "createAnnouncement", title: "Food drive", body: "Saturday at nine.", emailEveryone: true } });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const rows = await outbox(t, ids.church);
      expect(rows).toHaveLength(2);
      expect(rows.every(r => r.state === "queued" && r.providerId)).toBe(true);
      const { resend } = await import("./notifications");
      const sent = await t.run(ctx => Promise.all(rows.map(r => resend.get(ctx, r.providerId as EmailId))));
      const ana = sent.find(o => o?.to.includes("ana@example.org"));
      const owner = sent.find(o => o?.to.includes("owner@example.org"));
      expect(ana?.subject).toBe("Aviso de Sample Pantry: Food drive");
      expect(ana?.text).toContain("Saturday at nine.");
      expect(owner?.subject).toBe("Announcement from Sample Pantry: Food drive");
    } finally { vi.unstubAllEnvs(); vi.useRealTimers(); }
  });
});
