import ical from "ical-generator";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, httpAction, internalMutation, internalQuery, query } from "./_generated/server";
import { membership } from "./access";

/**
 * A member's shifts and home visits as a calendar that Google, Apple and Outlook can subscribe to.
 * The calendar app cannot sign in, so the address itself is the key: one long random token per member.
 * Making a new address switches the old one off.
 *
 * Privacy: a planned visit is written as "Home visit" with the time and the street. The feed never holds a
 * neighbor's name, house number, phone or the reason for the visit.
 */
const HOUR = 3600000;
const DAY = 24 * HOUR;
const tokenPattern = /^[0-9a-f]{64}$/;
/** How far back a feed reaches, so last week's shift does not vanish from a phone. */
const lookBack = 30 * DAY;
const mostEvents = 300;
const mostVisitsRead = 4000;

/**
 * "412 Sample St, Apt 7" becomes "Sample St": enough to plan the drive, not enough to find the door.
 * Every house, unit and lot number goes, wherever it sits; only a numbered street ("22nd Ave") or highway ("US 41") keeps its number.
 */
export function streetOnly(address: string) {
  const words = address.split(",")[0].replace(/#\s*\S+/g, " ").trim().split(/\s+/);
  const kept: string[] = [];
  for (const [index, word] of words.entries()) {
    const before = words[index - 1] ?? "";
    if (/^(apt|apartment|unit|suite|ste|lot|trailer|bldg|building|room|rm|no)\.?$/i.test(word)) continue;
    if (/^(apt|apartment|unit|suite|ste|lot|trailer|bldg|building|room|rm|no)\.?$/i.test(before) && word.length <= 4) continue;
    if (/\d/.test(word) && !/^\d+(st|nd|rd|th)$/i.test(word) && !(/^(us|sr|cr|hwy|highway|route|rte|i)$/i.test(before) && /^\d{1,3}$/.test(word))) continue;
    kept.push(word);
  }
  return kept.join(" ");
}
function feedAddress(token: string) {
  const site = process.env.CONVEX_SITE_URL;
  if (!site) throw new Error("The calendar address is not available on this deployment.");
  return `${site}/calendar/${token}.ics`;
}

/** The signed-in member's own calendar address, or null before they have made one. */
export const address = query({
  args: { churchId: v.id("churches") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const me = await membership(ctx, args.churchId);
    const feed = await ctx.db.query("calendarFeeds").withIndex("by_member", (q) => q.eq("memberId", me._id)).unique();
    return feed ? feedAddress(feed.token) : null;
  },
});

/** Makes the member's address, or replaces it with a new one so the old one stops working. */
export const createAddress = action({
  args: { churchId: v.id("churches") },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return ctx.runMutation(internal.calendar.saveAddress, { churchId: args.churchId, token });
  },
});
export const saveAddress = internalMutation({
  args: { churchId: v.id("churches"), token: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const me = await membership(ctx, args.churchId);
    if (!tokenPattern.test(args.token)) throw new Error("Invalid calendar address.");
    const prior = await ctx.db.query("calendarFeeds").withIndex("by_member", (q) => q.eq("memberId", me._id)).unique();
    if (prior) await ctx.db.delete("calendarFeeds", prior._id);
    await ctx.db.insert("calendarFeeds", { churchId: args.churchId, memberId: me._id, token: args.token, createdAt: Date.now() });
    await ctx.db.insert("auditEvents", { churchId: args.churchId, actorId: me.userId, action: prior ? "calendar_address_replaced" : "calendar_address_created", at: Date.now() });
    return feedAddress(args.token);
  },
});

/** The iCalendar text behind one address, or null when the address is wrong or its member has left. */
export const feedText = internalQuery({
  args: { token: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (!tokenPattern.test(args.token)) return null;
    const feed = await ctx.db.query("calendarFeeds").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!feed) return null;
    const member = await ctx.db.get("memberships", feed.memberId);
    const church = await ctx.db.get("churches", feed.churchId);
    if (!member?.active || !church || member.churchId !== church._id) return null;

    const now = Date.now();
    const from = now - lookBack;
    const calendar = ical({ name: church.name, prodId: { company: "Kind Helps", product: "Calendar", language: "EN" }, ttl: HOUR / 1000 });
    const shifts = await ctx.db.query("commitments").withIndex("by_assignee_end", (q) => q.eq("assigneeId", member._id).gt("end", from)).take(mostEvents);
    for (const shift of shifts) {
      if (shift.cancelled || shift.churchId !== church._id) continue;
      calendar.createEvent({ id: `${shift._id}@kindhelps.com`, sequence: shift.version, stamp: new Date(now), start: new Date(shift.start), end: new Date(shift.end), summary: shift.title, location: shift.location, description: shift.preparation || undefined });
    }
    // The narrow path past neighborAccess(): a calendar app cannot sign in, so the token stands for one member.
    // It reaches only visits still planned on which that member is a visitor, and only the street leaves the record.
    // Read past other people's and finished visits until this member's are found, so a busy group never crowds them out.
    let read = 0, found = 0;
    for await (const visit of ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", church._id).gte("scheduledAt", from))) {
      if (++read > mostVisitsRead || found >= mostEvents) break;
      if (visit.status !== "scheduled" || !visit.visitors.some((visitor) => visitor.memberId === member._id)) continue;
      found++;
      const neighbor = await ctx.db.get("neighbors", visit.neighborId);
      calendar.createEvent({ id: `${visit._id}@kindhelps.com`, stamp: new Date(now), start: new Date(visit.scheduledAt), end: new Date(visit.scheduledAt + HOUR), summary: "Home visit", location: (neighbor && streetOnly(neighbor.address)) || undefined, description: "Open the app for the details. You visit as a pair." });
    }
    return calendar.toString();
  },
});

/** GET /calendar/<token>.ics. Anything but a live address gets an empty 404. */
export const feed = httpAction(async (ctx, request) => {
  const token = new URL(request.url).pathname.match(/^\/calendar\/([0-9a-f]{64})\.ics$/)?.[1];
  const text = token ? await ctx.runQuery(internal.calendar.feedText, { token }) : null;
  if (text === null) return new Response(null, { status: 404 });
  return new Response(text, { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" } });
});
