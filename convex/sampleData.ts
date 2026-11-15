import { v } from "convex/values";
import { DateTime } from "luxon";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * A made-up conference with a year of activity, for the judge demo and for building screens.
 * Every person, address, phone number and case here is invented: names are drawn from the
 * lists below, phones use the reserved 555-01xx range, emails use the reserved .example domain.
 *
 *   bunx convex run sampleData:load
 *   bunx convex run sampleData:clear '{"churchId":"..."}'
 */
const zone = "America/New_York";
const emailDomain = "neighborly.example";
const DAY = 86400000;
/** The last call of these neighbors is this recent, so the demo always has open work whatever day it is loaded. */
const recentCalls = new Map([[34, DAY], [35, 2 * DAY], [36, 8 * DAY], [37, 10 * DAY], [38, DAY / 8]]);

const volunteerNames = ["Marisol Vega", "Thomas Okafor", "Renee Baptiste", "Daniel Whitcombe", "Graciela Fuentes", "Samuel Adeyemi", "Colleen Marsh", "Jean-Luc Pierre", "Hannah Lindqvist", "Victor Salgado", "Priya Raman", "Walter Brzezinski"];
const firstNames = ["Alma", "Benito", "Celeste", "Darnell", "Esperanza", "Fabrice", "Gloria", "Hector", "Imani", "Josue", "Katia", "Leon", "Mireille", "Nestor", "Odalys", "Pascal", "Quiana", "Rosalind", "Stefan", "Tamika", "Ulises", "Violeta", "Wendell", "Yolande"];
const lastNames = ["Almonte", "Bellweather", "Castellanos", "Desrosiers", "Eastman", "Figueroa", "Greenhalgh", "Hyppolite", "Ibarra", "Joseph", "Kowalczyk", "Larkspur", "Montoya", "Nwosu", "Orlov", "Pemberton", "Quintanilla", "Rosemond"];
const streets = ["Sample St", "Example Ave", "Placeholder Rd", "Demo Ct", "Fixture Ln", "Mockingbird Way"];
const kinds = [
  { kind: "rent", payeeKind: "landlord", payees: ["Sample Street Apartments", "Example Avenue Rentals", "Placeholder Property Group"], low: 25000, high: 90000, summaries: ["Behind on this month's rent after reduced hours", "Short on rent after a medical bill", "Needs help with a security deposit"] },
  { kind: "utility", payeeKind: "utility", payees: ["Demo Power & Light", "Example Water Authority", "Sample Gas Company"], low: 8000, high: 35000, summaries: ["Shut-off notice on the electric bill", "Past-due water bill", "Gas bill before the cold weather"] },
  { kind: "food", payeeKind: "vendor", payees: ["Fixture Family Market"], low: 4000, high: 12000, summaries: ["Groceries until the next paycheck", "Food for the week for a family with children"] },
  { kind: "voucher", payeeKind: "vendor", payees: ["Conference thrift store"], low: 2500, high: 7500, summaries: ["Furniture voucher after a move", "Winter coats for the children"] },
  { kind: "other", payeeKind: "vendor", payees: ["Demo Pharmacy", "Example Transit"], low: 2000, high: 15000, summaries: ["Prescription co-pay", "Bus pass to get to a new job"] },
] as const;

/** A small fixed-seed generator, so the sample conference is the same every time it is loaded. */
function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (low: number, high: number) => low + Math.floor(next() * (high - low + 1));
  const pick = <T>(items: readonly T[]) => items[between(0, items.length - 1)];
  return { next, between, pick };
}
const isoDay = (time: number) => DateTime.fromMillis(time, { zone }).toFormat("yyyy-MM-dd");
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const load = internalMutation({
  args: { owner: v.optional(v.object({ userId: v.id("users"), name: v.string(), email: v.string() })) },
  returns: v.id("churches"),
  handler: async (ctx, args) => {
    const random = generator(1833);
    const now = Date.now();
    const churchId = await ctx.db.insert("churches", { name: "St. Example Conference (sample)", timeZone: zone, sample: true });

    // People. Without a real owner account, the first volunteer owns the group.
    const members: Id<"memberships">[] = [];
    if (args.owner) members.push(await ctx.db.insert("memberships", { churchId, userId: args.owner.userId, name: args.owner.name, email: args.owner.email, role: "owner", active: true, approved: true, coverOptIn: true }));
    for (const [index, name] of volunteerNames.entries()) {
      const role = members.length === 0 ? "owner" : index < 3 ? "coordinator" : "member";
      members.push(await ctx.db.insert("memberships", { churchId, userId: await ctx.db.insert("users", {}), name, email: `${key(name).replaceAll(" ", ".")}@${emailDomain}`, role, active: true, approved: true, coverOptIn: index % 2 === 0, language: index % 4 === 1 ? "es" : index % 6 === 2 ? "ht" : "en" }));
    }
    const [owner, ...others] = members;
    const staff = members.slice(0, 4);
    const visitors = members.slice(1, 9);

    // The volunteer side: two teams, the coming weeks of help-line shifts, availability and one absence.
    const helpLine = await ctx.db.insert("teams", { churchId, name: "Help line", description: "Answers the conference phone and returns calls the next morning." });
    const homeVisits = await ctx.db.insert("teams", { churchId, name: "Home visitors", description: "Visits neighbors at home, always in pairs." });
    for (const [index, memberId] of others.entries()) {
      await ctx.db.insert("teamMembers", { churchId, teamId: index % 2 ? helpLine : homeVisits, memberId, teamRole: index < 2 ? "coordinator" : "member", approved: true, status: "active" });
      if (index < 8) await ctx.db.insert("availability", { churchId, memberId, start: isoDay(now), end: isoDay(now + 60 * DAY) });
    }
    const monday = DateTime.fromMillis(now, { zone }).startOf("week");
    for (let week = 0; week < 5; week++) for (const [slot, weekday] of [1, 3, 5].entries()) {
      const start = monday.plus({ weeks: week, days: weekday - 1, hours: 9 }).toMillis();
      if (start < now) continue;
      await ctx.db.insert("commitments", { churchId, teamId: helpLine, title: "Help line morning", start, end: start + 3 * 3600000, location: "Parish office", preparation: "Check the callback list first. Record every call, even a wrong number.", assigneeId: week === 4 ? null : others[(week * 3 + slot) % others.length], coordinatorId: others[1], version: 1 });
    }
    // A year of finished shifts, so hours by team have something to add up: the help line twice a week
    // and the pantry on Saturdays. Kept under the 200 the overview reads, after the coming weeks above.
    const pantry = await ctx.db.insert("teams", { churchId, name: "Pantry", description: "Sorts donations and packs food bags on Saturday mornings." });
    const pantryCrew = others.slice(6, 11);
    for (const [index, memberId] of pantryCrew.entries()) await ctx.db.insert("teamMembers", { churchId, teamId: pantry, memberId, teamRole: index === 0 ? "coordinator" : "member", approved: true, status: "active" });
    const helpLineCrew = others.filter((_, index) => index % 2 === 1);
    for (let week = 1; week <= 52; week++) {
      for (const [slot, weekday] of [2, 4].entries()) {
        const start = monday.minus({ weeks: week }).plus({ days: weekday - 1, hours: 9 }).toMillis();
        await ctx.db.insert("commitments", { churchId, teamId: helpLine, title: "Help line morning", start, end: start + 3 * 3600000, location: "Parish office", preparation: "", assigneeId: helpLineCrew[(week * 2 + slot) % helpLineCrew.length], coordinatorId: others[1], version: 1 });
      }
      const saturday = monday.minus({ weeks: week }).plus({ days: 5, hours: 10 }).toMillis();
      await ctx.db.insert("commitments", { churchId, teamId: pantry, title: "Pantry morning", start: saturday, end: saturday + 2 * 3600000, location: "Parish hall", preparation: "", assigneeId: pantryCrew[week % pantryCrew.length], coordinatorId: pantryCrew[0], version: 1 });
    }
    await ctx.db.insert("timeOff", { churchId, memberId: others[5], start: isoDay(now + 9 * DAY), end: isoDay(now + 16 * DAY), note: "Visiting family." });
    await ctx.db.insert("tasks", { churchId, title: "Restock the food pantry shelf", dueAt: now + 4 * DAY, assigneeId: others[4], complete: false });
    await ctx.db.insert("tasks", { churchId, title: "Send thank-you notes for the fall collection", dueAt: null, assigneeId: others[2], complete: true });
    await ctx.db.insert("announcements", { churchId, title: "Winter coat drive starts next week", body: "Bring coats to the parish office. Home visitors, ask each family for sizes.", authorId: owner, createdAt: now - 2 * DAY });

    // The treasury opens a year ago and receives the monthly collection and occasional gifts.
    const yearAgo = now - 365 * DAY;
    const entry = (kind: "income" | "expense", time: number, amount: number, category: string, payee: string, memo: string, links: { requestId?: Id<"assistanceRequests">; neighborId?: Id<"neighbors"> } = {}) =>
      ctx.db.insert("ledgerEntries", { churchId, kind, amount, date: isoDay(time), category, payee, memo, ...links, recordedBy: owner, createdAt: time });
    await entry("income", yearAgo, 420000, "Opening balance", "St. Example Conference", "Balance carried forward");
    for (let month = 0; month < 12; month++) {
      const time = yearAgo + month * 30 * DAY + 6 * DAY;
      await entry("income", time, random.between(210000, 340000), "Parish collection", "St. Example Parish", "Fifth-Sunday and poor-box collection");
      if (month % 3 === 1) await entry("income", time + 9 * DAY, random.between(50000, 150000), "Donation", "Anonymous gift", "Designated for rent and utilities");
    }

    // Neighbors, and for each a year of calls, requests, visits in pairs and payments.
    for (let index = 0; index < 40; index++) {
      const name = `${firstNames[index % firstNames.length]} ${lastNames[(index * 7) % lastNames.length]}`;
      const phone = `(555) 01${String(index).padStart(2, "0")}`;
      const firstCall = yearAgo + random.between(5, 330) * DAY;
      const neighborId = await ctx.db.insert("neighbors", { churchId, name, nameKey: key(name), phone, phoneKey: phone.replace(/\D/g, ""), email: index % 5 === 0 ? `${key(name).replaceAll(" ", ".")}@${emailDomain}` : "", address: `${random.between(10, 980)} ${random.pick(streets)}, Apt ${random.between(1, 24)}`, adults: random.between(1, 3), children: random.between(0, 4), language: index % 4 === 1 ? "es" : index % 9 === 2 ? "ht" : "en", notes: index % 6 === 0 ? "Prefers a call after 5 PM." : "", createdBy: random.pick(staff), createdAt: firstCall });
      const callCount = random.between(1, 4);
      for (let call = 0; call < callCount; call++) {
        const recent = call === callCount - 1 ? recentCalls.get(index) : undefined;
        const takenAt = recent !== undefined ? now - recent : Math.min(firstCall + call * random.between(25, 80) * DAY + random.between(9, 16) * 3600000, now - random.between(1, 30) * 3600000);
        const age = now - takenAt;
        const need = random.pick(kinds);
        const summary = random.pick(need.summaries);
        const asksForHelp = call === 0 || recent !== undefined || random.next() < 0.7;
        const callId = await ctx.db.insert("calls", { churchId, neighborId, callerName: name, phone, note: asksForHelp ? `${summary}.` : "Called to say thank you and give an update.", callback: age < 2 * DAY && (recent !== undefined || random.next() < 0.6) ? "needed" : asksForHelp ? "done" : "none", takenBy: random.pick(staff), takenAt });
        if (!asksForHelp) continue;
        const amountRequested = Math.round(random.between(need.low, need.high) / 500) * 500;
        const outcome = age < 6 * DAY ? "open" : age < 14 * DAY ? "approved" : random.pick(["paid", "paid", "paid", "paid", "declined", "closed"] as const);
        const granted = outcome === "approved" || outcome === "paid";
        const amountApproved = granted ? Math.min(amountRequested, Math.round((amountRequested * random.between(60, 100)) / 100 / 500) * 500) : undefined;
        const decidedAt = outcome === "open" ? undefined : takenAt + random.between(3, 5) * DAY;
        const payeeName = random.pick(need.payees);
        const requestId = await ctx.db.insert("assistanceRequests", { churchId, neighborId, callId, kind: need.kind, summary, amountRequested, amountApproved, status: outcome, decisionNote: outcome === "declined" ? "Referred to the county program, which covers this in full." : outcome === "closed" ? "Neighbor resolved it before the visit." : granted ? "Approved after the home visit." : "", decidedBy: decidedAt ? owner : undefined, decidedAt, payeeKind: need.payeeKind, payeeName, source: index % 8 === 3 ? "ai_draft" : "person", createdBy: random.pick(staff), createdAt: takenAt });
        if (outcome !== "closed") {
          const first = random.between(0, visitors.length - 1);
          const pair = [visitors[first], visitors[(first + random.between(1, visitors.length - 1)) % visitors.length]];
          const scheduledAt = takenAt + random.between(1, 2) * DAY;
          const done = scheduledAt < now && outcome !== "open";
          const hours = random.between(2, 5) / 2, miles = random.between(4, 22);
          await ctx.db.insert("visits", { churchId, neighborId, requestId, scheduledAt: done ? scheduledAt : Math.max(scheduledAt, now + random.between(1, 3) * DAY), status: done ? "completed" : "scheduled", visitors: pair.map((memberId) => ({ memberId, hours: done ? hours : 0, miles: done ? miles : 0 })), notes: done ? "Visited together. Reviewed the bill and confirmed the amount with the payee." : "", completedAt: done ? scheduledAt + 2 * 3600000 : undefined, createdBy: owner, createdAt: takenAt });
        }
        if (outcome === "paid" && amountApproved && decidedAt)
          await entry("expense", decidedAt + DAY, amountApproved, need.kind, payeeName, `Paid directly to ${payeeName}`, { requestId, neighborId });
      }
    }
    return churchId;
  },
});

export const clear = internalMutation({
  args: { churchId: v.id("churches") },
  returns: v.null(),
  handler: async (ctx, { churchId }) => {
    const church = await ctx.db.get("churches", churchId);
    if (!church?.sample) throw new Error("Only a sample group can be cleared.");
    const memberships = await ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect();
    const rows = (await Promise.all([
      ctx.db.query("ledgerEntries").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("visits").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("calendarFeeds").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("announcements").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("tasks").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("timeOff").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("availability").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("requests").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("commitments").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("teamMembers").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("teams").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
    ])).flat();
    for (const row of rows) await ctx.db.delete(row._id);
    for (const member of memberships) {
      // Invented volunteers have a placeholder account that exists only for this group. A real owner's account stays.
      if (member.email.endsWith(`@${emailDomain}`)) await ctx.db.delete(member.userId);
      await ctx.db.delete(member._id);
    }
    await ctx.db.delete(churchId);
    return null;
  },
});
