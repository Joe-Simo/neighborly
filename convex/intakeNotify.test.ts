/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import resendTest from "@convex-dev/resend/test";
import type { EmailId } from "@convex-dev/resend";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
// The Resend client reads its key when its module first loads, so nothing here imports it statically.
process.env.RESEND_API_KEY = "re_test_key";
const BATCH_MS = 15 * 60 * 1000;

/** A made-up team: an owner, a Spanish-speaking coordinator, one who turned the email off, and a plain member. */
async function setup() {
  const t = convexTest(schema, modules);
  resendTest.register(t);
  await t.mutation(internal.intake.seedZips, { rows: [{ zip: "48201", lat: 42.347, lng: -83.06 }] });
  const ids = await t.run(async (ctx) => {
    const churchId = await ctx.db.insert("churches", { name: "St. Example", timeZone: "America/Detroit" });
    const add = async (name: string, role: "owner" | "coordinator" | "member", language?: "en" | "es") => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("memberships", { churchId, userId, name, email: `${name}@example.org`, role, active: true, approved: true, coverOptIn: false, language });
      return userId;
    };
    return { churchId, owner: await add("owner", "owner"), ana: await add("ana", "coordinator", "es"), quiet: await add("quiet", "coordinator"), member: await add("member", "member") };
  });
  const as = (userId: Id<"users">) => signedIn(t, userId);
  await as(ids.owner).mutation(api.intake.saveSettings, { churchId: ids.churchId, enabled: true, address: "1 Example St, Detroit, MI 48201", miles: 10 });
  await as(ids.quiet).mutation(api.intakeNotify.setNewRequestEmail, { churchId: ids.churchId, on: false });
  return { t, ids, as };
}

let serial = 0;
/** A phone-only request: it lands on the Help line at once (the unverified door). Each from its own device and network. */
const lands = (t: Awaited<ReturnType<typeof setup>>["t"], need = "Behind on rent, Maria Lopez, 12 Elm St") => {
  serial++;
  return t.mutation(internal.intake.receive, {
    kinds: ["rent"], safe: false, urgent: false, need, email: "", phone: `313555${String(1000 + serial)}`, zip: "48201", language: "en",
    ipHash: `ip${serial}`, deviceHash: `d${serial}`, contactHash: `c${serial}`, statusKeyHash: `k${serial}`, codeHash: `x${serial}`, code: "123456", statusLink: "https://example.org/help/status#x",
  });
};
const outbox = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.run((ctx) => ctx.db.query("outbox").collect()).then((rows) => rows.filter((row) => row.kind === "intake_new"));

describe("the email about new web requests", () => {
  test("a burst becomes one email per person after 15 minutes, in their language, with a count and no details", async () => {
    vi.useFakeTimers();
    vi.stubEnv("EMAIL_DELIVERY_ENABLED", "true");
    vi.stubEnv("SENDER_EMAIL", "Kind Helps <test@example.org>");
    vi.stubEnv("SITE_URL", "https://example.org");
    try {
      const { t } = await setup();
      // The unverified door takes 3 a day per team; that is enough for a burst.
      for (let i = 0; i < 3; i++) expect(await lands(t)).toMatchObject({ result: "landed" });
      expect(await outbox(t)).toHaveLength(0);
      vi.advanceTimersByTime(BATCH_MS - 1000);
      await t.finishInProgressScheduledFunctions();
      expect(await outbox(t)).toHaveLength(0);
      vi.advanceTimersByTime(2000);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const rows = await outbox(t);
      // Owner and Ana; not the one who turned it off, not the plain member.
      expect(rows.map((row) => row.recipient).sort()).toEqual(["ana@example.org", "owner@example.org"]);
      const { resend } = await import("./notifications");
      const sent = await t.run((ctx) => Promise.all(rows.map((row) => resend.get(ctx, row.providerId as EmailId))));
      const ana = sent.find((one) => one?.to.includes("ana@example.org"));
      const owner = sent.find((one) => one?.to.includes("owner@example.org"));
      expect(owner?.subject).toBe("3 new requests for help at St. Example");
      expect(ana?.subject).toBe("3 nuevas peticiones de ayuda en St. Example");
      expect(owner?.text).toContain("https://example.org/app/help-line");
      for (const one of sent) for (const secret of ["Maria", "Lopez", "Elm", "313555", "rent", "48201"]) expect(`${one?.subject} ${one?.text} ${one?.html}`).not.toContain(secret);
      expect(await t.run((ctx) => ctx.db.query("webNotices").collect())).toEqual([]);
    } finally { vi.unstubAllEnvs(); vi.useRealTimers(); }
  });

  test("the next request after an email starts a new 15-minute wait: never two emails inside 15 minutes", async () => {
    vi.useFakeTimers();
    try {
      const { t } = await setup();
      await lands(t);
      vi.advanceTimersByTime(BATCH_MS + 1000);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await outbox(t)).toHaveLength(2);
      await lands(t);
      await t.finishInProgressScheduledFunctions();
      expect(await outbox(t)).toHaveLength(2);
      vi.advanceTimersByTime(BATCH_MS + 1000);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await outbox(t)).toHaveLength(4);
    } finally { vi.useRealTimers(); }
  });

  test("with EMAIL_DELIVERY_ENABLED off, the outbox records it and nothing is sent", async () => {
    vi.useFakeTimers();
    try {
      const { t } = await setup();
      await lands(t);
      vi.advanceTimersByTime(BATCH_MS + 1000);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const rows = await outbox(t);
      expect(rows.every((row) => row.state === "awaiting_configuration" && !row.providerId)).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  test("each person turns it off and on for themselves, and sees their own choice", async () => {
    const { ids, as } = await setup();
    expect((await as(ids.quiet).query(api.intake.settings, { churchId: ids.churchId }))?.newRequestEmail).toBe(false);
    expect((await as(ids.owner).query(api.intake.settings, { churchId: ids.churchId }))?.newRequestEmail).toBe(true);
    await as(ids.quiet).mutation(api.intakeNotify.setNewRequestEmail, { churchId: ids.churchId, on: true });
    expect((await as(ids.quiet).query(api.intake.settings, { churchId: ids.churchId }))?.newRequestEmail).toBe(true);
    await expect(as(ids.member).mutation(api.intakeNotify.setNewRequestEmail, { churchId: ids.churchId, on: false })).rejects.toThrow();
  });
});
