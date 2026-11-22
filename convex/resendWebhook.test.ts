/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import resendTest from "@convex-dev/resend/test";
import type { EmailId } from "@convex-dev/resend";
import { Webhook } from "standardwebhooks";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
// A made-up signing secret in Resend's (svix) whsec_ form; never a real one.
const SECRET = "whsec_" + Buffer.from("neighborly-test-webhook-secret-32b").toString("base64");
const OTHER = "whsec_" + Buffer.from("some-other-secret-not-ours-000000").toString("base64");

/** The Resend client reads the secret when its module first loads, so each test loads it afresh. */
async function setup(secret: string | undefined) {
  vi.resetModules();
  if (secret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = secret;
  const t = convexTest(schema, modules);
  resendTest.register(t);
  const { resend } = await import("./notifications");
  const emailId = await t.run(ctx => resend.sendEmailManually(ctx as never, { from: "a@example.org", to: "b@example.org", subject: "Hello" }, async () => "re_msg_1"));
  return { t, resend, emailId };
}

const event = (type: string) => JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: "re_msg_1", created_at: new Date().toISOString(), from: "a@example.org", to: ["b@example.org"], subject: "Hello", ...(type === "email.bounced" ? { bounce: { message: "Mailbox does not exist", subType: "General", type: "Permanent" } } : {}) } });

function signed(body: string, opts: { secret?: string; id?: string; at?: Date } = {}) {
  const id = opts.id ?? `msg_${Math.random().toString(36).slice(2)}`;
  const at = opts.at ?? new Date();
  const signature = new Webhook(opts.secret ?? SECRET).sign(id, at, body);
  return { "svix-id": id, "svix-timestamp": String(Math.floor(at.getTime() / 1000)), "svix-signature": signature, "content-type": "application/json" };
}

async function post(t: ReturnType<typeof convexTest>, body: string, headers: Record<string, string>) {
  try { return (await t.fetch("/resend-webhook", { method: "POST", body, headers })).status; }
  catch { return "threw"; }
}

const statusOf = async (s: Awaited<ReturnType<typeof setup>>) => (await s.t.run(ctx => s.resend.status(ctx as never, s.emailId as EmailId)))?.status;

describe("Resend webhook", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); delete process.env.RESEND_WEBHOOK_SECRET; });

  test("a correctly signed event is accepted and applied", async () => {
    const s = await setup(SECRET);
    const body = event("email.delivered");
    expect(await post(s.t, body, signed(body))).toBe(201);
    expect(await statusOf(s)).toBe("delivered");
  });

  test("a signature made with another secret is refused and changes nothing", async () => {
    const s = await setup(SECRET);
    const body = event("email.bounced");
    expect(await post(s.t, body, signed(body, { secret: OTHER }))).not.toBe(201);
    expect(await statusOf(s)).toBe("sent");
  });

  test("a body changed after signing is refused", async () => {
    const s = await setup(SECRET);
    const headers = signed(event("email.delivered"));
    expect(await post(s.t, event("email.bounced"), headers)).not.toBe(201);
    expect(await statusOf(s)).toBe("sent");
  });

  test.each(["svix-id", "svix-timestamp", "svix-signature"])("a request missing %s is refused", async header => {
    const s = await setup(SECRET);
    const body = event("email.bounced");
    const headers: Record<string, string> = signed(body);
    delete headers[header];
    expect(await post(s.t, body, headers)).not.toBe(201);
    expect(await statusOf(s)).toBe("sent");
  });

  test("an unsigned request is refused", async () => {
    const s = await setup(SECRET);
    expect(await post(s.t, event("email.bounced"), { "content-type": "application/json" })).not.toBe(201);
    expect(await statusOf(s)).toBe("sent");
  });

  test("an event signed more than five minutes ago, or in the future, is refused", async () => {
    const s = await setup(SECRET);
    const body = event("email.bounced");
    expect(await post(s.t, body, signed(body, { at: new Date(Date.now() - 6 * 60_000) }))).not.toBe(201);
    expect(await post(s.t, body, signed(body, { at: new Date(Date.now() + 6 * 60_000) }))).not.toBe(201);
    expect(await statusOf(s)).toBe("sent");
  });

  test("with no secret configured, even a well-signed event is refused", async () => {
    const s = await setup(undefined);
    const body = event("email.bounced");
    expect(await post(s.t, body, signed(body))).not.toBe(201);
    expect(await statusOf(s)).toBe("sent");
  });

  test("replaying the same signed event does not apply it twice or move state backwards", async () => {
    const s = await setup(SECRET);
    const bounced = event("email.bounced");
    const headers = signed(bounced, { id: "msg_fixed" });
    expect(await post(s.t, bounced, headers)).toBe(201);
    const first = await s.t.run(ctx => s.resend.status(ctx as never, s.emailId as EmailId));
    expect(first).toMatchObject({ status: "bounced", bounced: true });
    expect(await post(s.t, bounced, headers)).toBe(201);
    expect(await s.t.run(ctx => s.resend.status(ctx as never, s.emailId as EmailId))).toEqual(first);
    // A late, stale-but-valid "delivered" after the bounce cannot undo it.
    const delivered = event("email.delivered");
    expect(await post(s.t, delivered, signed(delivered))).toBe(201);
    expect(await statusOf(s)).toBe("bounced");
  });
});
