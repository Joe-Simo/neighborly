import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { hour, hourAsked, neighborAccess } from "./access";

/** When this week's Monday began in the group's own time zone. */
export function weekBegan(now: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday);
  return now - (day * 86_400_000 + Number(parts.hour) * 3_600_000 + Number(parts.minute) * 60_000 + Number(parts.second) * 1000);
}

const act = v.object({ id: v.string(), kind: v.union(v.literal("call"), v.literal("visit"), v.literal("yes")), at: v.number(), day: v.number() });

/**
 * What was done since Monday began where the group is, oldest first: each call called back, each visit written
 * up, each yes given. This week's head on the leader's home lays one paper piece for each. Read from the records
 * alone, with reads bounded to the week.
 */
export const week = query({
  args: { churchId: v.id("churches"), at: hour },
  returns: v.array(act),
  handler: async (ctx, { churchId, at }) => {
    await neighborAccess(ctx, churchId);
    const church = await ctx.db.get("churches", churchId);
    if (!church) throw new ConvexError("Group not found.");
    const now = hourAsked(at);
    const monday = weekBegan(now, church.timeZone);
    const [returned, visits, approved, paid] = await Promise.all([
      ctx.db.query("calls").withIndex("by_church_callback_returned", (q) => q.eq("churchId", churchId).eq("callback", "done").gte("returnedAt", monday)).take(100),
      // By when it was written up, not when it was planned: a visit planned last week and written up today is today's.
      ctx.db.query("visits").withIndex("by_church_status_completed", (q) => q.eq("churchId", churchId).eq("status", "completed").gte("completedAt", monday)).take(100),
      ctx.db.query("assistanceRequests").withIndex("by_church_status", (q) => q.eq("churchId", churchId).eq("status", "approved")).take(200),
      // A yes given this week and already paid: among the latest paid.
      ctx.db.query("assistanceRequests").withIndex("by_church_status", (q) => q.eq("churchId", churchId).eq("status", "paid")).order("desc").take(60),
    ]);
    // Nothing is done in the future, so the week runs from Monday on: a piece laid in this hour shows at once.
    const within = (at: number | undefined): at is number => at !== undefined && at >= monday;
    return [
      ...returned.filter((call) => within(call.returnedAt)).map((call) => ({ id: call._id as string, kind: "call" as const, at: call.returnedAt ?? 0 })),
      ...visits.filter((visit) => within(visit.completedAt)).map((visit) => ({ id: visit._id as string, kind: "visit" as const, at: visit.completedAt ?? 0 })),
      ...[...approved, ...paid].filter((request) => within(request.decidedAt)).map((request) => ({ id: request._id as string, kind: "yes" as const, at: request.decidedAt ?? 0 })),
    ]
      .sort((a, b) => a.at - b.at)
      .slice(0, 120)
      // The weekday it was done on, Monday 0 to Sunday 6.
      .map((one) => ({ ...one, day: Math.min(6, Math.floor((one.at - monday) / 86_400_000)) }));
  },
});
