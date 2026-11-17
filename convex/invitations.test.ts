/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";
import resendTest from "@convex-dev/resend/test";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const ids = await t.run(async ctx => {
    const owner = await ctx.db.insert("users", {});
    const recipient = await ctx.db.insert("users", {});
    const stranger = await ctx.db.insert("users", {});
    const coordinator = await ctx.db.insert("users", {});
    const church = await ctx.db.insert("churches", { name: "Church", timeZone: "UTC" });
    const membership = (userId: typeof owner, role: "owner" | "coordinator", email: string) => ({ churchId: church, userId, role, email, name: role, active: true, approved: true, coverOptIn: false });
    await ctx.db.insert("memberships", membership(owner, "owner", "owner@example.org"));
    await ctx.db.insert("memberships", membership(coordinator, "coordinator", "coordinator@example.org"));
    return { owner, recipient, stranger, coordinator, church };
  });
  emails.set(ids.owner, "owner@example.org");
  emails.set(ids.recipient, "person@example.org");
  emails.set(ids.stranger, "other@example.org");
  emails.set(ids.coordinator, "coordinator@example.org");
  return { t, ids, as: (id: string) => signedIn(t, id, emails.has(id), emails.get(id)) };
}

describe("church invitations", () => {
  test("account email readiness does not enable group notification delivery", async () => {
    vi.stubEnv("EMAIL_DELIVERY_ENABLED", "false");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("SENDER_EMAIL", "Kind Helps <test@example.org>");
    vi.stubEnv("SITE_URL", "https://example.org");
    try {
      const { t, ids, as } = await setup();
      expect(await t.query(api.workspace.emailConfiguration, {})).toBe(true);
      const invitation = await as(ids.owner).action(api.invitations.create, {
        churchId: ids.church, email: "person@example.org", role: "member", requestId: "account_ready_no_outbox",
      });
      expect(invitation.delivery).toBe("not_sent");
      const outbox = await t.run(ctx => ctx.db.query("outbox").withIndex("by_invitation", q => q.eq("invitationId", invitation.invitationId)).unique());
      expect(outbox?.state).toBe("awaiting_configuration");
      expect(outbox?.providerId).toBeUndefined();
      for (const invalid of ["http://example.org", "https://example.org?token=value", "https://example.org#fragment", "https://user:pass@example.org", "not-a-url"]) {
        vi.stubEnv("SITE_URL", invalid);
        expect(await t.query(api.workspace.emailConfiguration, {})).toBe(false);
      }
      vi.stubEnv("SITE_URL", "https://example.org");
      vi.stubEnv("SENDER_EMAIL", "");
      expect(await t.query(api.workspace.emailConfiguration, {})).toBe(false);
      vi.stubEnv("SENDER_EMAIL", "Kind Helps <test@example.org>");
      vi.stubEnv("RESEND_API_KEY", "");
      expect(await t.query(api.workspace.emailConfiguration, {})).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  test("configured delivery queues once without making a network request", async () => {
    vi.useFakeTimers();
    process.env.EMAIL_DELIVERY_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SENDER_EMAIL = "Kind Helps <test@example.org>";
    process.env.SITE_URL = "https://example.org";
    try {
      const { t, ids, as } = await setup();
      resendTest.register(t);
      const args = { churchId: ids.church, email: "person@example.org", role: "member" as const, requestId: "request_delivery_123" };
      const invite = await as(ids.owner).action(api.invitations.create, args);
      expect(invite.delivery).toBe("queued");
      expect((await as(ids.owner).query(api.notifications.invitationDelivery, { invitationId: invite.invitationId })).providerStatus).toBe("waiting");
      expect((await as(ids.owner).action(api.invitations.create, args)).delivery).toBe("queued");
      expect(await as(ids.owner).action(api.invitations.queueEmail, { invitationId: invite.invitationId, token: invite.token! })).toBe("queued");
      await as(ids.owner).mutation(api.invitations.revoke, { invitationId: invite.invitationId });
      expect((await as(ids.owner).query(api.notifications.invitationDelivery, { invitationId: invite.invitationId })).providerStatus).toBe("cancelled");
      const { queueCoverRequest, queueMeetingInvitation, cancelPendingNotification } = await import("./notificationEvents");
      const eventIds = await t.run(async ctx => {
        const memberId = await ctx.db.insert("memberships", { churchId: ids.church, userId: ids.recipient, name: "Person", email: "person@example.org", role: "member", active: true, approved: true, coverOptIn: true });
        const teamId = await ctx.db.insert("teams", { churchId: ids.church, name: "Welcome", description: "" });
        await ctx.db.insert("teamMembers", { churchId: ids.church, teamId, memberId, teamRole: "member", approved: true, status: "active" });
        await ctx.db.insert("availability", { churchId: ids.church, memberId, start: new Date(Date.now()).toISOString().slice(0, 10), end: new Date(Date.now()+86400000).toISOString().slice(0, 10) });
        const commitmentId = await ctx.db.insert("commitments", { churchId: ids.church, teamId, title: "Welcome", start: Date.now()+100000, end: Date.now()+200000, location: "Hall", preparation: "", assigneeId: null, coordinatorId: memberId, version: 1 });
        const requestId = await ctx.db.insert("requests", { churchId: ids.church, commitmentId, recipientId: memberId, commitmentVersion: 1, status: "pending" });
        const meetingId = await ctx.db.insert("meetings", { churchId: ids.church, fanoutStatus: "complete", cutoff: Date.now(), title: "Meeting", start: Date.now()+100000, end: Date.now()+200000, location: "Hall" });
        await ctx.db.insert("meetingInvitees", { churchId: ids.church, meetingId, memberId });
        await queueCoverRequest(ctx, requestId); await queueCoverRequest(ctx, requestId);
        await queueMeetingInvitation(ctx, meetingId, memberId); await queueMeetingInvitation(ctx, meetingId, memberId);
        return { requestId, meetingId };
      });
      const events = await t.run(ctx => ctx.db.query("outbox").withIndex("by_church", q => q.eq("churchId", ids.church)).collect());
      expect(events.filter(e => e.requestId === eventIds.requestId)).toHaveLength(1);
      expect(events.filter(e => e.meetingId === eventIds.meetingId)).toHaveLength(1);
      expect(events.filter(e => e.kind !== "invitation").every(e => e.state === "queued" && e.providerId)).toBe(true);
      await t.run(ctx => cancelPendingNotification(ctx, ids.church, `cover:${eventIds.requestId}`));
      const afterCancel = await as(ids.owner).query(api.notificationEvents.status, { churchId: ids.church });
      expect(afterCancel.find(e => e.kind === "cover_request")).toMatchObject({ state: "cancelled", providerStatus: "cancelled" });
    } finally {
      delete process.env.EMAIL_DELIVERY_ENABLED;
      delete process.env.RESEND_API_KEY;
      delete process.env.SENDER_EMAIL;
      delete process.env.SITE_URL;
      vi.useRealTimers();
    }
  });
  test("only an owner can issue; a verified intended recipient can accept once without a sent email", async () => {
    const { t, ids, as } = await setup();
    const args = { churchId: ids.church, email: " Person@Example.org ", role: "member" as const, requestId: "request_1234567890" };
    await expect(as(ids.coordinator).action(api.invitations.create, args)).rejects.toThrow("owner access");
    const invite = await as(ids.owner).action(api.invitations.create, args);
    expect(invite.delivery).toBe("not_sent");
    expect(invite.token).toMatch(/^[0-9a-f]{64}$/);
    const token = invite.token!;
    const duplicate = await as(ids.owner).action(api.invitations.create, args);
    expect(duplicate).toEqual({ invitationId: invite.invitationId, token: null, delivery: "not_sent" });
    expect(await as(ids.owner).action(api.invitations.queueEmail, { invitationId: invite.invitationId, token })).toBe("not_sent");
    expect(await as(ids.owner).query(api.notifications.invitationDelivery, { invitationId: invite.invitationId })).toEqual({ state: "awaiting_configuration", providerStatus: null, failed: false });
    await expect(as(ids.coordinator).query(api.notifications.invitationDelivery, { invitationId: invite.invitationId })).rejects.toThrow("owner access");
    await expect(as(ids.stranger).action(api.invitations.accept, { token, displayName: "Other" })).rejects.toThrow("invalid or expired");
    expect(await as(ids.recipient).action(api.invitations.accept, { token, displayName: "Person" })).toBe(ids.church);
    expect(await as(ids.recipient).action(api.invitations.accept, { token, displayName: "Person" })).toBe(ids.church);
    const state = await t.run(async ctx => ({ members: await ctx.db.query("memberships").withIndex("by_church_user", q => q.eq("churchId", ids.church).eq("userId", ids.recipient)).collect(), outbox: await ctx.db.query("outbox").withIndex("by_invitation", q => q.eq("invitationId", invite.invitationId)).unique(), invite: await ctx.db.get("invitations", invite.invitationId) }));
    expect(state.members).toHaveLength(1);
    expect(state.members[0]).toMatchObject({ role: "member", approved: false, coverOptIn: false });
    expect(state.outbox?.state).toBe("awaiting_configuration");
    expect(state.invite?.tokenHash).not.toBe(token);
  });
  test("revoked or expired invitations do not grant membership", async () => {
    const { t, ids, as } = await setup();
    const create = (requestId: string) => as(ids.owner).action(api.invitations.create, { churchId: ids.church, email: "person@example.org", role: "member", requestId });
    const revoked = await create("request_revoked_1234");
    await as(ids.owner).mutation(api.invitations.revoke, { invitationId: revoked.invitationId });
    await expect(as(ids.recipient).action(api.invitations.accept, { token: revoked.token!, displayName: "Person" })).rejects.toThrow("invalid or expired");
    const expired = await create("request_expired_1234");
    await t.run(async ctx => { await ctx.db.patch("invitations", expired.invitationId, { expiresAt: Date.now() - 1 }); });
    await expect(as(ids.recipient).action(api.invitations.accept, { token: expired.token!, displayName: "Person" })).rejects.toThrow("invalid or expired");
  });
  test("anyone may ask whether a link is still good, and every bad case is the same no", async () => {
    const { t, ids, as } = await setup();
    const create = (requestId: string) => as(ids.owner).action(api.invitations.create, { churchId: ids.church, email: "person@example.org", role: "member", requestId });
    const good = (token: string) => t.action(api.invitations.good, { token });
    const pending = await create("request_pending_1234");
    expect(await good(pending.token!)).toBe(true);
    expect(await good("0000000000")).toBe(false);
    expect(await good("0".repeat(64))).toBe(false);
    const revoked = await create("request_revoked_1234");
    await as(ids.owner).mutation(api.invitations.revoke, { invitationId: revoked.invitationId });
    expect(await good(revoked.token!)).toBe(false);
    await t.run(async ctx => { await ctx.db.patch("invitations", pending.invitationId, { expiresAt: Date.now() - 1 }); });
    expect(await good(pending.token!)).toBe(false);
    const used = await create("request_used_12345678");
    await as(ids.recipient).action(api.invitations.accept, { token: used.token!, displayName: "Person" });
    expect(await good(used.token!)).toBe(false);
  });
  test("disabled delivery retains notifications and cancels stale events on retry", async () => {
    const { t, ids, as } = await setup();
    const { queueCoverRequest, queueMeetingInvitation } = await import("./notificationEvents");
    const eventIds = await t.run(async ctx => {
      const memberId = await ctx.db.insert("memberships", { churchId: ids.church, userId: ids.recipient, name: "Person", email: "person@example.org", role: "member", active: true, approved: true, coverOptIn: true });
      const teamId = await ctx.db.insert("teams", { churchId: ids.church, name: "Welcome", description: "" });
      await ctx.db.insert("teamMembers", { churchId: ids.church, teamId, memberId, teamRole: "member", approved: true, status: "active" });
        await ctx.db.insert("availability", { churchId: ids.church, memberId, start: new Date(Date.now()).toISOString().slice(0, 10), end: new Date(Date.now()+86400000).toISOString().slice(0, 10) });
        const commitmentId = await ctx.db.insert("commitments", { churchId: ids.church, teamId, title: "Welcome", start: Date.now()+100000, end: Date.now()+200000, location: "Hall", preparation: "", assigneeId: null, coordinatorId: memberId, version: 1 });
      const requestId = await ctx.db.insert("requests", { churchId: ids.church, commitmentId, recipientId: memberId, commitmentVersion: 1, status: "pending" });
      const meetingId = await ctx.db.insert("meetings", { churchId: ids.church, fanoutStatus: "complete", cutoff: Date.now(), title: "Meeting", start: Date.now()+100000, end: Date.now()+200000, location: "Hall" });
      await ctx.db.insert("meetingInvitees", { churchId: ids.church, meetingId, memberId });
      await queueCoverRequest(ctx, requestId); await queueMeetingInvitation(ctx, meetingId, memberId);
      return { requestId, meetingId, memberId };
    });
    const before = await as(ids.owner).query(api.notificationEvents.status, { churchId: ids.church });
    expect(before.map(x => x.state)).toEqual(["awaiting_configuration", "awaiting_configuration"]);
    await t.run(async ctx => {
      await ctx.db.patch("requests", eventIds.requestId, { status: "declined" });
      await ctx.db.insert("meetingResponses", { churchId: ids.church, meetingId: eventIds.meetingId, memberId: eventIds.memberId, response: "accepted" });
    });
    await expect(as(ids.owner).mutation(api.notificationEvents.queuePending, { churchId: ids.church })).rejects.toThrow("not configured");
    process.env.EMAIL_DELIVERY_ENABLED = "true"; process.env.RESEND_API_KEY = "re_test_key"; process.env.SENDER_EMAIL = "test@example.org"; process.env.SITE_URL = "https://example.org";
    try { expect(await as(ids.owner).mutation(api.notificationEvents.queuePending, { churchId: ids.church })).toBe(2); } finally { delete process.env.EMAIL_DELIVERY_ENABLED; delete process.env.RESEND_API_KEY; delete process.env.SENDER_EMAIL; delete process.env.SITE_URL; }
    const after = await as(ids.owner).query(api.notificationEvents.status, { churchId: ids.church });
    expect(after.map(x => x.state)).toEqual(["cancelled", "cancelled"]);
  });
});
