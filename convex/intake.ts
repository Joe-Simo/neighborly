import { ConvexError, v } from "convex/values";
import { DateTime } from "luxon";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { hour, hourAsked, neighborAccess } from "./access";
import { callbackOwner } from "./assistance";
import { bbox, byDistance, circlePolygon, nearestCovering, validArea, validMiles, validZip, type Team } from "./area";
import { helpKind } from "./schema";
import { deliveryConfiguration, resend } from "./notifications";
import { paperEmail } from "../src/lib/email/paper-email";

/**
 * The public "Ask for help" form, behind convex/intakeHttp.ts (which checks Turnstile and the input, and hashes).
 *
 * receive: routes the zip to the nearest team that covers it, or answers "no_team" and keeps nothing. Otherwise it
 * keeps a pending request and emails a six-digit code. confirm: on the right code the request becomes a call on that
 * team's Help line (createWebCall). Nothing here tells a sender whether their contact is known, limited or blocked:
 * those all answer "sent" and simply send nothing. No model reads anything here.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const LIMITS = { ipPerHour: 10, devicePerHour: 5, contactPerDay: 3, confirmTriesPerIpHour: 20, codeTries: 5, floodPerTeamHour: 20, unverifiedPerTeamDay: 3 } as const;
const JOIN_DAYS = 7;

/** Counts one more in a fixed window; false when that would pass `max`. */
export async function bump(ctx: MutationCtx, key: string, windowMs: number, max: number, now: number) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const row = await ctx.db.query("webLimits").withIndex("by_key", (q) => q.eq("key", key).eq("windowStart", windowStart)).unique();
  if (row && row.count >= max) return false;
  if (row) await ctx.db.patch("webLimits", row._id, { count: row.count + 1 });
  else await ctx.db.insert("webLimits", { key, windowStart, count: 1 });
  return true;
}

async function enabledTeams(ctx: QueryCtx): Promise<Team<Id<"churches">>[]> {
  // One row per team that switched the form on; a few hundred teams read in one go is well inside a query's reads.
  const churches = await ctx.db.query("churches").withIndex("by_intake_enabled", (q) => q.eq("intake.enabled", true)).take(2000);
  return churches.flatMap((church) => (church.intake && !church.sample ? [{ id: church._id, area: church.intake.area, center: church.intake.center, bbox: church.intake.bbox }] : []));
}
export async function centroid(ctx: QueryCtx, zip: string) {
  const row = await ctx.db.query("zipCentroids").withIndex("by_zip", (q) => q.eq("zip", zip)).unique();
  return row ? { lat: row.lat, lng: row.lng } : null;
}
/** Where a zip goes: the nearest team whose area covers it, null when none does, "unknown" when the zip is not on the Census list. */
export async function route(ctx: QueryCtx, zip: string) {
  const point = await centroid(ctx, zip);
  return point ? nearestCovering(await enabledTeams(ctx), point) : ("unknown" as const);
}

/** One business day after `from`, on the team's own calendar: Friday's request is due Monday. */
export function nextBusinessDay(from: number, timeZone: string) {
  let at = DateTime.fromMillis(from, { zone: timeZone }).plus({ days: 1 });
  while (at.weekday > 5) at = at.plus({ days: 1 });
  return at.toMillis();
}

/** A block lasts 90 days unless a member blocks again. */
const BLOCK_DAYS = 90;
const blocked = async (ctx: QueryCtx, churchId: Id<"churches">, hashes: (string | undefined)[]) => {
  const since = Date.now() - BLOCK_DAYS * DAY;
  for (const hash of hashes) {
    if (!hash) continue;
    const rows = await ctx.db.query("webBlocks").withIndex("by_church_hash", (q) => q.eq("churchId", churchId).eq("hash", hash)).take(10);
    if (rows.some((row) => row.at >= since)) return true;
  }
  return false;
};

/** For the form's first step, before anything is kept: whether a team serves this zip. Says nothing about any person. */
export const coverage = query({
  args: { zip: v.string() },
  returns: v.union(v.literal("team"), v.literal("no_team"), v.literal("unknown_zip")),
  handler: async (ctx, { zip }) => {
    if (!validZip(zip)) return "unknown_zip";
    const routed = await route(ctx, zip);
    return routed === "unknown" ? "unknown_zip" : routed ? "team" : "no_team";
  },
});

const answer = v.object({
  result: v.union(v.literal("sent"), v.literal("landed"), v.literal("no_team"), v.literal("unknown_zip"), v.literal("slow")),
  /** For "landed" (unverified, shown at once): the team's name and when first contact is due. */
  team: v.optional(v.string()),
  by: v.optional(v.number()),
  timeZone: v.optional(v.string()),
});
const submission = {
  kinds: v.array(helpKind), need: v.string(), email: v.string(), phone: v.string(), zip: v.string(), language: v.union(v.literal("en"), v.literal("es")),
  safe: v.boolean(), callAt: v.optional(v.string()), meet: v.optional(v.string()), referredBy: v.optional(v.string()), urgent: v.boolean(),
};

/**
 * One submission, after the site's server checked Turnstile and the input. With an email and safe to message: kept
 * pending and a code is emailed ("sent"). Otherwise (phone only, or not safe to message) nothing is ever sent to the
 * person: it lands at once as unverified, at most UNVERIFIED_PER_TEAM_DAY a day per team, the rest held for a coordinator.
 */
export const receive = internalMutation({
  args: { ...submission, ipHash: v.string(), deviceHash: v.string(), contactHash: v.string(), phoneHash: v.optional(v.string()), statusKeyHash: v.string(), codeHash: v.string(), code: v.string(), statusLink: v.string() },
  returns: answer,
  handler: async (ctx, args) => {
    const now = Date.now();
    const unverified = !args.email || !args.safe;
    if (!(await bump(ctx, `ip:${args.ipHash}`, HOUR, LIMITS.ipPerHour, now)) || !(await bump(ctx, `device:${args.deviceHash}`, HOUR, LIMITS.devicePerHour, now))) return { result: "slow" as const };
    // The unverified door is the open one, so it is narrow: one a day per device and per network.
    if (unverified && (!(await bump(ctx, `unv-ip:${args.ipHash}`, DAY, 1, now)) || !(await bump(ctx, `unv-device:${args.deviceHash}`, DAY, 1, now)))) return { result: "slow" as const };
    const churchId = await route(ctx, args.zip);
    if (churchId === "unknown") return { result: "unknown_zip" as const };
    if (!churchId) return { result: "no_team" as const };
    const church = await ctx.db.get("churches", churchId);
    if (!church) return { result: "no_team" as const };
    const quiet = unverified ? { result: "landed" as const, team: church.name, by: nextBusinessDay(now, church.timeZone), timeZone: church.timeZone } : { result: "sent" as const };
    // From here on every answer is the same, so the reply never says whether a contact is known, over its limit or blocked.
    // Codes per destination: three a day per email (and per phone).
    if (!(await bump(ctx, `contact:${args.contactHash}`, DAY, LIMITS.contactPerDay, now))) return quiet;
    if (await blocked(ctx, churchId, [args.contactHash, args.phoneHash, args.ipHash])) return quiet;
    // A second try from the same contact replaces the first one still waiting for its code.
    const earlier = await ctx.db.query("webRequests").withIndex("by_contact", (q) => q.eq("contactHash", args.contactHash).gte("createdAt", now - DAY)).take(20);
    for (const row of earlier) if (row.stage === "pending") await ctx.db.delete("webRequests", row._id);
    const requestId = await ctx.db.insert("webRequests", {
      churchId, kind: args.kinds[0] ?? "other", kinds: args.kinds, need: args.need, phone: args.phone, email: args.email, zip: args.zip, language: args.language, stage: "pending",
      statusKeyHash: args.statusKeyHash, codeHash: unverified ? "" : args.codeHash, codeTries: 0, contactHash: args.contactHash, phoneHash: args.phoneHash, ipHash: args.ipHash,
      referredBy: args.referredBy, safe: args.safe, callAt: args.callAt, meet: args.meet, urgent: args.urgent || undefined, unverified: unverified || undefined, createdAt: now,
    });
    if (unverified) {
      await ctx.db.patch("webRequests", requestId, { confirmedAt: now });
      const request = await ctx.db.get("webRequests", requestId);
      if (!request) return quiet;
      if (await bump(ctx, `unv-team:${churchId}`, DAY, LIMITS.unverifiedPerTeamDay, now)) await land(ctx, request, now);
      else await ctx.db.patch("webRequests", requestId, { stage: "held" });
      return quiet;
    }
    await sendCode(ctx, requestId, churchId, args.email, args.language, args.code, args.statusLink, now);
    return quiet;
  },
});

async function sendCode(ctx: MutationCtx, requestId: Id<"webRequests">, churchId: Id<"churches">, to: string, language: "en" | "es", code: string, statusLink: string, now: number) {
  const outboxId = await ctx.db.insert("outbox", { churchId, webRequestId: requestId, kind: "help_code", recipient: to, state: "awaiting_configuration", createdAt: now });
  const config = deliveryConfiguration();
  if (!config) return;
  // Neutral on purpose: the code and the person's own link, never the need or the team.
  const email = paperEmail({ kind: "help_code", language, set: "general", place: code, link: statusLink });
  const providerId = await resend.sendEmail(ctx, { from: config.sender, to, ...email, idempotencyKey: `help_code:${requestId}:${now}` });
  await ctx.db.patch("outbox", outboxId, { state: "queued", providerId });
}

/** A new code for a request still waiting for one, inside the same per-destination cap. Always answers the same. */
export const resendCode = internalMutation({
  args: { statusKeyHash: v.string(), codeHash: v.string(), code: v.string(), statusLink: v.string(), ipHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (!(await bump(ctx, `ip:${args.ipHash}`, HOUR, LIMITS.ipPerHour, now))) return null;
    const request = await ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", args.statusKeyHash)).unique();
    if (!request || request.stage !== "pending" || !request.email || request.createdAt < now - DAY) return null;
    if (!(await bump(ctx, `contact:${request.contactHash}`, DAY, LIMITS.contactPerDay, now))) return null;
    await ctx.db.patch("webRequests", request._id, { codeHash: args.codeHash, codeTries: 0 });
    await sendCode(ctx, request._id, request.churchId, request.email, request.language, args.code, args.statusLink, now);
    return null;
  },
});

const KIND_NOTE = { rent: "rent", utility: "utility bill", food: "food", voucher: "voucher", other: "other" } as const;
const LANGUAGE_NOTE = { en: "English", es: "Spanish" } as const;
/** The call a confirmed web request becomes on its team's Help line. This is the one place a web request turns into work. */
export async function createWebCall(ctx: MutationCtx, request: Doc<"webRequests">, now: number) {
  const kinds = (request.kinds ?? [request.kind]).map((kind) => KIND_NOTE[kind]).join(", ");
  const contact = [request.phone && `Phone: ${request.phone}`, request.email && `Email: ${request.email}`].filter(Boolean).join(" · ");
  const flags = [
    request.unverified && "Unverified: not confirmed by a code.",
    request.safe === false && `Do not text, email or leave a message. Call only${request.callAt ? `: ${request.callAt}` : ""}.`,
    request.meet && `No address; can be met at: ${request.meet}.`,
  ].filter(Boolean).join(" ");
  const note = `${request.need || kinds}\n\nFrom the web form (${kinds}; zip ${request.zip}; ${LANGUAGE_NOTE[request.language]}${request.referredBy ? `; referred by ${request.referredBy}` : ""}). ${contact}${flags ? `\n${flags}` : ""}`;
  return ctx.db.insert("calls", {
    churchId: request.churchId, callerName: request.phone ? "Web request" : request.email, phone: request.phone, note: note.slice(0, 2000),
    callback: "needed", fromWeb: true, takenAt: now, ownerId: await callbackOwner(ctx, request.churchId, now),
    ...(request.language === "es" ? { spanish: true } : {}), ...(request.urgent ? { urgent: { reasons: ["marked"], by: "rules" as const } } : {}),
  });
}
/**
 * Lays a received request on its team: a new call. One contact has one open request across all of Kind Helps: when the
 * same contact already has one waiting (from the last 7 days), the new words join that call, at whichever team holds it.
 * Only confirmed requests join, so a typed-in email cannot attach itself to someone else's request.
 */
async function land(ctx: MutationCtx, request: Doc<"webRequests">, now: number) {
  const church = await ctx.db.get("churches", request.churchId);
  if (!church) return;
  const firstContactBy = nextBusinessDay(now, church.timeZone);
  const recent = request.unverified ? [] : await ctx.db.query("webRequests").withIndex("by_contact", (q) => q.eq("contactHash", request.contactHash).gte("createdAt", now - JOIN_DAYS * DAY)).take(20);
  const joined = recent.find((row) => row._id !== request._id && row.stage === "received" && row.callId && !row.unverified);
  const call = joined?.callId ? await ctx.db.get("calls", joined.callId) : null;
  if (joined && call && call.callback === "needed") {
    await ctx.db.patch("calls", call._id, { note: `${call.note}\n\nAdded from the web: ${request.need || (request.kinds ?? [request.kind]).join(", ")}`.slice(0, 2000) });
    await ctx.db.patch("webRequests", request._id, { churchId: joined.churchId, stage: "received", callId: call._id, firstContactBy: joined.firstContactBy ?? firstContactBy });
    return;
  }
  await ctx.db.patch("webRequests", request._id, { stage: "received", callId: await createWebCall(ctx, request, now), firstContactBy });
}

export const confirm = internalMutation({
  args: { statusKeyHash: v.string(), codeHash: v.string(), ipHash: v.string() },
  returns: v.union(v.null(), v.object({ team: v.string(), by: v.number(), timeZone: v.string() })),
  handler: async (ctx, { statusKeyHash, codeHash, ipHash }) => {
    const now = Date.now();
    if (!(await bump(ctx, `confirm:${ipHash}`, HOUR, LIMITS.confirmTriesPerIpHour, now))) return null;
    const request = await ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", statusKeyHash)).unique();
    if (!request || request.stage !== "pending" || !request.codeHash || request.createdAt < now - DAY || request.codeTries >= LIMITS.codeTries) return null;
    if (request.codeHash !== codeHash) {
      await ctx.db.patch("webRequests", request._id, { codeTries: request.codeTries + 1 });
      return null;
    }
    const church = await ctx.db.get("churches", request.churchId);
    const shown = { team: church?.name ?? "", by: nextBusinessDay(now, church?.timeZone ?? "America/New_York"), timeZone: church?.timeZone ?? "America/New_York" };
    // A block made since the code was sent: it goes quietly, and the answer looks the same.
    if (await blocked(ctx, request.churchId, [request.contactHash, request.phoneHash, request.ipHash])) {
      await ctx.db.delete("webRequests", request._id);
      return shown;
    }
    await ctx.db.patch("webRequests", request._id, { confirmedAt: now, codeHash: "" });
    // A flood: past the team's hourly share, requests from contacts never confirmed before wait for a coordinator to let them
    // in. A contact confirmed before is trusted and always lands, so a flood cannot bury the people a team already knows.
    const before = await ctx.db.query("webRequests").withIndex("by_contact", (q) => q.eq("contactHash", request.contactHash).lt("createdAt", request.createdAt)).take(20);
    const trusted = before.some((row) => row.confirmedAt !== undefined && !row.unverified);
    const underShare = await bump(ctx, `team:${request.churchId}`, HOUR, LIMITS.floodPerTeamHour, now);
    if (!underShare && !trusted) {
      await ctx.db.patch("webRequests", request._id, { stage: "held" });
      return shown;
    }
    const fresh = await ctx.db.get("webRequests", request._id);
    if (fresh) await land(ctx, fresh, now);
    const landed = await ctx.db.get("webRequests", request._id);
    const holder = landed && landed.churchId !== request.churchId ? await ctx.db.get("churches", landed.churchId) : null;
    // Joined to the same person's open request at another team: they hear about the team that has it.
    return holder ? { team: holder.name, by: landed?.firstContactBy ?? shown.by, timeZone: holder.timeZone } : shown;
  },
});

/** The person deletes their own request from its private page: the request goes, and its call if no one has returned it yet. */
export const remove = internalMutation({
  args: { statusKeyHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { statusKeyHash }) => {
    const request = await ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", statusKeyHash)).unique();
    if (!request) return false;
    if (request.callId) {
      const call = await ctx.db.get("calls", request.callId);
      const sharing = await ctx.db.query("webRequests").withIndex("by_call", (q) => q.eq("callId", request.callId)).take(2);
      if (call && call.callback === "needed" && sharing.length <= 1) await ctx.db.delete("calls", call._id);
    }
    await ctx.db.delete("webRequests", request._id);
    return true;
  },
});

const sha256 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (byte) => byte.toString(16).padStart(2, "0")).join("");
export const statusKeyHash = (key: string) => sha256(`status:${key}`);
const LINK_DAYS_AFTER_CLOSE = 30;

/** The sender's private page: only where the request stands, when it was sent and when contact is due. No names, no notes. */
export const status = query({
  args: { key: v.string() },
  returns: v.union(v.null(), v.object({
    status: v.union(v.literal("pending"), v.literal("received"), v.literal("assigned"), v.literal("contacted"), v.literal("closed")),
    sentAt: v.number(), by: v.union(v.number(), v.null()), timeZone: v.string(),
  })),
  handler: async (ctx, { key }) => {
    if (!/^[0-9a-f]{32}$/.test(key)) return null;
    const hashed = await statusKeyHash(key);
    const request = await ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", hashed)).unique();
    if (!request) return null;
    const call = request.callId ? await ctx.db.get("calls", request.callId) : null;
    if (request.stage === "closed" && (call?.returnedAt ?? request.confirmedAt ?? request.createdAt) < Date.now() - LINK_DAYS_AFTER_CLOSE * DAY) return null;
    const church = await ctx.db.get("churches", request.churchId);
    return { status: publicStatus(request, call), sentAt: request.confirmedAt ?? request.createdAt, by: request.firstContactBy ?? null, timeZone: church?.timeZone ?? "America/New_York" };
  },
});
function publicStatus(request: Doc<"webRequests">, call: Doc<"calls"> | null) {
  if (request.stage === "pending" || request.stage === "closed") return request.stage;
  if (call?.callback === "done") return "contacted" as const;
  return call?.ownerId ? ("assigned" as const) : ("received" as const);
}

// ——— The team's side: every function starts with neighborAccess and reads only its own church's rows. ———

const settingsRow = v.union(v.null(), v.object({ enabled: v.boolean(), address: v.string(), zip: v.string(), miles: v.number() }));
export const settings = query({
  args: { churchId: v.id("churches") },
  returns: settingsRow,
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const intake = (await ctx.db.get("churches", churchId))?.intake;
    return intake ? { enabled: intake.enabled, address: intake.address ?? intake.zip, zip: intake.zip, miles: intake.miles } : null;
  },
});
export const saveSettings = mutation({
  args: { churchId: v.id("churches"), enabled: v.boolean(), address: v.string(), miles: v.number() },
  returns: v.null(),
  handler: async (ctx, { churchId, enabled, address, miles }) => {
    const member = await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church || church.sample) throw new ConvexError("The sample conference does not take requests from the web.");
    // The centre is the address's zip code's Census centre point for now; the Census address lookup will replace it.
    const written = address.replace(/\s+/g, " ").trim().slice(0, 200);
    const typed = written.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? written.match(/\b\d{5}\b/g)?.pop() ?? "";
    if (!validZip(typed)) throw new ConvexError("Add the church's five-digit zip code to the address.");
    if (!validMiles(miles)) throw new ConvexError("Choose a distance from 1 to 100 miles.");
    const center = await centroid(ctx, typed);
    if (!center) throw new ConvexError("That zip code is not on the Census list. Try the zip of the church itself.");
    const area = circlePolygon(center, miles);
    if (!validArea(area)) throw new ConvexError("That area could not be drawn. Try another distance.");
    await ctx.db.patch("churches", churchId, { intake: { enabled, address: written, zip: typed, miles, area, bbox: bbox(area), center } });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.settings", targetId: `${enabled ? "on" : "off"}:${typed}:${miles}`, at: Date.now() });
    return null;
  },
});

const webRow = v.object({
  id: v.id("webRequests"), kind: helpKind, need: v.string(), phone: v.string(), email: v.string(), zip: v.string(), language: v.union(v.literal("en"), v.literal("es")),
  stage: v.union(v.literal("held"), v.literal("received")), confirmedAt: v.number(), late: v.boolean(), referredBy: v.union(v.string(), v.null()),
  passedFrom: v.union(v.null(), v.object({ name: v.string(), reason: v.string() })),
  kinds: v.array(helpKind), unverified: v.boolean(), doNotMessage: v.boolean(), callAt: v.union(v.string(), v.null()), meet: v.union(v.string(), v.null()), passes: v.number(),
});
/** The team's web requests that wait: held ones (a flood) to let in, and received ones whose call is not yet returned. */
export const forTeam = query({
  args: { churchId: v.id("churches"), at: hour },
  returns: v.object({ waiting: v.array(webRow), passedOn: v.array(v.object({ toName: v.string(), reason: v.string(), at: v.number() })) }),
  handler: async (ctx, { churchId, at }) => {
    await neighborAccess(ctx, churchId);
    const now = hourAsked(at);
    const [held, received, passedOn] = await Promise.all([
      ctx.db.query("webRequests").withIndex("by_church_stage", (q) => q.eq("churchId", churchId).eq("stage", "held")).take(100),
      ctx.db.query("webRequests").withIndex("by_church_stage", (q) => q.eq("churchId", churchId).eq("stage", "received")).order("desc").take(200),
      ctx.db.query("webPasses").withIndex("by_from", (q) => q.eq("fromChurchId", churchId).gte("at", now - 30 * DAY)).order("desc").take(20),
    ]);
    const rows = [];
    for (const request of [...held, ...received]) {
      const call = request.callId ? await ctx.db.get("calls", request.callId) : null;
      if (request.stage === "received" && call?.callback !== "needed") continue;
      const from = request.passedFrom ? await ctx.db.get("churches", request.passedFrom.churchId) : null;
      rows.push({
        id: request._id, kind: request.kind, need: request.need, phone: request.phone, email: request.email, zip: request.zip, language: request.language,
        stage: request.stage === "held" ? ("held" as const) : ("received" as const), confirmedAt: request.confirmedAt ?? request.createdAt,
        late: request.firstContactBy !== undefined && now >= request.firstContactBy, referredBy: request.referredBy ?? null,
        passedFrom: request.passedFrom ? { name: from?.name ?? "Another team", reason: request.passedFrom.reason } : null,
        kinds: request.kinds ?? [request.kind], unverified: !!request.unverified, doNotMessage: request.safe === false, callAt: request.callAt ?? null, meet: request.meet ?? null, passes: request.passes ?? 0,
      });
    }
    // Passed-on requests lead, as the design asks; then the longest waiting.
    rows.sort((a, b) => Number(!!b.passedFrom) - Number(!!a.passedFrom) || a.confirmedAt - b.confirmedAt);
    return { waiting: rows, passedOn: passedOn.map((pass) => ({ toName: pass.toChurchName, reason: pass.reason, at: pass.at })) };
  },
});

async function ownRequest(ctx: QueryCtx, churchId: Id<"churches">, requestId: Id<"webRequests">) {
  const request = await ctx.db.get("webRequests", requestId);
  if (!request || request.churchId !== churchId || (request.stage !== "held" && request.stage !== "received")) throw new ConvexError("This request is no longer here.");
  return request;
}

/** The other teams this request could go to, nearest first (a handful). */
export const passTargets = query({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests") },
  returns: v.array(v.object({ id: v.id("churches"), name: v.string(), miles: v.number() })),
  handler: async (ctx, { churchId, requestId }) => {
    await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    const point = await centroid(ctx, request.zip);
    if (!point) return [];
    const near = byDistance((await enabledTeams(ctx)).filter((team) => team.id !== churchId), point).slice(0, 5);
    const named = await Promise.all(near.map(async (team) => ({ id: team.id, name: (await ctx.db.get("churches", team.id))?.name ?? "", miles: Math.round(team.miles) })));
    return named.filter((team) => team.name);
  },
});

export const passOn = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests"), toChurchId: v.id("churches"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId, toChurchId, reason }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    const why = reason.replace(/\s+/g, " ").trim();
    if (!why) throw new ConvexError("Say in one line why it goes on.");
    if (why.length > 160) throw new ConvexError("Keep the reason to one line.");
    if ((request.passes ?? 0) >= 3) throw new ConvexError("This request has been passed on three times. Settle it by phone with your coordinators.");
    const target = await ctx.db.get("churches", toChurchId);
    if (!target || toChurchId === churchId || !target.intake?.enabled || target.sample) throw new ConvexError("That team does not take requests from the web.");
    const now = Date.now();
    if (request.callId) {
      const call = await ctx.db.get("calls", request.callId);
      if (call && call.callback !== "needed") throw new ConvexError("This request was already called back.");
      // Nothing of the person stays with this team: the call goes, and only the one-line trace below is kept.
      if (call) await ctx.db.delete("calls", call._id);
    }
    await ctx.db.patch("webRequests", requestId, { churchId: toChurchId, callId: undefined, stage: "pending", passes: (request.passes ?? 0) + 1, passedFrom: { churchId, reason: why, at: now } });
    const moved = await ctx.db.get("webRequests", requestId);
    if (moved) await land(ctx, moved, now);
    await ctx.db.insert("webPasses", { fromChurchId: churchId, toChurchName: target.name, reason: why, at: now });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.passed_on", targetId: requestId, at: now });
    return null;
  },
});

/** Lets in a request held back by a flood. */
export const release = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests") },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    if (request.stage !== "held") return null;
    await land(ctx, request, Date.now());
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.released", targetId: requestId, at: Date.now() });
    return null;
  },
});

/** Lets in every request held back by a flood at once, oldest first. */
export const releaseAll = mutation({
  args: { churchId: v.id("churches") },
  returns: v.number(),
  handler: async (ctx, { churchId }) => {
    const member = await neighborAccess(ctx, churchId);
    const held = await ctx.db.query("webRequests").withIndex("by_church_stage", (q) => q.eq("churchId", churchId).eq("stage", "held")).take(50);
    const now = Date.now();
    for (const request of held) await land(ctx, request, now);
    if (held.length) await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.released_all", targetId: String(held.length), at: now });
    return held.length;
  },
});

/** Only a person closes a request; its call, if still waiting, is closed with it. */
export const close = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests") },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    await closeRequest(ctx, request, member);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.closed", targetId: requestId, at: Date.now() });
    return null;
  },
});
async function closeRequest(ctx: MutationCtx, request: Doc<"webRequests">, member: Doc<"memberships">) {
  const now = Date.now();
  await ctx.db.patch("webRequests", request._id, { stage: "closed" });
  const call = request.callId ? await ctx.db.get("calls", request.callId) : null;
  if (call?.callback === "needed") await ctx.db.patch("calls", call._id, { callback: "done", returnedBy: member._id, returnedAt: now, outcome: "Closed from the web requests." });
}

/** Silently refuses this sender's email, phone and address from now on, for this team only, and closes the request. */
export const block = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests") },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    const now = Date.now();
    for (const hash of [request.contactHash, request.phoneHash, request.ipHash]) {
      if (hash) await ctx.db.insert("webBlocks", { churchId, hash, by: member._id, at: now });
    }
    await closeRequest(ctx, request, member);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.blocked", targetId: requestId, at: now });
    return null;
  },
});

/** Hourly: requests never confirmed go after 24 hours, and spent counters after two days. */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db.query("webRequests").withIndex("by_stage_created", (q) => q.eq("stage", "pending").lt("createdAt", now - DAY)).take(500);
    for (const row of stale) await ctx.db.delete("webRequests", row._id);
    const spent = await ctx.db.query("webLimits").withIndex("by_window", (q) => q.lt("windowStart", now - 2 * DAY)).take(1000);
    for (const row of spent) await ctx.db.delete("webLimits", row._id);
    return null;
  },
});

/** Census ZCTA centre points, a batch at a time (scripts/zip-centroids.mts). A zip already kept is moved, not doubled. */
export const seedZips = internalMutation({
  args: { rows: v.array(v.object({ zip: v.string(), lat: v.number(), lng: v.number() })) },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      if (!validZip(row.zip) || Math.abs(row.lat) > 90 || Math.abs(row.lng) > 180) continue;
      const kept = await ctx.db.query("zipCentroids").withIndex("by_zip", (q) => q.eq("zip", row.zip)).unique();
      if (kept) await ctx.db.patch("zipCentroids", kept._id, { lat: row.lat, lng: row.lng });
      else await ctx.db.insert("zipCentroids", row);
    }
    return rows.length;
  },
});
