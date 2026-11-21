import { ConvexError, v } from "convex/values";
import { DateTime } from "luxon";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internalMutation, mutation } from "./functions";
import type { Doc, Id } from "./_generated/dataModel";
import { hour, hourAsked, neighborAccess } from "./access";
import { callbackOwner } from "./assistance";
import { intakeMatch } from "../src/lib/duplicates";
import { phoneKey } from "../src/lib/keys";
import { bbox, byDistance, circlePolygon, covering, distanceMiles, reachOf, validArea, validMiles, validZip, type Point, type Team } from "./area";
import { helpKind } from "./schema";
import { deliveryConfiguration, resend } from "./notifications";
import { paperEmail } from "../src/lib/email/paper-email";
import { noteLanded } from "./intakeNotify";

/**
 * The public "Ask for help" form, behind convex/intakeHttp.ts (which takes the site's BotID verdict, checks the input, and hashes).
 *
 * receive: routes the zip to the nearest team that covers it, or answers "no_team" and keeps nothing. Otherwise it
 * keeps a pending request and emails a six-digit code. confirm: on the right code the request becomes a call on that
 * team's Help line (createWebCall). Nothing here tells a sender whether their contact is known, limited or blocked:
 * those all answer "sent" and simply send nothing. No model reads anything here.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const LIMITS = { ipPerHour: 10, devicePerHour: 5, contactPerDay: 3, confirmTriesPerIpHour: 20, codeTries: 5, floodPerTeamHour: 20, unverifiedPerTeamDay: 3, partnerPerDay: 10, partnerCodesPerDay: 5 } as const;
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

export async function enabledTeams(ctx: QueryCtx): Promise<Team<Id<"churches">>[]> {
  // One row per team that switched the form on; a few hundred teams read in one go is well inside a query's reads.
  const churches = await ctx.db.query("churches").withIndex("by_intake_enabled", (q) => q.eq("intake.enabled", true)).take(2000);
  return churches.flatMap((church) => (church.intake && !church.sample ? [{ id: church._id, area: church.intake.area, center: church.intake.center, bbox: church.intake.bbox, order: church.intake.order, miles: church.intake.miles }] : []));
}
export async function centroid(ctx: QueryCtx, zip: string) {
  const row = await ctx.db.query("zipCentroids").withIndex("by_zip", (q) => q.eq("zip", zip)).unique();
  return row ? { lat: row.lat, lng: row.lng, sqmi: row.sqmi } : null;
}
const WEEK = 7 * DAY;
/** The fixed week window a team's weekly limit counts in. */
const weekKey = (churchId: Id<"churches">) => `week:${churchId}`;
async function weekCount(ctx: QueryCtx, churchId: Id<"churches">, now: number) {
  const windowStart = Math.floor(now / WEEK) * WEEK;
  return (await ctx.db.query("webLimits").withIndex("by_key", (q) => q.eq("key", weekKey(churchId)).eq("windowStart", windowStart)).unique())?.count ?? 0;
}
async function full(ctx: QueryCtx, churchId: Id<"churches">, now: number) {
  const limit = (await ctx.db.get("churches", churchId))?.intake?.weeklyLimit;
  return limit !== undefined && (await weekCount(ctx, churchId, now)) >= limit;
}
export type Routed = { kind: "unknown" } | { kind: "none" } | { kind: "full" } | { kind: "team"; churchId: Id<"churches">; checkArea: boolean };
/**
 * Where a request goes: the best team that serves its point (a geocoded street address when there is one, else the zip's
 * centre) and is not full this week. A big zip whose centre is outside every area still reaches a team its land touches,
 * marked "check area". All serving teams full: "full". None: "none". A zip not on the Census list: "unknown".
 */
export async function route(ctx: QueryCtx, zip: string, at?: Point, skip?: Id<"churches">): Promise<Routed> {
  const zipPoint = await centroid(ctx, zip);
  if (!zipPoint && !at) return { kind: "unknown" };
  const teams = (await enabledTeams(ctx)).filter((team) => team.id !== skip);
  const point = at ?? zipPoint!;
  const found = covering(teams, point, at ? 0 : reachOf(zipPoint?.sqmi));
  const fallback = !found.length && at && zipPoint ? covering(teams, zipPoint, reachOf(zipPoint.sqmi)) : [];
  const serving = found.length ? found : fallback;
  if (!serving.length) return { kind: "none" };
  const now = Date.now();
  for (const team of serving) if (!(await full(ctx, team.id, now))) return { kind: "team", churchId: team.id, checkArea: team.checkArea };
  return { kind: "full" };
}

/** Whether a day ("yyyy-MM-dd" in the team's zone) is a working day: not a weekend, not one of the team's holidays. */
const working = (at: DateTime, holidays: readonly string[]) => at.weekday <= 5 && !holidays.includes(at.toISODate() ?? "");
/** `days` business days after `from`, on the team's own calendar: Friday's request is due Monday, and holidays are skipped. */
export function nextBusinessDay(from: number, timeZone: string, holidays: readonly string[] = [], days = 1) {
  let at = DateTime.fromMillis(from, { zone: timeZone });
  for (let left = days; left > 0;) {
    at = at.plus({ days: 1 });
    if (working(at, holidays)) left--;
  }
  return at.toMillis();
}
/** Whole business days from `from` to `to` (0 when `to` is not past one business day). */
export function businessDaysBetween(from: number, to: number, timeZone: string, holidays: readonly string[] = []) {
  let count = 0;
  while (count < 30 && nextBusinessDay(from, timeZone, holidays, count + 1) <= to) count++;
  return count;
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
    return routed.kind === "unknown" ? "unknown_zip" : routed.kind === "none" ? "no_team" : "team";
  },
});

const answer = v.object({
  result: v.union(v.literal("sent"), v.literal("landed"), v.literal("no_team"), v.literal("unknown_zip"), v.literal("full"), v.literal("slow")),
  /** For "landed" (unverified, shown at once): the team's name and when first contact is due. */
  team: v.optional(v.string()),
  by: v.optional(v.number()),
  timeZone: v.optional(v.string()),
  /** The team's public phone, when it has one: with "landed", or with "slow" for a partner (its team is known). */
  phone: v.optional(v.string()),
});
const submission = {
  kinds: v.array(helpKind), need: v.string(), email: v.string(), phone: v.string(), zip: v.string(), language: v.union(v.literal("en"), v.literal("es")),
  safe: v.boolean(), callAt: v.optional(v.string()), meet: v.optional(v.string()), referredBy: v.optional(v.string()), urgent: v.boolean(),
};

/**
 * One submission, after the site's server checked Vercel BotID and the input. With an email and safe to message: kept
 * pending and a code is emailed ("sent"). Otherwise (phone only, or not safe to message) nothing is ever sent to the
 * person: it lands at once as unverified, at most UNVERIFIED_PER_TEAM_DAY a day per team, the rest held for a coordinator.
 */
export const receive = internalMutation({
  args: {
    ...submission, ipHash: v.string(), deviceHash: v.string(), contactHash: v.string(), phoneHash: v.optional(v.string()), statusKeyHash: v.string(), codeHash: v.string(), code: v.string(), statusLink: v.string(),
    /** The street address's point from the Census geocoder, when one was typed and found. */
    at: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    /** A signed-in partner (intakePartners.ts): its request needs no code from the person and lands at once. */
    partnerId: v.optional(v.id("webPartners")),
  },
  returns: answer,
  handler: async (ctx, args) => {
    const now = Date.now();
    const partner = args.partnerId ? await ctx.db.get("webPartners", args.partnerId) : null;
    const partnerPhone = partner ? { phone: (await ctx.db.get("churches", partner.churchId))?.intake?.phone } : {};
    if (args.partnerId && !partner?.active) return { result: "slow" as const, ...partnerPhone };
    const unverified = !partner && (!args.email || !args.safe);
    if (partner) {
      if (!(await bump(ctx, `partner:${partner._id}`, DAY, LIMITS.partnerPerDay, now))) return { result: "slow" as const, ...partnerPhone };
    } else if (!(await bump(ctx, `ip:${args.ipHash}`, HOUR, LIMITS.ipPerHour, now)) || !(await bump(ctx, `device:${args.deviceHash}`, HOUR, LIMITS.devicePerHour, now))) return { result: "slow" as const };
    // The unverified door is the open one, so it is narrow: one a day per device and per network.
    if (unverified && (!(await bump(ctx, `unv-ip:${args.ipHash}`, DAY, 1, now)) || !(await bump(ctx, `unv-device:${args.deviceHash}`, DAY, 1, now)))) return { result: "slow" as const };
    // A partner's request goes to the partner's own team; anyone else's goes where it is routed.
    const routed: Routed = partner ? { kind: "team", churchId: partner.churchId, checkArea: false } : await route(ctx, args.zip, args.at);
    if (routed.kind === "unknown") return { result: "unknown_zip" as const };
    if (routed.kind === "none") return { result: "no_team" as const };
    if (routed.kind === "full") return { result: "full" as const };
    const churchId = routed.churchId;
    const church = await ctx.db.get("churches", churchId);
    if (!church) return { result: "no_team" as const };
    const landsNow = unverified || !!partner;
    const quiet = landsNow ? { result: "landed" as const, team: church.name, by: nextBusinessDay(now, church.timeZone, church.intake?.holidays), timeZone: church.timeZone, phone: church.intake?.phone } : { result: "sent" as const };
    // From here on every answer is the same, so the reply never says whether a contact is known, over its limit or blocked.
    // Codes per destination: three a day per email (and per phone).
    if (!(await bump(ctx, `contact:${args.contactHash}`, DAY, LIMITS.contactPerDay, now))) return quiet;
    if (await blocked(ctx, churchId, [args.contactHash, args.phoneHash, partner ? undefined : args.ipHash])) return quiet;
    // A second try from the same contact replaces the first one still waiting for its code.
    const earlier = await ctx.db.query("webRequests").withIndex("by_contact", (q) => q.eq("contactHash", args.contactHash).gte("createdAt", now - DAY)).take(20);
    for (const row of earlier) if (row.stage === "pending") await ctx.db.delete("webRequests", row._id);
    const requestId = await ctx.db.insert("webRequests", {
      churchId, kind: args.kinds[0] ?? "other", kinds: args.kinds, need: args.need, phone: args.phone, email: args.email, zip: args.zip, language: args.language, stage: "pending",
      statusKeyHash: args.statusKeyHash, codeHash: landsNow ? "" : args.codeHash, codeTries: 0, contactHash: args.contactHash, phoneHash: args.phoneHash, ipHash: args.ipHash,
      referredBy: partner?.name ?? args.referredBy, partnerId: partner?._id, safe: args.safe, callAt: args.callAt, meet: args.meet, urgent: args.urgent || undefined,
      unverified: unverified || undefined, checkArea: routed.checkArea || undefined, createdAt: now,
    });
    if (landsNow) {
      await ctx.db.patch("webRequests", requestId, { confirmedAt: now });
      const request = await ctx.db.get("webRequests", requestId);
      if (!request) return quiet;
      if (partner || (await bump(ctx, `unv-team:${churchId}`, DAY, LIMITS.unverifiedPerTeamDay, now))) await land(ctx, request, now);
      else await ctx.db.patch("webRequests", requestId, { stage: "held" });
      return quiet;
    }
    await sendCode(ctx, requestId, churchId, { by: "email", to: args.email }, args.language, args.code, args.statusLink, now);
    return quiet;
  },
});

/**
 * How a code reaches a person. Email now; a text channel later plugs in here with the same per-destination caps
 * (`contact:` limits above) and must add a daily spend cap, one text per number a day, and US numbers only.
 */
type Destination = { by: "email"; to: string };
const channels: { [By in Destination["by"]]: (ctx: MutationCtx, to: string, message: { subject: string; text: string; html: string }, key: string) => Promise<string | null> } = {
  email: async (ctx, to, message, key) => {
    const config = deliveryConfiguration();
    if (!config) return null;
    return resend.sendEmail(ctx, { from: config.sender, to, ...message, idempotencyKey: key });
  },
};

export async function sendCode(ctx: MutationCtx, requestId: Id<"webRequests"> | undefined, churchId: Id<"churches">, destination: Destination, language: "en" | "es", code: string, statusLink: string, now: number) {
  const outboxId = await ctx.db.insert("outbox", { churchId, webRequestId: requestId, kind: "help_code", recipient: destination.to, state: "awaiting_configuration", createdAt: now });
  // Neutral on purpose: the code and the person's own link, never the need or the team.
  const message = paperEmail({ kind: "help_code", language, set: "general", place: code, link: statusLink });
  const providerId = await channels[destination.by](ctx, destination.to, message, `help_code:${requestId ?? churchId}:${now}`);
  if (providerId) await ctx.db.patch("outbox", outboxId, { state: "queued", providerId });
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
    await sendCode(ctx, request._id, request.churchId, { by: "email", to: request.email }, request.language, args.code, args.statusLink, now);
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
    request.checkArea && "Check area: the zip's centre is outside your area, but the zip reaches into it.",
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
  const firstContactBy = nextBusinessDay(now, church.timeZone, church.intake?.holidays);
  // Counts toward the team's weekly limit (a join below does not add a new request).
  const recent = request.unverified ? [] : await ctx.db.query("webRequests").withIndex("by_contact", (q) => q.eq("contactHash", request.contactHash).gte("createdAt", now - JOIN_DAYS * DAY)).take(20);
  const joined = recent.find((row) => row._id !== request._id && row.stage === "received" && row.callId && !row.unverified);
  const call = joined?.callId ? await ctx.db.get("calls", joined.callId) : null;
  if (joined && call && call.callback === "needed") {
    await ctx.db.patch("calls", call._id, { note: `${call.note}\n\nAdded from the web: ${request.need || (request.kinds ?? [request.kind]).join(", ")}`.slice(0, 2000) });
    await ctx.db.patch("webRequests", request._id, { churchId: joined.churchId, stage: "received", callId: call._id, firstContactBy: joined.firstContactBy ?? firstContactBy });
    return;
  }
  await bump(ctx, weekKey(request.churchId), WEEK, Number.MAX_SAFE_INTEGER, now);
  const callId = await createWebCall(ctx, request, now);
  await ctx.db.patch("webRequests", request._id, { stage: "received", callId, firstContactBy });
  // A new request on this team's Help line (a join above is not new): counted toward the team's next email.
  await noteLanded(ctx, request.churchId, now);
  // A request nobody confirmed is never matched to a household (abuse review #5): a typed-in phone proves nothing.
  if (!request.unverified) {
    const likely = await likelyHousehold(ctx, request);
    if (likely) await ctx.db.patch("calls", callId, { likelyNeighborId: likely });
  }
}

/**
 * The household on file at the routed team that a confirmed web request is likely from, by code alone (intakeMatch). The
 * form carries no name or street, so only the phone can match, and only when exactly one household gives it: a phone two
 * households share says nothing about which. The call is only marked; a person confirms with "Use this household" before
 * it is linked. No model is asked, and only the phone index is read.
 */
async function likelyHousehold(ctx: MutationCtx, request: Doc<"webRequests">) {
  const phone = phoneKey(request.phone);
  if (phone.length < 7) return null;
  const households = (await ctx.db.query("neighbors").withIndex("by_church_phone", (q) => q.eq("churchId", request.churchId).eq("phoneKey", phone)).take(3)).filter((row) => row.nameKey);
  return households.length === 1 ? (intakeMatch({ name: "", phone: request.phone, address: "" }, households)?.household._id ?? null) : null;
}

export const confirm = internalMutation({
  args: { statusKeyHash: v.string(), codeHash: v.string(), ipHash: v.string() },
  returns: v.union(v.null(), v.object({ team: v.string(), by: v.number(), timeZone: v.string(), phone: v.optional(v.string()) })),
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
    const shown = { team: church?.name ?? "", by: nextBusinessDay(now, church?.timeZone ?? "America/New_York", church?.intake?.holidays), timeZone: church?.timeZone ?? "America/New_York", phone: church?.intake?.phone };
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
    return holder ? { team: holder.name, by: landed?.firstContactBy ?? shown.by, timeZone: holder.timeZone, phone: holder.intake?.phone } : shown;
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
    sentAt: v.number(), by: v.union(v.number(), v.null()), timeZone: v.string(), phone: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, { key }) => {
    if (!/^[0-9a-f]{32}$/.test(key)) return null;
    const hashed = await statusKeyHash(key);
    const request = await ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", hashed)).unique();
    if (!request) return null;
    const call = request.callId ? await ctx.db.get("calls", request.callId) : null;
    if (request.stage === "closed" && (call?.returnedAt ?? request.confirmedAt ?? request.createdAt) < Date.now() - LINK_DAYS_AFTER_CLOSE * DAY) return null;
    const church = await ctx.db.get("churches", request.churchId);
    return { status: publicStatus(request, call), sentAt: request.confirmedAt ?? request.createdAt, by: request.firstContactBy ?? null, timeZone: church?.timeZone ?? "America/New_York", phone: church?.intake?.phone ?? null };
  },
});
function publicStatus(request: Doc<"webRequests">, call: Doc<"calls"> | null) {
  if (request.stage === "pending" || request.stage === "closed") return request.stage;
  if (call?.callback === "done") return "contacted" as const;
  return call?.ownerId ? ("assigned" as const) : ("received" as const);
}

// ——— The team's side: every function starts with neighborAccess and reads only its own church's rows. ———

const settingsRow = v.union(v.null(), v.object({
  enabled: v.boolean(), autoPaused: v.boolean(), address: v.string(), zip: v.string(), miles: v.number(), placed: v.union(v.literal("address"), v.literal("zip")),
  weeklyLimit: v.union(v.number(), v.null()), order: v.union(v.number(), v.null()), holidays: v.array(v.string()), phone: v.union(v.string(), v.null()),
  /** The caller's own choice: an email when new requests reach the Help line. */
  newRequestEmail: v.boolean(),
}));
export const settings = query({
  args: { churchId: v.id("churches") },
  returns: settingsRow,
  handler: async (ctx, { churchId }) => {
    const member = await neighborAccess(ctx, churchId);
    const intake = (await ctx.db.get("churches", churchId))?.intake;
    if (!intake) return null;
    const zipCentre = intake.zip ? await centroid(ctx, intake.zip) : null;
    const placed = zipCentre && zipCentre.lat === intake.center.lat && zipCentre.lng === intake.center.lng ? "zip" : "address";
    return {
      enabled: intake.enabled, autoPaused: intake.pausedBy === "auto", address: intake.address ?? intake.zip, zip: intake.zip, miles: intake.miles, placed: placed as "address" | "zip",
      weeklyLimit: intake.weeklyLimit ?? null, order: intake.order ?? null, holidays: intake.holidays ?? [], phone: intake.phone ?? null, newRequestEmail: member.newRequestEmail !== false,
    };
  },
});
/** A US phone as the public pages show it, "(313) 555-0100"; null when it is not 10 numbers (a leading 1 is allowed). */
export function publicPhone(typed: string): string | null {
  if (typed.length > 30 || /[^\d\s().+-]/.test(typed)) return null;
  const digits = typed.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Where the team helps: the church's address and miles, drawn as a circle. `at` is the address's point from the Census
 * geocoder (intakeActions.saveArea); without it, or when it lands far from the address's zip, the zip's centre is used.
 */
export const saveSettings = mutation({
  args: {
    churchId: v.id("churches"), enabled: v.boolean(), address: v.string(), miles: v.number(), at: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    weeklyLimit: v.optional(v.union(v.number(), v.null())), order: v.optional(v.union(v.number(), v.null())), holidays: v.optional(v.array(v.string())),
    phone: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { churchId, enabled, address, miles, at, weeklyLimit, order, holidays, phone }) => {
    const member = await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church || church.sample) throw new ConvexError("The sample conference does not take requests from the web.");
    const written = address.replace(/\s+/g, " ").trim().slice(0, 200);
    const typed = written.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? written.match(/\b\d{5}\b/g)?.pop() ?? "";
    if (!validMiles(miles)) throw new ConvexError("Choose a distance from 1 to 100 miles.");
    const zipCentre = validZip(typed) ? await centroid(ctx, typed) : null;
    const found = at && Math.abs(at.lat) <= 90 && Math.abs(at.lng) <= 180 && (!zipCentre || distanceMiles(zipCentre, at) <= 30) ? at : null;
    if (!found && !validZip(typed)) throw new ConvexError("Add the church's five-digit zip code to the address.");
    const center = found ?? (zipCentre ? { lat: zipCentre.lat, lng: zipCentre.lng } : null);
    if (!center) throw new ConvexError("That zip code is not on the Census list. Try the zip of the church itself.");
    const area = circlePolygon(center, miles);
    if (!validArea(area)) throw new ConvexError("That area could not be drawn. Try another distance.");
    const kept = church.intake;
    const limit = weeklyLimit === undefined ? kept?.weeklyLimit : weeklyLimit ?? undefined;
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) throw new ConvexError("A weekly limit is a whole number from 1 to 1000.");
    const rank = order === undefined ? kept?.order : order ?? undefined;
    if (rank !== undefined && (!Number.isInteger(rank) || rank < 0 || rank > 1000)) throw new ConvexError("An overlap order is a whole number from 0 to 1000.");
    const closedDays = holidays === undefined ? kept?.holidays : [...new Set(holidays)].sort();
    if (closedDays && (closedDays.length > 60 || closedDays.some((day) => !DAY_TEXT.test(day)))) throw new ConvexError("Holidays are days like 2026-12-25, at most 60.");
    const line = phone === undefined ? kept?.phone : phone === null || !phone.trim() ? undefined : publicPhone(phone);
    if (line === null) throw new ConvexError("A team phone has 10 numbers, like (313) 555-0100.");
    await ctx.db.patch("churches", churchId, {
      intake: { enabled, address: written, zip: typed, miles, area, bbox: bbox(area), center, weeklyLimit: limit, order: rank, holidays: closedDays, phone: line, seenAt: Date.now() },
    });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.settings", targetId: `${enabled ? "on" : "off"}:${miles}`, at: Date.now() });
    return null;
  },
});

/** An owner or coordinator opened the Help line: the team is alive, so the form is not paused for silence. Once a day at most. */
export const seen = mutation({
  args: { churchId: v.id("churches") },
  returns: v.null(),
  handler: async (ctx, { churchId }) => {
    await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    const now = Date.now();
    if (church?.intake && (church.intake.seenAt ?? 0) < now - DAY) await ctx.db.patch("churches", churchId, { intake: { ...church.intake, seenAt: now } });
    return null;
  },
});

const webRow = v.object({
  id: v.id("webRequests"), kind: helpKind, need: v.string(), phone: v.string(), email: v.string(), zip: v.string(), language: v.union(v.literal("en"), v.literal("es")),
  stage: v.union(v.literal("held"), v.literal("received")), confirmedAt: v.number(), late: v.boolean(), referredBy: v.union(v.string(), v.null()),
  passedFrom: v.union(v.null(), v.object({ name: v.string(), reason: v.string() })),
  acceptBy: v.union(v.number(), v.null()), checkArea: v.boolean(), partner: v.boolean(),
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
        acceptBy: request.acceptBy !== undefined && request.acceptBy > now ? request.acceptBy : null, checkArea: !!request.checkArea, partner: !!request.partnerId,
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

/**
 * Moves a request to another team: its call here goes (nothing of the person stays, only a one-line trace), and it lands
 * there with the reason at the top, to accept or return within one business day.
 */
export async function moveTo(ctx: MutationCtx, request: Doc<"webRequests">, to: Doc<"churches">, reason: string, now: number, counts: boolean) {
  if (request.callId) {
    const call = await ctx.db.get("calls", request.callId);
    if (call && call.callback !== "needed") throw new ConvexError("This request was already called back.");
    if (call) await ctx.db.delete("calls", call._id);
  }
  await ctx.db.patch("webRequests", request._id, {
    churchId: to._id, callId: undefined, stage: "pending", passes: (request.passes ?? 0) + (counts ? 1 : 0), passedFrom: { churchId: request.churchId, reason, at: now },
    acceptBy: nextBusinessDay(now, to.timeZone, to.intake?.holidays),
  });
  const moved = await ctx.db.get("webRequests", request._id);
  if (moved) await land(ctx, moved, now);
  await ctx.db.insert("webPasses", { fromChurchId: request.churchId, toChurchName: to.name, reason, at: now });
}
const oneLine = (reason: string) => {
  const why = reason.replace(/\s+/g, " ").trim();
  if (!why) throw new ConvexError("Say in one line why it goes on.");
  if (why.length > 160) throw new ConvexError("Keep the reason to one line.");
  return why;
};

export const passOn = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests"), toChurchId: v.id("churches"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId, toChurchId, reason }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    const why = oneLine(reason);
    if ((request.passes ?? 0) >= 3) throw new ConvexError("This request has been passed on three times. Settle it by phone with your coordinators.");
    const target = await ctx.db.get("churches", toChurchId);
    if (!target || toChurchId === churchId || !target.intake?.enabled || target.sample) throw new ConvexError("That team does not take requests from the web.");
    await moveTo(ctx, request, target, why, Date.now(), true);
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.passed_on", targetId: requestId, at: Date.now() });
    return null;
  },
});

/** The team a request was passed to keeps it. (Past its one business day it is theirs anyway.) */
export const accept = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests") },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId }) => {
    const member = await neighborAccess(ctx, churchId);
    await ownRequest(ctx, churchId, requestId);
    await ctx.db.patch("webRequests", requestId, { acceptBy: undefined });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.accepted", targetId: requestId, at: Date.now() });
    return null;
  },
});

/** Sends a passed request back to the team that passed it, with one line on why, within its one business day. */
export const giveBack = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId, reason }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    const why = oneLine(reason);
    const now = Date.now();
    if (!request.passedFrom || request.acceptBy === undefined || now > request.acceptBy) throw new ConvexError("This request can no longer be returned. Pass it on instead.");
    const back = await ctx.db.get("churches", request.passedFrom.churchId);
    if (!back) throw new ConvexError("That team does not take requests from the web.");
    await moveTo(ctx, request, back, why, now, false);
    // Returned to where it came from, it is that team's to keep: it cannot bounce back again without a pass.
    await ctx.db.patch("webRequests", requestId, { acceptBy: undefined });
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.returned", targetId: requestId, at: now });
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
  await ctx.db.patch("webRequests", request._id, { stage: "closed", closedAt: now });
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

/**
 * "Not genuine": blocks this sender for this team, closes the request, and marks the contact. When a second team marks the
 * same contact it goes to the admin review queue (intakeCare.reviews), never in front of other teams.
 */
export const notGenuine = mutation({
  args: { churchId: v.id("churches"), requestId: v.id("webRequests") },
  returns: v.null(),
  handler: async (ctx, { churchId, requestId }) => {
    const member = await neighborAccess(ctx, churchId);
    const request = await ownRequest(ctx, churchId, requestId);
    const now = Date.now();
    for (const hash of [request.contactHash, request.phoneHash, request.ipHash]) if (hash) await ctx.db.insert("webBlocks", { churchId, hash, by: member._id, at: now });
    await closeRequest(ctx, request, member);
    await ctx.db.patch("webRequests", request._id, { notGenuineAt: now });
    const marked = await ctx.db.query("webFlags").withIndex("by_contact", (q) => q.eq("contactHash", request.contactHash)).take(50);
    if (!marked.some((flag) => flag.churchId === churchId)) await ctx.db.insert("webFlags", { churchId, contactHash: request.contactHash, at: now });
    const teams = new Set([...marked.map((flag) => flag.churchId), churchId]).size;
    if (teams >= 2) {
      const review = await ctx.db.query("webReviews").withIndex("by_contact", (q) => q.eq("contactHash", request.contactHash)).unique();
      if (review) await ctx.db.patch("webReviews", review._id, { teams, at: now, settled: undefined });
      else await ctx.db.insert("webReviews", { contactHash: request.contactHash, teams, at: now });
    }
    await ctx.db.insert("auditEvents", { churchId, actorId: member.userId, action: "intake.not_genuine", targetId: requestId, at: now });
    return null;
  },
});

/**
 * Deleting from the status page needs the code sent to the request's own email (abuse review #9). A request with no
 * email to send to (phone only, or not safe to message) is deleted with its private link alone: there is no other way to
 * reach the person, and messaging them may not be safe.
 */
export const askToRemove = internalMutation({
  args: { statusKeyHash: v.string(), codeHash: v.string(), code: v.string(), statusLink: v.string(), ipHash: v.string() },
  returns: v.union(v.literal("code"), v.literal("removed"), v.literal("gone")),
  handler: async (ctx, args) => {
    const now = Date.now();
    const request = await ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", args.statusKeyHash)).unique();
    if (!request) return "gone";
    if (!request.email || request.safe === false) {
      await removeRequest(ctx, request);
      return "removed";
    }
    // Answers "code" even past the caps, so the page never tells whether a code went.
    if (!(await bump(ctx, `ip:${args.ipHash}`, HOUR, LIMITS.ipPerHour, now)) || !(await bump(ctx, `contact:${request.contactHash}`, DAY, LIMITS.contactPerDay, now))) return "code";
    for (const old of await ctx.db.query("webDeletes").withIndex("by_request", (q) => q.eq("requestId", request._id)).take(10)) await ctx.db.delete("webDeletes", old._id);
    await ctx.db.insert("webDeletes", { requestId: request._id, codeHash: args.codeHash, tries: 0, expiresAt: now + DAY });
    await sendCode(ctx, request._id, request.churchId, { by: "email", to: request.email }, request.language, args.code, args.statusLink, now);
    return "code";
  },
});
export const removeWithCode = internalMutation({
  args: { statusKeyHash: v.string(), codeHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { statusKeyHash, codeHash }) => {
    const request = await ctx.db.query("webRequests").withIndex("by_status_key", (q) => q.eq("statusKeyHash", statusKeyHash)).unique();
    if (!request) return false;
    const asked = await ctx.db.query("webDeletes").withIndex("by_request", (q) => q.eq("requestId", request._id)).first();
    if (!asked || asked.expiresAt < Date.now() || asked.tries >= LIMITS.codeTries) return false;
    if (asked.codeHash !== codeHash) {
      await ctx.db.patch("webDeletes", asked._id, { tries: asked.tries + 1 });
      return false;
    }
    await ctx.db.delete("webDeletes", asked._id);
    await removeRequest(ctx, request);
    return true;
  },
});
async function removeRequest(ctx: MutationCtx, request: Doc<"webRequests">) {
  if (request.callId) {
    const call = await ctx.db.get("calls", request.callId);
    const sharing = await ctx.db.query("webRequests").withIndex("by_call", (q) => q.eq("callId", request.callId)).take(2);
    if (call && call.callback === "needed" && sharing.length <= 1) await ctx.db.delete("calls", call._id);
  }
  await ctx.db.delete("webRequests", request._id);
}

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
  args: { rows: v.array(v.object({ zip: v.string(), lat: v.number(), lng: v.number(), sqmi: v.optional(v.number()) })) },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      if (!validZip(row.zip) || Math.abs(row.lat) > 90 || Math.abs(row.lng) > 180) continue;
      const kept = await ctx.db.query("zipCentroids").withIndex("by_zip", (q) => q.eq("zip", row.zip)).unique();
      if (kept) await ctx.db.patch("zipCentroids", kept._id, { lat: row.lat, lng: row.lng, sqmi: row.sqmi });
      else await ctx.db.insert("zipCentroids", row);
    }
    return rows.length;
  },
});
