import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { mayOpenNeighborRecords } from "./access";
import { businessDaysBetween, moveTo, route } from "./intake";
import { deliveryConfiguration, resend } from "./notifications";
import { isSampleChurch } from "./demo";
import { emailLanguage, paperEmail } from "../src/lib/email/paper-email";

/**
 * The web form's daily care, once a day (crons.ts): a team silent for 30 days is paused and its open requests passed on;
 * late requests remind the coordinators every day and the owners too from three business days; closed requests are
 * erased after a year. Nothing closes on its own. Notices carry counts and a link, never a person's words or contact.
 */
const DAY = 86_400_000;
const SILENT_DAYS = 30;
const KEEP_DAYS = 365;

type Notice = "intake_late" | "intake_late_owner" | "intake_paused";
async function tell(ctx: MutationCtx, church: Doc<"churches">, who: Doc<"memberships">[], kind: Notice, day: string) {
  const config = deliveryConfiguration();
  if (await isSampleChurch(ctx, church._id)) return;
  for (const member of who) {
    const eventKey = `${kind}:${member._id}:${day}`;
    const prior = await ctx.db.query("outbox").withIndex("by_church_event", (q) => q.eq("churchId", church._id).eq("eventKey", eventKey)).unique();
    if (prior) continue;
    const outboxId = await ctx.db.insert("outbox", { churchId: church._id, memberId: member._id, eventKey, kind: "intake_notice", recipient: member.email, state: "awaiting_configuration", createdAt: Date.now() });
    if (!config) continue;
    const email = paperEmail({ kind, language: emailLanguage(member.language), set: church.wordSet ?? "general", place: church.name, link: new URL("/app/help-line", config.site).toString() });
    const providerId = await resend.sendEmail(ctx, { from: config.sender, to: member.email, ...email, idempotencyKey: `intake:${eventKey}` });
    await ctx.db.patch("outbox", outboxId, { state: "queued", providerId });
  }
}
async function deciders(ctx: MutationCtx, churchId: Id<"churches">) {
  const members = await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).take(500);
  return members.filter((member) => !member.removedAt && mayOpenNeighborRecords(member));
}

/** Requests still waiting with a team: held, or received with their call not yet returned. */
async function open(ctx: MutationCtx, churchId: Id<"churches">) {
  const rows = [
    ...(await ctx.db.query("webRequests").withIndex("by_church_stage", (q) => q.eq("churchId", churchId).eq("stage", "held")).take(200)),
    ...(await ctx.db.query("webRequests").withIndex("by_church_stage", (q) => q.eq("churchId", churchId).eq("stage", "received")).take(500)),
  ];
  const waiting = [];
  for (const row of rows) {
    const call = row.callId ? await ctx.db.get("calls", row.callId) : null;
    if (row.stage === "held" || call?.callback === "needed") waiting.push(row);
  }
  return waiting;
}

export const daily = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const churches = await ctx.db.query("churches").withIndex("by_intake_enabled", (q) => q.eq("intake.enabled", true)).take(2000);
    for (const church of churches) {
      const intake = church.intake;
      if (!intake || church.sample) continue;
      const people = await deciders(ctx, church._id);
      // Silent for 30 days: paused, its open requests passed to the next team that serves them, the owners told.
      if ((intake.seenAt ?? 0) < now - SILENT_DAYS * DAY) {
        await ctx.db.patch("churches", church._id, { intake: { ...intake, enabled: false, pausedBy: "auto" } });
        for (const request of await open(ctx, church._id)) {
          const next = await route(ctx, request.zip, undefined, church._id);
          const to = next.kind === "team" ? await ctx.db.get("churches", next.churchId) : null;
          if (to) await moveTo(ctx, request, to, "The team that had it paused its web form.", now, false);
        }
        await tell(ctx, church, people.filter((member) => member.role === "owner"), "intake_paused", day);
        continue;
      }
      // Late: past the first-contact day with the call not returned. Coordinators every day; owners too from three business days.
      const late = (await open(ctx, church._id)).filter((row) => row.stage === "received" && row.firstContactBy !== undefined && now >= row.firstContactBy);
      if (!late.length) continue;
      const worst = Math.max(...late.map((row) => businessDaysBetween(row.confirmedAt ?? row.createdAt, now, church.timeZone, intake.holidays)));
      await tell(ctx, church, people.filter((member) => member.role === "coordinator"), "intake_late", day);
      if (worst >= 3) await tell(ctx, church, people.filter((member) => member.role === "owner"), "intake_late_owner", day);
    }
    await erase(ctx, now);
    return null;
  },
});

/** A year after closing, the person's words and contact go; the row stays for the year's counts. */
async function erase(ctx: MutationCtx, now: number) {
  const closed = await ctx.db.query("webRequests").withIndex("by_stage_created", (q) => q.eq("stage", "closed").lt("createdAt", now - KEEP_DAYS * DAY)).take(500);
  for (const row of closed) {
    if (row.erased || (row.closedAt ?? row.createdAt) > now - KEEP_DAYS * DAY) continue;
    await ctx.db.patch("webRequests", row._id, { need: "", phone: "", email: "", callAt: undefined, meet: undefined, referredBy: undefined, statusKeyHash: "", erased: true });
    const call = row.callId ? await ctx.db.get("calls", row.callId) : null;
    // A call kept with no name and no phone is the help line's own "kept for the count" row.
    if (call?.fromWeb && call.callback !== "needed" && !call.neighborId) await ctx.db.patch("calls", call._id, { callerName: "", phone: "", note: "", outcome: undefined });
  }
}

/**
 * The admin review queue: contacts that two or more teams marked "not genuine". Read and settled from the Convex
 * dashboard (`bunx convex run intakeCare:reviews`), never shown to teams. Only a hash and a count: no person's details.
 */
export const reviews = internalQuery({
  args: {},
  returns: v.array(v.object({ id: v.id("webReviews"), teams: v.number(), at: v.number() })),
  handler: async (ctx) => (await ctx.db.query("webReviews").withIndex("by_settled", (q) => q.eq("settled", undefined)).take(100)).map((row) => ({ id: row._id, teams: row.teams, at: row.at })),
});
/** Settles one: `block` blocks the contact for every team that takes web requests (90 days); otherwise the marks stay per team. */
export const settle = internalMutation({
  args: { id: v.id("webReviews"), block: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { id, block }) => {
    const review = await ctx.db.get("webReviews", id);
    if (!review) return null;
    if (block) {
      const flags = await ctx.db.query("webFlags").withIndex("by_contact", (q) => q.eq("contactHash", review.contactHash)).take(50);
      const owners = await Promise.all(flags.map(async (flag) => (await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", flag.churchId)).take(50)).find((member) => member.role === "owner")));
      const by = owners.find(Boolean)?._id;
      const churches = await ctx.db.query("churches").withIndex("by_intake_enabled", (q) => q.eq("intake.enabled", true)).take(2000);
      if (by) for (const church of churches) await ctx.db.insert("webBlocks", { churchId: church._id, hash: review.contactHash, by, at: Date.now() });
    }
    await ctx.db.patch("webReviews", id, { settled: true });
    return null;
  },
});
