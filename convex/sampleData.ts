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
// 200 first names, one for each household, in no order, and 40 family names. All invented.
const firstNames = ["Alma", "Benito", "Celeste", "Darnell", "Esperanza", "Fabrice", "Gloria", "Hector", "Imani", "Josue", "Katia", "Leon", "Mireille", "Nestor", "Odalys", "Pascal", "Quiana", "Rosalind", "Stefan", "Tamika", "Ulises", "Violeta", "Wendell", "Yolande", "Zenaida", "Adela", "Bertrand", "Carmela", "Dieudonne", "Elodie", "Faustino", "Griselda", "Horacio", "Ines", "Jacinto", "Kerline", "Lazaro", "Magdalena", "Nadege", "Octavio", "Paloma", "Quentin", "Rafaela", "Silvio", "Therese", "Ubaldo", "Valentina", "Wilner", "Ximena", "Yvon", "Zoraida", "Anselmo", "Beatriz", "Clement", "Dolores", "Emeric", "Florencia", "Gaspard", "Herminia", "Isidro", "Jocelyne", "Karim", "Lourdes", "Maxime", "Noemi", "Orlando", "Perla", "Quincy", "Roselande", "Santiago", "Tatiana", "Urbain", "Veronica", "Wesner", "Yesenia", "Zacharie", "Amparo", "Bruno", "Consuelo", "Delphine", "Eusebio", "Fernande", "Gilberto", "Helene", "Ignacio", "Josette", "Kendrick", "Leticia", "Marcelin", "Nicolasa", "Oswaldo", "Priscila", "Remy", "Soledad", "Teodoro", "Ursula", "Vicente", "Widline", "Yanick", "Zulema", "Abelardo", "Bernadette", "Cornelio", "Daphne", "Evaristo", "Fabiola", "Gervais", "Hortensia", "Ismael", "Julienne", "Kervens", "Liliana", "Modeste", "Natividad", "Olivier", "Petra", "Raimundo", "Solange", "Tiburcio", "Viviane", "Wilfrid", "Yolaine", "Agustin", "Blandine", "Cayetano", "Darline", "Eladio", "Florette", "Gonzalo", "Heloise", "Inocencio", "Jesula", "Leopoldo", "Marisela", "Narciso", "Odette", "Porfirio", "Rosemene", "Sergio", "Thelma", "Valerio", "Wideline", "Aurelio", "Belkis", "Casimir", "Dalia", "Edgard", "Francisca", "Guerline", "Hipolito", "Iraida", "Jean-Marc", "Katiana", "Lisandro", "Mirlande", "Nemesio", "Ofelia", "Patrice", "Rebeca", "Sauveur", "Trinidad", "Venel", "Araceli", "Bastien", "Camila", "Donald", "Eugenia", "Fritz", "Genoveva", "Hubert", "Ivette", "Joaquin", "Kettly", "Luciano", "Marlene", "Norberto", "Olga", "Prosper", "Rosario", "Stanley", "Teresa", "Vladimir", "Altagracia", "Bolivar", "Clarisse", "Demetrio", "Edwige", "Feliciano", "Ginette", "Humberto", "Islande", "Julio", "Lucienne", "Mauricio", "Nathalie", "Omar", "Pilar", "Reynaldo", "Sabine", "Tomas"];
const lastNames = ["Almonte", "Bellweather", "Castellanos", "Desrosiers", "Eastman", "Figueroa", "Greenhalgh", "Hyppolite", "Ibarra", "Joseph", "Kowalczyk", "Larkspur", "Montoya", "Nwosu", "Orlov", "Pemberton", "Quintanilla", "Rosemond", "Sandoval", "Thibodeaux", "Aguilar", "Beauvoir", "Charles", "Dorval", "Estime", "Fontaine", "Guerrero", "Hernandez", "Innocent", "Jeanty", "Lafleur", "Mathurin", "Navarro", "Ortega", "Paredes", "Raymond", "Salazar", "Toussaint", "Vargas", "Zamora"];
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
// What a pair writes after a visit. Short, about the need and the home, never a judgment of the person.
const visitNotes = [
  "Visited together. Reviewed the bill and confirmed the amount with the payee.",
  "Met at the kitchen table. Saw the shut-off notice and called the utility with her to confirm the balance.",
  "Landlord confirmed the amount by phone while we were there. Agreed the help goes to him directly.",
  "Two children at home. Pantry bag left today, and the rent request goes to the conference on Tuesday.",
  "He lost hours at work last month and expects a full week again soon. Asked only for help with this one bill.",
  "Lives alone, second floor, no lift. Prefers a phone call before any visit. Bill seen and copied.",
  "Translated by her daughter. Read the lease together. The amount on the notice matches what she told the help line.",
  "Short visit at the door at his request. Showed us the past-due notice. We prayed together before leaving.",
  "New to the parish. Explained how the conference helps and that payment goes to the company, never in cash.",
  "Follow-up visit. Last month's help kept the lights on. Brought a furniture voucher and the pantry hours.",
];
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
    // A second stream for how things read (names, times of day, visit notes), so money and counts keep their own draws.
    const look = generator(4127);
    // A believable time on the same day: the help line mostly in the morning, visits mid-morning or late afternoon.
    const clock = (time: number, slots: readonly (readonly [number, number])[]) => {
      const [hour, minute] = look.pick(slots);
      return DateTime.fromMillis(time, { zone }).startOf("day").set({ hour, minute: minute + look.between(0, 2) * 5 }).toMillis();
    };
    const callSlots = [[9, 5], [9, 20], [9, 40], [10, 0], [10, 15], [10, 35], [10, 50], [11, 10], [11, 30], [11, 45], [9, 30], [10, 25], [13, 15], [14, 40], [15, 20]] as const;
    const visitSlots = [[9, 30], [10, 0], [10, 0], [10, 30], [10, 30], [11, 0], [11, 0], [14, 0], [16, 30], [17, 30]] as const;
    const familyNames = Array.from({ length: HOUSEHOLDS }, (_, index) => lastNames[index % lastNames.length]);
    for (let index = familyNames.length - 1; index > 0; index--) { const other = look.between(0, index); [familyNames[index], familyNames[other]] = [familyNames[other], familyNames[index]]; }
    const now = Date.now();
    const churchId = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: zone, sample: true });

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
    // The owner's own part, so "My commitments" and the calendar link have something to show:
    // a help-line morning and a home visit next week.
    const mine = monday.plus({ weeks: 1 });
    await ctx.db.insert("commitments", { churchId, teamId: helpLine, title: "Help line morning", start: mine.plus({ days: 1, hours: 9 }).toMillis(), end: mine.plus({ days: 1, hours: 12 }).toMillis(), location: "Parish office", preparation: "Check the callback list first. Record every call, even a wrong number.", assigneeId: owner, coordinatorId: others[1], version: 1 });
    await ctx.db.insert("commitments", { churchId, teamId: homeVisits, title: "Home visit with Renee Baptiste", start: mine.plus({ days: 3, hours: 10 }).toMillis(), end: mine.plus({ days: 3, hours: 12 }).toMillis(), location: "Meet at the parish office", preparation: "Read the request before you go. Bring the visit sheet. Always go as a pair.", assigneeId: owner, coordinatorId: others[0], version: 1 });
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
    // One shift nobody has taken yet, on the next Saturday still ahead, so the week has a place waiting for a name.
    const openSaturday = [0, 1].map((week) => monday.plus({ weeks: week, days: 5, hours: 10 })).find((day) => day.toMillis() > now)!;
    await ctx.db.insert("commitments", { churchId, teamId: pantry, title: "Pantry morning", start: openSaturday.toMillis(), end: openSaturday.plus({ hours: 2 }).toMillis(), location: "Parish hall", preparation: "Sort the week's donations and pack food bags.", assigneeId: null, coordinatorId: pantryCrew[0], version: 1 });
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
    const book: { id: Id<"ledgerEntries">; kind: "income" | "expense"; amount: number; date: string; category: string }[] = [];
    const vouchersGiven: { requestId: Id<"assistanceRequests">; time: number; item: string }[] = [];
    const entry = async (kind: "income" | "expense", time: number, amount: number, category: string, payee: string, memo: string, links: { requestId?: Id<"assistanceRequests">; neighborId?: Id<"neighbors">; checkNumber?: string } = {}) => {
      if (kind === "expense") spentByMonth.set(isoDay(time).slice(0, 7), (spentByMonth.get(isoDay(time).slice(0, 7)) ?? 0) + amount);
      const id = await ctx.db.insert("ledgerEntries", { churchId, kind, amount, date: isoDay(time), category, payee, memo, ...links, recordedBy: owner, createdAt: time });
      book.push({ id, kind, amount, date: isoDay(time), category });
      return id;
    };
    await entry("income", start, 420000, "Opening balance", "St. Example Conference", "Balance carried forward");

    let checkNumber = 2041;
    // The payees the conference already uses, by the same names as on its requests and payments.
    const payees = [
      { kind: "landlord", name: "Orchard Street Apartments", address: "200 Orchard St", phone: "(102) 555-0111", notes: "Office open weekdays. Checks to the property manager." },
      { kind: "landlord", name: "Mill Road Rentals", address: "48 Mill Rd", phone: "(102) 555-0112", notes: "" },
      { kind: "utility", name: "City Power & Light", address: "1 Harbor Ave", phone: "(102) 555-0113", notes: "Pledges accepted by phone; ask for the assistance desk." },
      { kind: "utility", name: "County Water Authority", address: "15 Bridge Rd", phone: "(102) 555-0114", notes: "" },
      { kind: "vendor", name: "Corner Family Market", address: "9 Garden St", phone: "(102) 555-0115", notes: "Pantry purchases and grocery cards." },
    ] as const;
    for (const payee of payees) await ctx.db.insert("payees", { churchId, kind: payee.kind, name: payee.name, nameKey: key(payee.name), address: payee.address, phone: payee.phone, email: "", notes: payee.notes, createdBy: owner, createdAt: start });

    // Households, and for each its calls, requests for help, visits in pairs and payments.
    for (let index = 0; index < HOUSEHOLDS; index++) {
      const name = `${firstNames[index]} ${familyNames[index]}`;
      const phone = `(10${index < 100 ? 0 : 1}) 555-01${String(index % 100).padStart(2, "0")}`;
      const firstCall = start + random.between(1, days - 14) * DAY;
      const neighborId = await ctx.db.insert("neighbors", { churchId, name, nameKey: key(name), phone, phoneKey: phone.replace(/\D/g, ""), email: index % 5 === 0 ? `${key(name).replaceAll(" ", ".")}@${emailDomain}` : "", address: `${random.between(10, 980)} ${random.pick(streets)}, Apt ${random.between(1, 24)}`, adults: random.between(1, 3), children: random.between(0, 4), language: index % 4 === 1 ? "es" : index % 9 === 2 ? "ht" : "en", notes: index % 6 === 0 ? "Prefers a call after 5 PM." : "", createdBy: random.pick(staff), createdAt: firstCall });
      const callCount = random.between(1, 4);
      for (let call = 0; call < callCount; call++) {
        const recent = call === callCount - 1 ? recentCalls.get(index) : undefined;
        const planned = clock(firstCall + call * random.between(25, 80) * DAY + random.between(9, 16) * 3600000, callSlots);
        // A household's later calls stop where the calendar does; only the chosen recent cases reach this week.
        if (recent === undefined && planned > now - 3 * DAY) break;
        // A recent call keeps its day and takes a morning time, unless that morning has not come yet.
        const morning = recent !== undefined ? clock(now - recent, callSlots) : planned;
        const takenAt = recent === undefined ? planned : morning < now - 20 * 60000 ? morning : now - recent;
        const age = now - takenAt;
        const need = random.pick(kinds);
        const summary = random.pick(need.summaries);
        const asksForHelp = call === 0 || recent !== undefined || random.next() < 0.7;
        const callId = await ctx.db.insert("calls", { churchId, neighborId, callerName: name, phone, note: asksForHelp ? `${summary}.` : "Called to say thank you and give an update.", callback: recent !== undefined && age < 3 * DAY ? "needed" : asksForHelp ? "done" : "none", takenBy: random.pick(staff), takenAt });
        if (!asksForHelp) continue;
        // A voucher request names what comes off the shelf; nobody is paid, so it carries no amount and no payee.
        const voucher = need.kind === "voucher" ? { item: summary.startsWith("Furniture") ? "Furniture voucher" : "Clothing voucher", quantity: 1 } : undefined;
        // The same numbers are drawn for every kind, so changing one kind's rules leaves the rest of the year as it was.
        const asked = Math.round(random.between(need.low, need.high) / 500) * 500;
        const amountRequested = voucher ? 0 : asked;
        const drawn = age < 6 * DAY ? "open" : age < 13 * DAY ? "approved" : random.pick(["paid", "paid", "paid", "paid", "paid", "paid", "paid", "declined", "closed"] as const);
        const outcome = voucher && drawn === "approved" ? "paid" : drawn;
        const granted = outcome === "approved" || outcome === "paid";
        const share = granted ? Math.min(asked, Math.round((asked * random.between(60, 100)) / 100 / 500) * 500) : undefined;
        const amountApproved = voucher && granted ? 0 : share;
        const decidedAt = outcome === "open" ? undefined : takenAt + random.between(3, 5) * DAY;
        const paidTo = random.pick(need.payees);
        const payeeName = voucher ? "" : paidTo;
        const requestId = await ctx.db.insert("assistanceRequests", { churchId, neighborId, callId, kind: need.kind, summary, amountRequested, amountApproved, ...(voucher ? { voucher } : {}), status: outcome, decisionNote: outcome === "declined" ? "Referred to the county program, which covers this in full." : outcome === "closed" ? "Neighbor resolved it before the visit." : granted ? "Approved after the home visit." : "", decidedBy: decidedAt ? owner : undefined, decidedAt, payeeKind: need.payeeKind, payeeName, source: index % 8 === 3 ? "ai_draft" : "person", createdBy: random.pick(staff), createdAt: takenAt });
        if (voucher && outcome === "paid") vouchersGiven.push({ requestId, time: decidedAt ?? takenAt, item: voucher.item });
        if (outcome !== "closed") {
          const first = random.between(0, visitors.length - 1);
          const pair = [visitors[first], visitors[(first + random.between(1, visitors.length - 1)) % visitors.length]];
          const scheduledAt = clock(takenAt + random.between(1, 2) * DAY, visitSlots);
          const done = scheduledAt < now && outcome !== "open";
          const hours = random.between(2, 5) / 2, miles = random.between(4, 22);
          await ctx.db.insert("visits", { churchId, neighborId, requestId, scheduledAt: done ? scheduledAt : Math.max(scheduledAt, clock(now + random.between(1, 3) * DAY, visitSlots)), status: done ? "completed" : "scheduled", visitors: pair.map((memberId) => ({ memberId, hours: done ? hours : 0, miles: done ? miles : 0 })), notes: done ? look.pick(visitNotes) : "", completedAt: done ? scheduledAt + 2 * 3600000 : undefined, createdBy: owner, createdAt: takenAt });
        }
        if (outcome === "paid" && amountApproved && decidedAt && !voucher)
          await entry("expense", decidedAt + DAY, amountApproved, need.kind, payeeName, "", { requestId, neighborId, ...(need.kind === "food" || need.kind === "voucher" ? {} : { checkNumber: String(checkNumber++) }) });
      }
    }

    // Calls that never became a household: about three a month.
    for (let call = 0; call < Math.floor(days / 10); call++) {
      const takenAt = clock(start + call * 10 * DAY + random.between(1, 8) * DAY + random.between(9, 16) * 3600000, callSlots);
      if (takenAt > now - DAY) break;
      await ctx.db.insert("calls", { churchId, callerName: "No name given", phone: "", note: random.pick(strangers), callback: "none", takenBy: random.pick(staff), takenAt });
    }

    // This week's returned calls from people who are not a household here, so the help line shows how a call ends.
    const returned = [
      { callerName: "Stefan Orlov", phone: "(102) 555-0101", note: "Asked for help with rent. Lives across the county line.", outcome: "Outside our area, referred to 211.", daysAgo: 4 },
      { callerName: "Imani Nwosu", phone: "(102) 555-0102", note: "Asked when the pantry is open.", outcome: "Saturdays, 10 to noon. No request needed.", daysAgo: 3 },
      { callerName: "Leon Pemberton", phone: "(102) 555-0103", note: "Called to thank the two visitors who came in October.", outcome: "Passed his thanks on to the pair.", daysAgo: 2 },
    ];
    for (const [index, call] of returned.entries()) {
      const takenAt = clock(now - call.daysAgo * DAY, callSlots);
      await ctx.db.insert("calls", { churchId, callerName: call.callerName, phone: call.phone, note: call.note, callback: "done", takenBy: staff[index % staff.length], takenAt, ownerId: staff[(index + 1) % staff.length], returnedBy: staff[(index + 1) % staff.length], returnedAt: clock(takenAt + DAY, callSlots), outcome: call.outcome });
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
    // The conference's own kinds: one in, one out, each used once.
    await ctx.db.insert("ledgerKinds", { churchId, direction: "income", name: "Bake sale", nameKey: "bake sale", recordedBy: owner, createdAt: on(months[5], 3) });
    await ctx.db.insert("ledgerKinds", { churchId, direction: "expense", name: "Bus tokens", nameKey: "bus tokens", recordedBy: owner, createdAt: on(months[5], 3) });
    await entry("income", on(months[6], 14), 38600, "Bake sale", "Parish hall table", "Spring bake sale after the 10 o'clock Mass");
    await entry("expense", on(months[7], 8), 12000, "Bus tokens", "County Transit", "Forty tokens for the help line to hand out", { checkNumber: String(checkNumber++) });
    for (const month of months) {
      const spent = spentByMonth.get(month.toFormat("yyyy-MM")) ?? 0;
      if (on(month, 2) < now) await entry("income", on(month, 2), Math.max(150000, Math.round((spent * random.between(90, 102)) / 100 / 500) * 500), "Parish collection", "St. Example Parish", "Fifth-Sunday and poor-box collection");
      if (month.month % 3 !== 0 && on(month, 10) < now) await entry("income", on(month, 10), random.between(20, 75) * 1000, "Donation", "Anonymous gift", "Designated for rent and utilities");
      if (month.month === 9 && on(month, 27) < now) await entry("income", on(month, 27), random.between(380, 520) * 1000, "Friends of the Poor Walk", "Walk pledges", "Pledges collected after the walk");
    }
    // A small gift this month, so a few gifts are waiting to go to the bank.
    if (now - 2 * DAY > today.startOf("month").toMillis()) await entry("income", now - 2 * DAY, 7500, "Donation", "Parish family", "Left at the parish office");

    // The bank side. Everything before last month has cleared, month by month, and the last six
    // of those months have a kept statement that agrees with the ledger. Last month and this month
    // are still to be matched.
    const lastMonth = today.startOf("month").minus({ months: 1 });
    const monthEnd = (date: string) => DateTime.fromISO(date, { zone }).endOf("month").toFormat("yyyy-MM-dd");
    const cutoff = lastMonth.toFormat("yyyy-MM-dd");
    for (const line of book) if (line.date < cutoff) await ctx.db.patch("ledgerEntries", line.id, { clearedOn: monthEnd(line.date) });
    const signed = (line: (typeof book)[number]) => (line.kind === "income" ? line.amount : -line.amount);
    for (const month of months.filter((month) => month < lastMonth).slice(-6)) {
      const endsOn = month.endOf("month").toFormat("yyyy-MM-dd");
      const balance = book.reduce((sum, line) => (line.date <= endsOn ? sum + signed(line) : sum), 0);
      await ctx.db.insert("bankStatements", { churchId, endsOn, balance, agreedBy: owner, agreedAt: month.endOf("month").plus({ days: 5 }).toMillis() });
    }

    // Two deposits: the month before last (cleared with its statement) and last month (not yet matched).
    // This month's gifts stay undeposited.
    const gifts = (month: DateTime) => book.filter((line) => line.kind === "income" && line.category !== "Opening balance" && line.date.startsWith(month.toFormat("yyyy-MM")));
    for (const month of [lastMonth.minus({ months: 1 }), lastMonth]) {
      const carried = gifts(month);
      if (!carried.length) continue;
      const date = carried.reduce((latest, line) => (line.date > latest ? line.date : latest), carried[0].date);
      const depositId = await ctx.db.insert("deposits", { churchId, date, total: carried.reduce((sum, line) => sum + line.amount, 0), memo: "Carried to the bank after the collection was counted", recordedBy: owner, createdAt: DateTime.fromISO(date, { zone }).toMillis() });
      for (const line of carried) await ctx.db.patch("ledgerEntries", line.id, { depositId });
    }

    // The voucher shelf: two lots received from the thrift store, one given on each granted voucher request.
    const shelf = (time: number, change: number, item: string, note: string, requestId?: Id<"assistanceRequests">) =>
      ctx.db.insert("voucherStock", { churchId, date: isoDay(time), change, item, note, ...(requestId ? { requestId } : {}), recordedBy: owner, createdAt: time });
    await shelf(start + DAY, 40, "Furniture voucher", "From the conference thrift store");
    await shelf(start + DAY, 40, "Clothing voucher", "From the conference thrift store");
    for (const given of vouchersGiven) await shelf(Math.min(given.time, now), -1, given.item, "Given on a request", given.requestId);

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
      ctx.db.query("requestDrafts").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("assistanceRequests").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("calls").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("calendarFeeds").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("payees").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("outbox").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("meetings").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("meetingResponses").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
      ctx.db.query("series").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect(),
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
    // Two tables are reached only through their parent: a meeting's invitees and a commitment's history.
    for (const meeting of await ctx.db.query("meetings").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect())
      for (const invitee of await ctx.db.query("meetingInvitees").withIndex("by_meeting_member", (q) => q.eq("meetingId", meeting._id)).collect()) await ctx.db.delete(invitee._id);
    for (const commitment of await ctx.db.query("commitments").withIndex("by_church", (q) => q.eq("churchId", churchId)).collect())
      for (const change of await ctx.db.query("commitmentHistory").withIndex("by_commitment", (q) => q.eq("commitmentId", commitment._id)).collect()) await ctx.db.delete(change._id);
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
