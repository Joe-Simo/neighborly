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
const emailDomain = "kindhelps.example";
const DAY = 86400000;
/** The last call of these households is this recent, so the demo always has open work whatever day it is loaded. */
const recentCalls = new Map([[194, DAY / 8], [195, DAY], [196, 2 * DAY], [197, 7 * DAY], [198, 9 * DAY], [199, 12 * DAY]]);
const HOUSEHOLDS = 200;

const volunteerNames = ["Marisol Vega", "Thomas Okafor", "Renee Baptiste", "Daniel Whitcombe", "Graciela Fuentes", "Samuel Adeyemi", "Colleen Marsh", "Jean-Luc Pierre", "Hannah Lindqvist", "Victor Salgado", "Priya Raman", "Walter Brzezinski"];
// 25 first names and 20 family names; paired so that 200 households are all different.
const firstNames = ["Alma", "Benito", "Celeste", "Darnell", "Esperanza", "Fabrice", "Gloria", "Hector", "Imani", "Josue", "Katia", "Leon", "Mireille", "Nestor", "Odalys", "Pascal", "Quiana", "Rosalind", "Stefan", "Tamika", "Ulises", "Violeta", "Wendell", "Yolande", "Zenaida"];
const lastNames = ["Almonte", "Bellweather", "Castellanos", "Desrosiers", "Eastman", "Figueroa", "Greenhalgh", "Hyppolite", "Ibarra", "Joseph", "Kowalczyk", "Larkspur", "Montoya", "Nwosu", "Orlov", "Pemberton", "Quintanilla", "Rosemond", "Sandoval", "Thibodeaux"];
const streets = ["Orchard St", "Mill Rd", "Chapel Ln", "Harbor Ave", "Cedar Ct", "Larkspur Way", "Garden St", "Bridge Rd"];
const needs = [
  { kind: "rent", payeeKind: "landlord", payees: ["Orchard Street Apartments", "Mill Road Rentals", "Chapel Lane Property Group"], low: 25000, high: 90000, summaries: ["Behind on this month's rent after reduced hours", "Short on rent after a medical bill", "Needs help with a security deposit"] },
  { kind: "utility", payeeKind: "utility", payees: ["City Power & Light", "County Water Authority", "Valley Gas Company"], low: 8000, high: 35000, summaries: ["Shut-off notice on the electric bill", "Past-due water bill", "Gas bill before the cold weather"] },
  { kind: "food", payeeKind: "vendor", payees: ["Corner Family Market"], low: 4000, high: 12000, summaries: ["Groceries until the next paycheck", "Food for the week for a family with children"] },
  { kind: "voucher", payeeKind: "vendor", payees: ["Conference thrift store"], low: 2500, high: 7500, summaries: ["Furniture voucher after a move", "Winter coats for the children"] },
  { kind: "other", payeeKind: "vendor", payees: ["Main Street Pharmacy", "County Transit"], low: 2000, high: 15000, summaries: ["Prescription co-pay", "Bus pass to get to a new job"] },
] as const;
// Utilities and rent are most of what a conference is asked for.
const kinds = [needs[0], needs[0], needs[0], needs[1], needs[1], needs[1], needs[1], needs[2], needs[2], needs[2], needs[3], needs[4]];
const strangers = ["Wrong number.", "Asked for the pantry's hours.", "Asked how to volunteer.", "Calling for a relative in another parish; referred to that conference.", "Hung up before leaving a name."];

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

    // From the start of the last full fiscal year (October 1) to today, so that year and every
    // month since has activity and no earlier year is left with a sliver.
    const today = DateTime.fromMillis(now, { zone });
    const thisFiscalYear = (today.month >= 10 ? today : today.minus({ years: 1 })).set({ month: 10, day: 1 }).startOf("day");
    const firstMonth = thisFiscalYear.minus({ years: 1 });
    const start = firstMonth.toMillis();
    const days = Math.floor((now - start) / DAY);
    const spentByMonth = new Map<string, number>();
    const entry = (kind: "income" | "expense", time: number, amount: number, category: string, payee: string, memo: string, links: { requestId?: Id<"assistanceRequests">; neighborId?: Id<"neighbors">; checkNumber?: string } = {}) => {
      if (kind === "expense") spentByMonth.set(isoDay(time).slice(0, 7), (spentByMonth.get(isoDay(time).slice(0, 7)) ?? 0) + amount);
      return ctx.db.insert("ledgerEntries", { churchId, kind, amount, date: isoDay(time), category, payee, memo, ...links, recordedBy: owner, createdAt: time });
    };
    await entry("income", start, 420000, "Opening balance", "St. Example Conference", "Balance carried forward");

    let checkNumber = 2041;
    // Households, and for each its calls, requests for help, visits in pairs and payments.
    for (let index = 0; index < HOUSEHOLDS; index++) {
      const name = `${firstNames[index % 25]} ${lastNames[((index % 25) * 3 + Math.floor(index / 25)) % 20]}`;
      const phone = `(10${index < 100 ? 0 : 1}) 555-01${String(index % 100).padStart(2, "0")}`;
      const firstCall = start + random.between(1, days - 14) * DAY;
      const neighborId = await ctx.db.insert("neighbors", { churchId, name, nameKey: key(name), phone, phoneKey: phone.replace(/\D/g, ""), email: index % 5 === 0 ? `${key(name).replaceAll(" ", ".")}@${emailDomain}` : "", address: `${random.between(10, 980)} ${random.pick(streets)}, Apt ${random.between(1, 24)}`, adults: random.between(1, 3), children: random.between(0, 4), language: index % 4 === 1 ? "es" : index % 9 === 2 ? "ht" : "en", notes: index % 6 === 0 ? "Prefers a call after 5 PM." : "", createdBy: random.pick(staff), createdAt: firstCall });
      const callCount = random.between(1, 4);
      for (let call = 0; call < callCount; call++) {
        const recent = call === callCount - 1 ? recentCalls.get(index) : undefined;
        const planned = firstCall + call * random.between(25, 80) * DAY + random.between(9, 16) * 3600000;
        // A household's later calls stop where the calendar does; only the chosen recent cases reach this week.
        if (recent === undefined && planned > now - 3 * DAY) break;
        const takenAt = recent !== undefined ? now - recent : planned;
        const age = now - takenAt;
        const need = random.pick(kinds);
        const summary = random.pick(need.summaries);
        const asksForHelp = call === 0 || recent !== undefined || random.next() < 0.7;
        const callId = await ctx.db.insert("calls", { churchId, neighborId, callerName: name, phone, note: asksForHelp ? `${summary}.` : "Called to say thank you and give an update.", callback: recent !== undefined && age < 3 * DAY ? "needed" : asksForHelp ? "done" : "none", takenBy: random.pick(staff), takenAt });
        if (!asksForHelp) continue;
        const amountRequested = Math.round(random.between(need.low, need.high) / 500) * 500;
        const outcome = age < 6 * DAY ? "open" : age < 13 * DAY ? "approved" : random.pick(["paid", "paid", "paid", "paid", "paid", "paid", "paid", "declined", "closed"] as const);
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
          await entry("expense", decidedAt + DAY, amountApproved, need.kind, payeeName, "", { requestId, neighborId, ...(need.kind === "food" || need.kind === "voucher" ? {} : { checkNumber: String(checkNumber++) }) });
      }
    }

    // Calls that never became a household: about three a month.
    for (let call = 0; call < Math.floor(days / 10); call++) {
      const takenAt = start + call * 10 * DAY + random.between(1, 8) * DAY + random.between(9, 16) * 3600000;
      if (takenAt > now - DAY) break;
      await ctx.db.insert("calls", { churchId, callerName: "No name given", phone: "", note: random.pick(strangers), callback: "none", takenBy: random.pick(staff), takenAt });
    }

    // What the conference spends besides help, then what comes in. Each month's collection is set close
    // to what that month paid out, so the year reads like a conference that gives away what it receives.
    const months = Array.from({ length: Math.floor(today.diff(firstMonth, "months").months) + 1 }, (_, index) => firstMonth.plus({ months: index }));
    const on = (month: DateTime, day: number) => month.set({ day, hour: 12 }).toMillis();
    for (const month of months) {
      if (on(month, 20) < now) await entry("expense", on(month, 20), random.between(150, 320) * 100, "Pantry purchase", "Corner Family Market", "Shelf-stable food for the pantry");
      if (month.month === 10 && on(month, 12) < now) await entry("expense", on(month, 12), 60000, "Council dues", "District Council", "Annual solidarity contribution");
      if (month.month % 4 === 2 && on(month, 9) < now) await entry("expense", on(month, 9), random.between(40, 110) * 100, "Supplies", "Main Street Office Supply", "Paper, postage and phone line");
    }
    for (const month of months) {
      const spent = spentByMonth.get(month.toFormat("yyyy-MM")) ?? 0;
      if (on(month, 2) < now) await entry("income", on(month, 2), Math.max(150000, Math.round((spent * random.between(90, 102)) / 100 / 500) * 500), "Parish collection", "St. Example Parish", "Fifth-Sunday and poor-box collection");
      if (month.month % 3 !== 0 && on(month, 10) < now) await entry("income", on(month, 10), random.between(20, 75) * 1000, "Donation", "Anonymous gift", "Designated for rent and utilities");
      if (month.month === 9 && on(month, 27) < now) await entry("income", on(month, 27), random.between(380, 520) * 1000, "Friends of the Poor Walk", "Walk pledges", "Pledges collected after the walk");
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
      ctx.db.query("deposits").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("voucherStock").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("ledgerKinds").withIndex("by_church_key", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("bankStatements").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("neighborNotes").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("referralAgencies").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("aiUsageByChurch").withIndex("by_church_month", (q) => q.eq("churchId", churchId)).collect(),
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
