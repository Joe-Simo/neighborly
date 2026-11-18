import { v } from "convex/values";
import { DateTime } from "luxon";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { WAITING_KEPT } from "./counts";

type TableName = TableNames;
type Row = { table: TableName; doc: Doc<TableName> };
/** What the made-up year is written through: the database itself, or the plan of the nightly reset. */
type SampleDb = Pick<MutationCtx["db"], "insert" | "get" | "patch">;
const owner = v.object({ userId: v.id("users"), name: v.string(), email: v.string() });
type Owner = typeof owner.type;

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
// A write-up is put together from three short parts: how the visit went, what the pair saw for this need,
// and what happens next. The parts turn with the household and its visit, so neighbors read side by side
// never say the same thing. Short, about the need and the home, never a judgment of the person.
const visitOpenings = [
  "Visited together.",
  "Met at the kitchen table.",
  "Short visit at the door, as asked.",
  "Two children at home during the visit.",
  "Lives alone, second floor, no lift.",
  "A grown son translated for us.",
  "New to the parish; explained how the conference helps.",
  "Follow-up visit after last month's help.",
  "Met on the porch; the apartment is being painted.",
  "Grandmother raising two grandchildren.",
];
const visitFindings: Record<string, readonly string[]> = {
  rent: ["Read the lease together and saw the past-due notice.", "The landlord confirmed the amount by phone while we were there.", "Lost hours at work last month; a full schedule starts again soon.", "The notice gives until the 15th before a late fee.", "Asked only for this month's rent, not the arrears."],
  utility: ["Saw the shut-off notice and called the utility to confirm the balance.", "The bill matches what was told to the help line.", "The furnace runs on gas; the bill doubled with the cold.", "A payment plan is set up for the rest of the balance.", "Copied the account number from the bill for the pledge."],
  food: ["The pantry shelf was nearly empty; a bag was left today.", "Payday is next Friday; asked for groceries until then.", "A child has a dairy allergy; noted for the next bag.", "Gave the pantry hours and the bus that stops nearby.", "The fridge works again after last week's repair."],
  voucher: ["Moved in this month with little furniture; beds are the need.", "The children need winter coats; sizes written down.", "A mattress and a table are what is missing.", "Took the voucher to the thrift store together.", "Clothing for a new job that starts Monday."],
  other: ["The prescription is ready at the pharmacy; the co-pay is the gap.", "Needs a bus pass to reach a new job across town.", "Saw the pharmacy receipt and the doctor's note.", "The job starts next week; the pass covers the first month.", "Asked for help with this one bill only."],
};
const visitClosings = [
  "Payment goes to the payee directly.",
  "The request goes to the conference on Tuesday.",
  "We prayed together before leaving.",
  "Prefers a phone call before any visit.",
  "Left the pantry hours and our number.",
  "Will check in again in two weeks.",
  "Bill seen and copied for the treasurer.",
  "Grateful; asked us to thank the parish.",
];
/** One household's write-up for its `visit`th visit; `draw` is the one random number the visit already spends on it. */
function visitNote(household: number, visit: number, kind: string, draw: number) {
  const findings = visitFindings[kind] ?? visitFindings.other;
  const turn = Math.floor(draw * 400_000) + household * 7 + visit;
  return [
    visitOpenings[turn % visitOpenings.length],
    findings[Math.floor(turn / visitOpenings.length) % findings.length],
    visitClosings[Math.floor(turn / (visitOpenings.length * findings.length)) % visitClosings.length],
  ].join(" ");
}
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

/** Writes the whole made-up year through `db`: the real database, or the plan `renew` compares with what is there. */
async function fill(db: SampleDb, visitor?: Owner, now = Date.now()): Promise<Id<"churches">> {
  // The conference's running figures (convex/counts.ts) are counted as the sample is laid, and written last.
  const figures = { households: 0, waiting: [] as Id<"neighbors">[] };
  const laying = db;
  db = {
    ...laying,
    insert: (async (table: string, doc: Record<string, unknown>) => {
      if (table === "neighbors") figures.households++;
      // Requests are laid with their final state; none is patched afterwards.
      if (table === "assistanceRequests" && doc.status === "open") figures.waiting.push(doc.neighborId as Id<"neighbors">);
      return laying.insert(table as never, doc as never);
    }) as SampleDb["insert"],
    get: laying.get.bind(laying),
    patch: laying.patch.bind(laying),
  };
  // The year that has closed holds still: whatever day the sample is loaded, the same households, calls,
  // requests, visits and payments come out for it, so its yearly report reads the same to the dollar.
  // Only what is recent moves with today. That is why every household draws from a stream of its own
  // (what today cuts short in one never shifts another), and so does each month of other money.
  // A second stream is for how things read (names, times of day, visit notes), so money and counts keep their own draws.
  const look = generator(4127);
  type Stream = ReturnType<typeof generator>;
  // A believable time on the same day: the help line mostly in the morning, visits mid-morning or late afternoon.
  const clockFrom = (stream: Stream) => (time: number, slots: readonly (readonly [number, number])[]) => {
    const [hour, minute] = stream.pick(slots);
    return DateTime.fromMillis(time, { zone }).startOf("day").set({ hour, minute: minute + stream.between(0, 2) * 5 }).toMillis();
  };
  const clock = clockFrom(look);
  const callSlots = [[9, 5], [9, 20], [9, 40], [10, 0], [10, 15], [10, 35], [10, 50], [11, 10], [11, 30], [11, 45], [9, 30], [10, 25], [13, 15], [14, 40], [15, 20]] as const;
  const visitSlots = [[9, 30], [10, 0], [10, 0], [10, 30], [10, 30], [11, 0], [11, 0], [14, 0], [16, 30], [17, 30]] as const;
  // The planned visits tell the whole story of a pair: both said yes, nobody has answered, one answer in.
  const pairAnswers = [["accepted", "accepted"], ["pending", "pending"], ["accepted", "pending"], ["accepted", "declined"], ["accepted", "accepted"]] as const;
  // Visits still ahead are in the afternoon, so the coming mornings stay free for a pair to be offered.
  const plannedSlots = [[13, 30], [14, 0], [15, 30], [16, 30], [17, 30]] as const;
  let plannedVisits = 0;
  const households: Id<"neighbors">[] = [];
  const familyNames = Array.from({ length: HOUSEHOLDS }, (_, index) => lastNames[index % lastNames.length]);
  for (let index = familyNames.length - 1; index > 0; index--) { const other = look.between(0, index); [familyNames[index], familyNames[other]] = [familyNames[other], familyNames[index]]; }
  const churchId = await db.insert("churches", { name: "St. Example Conference", timeZone: zone, sample: true, wordSet: "vincentian" });

  // People. Without a real owner account, the first volunteer owns the group.
  const members: Id<"memberships">[] = [];
  if (visitor) members.push(await db.insert("memberships", { churchId, userId: visitor.userId, name: visitor.name, email: visitor.email, role: "owner", active: true, approved: true, coverOptIn: true }));
  for (const [index, name] of volunteerNames.entries()) {
    const role = members.length === 0 ? "owner" : index < 3 ? "coordinator" : "member";
    members.push(await db.insert("memberships", { churchId, userId: await db.insert("users", {}), name, email: `${key(name).replaceAll(" ", ".")}@${emailDomain}`, role, active: true, approved: true, coverOptIn: index % 2 === 0, language: index % 4 === 1 ? "es" : "en" }));
  }
  const [owner, ...others] = members;
  const staff = members.slice(0, 4);
  const visitors = members.slice(1, 9);

  // The volunteer side: two teams, the coming weeks of help-line shifts, availability and one absence.
  const helpLine = await db.insert("teams", { churchId, name: "Help line", description: "Answers the conference phone and returns calls the next morning." });
  const homeVisits = await db.insert("teams", { churchId, name: "Home visitors", description: "Visits neighbors at home, always in pairs." });
  for (const [index, memberId] of others.entries()) {
    await db.insert("teamMembers", { churchId, teamId: index % 2 ? helpLine : homeVisits, memberId, teamRole: index < 2 ? "coordinator" : "member", approved: true, status: "active" });
    if (index < 8) await db.insert("availability", { churchId, memberId, start: isoDay(now), end: isoDay(now + 60 * DAY) });
  }
  const monday = DateTime.fromMillis(now, { zone }).startOf("week");
  // Two states a leader meets at the door, kept apart from the twelve so no turn, pair or count above moves:
  // one person who has joined and is not yet marked ready to serve, and one invitation still waiting for its answer.
  // Both are invented, on the reserved example domain, and nothing is queued to be sent.
  const newcomer = await db.insert("memberships", { churchId, userId: await db.insert("users", {}), name: "Lucia Ferreira", email: `lucia.ferreira@${emailDomain}`, role: "member", active: true, approved: false, coverOptIn: false, language: "en" });
  await db.insert("invitations", { churchId, email: `ana.duarte@${emailDomain}`, role: "member", tokenHash: "sample-invitation-opens-nothing", expiresAt: now + 6 * DAY, status: "pending", createdBy: owner, createdAt: now - DAY, requestId: "sample-invitation-0001" });
  const passed: { start: number; assigneeId: Id<"memberships"> }[] = [];
  for (let week = 0; week < 5; week++) for (const [slot, weekday] of [1, 3, 5].entries()) {
    const start = monday.plus({ weeks: week, days: weekday - 1, hours: 9 }).toMillis();
    // This week's mornings that have passed are written after the coming ones, below.
    if (start < now) { passed.push({ start, assigneeId: others[(week * 3 + slot) % others.length] }); continue; }
    await db.insert("commitments", { churchId, teamId: helpLine, title: "Help line morning", start, end: start + 3 * 3600000, location: "Parish office", preparation: "Check the callback list first. Record every call, even a wrong number.", assigneeId: week === 4 ? null : others[(week * 3 + slot) % others.length], coordinatorId: others[1], version: 1 });
  }
  // The owner's own part, so "My commitments" and the calendar link have something to show:
  // a help-line morning and a home visit next week.
  const mine = monday.plus({ weeks: 1 });
  await db.insert("commitments", { churchId, teamId: helpLine, title: "Help line morning", start: mine.plus({ days: 1, hours: 9 }).toMillis(), end: mine.plus({ days: 1, hours: 12 }).toMillis(), location: "Parish office", preparation: "Check the callback list first. Record every call, even a wrong number.", assigneeId: owner, coordinatorId: others[1], version: 1 });
  await db.insert("commitments", { churchId, teamId: homeVisits, title: "Home visit with Renee Baptiste", start: mine.plus({ days: 3, hours: 10 }).toMillis(), end: mine.plus({ days: 3, hours: 12 }).toMillis(), location: "Meet at the parish office", preparation: "Read the request before you go. Bring the visit sheet. Always go as a pair.", assigneeId: owner, coordinatorId: others[0], version: 1 });
  // Today on the help line: the morning is covered and the afternoon still has an open place, whatever day the sample is loaded.
  const todayStart = DateTime.fromMillis(now, { zone }).startOf("day");
  const helpLineToday = async (hour: number, hours: number, assigneeId: Id<"memberships"> | null) => {
    const start = todayStart.plus({ hours: hour }).toMillis();
    // A Monday, Wednesday or Friday already has its morning above.
    if (hour === 9 && [1, 3, 5].includes(todayStart.weekday)) return;
    await db.insert("commitments", { churchId, teamId: helpLine, title: hour === 9 ? "Help line morning" : "Help line afternoon", start, end: start + hours * 3600000, location: "Parish office", preparation: "Check the callback list first. Record every call, even a wrong number.", assigneeId, coordinatorId: others[1], version: 1 });
  };
  await helpLineToday(9, 3, others[3]);
  // The afternoon's place stays open only while it is still ahead; a turn that has ended always has a name on it.
  await helpLineToday(13, 3, todayStart.plus({ hours: 16 }).toMillis() > now ? null : others[5]);
  // This week's mornings already past, so the week by team is never empty on its last days.
  for (const shift of passed) await db.insert("commitments", { churchId, teamId: helpLine, title: "Help line morning", start: shift.start, end: shift.start + 3 * 3600000, location: "Parish office", preparation: "", assigneeId: shift.assigneeId, coordinatorId: others[1], version: 1 });
  // A year of finished shifts, so hours by team have something to add up: the help line twice a week
  // and the pantry on Saturdays. Kept under the 200 the overview reads, after the coming weeks above.
  const pantry = await db.insert("teams", { churchId, name: "Pantry", description: "Sorts donations and packs food bags on Saturday mornings." });
  const pantryCrew = others.slice(6, 11);
  for (const [index, memberId] of pantryCrew.entries()) await db.insert("teamMembers", { churchId, teamId: pantry, memberId, teamRole: index === 0 ? "coordinator" : "member", approved: true, status: "active" });
  // The newcomer has asked for a place on the pantry team and waits for its coordinator.
  await db.insert("teamMembers", { churchId, teamId: pantry, memberId: newcomer, teamRole: "member", approved: false, status: "active" });
  const helpLineCrew = others.filter((_, index) => index % 2 === 1);
  // The closed fiscal year's shifts are every week of that year, counted from its own first Monday, so its
  // hours read the same whatever day the sample is loaded. This year keeps only its last twelve weeks, so the
  // whole stays under the 200 commitments the overview reads.
  const fiscalStart = DateTime.fromMillis(now, { zone }).set({ month: 10, day: 1 }).startOf("day");
  const closedStart = (DateTime.fromMillis(now, { zone }).month >= 10 ? fiscalStart : fiscalStart.minus({ years: 1 })).minus({ years: 1 });
  const openStart = closedStart.plus({ years: 1 });
  const firstWeek = closedStart.startOf("week");
  for (let week = 0, monday0 = firstWeek; monday0 < monday; week++, monday0 = firstWeek.plus({ weeks: week })) {
    const closed = monday0 < openStart;
    if (!closed && monday0 < monday.minus({ weeks: 12 })) continue;
    const day = (offset: number, hour: number) => monday0.plus({ days: offset, hours: hour });
    for (const [slot, weekday] of [2, 4].entries()) {
      const at = day(weekday - 1, 9);
      // A shift on the far side of the year's first day belongs to the year before, which the sample does not hold.
      if (at < closedStart) continue;
      const start = at.toMillis();
      await db.insert("commitments", { churchId, teamId: helpLine, title: "Help line morning", start, end: start + 3 * 3600000, location: "Parish office", preparation: "", assigneeId: helpLineCrew[(week * 2 + slot) % helpLineCrew.length], coordinatorId: others[1], version: 1 });
    }
    const saturdayAt = day(5, 10);
    if (saturdayAt < closedStart) continue;
    const saturday = saturdayAt.toMillis();
    await db.insert("commitments", { churchId, teamId: pantry, title: "Pantry morning", start: saturday, end: saturday + 2 * 3600000, location: "Parish hall", preparation: "", assigneeId: pantryCrew[week % pantryCrew.length], coordinatorId: pantryCrew[0], version: 1 });
  }
  // One shift nobody has taken yet, on the next Saturday still ahead, so the week has a place waiting for a name.
  const openSaturday = [0, 1].map((week) => monday.plus({ weeks: week, days: 5, hours: 10 })).find((day) => day.toMillis() > now)!;
  const openShift = await db.insert("commitments", { churchId, teamId: pantry, title: "Pantry morning", start: openSaturday.toMillis(), end: openSaturday.plus({ hours: 2 }).toMillis(), location: "Parish hall", preparation: "Sort the week's donations and pack food bags.", assigneeId: null, coordinatorId: pantryCrew[0], version: 1 });
  // The owner has been asked to take it and has not answered yet, so there is always a commitment waiting for a reply.
  await db.insert("teamMembers", { churchId, teamId: pantry, memberId: owner, teamRole: "member", approved: true, status: "active" });
  // The owner has offered the coming two weeks, which cover that shift and their own commitments, so a yes goes through.
  await db.insert("availability", { churchId, memberId: owner, start: isoDay(now), end: isoDay(now + 14 * DAY) });
  await db.insert("requests", { churchId, commitmentId: openShift, recipientId: owner, commitmentVersion: 1, status: "pending" });
  await db.insert("timeOff", { churchId, memberId: others[5], start: isoDay(now + 9 * DAY), end: isoDay(now + 16 * DAY), note: "Visiting family." });
  // The owner's own days away this month, two days clear of their commitments and of the shift they are asked to take,
  // so the month in Time off has something marked. Ahead if the month allows, else just behind.
  const taken = new Set([mine.plus({ days: 1 }), mine.plus({ days: 3 }), openSaturday].map((day) => day.toFormat("yyyy-MM-dd")));
  const monthDays = Array.from({ length: todayStart.daysInMonth ?? 30 }, (_, index) => todayStart.startOf("month").plus({ days: index }));
  const free = (day: DateTime) => !taken.has(day.toFormat("yyyy-MM-dd"));
  const pairs = monthDays.slice(0, -1).filter((day, index) => free(day) && free(monthDays[index + 1]));
  const away = pairs.find((day) => day > todayStart.plus({ days: 4 })) ?? pairs.filter((day) => day < todayStart.minus({ days: 2 })).pop();
  if (away) await db.insert("timeOff", { churchId, memberId: owner, start: away.toFormat("yyyy-MM-dd"), end: away.plus({ days: 1 }).toFormat("yyyy-MM-dd"), note: "Away with family." });
  // The next conference meeting, with everyone invited and the owner yet to answer.
  const meetingStart = monday.plus({ weeks: 1, days: 1, hours: 19 });
  const meetingId = await db.insert("meetings", { churchId, fanoutStatus: "complete", cutoff: now, title: "Conference meeting", start: meetingStart.toMillis(), end: meetingStart.plus({ hours: 1 }).toMillis(), location: "Parish hall, room 2" });
  for (const [index, memberId] of members.entries()) {
    await db.insert("meetingInvitees", { churchId, meetingId, memberId });
    if (memberId !== owner && index % 3 !== 2) await db.insert("meetingResponses", { churchId, meetingId, memberId, response: index % 5 === 4 ? "declined" : "accepted" });
  }
  await db.insert("tasks", { churchId, title: "Restock the food pantry shelf", dueAt: now + 4 * DAY, assigneeId: others[4], complete: false });
  await db.insert("tasks", { churchId, title: "Bring the visit sheets to Tuesday's meeting", dueAt: now + 6 * DAY, assigneeId: others[4], complete: false });
  await db.insert("tasks", { churchId, title: "Send thank-you notes for the fall collection", dueAt: null, assigneeId: others[2], complete: true });
  await db.insert("announcements", { churchId, title: "Winter coat drive starts next week", body: "Bring coats to the parish office. Home visitors, ask each family for sizes.", authorId: owner, createdAt: now - 2 * DAY });

  // From the start of the last full fiscal year (October 1) to today, so that year and every
  // month since has activity and no earlier year is left with a sliver.
  const today = DateTime.fromMillis(now, { zone });
  const thisFiscalYear = (today.month >= 10 ? today : today.minus({ years: 1 })).set({ month: 10, day: 1 }).startOf("day");
  const firstMonth = thisFiscalYear.minus({ years: 1 });
  const start = firstMonth.toMillis();
  const days = Math.floor((now - start) / DAY);
  // The closed year's own length in days. First calls are drawn inside it, never from how far today has come.
  const closedDays = Math.round(thisFiscalYear.diff(firstMonth, "days").days);
  const spentByMonth = new Map<string, number>();
  const book: { id: Id<"ledgerEntries">; kind: "income" | "expense"; amount: number; date: string; category: string }[] = [];
  const vouchersGiven: { requestId: Id<"assistanceRequests">; time: number; item: string }[] = [];
  const entry = async (kind: "income" | "expense", time: number, amount: number, category: string, payee: string, memo: string, links: { requestId?: Id<"assistanceRequests">; neighborId?: Id<"neighbors">; checkNumber?: string } = {}) => {
    if (kind === "expense") spentByMonth.set(isoDay(time).slice(0, 7), (spentByMonth.get(isoDay(time).slice(0, 7)) ?? 0) + amount);
    const id = await db.insert("ledgerEntries", { churchId, kind, amount, date: isoDay(time), category, payee, memo, ...links, recordedBy: owner, createdAt: time });
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
  for (const payee of payees) await db.insert("payees", { churchId, kind: payee.kind, name: payee.name, nameKey: key(payee.name), address: payee.address, phone: payee.phone, email: "", notes: payee.notes, createdBy: owner, createdAt: start });

  // Households, and for each its calls, requests for help, visits in pairs and payments.
  for (let index = 0; index < HOUSEHOLDS; index++) {
    const random = generator(1833 + index * 7919), look = generator(4127 + index * 104729), clock = clockFrom(look);
    const name = `${firstNames[index]} ${familyNames[index]}`;
    const phone = `(10${index < 100 ? 0 : 1}) 555-01${String(index % 100).padStart(2, "0")}`;
    const firstCall = start + random.between(1, closedDays - 14) * DAY;
    const neighborId = await db.insert("neighbors", { churchId, name, nameKey: key(name), phone, phoneKey: phone.replace(/\D/g, ""), email: index % 5 === 0 ? `${key(name).replaceAll(" ", ".")}@${emailDomain}` : "", address: `${random.between(10, 980)} ${random.pick(streets)}, Apt ${random.between(1, 24)}`, adults: random.between(1, 3), children: random.between(0, 4), language: index % 4 === 1 ? "es" : index % 9 === 2 ? "ht" : "en", notes: index % 6 === 0 ? "Prefers a call after 5 PM." : "", createdBy: random.pick(staff), createdAt: firstCall });
    households.push(neighborId);
    const callCount = random.between(1, 4);
    let written = 0;
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
      const taker = random.pick(staff);
      const callId = await db.insert("calls", { churchId, neighborId, callerName: name, phone, note: asksForHelp ? `${summary}.` : "Called to say thank you and give an update.", callback: recent !== undefined && age < 3 * DAY ? "needed" : asksForHelp ? "done" : "none", takenBy: taker, takenAt });
      if (!asksForHelp) continue;
      // A voucher request names what comes off the shelf; nobody is paid, so it carries no amount and no payee.
      const voucher = need.kind === "voucher" ? { item: summary.startsWith("Furniture") ? "Furniture voucher" : "Clothing voucher", quantity: 1 } : undefined;
      // The same numbers are drawn for every kind, so changing one kind's rules leaves the rest of the year as it was.
      const asked = Math.round(random.between(need.low, need.high) / 500) * 500;
      const amountRequested = voucher ? 0 : asked;
      // Drawn for every request, so a recent one that is still open today settles the same way once it is old.
      const settled = random.pick(["paid", "paid", "paid", "paid", "paid", "paid", "paid", "declined", "closed"] as const);
      const drawn = age < 6 * DAY ? "open" : age < 13 * DAY ? "approved" : settled;
      const outcome = voucher && drawn === "approved" ? "paid" : drawn;
      const granted = outcome === "approved" || outcome === "paid";
      const share = granted ? Math.min(asked, Math.round((asked * random.between(60, 100)) / 100 / 500) * 500) : undefined;
      const amountApproved = voucher && granted ? 0 : share;
      const decidedAt = outcome === "open" ? undefined : takenAt + random.between(3, 5) * DAY;
      const paidTo = random.pick(need.payees);
      // A utility bill is paid to the company whose bill it is (each summary sits beside its company); the draw stays.
      const payeeName = voucher ? "" : need.kind === "utility" ? need.payees[(need.summaries as readonly string[]).indexOf(summary)] ?? paidTo : paidTo;
      // The one who took the call files its request. The draw stays, so every number after it is as pinned.
      random.pick(staff);
      const requestId = await db.insert("assistanceRequests", { churchId, neighborId, callId, kind: need.kind, summary, amountRequested, amountApproved, ...(voucher ? { voucher } : {}), status: outcome, decisionNote: outcome === "declined" ? "Referred to the county program, which covers this in full." : outcome === "closed" ? "Neighbor resolved it before the visit." : granted ? "Approved after the home visit." : "", decidedBy: decidedAt ? owner : undefined, decidedAt, payeeKind: need.payeeKind, payeeName, source: index % 8 === 3 ? "ai_draft" : "person", createdBy: taker, createdAt: takenAt });
      if (voucher && outcome === "paid") vouchersGiven.push({ requestId, time: decidedAt ?? takenAt, item: voucher.item });
      if (outcome !== "closed") {
        const first = random.between(0, visitors.length - 1);
        const pair = [visitors[first], visitors[(first + random.between(1, visitors.length - 1)) % visitors.length]];
        const scheduledAt = clock(takenAt + random.between(1, 2) * DAY, visitSlots);
        const done = scheduledAt < now && outcome !== "open";
        // Counted after this visit is written, so the first planned visit takes the first pair of answers.
        const planned = done ? 0 : plannedVisits++;
        const hours = random.between(2, 5) / 2, miles = random.between(4, 22);
        await db.insert("visits", { churchId, neighborId, requestId, scheduledAt: done ? scheduledAt : Math.max(scheduledAt, clock(now + random.between(1, 3) * DAY, plannedSlots)), status: done ? "completed" : "scheduled", visitors: pair.map((memberId, seat) => ({ memberId, hours: done ? hours : 0, miles: done ? miles : 0, ...(done ? {} : { response: pairAnswers[Math.min(planned, pairAnswers.length - 1)][seat] }) })), notes: done ? visitNote(index, written++, need.kind, look.next()) : "", completedAt: done ? scheduledAt + 2 * 3600000 : undefined, createdBy: owner, createdAt: takenAt });
      }
      if (outcome === "paid" && amountApproved && decidedAt && !voucher)
        await entry("expense", decidedAt + DAY, amountApproved, need.kind, payeeName, "", { requestId, neighborId, ...(need.kind === "food" || need.kind === "voucher" ? {} : { checkNumber: String(checkNumber++) }) });
    }
  }

  // Calls that never became a household: about three a month.
  const random = generator(613);
  for (let call = 0; call < Math.floor(days / 10); call++) {
    const takenAt = clock(start + call * 10 * DAY + random.between(1, 8) * DAY + random.between(9, 16) * 3600000, callSlots);
    if (takenAt > now - DAY) break;
    await db.insert("calls", { churchId, callerName: "No name given", phone: "", note: random.pick(strangers), callback: "none", takenBy: random.pick(staff), takenAt });
  }

  // The fuller record, written after the year's draws with its own stream so no figure above moves:
  // where the conference sends people it cannot help itself, and on some households who lives there,
  // the accounts a bill is paid to, what members have noted, and a word of caution to read first.
  const extra = generator(2207);
  const places = [
    { name: "County Energy Assistance", phone: "(102) 555-0121", helpsWith: "Electric and gas bills, once a year for each household" },
    { name: "Harbor Community Food Bank", phone: "(102) 555-0122", helpsWith: "Groceries on Tuesdays and Thursdays, no appointment" },
    { name: "211 Help Line", phone: "(102) 555-0123", helpsWith: "Any need outside our area, day or night" },
    { name: "Legal Aid of the Valley", phone: "(102) 555-0124", helpsWith: "Eviction notices and tenant questions" },
    { name: "St. Example Parish Nurse", phone: "(102) 555-0125", helpsWith: "Prescriptions, blood pressure checks, rides to the clinic" },
    { name: "County Housing Office", phone: "(102) 555-0126", helpsWith: "Rent help over what a conference can give, and the waiting list for housing" },
  ];
  for (const place of places) await db.insert("referralAgencies", { churchId, ...place });
  // A third of the households say who lives there, in step with the adults and children already counted.
  const thisYear = today.year;
  const elders = ["Mother", "Father", "Grandmother", "Husband", "Wife", "Sister", "Brother", "Aunt"];
  for (let index = 0; index < HOUSEHOLDS; index += 3) {
    const neighbor = await db.get("neighbors", households[index]);
    if (!neighbor) continue;
    const adults = Array.from({ length: neighbor.adults }, (_, seat) => ({ relationship: seat === 0 ? "Head of household" : extra.pick(elders), child: false, birthYear: thisYear - extra.between(24, 78) }));
    const young = Array.from({ length: neighbor.children }, () => ({ relationship: extra.pick(["Son", "Daughter", "Grandson", "Granddaughter"]), child: true, birthYear: thisYear - extra.between(1, 16) }));
    await db.patch("neighbors", neighbor._id, { household: [...adults, ...young] });
  }
  // The accounts, cautions and notes sit on households that also say who lives there, so one record shows it all.
  // The accounts a bill is paid to, on a dozen households. Invented numbers; only the last four ever show.
  const billed = [
    { kind: "utility", name: "City Power & Light", phone: "(102) 555-0113" },
    { kind: "utility", name: "County Water Authority", phone: "(102) 555-0114" },
    { kind: "landlord", name: "Orchard Street Apartments", phone: "(102) 555-0111" },
    { kind: "landlord", name: "Mill Road Rentals", phone: "(102) 555-0112" },
  ] as const;
  for (let place = 0; place < 12; place++) {
    const first = billed[place % billed.length], second = billed[(place + 2) % billed.length];
    const accounts = (place % 3 === 0 ? [first, second] : [first]).map((account) => ({ ...account, accountNumber: `00-${extra.between(1000, 9999)}-${extra.between(1000, 9999)}` }));
    await db.patch("neighbors", households[place * 18], { accounts });
  }
  // A word to read before calling or visiting, on a handful. About the visit, never a judgment of the person.
  const alerts = ["Hard of hearing. Knock loudly and wait.", "Large dog in the yard. Call from the gate.", "Works nights. Do not call before noon.", "Speaks Spanish only. Send a Spanish speaker.", "Use the side door; the front steps are broken."];
  for (const [place, alert] of alerts.entries()) await db.patch("neighbors", households[9 + place * 36], { alert });
  // What members have noted on twenty records over the year, the plain things a later caller is glad to know.
  const noted = [
    "Called to say the lights stayed on. She asked us to thank the two who came.",
    "Started a new job at the bakery this week. Expects a first full paycheck at the end of the month.",
    "Daughter translates on the phone. Best reached after school lets out.",
    "Brought the lease to the parish office so we could copy it for the file.",
    "Asked for the pantry hours again. Gave them and the food bank's days.",
    "Landlord agreed to wait two weeks once he heard the conference was helping.",
    "Hours at work are back to full. Says this should be the last time he needs to ask.",
    "Moved to the first floor of the same building. Address on the record is updated.",
    "Would like a visit from the parish nurse. Passed the request on.",
    "Returned the folding table we lent. Thanked the pantry team.",
    "The county approved the energy grant. Our help covered the month in between.",
    "Asked that we call before visiting. She does not open the door to a knock.",
  ];
  for (let place = 0; place < 20; place++) {
    const neighbor = await db.get("neighbors", households[place * 9]);
    if (!neighbor) continue;
    const span = Math.max(DAY, now - neighbor.createdAt - 2 * DAY);
    for (let note = 0; note < (place % 4 === 0 ? 2 : 1); note++)
      await db.insert("neighborNotes", { churchId, neighborId: neighbor._id, body: noted[(place + note * 5) % noted.length], authorId: extra.pick(staff), createdAt: clock(neighbor.createdAt + DAY + Math.floor(extra.next() * span), callSlots) });
  }

  // Three records for the year check to find, written apart from the loop and its draws, so they
  // fall inside the fiscal year the reports room opens. Two requests were approved and no payment was
  // recorded (one note says a check was sent); one visit's note says it happened and it is not marked done.
  // Four weeks before the closed year ends, on a fixed day, so they never slip out of it and move its totals.
  const findingsAt = thisFiscalYear.toMillis() - 28 * DAY;
  await db.insert("assistanceRequests", { churchId, neighborId: households[2], kind: "rent", summary: "One month's rent after reduced hours at work.", amountRequested: 60000, amountApproved: 60000, status: "approved", decisionNote: "Approved after the home visit. The treasurer sent the check to the landlord on the 12th.", decidedBy: owner, decidedAt: findingsAt + 4 * DAY, payeeKind: "landlord", payeeName: "Mill Road Rentals", source: "person", createdBy: staff[1], createdAt: findingsAt });
  await db.insert("visits", { churchId, neighborId: households[6], scheduledAt: clock(findingsAt + 2 * DAY, visitSlots), status: "scheduled", visitors: [visitors[0], visitors[3]].map((memberId) => ({ memberId, hours: 0, miles: 0, response: "accepted" as const })), notes: "We met with her on Tuesday afternoon. Gave the pantry hours and she will call about the light bill.", createdBy: owner, createdAt: findingsAt });
  await db.insert("assistanceRequests", { churchId, neighborId: households[10], kind: "utility", summary: "Electric bill with a shut-off notice.", amountRequested: 21000, amountApproved: 21000, status: "approved", decisionNote: "Approved after the home visit.", decidedBy: owner, decidedAt: findingsAt + 3 * DAY, payeeKind: "utility", payeeName: "City Power & Light", source: "person", createdBy: staff[1], createdAt: findingsAt });

  // Three more requests approved last week and not yet paid, written apart from the loop and its draws, so the
  // count of approved requests waiting for payment reads clearly apart from the count still waiting for a yes.
  for (const [index, waiting] of ([[30, "rent", "Short on rent after a medical bill", 52500, "landlord", "Orchard Street Apartments", 8], [41, "utility", "Shut-off notice on the electric bill", 18000, "utility", "City Power & Light", 9], [52, "food", "Groceries until the next paycheck", 6500, "vendor", "Corner Family Market", 10]] as const).entries())
    await db.insert("assistanceRequests", { churchId, neighborId: households[waiting[0]], kind: waiting[1], summary: waiting[2], amountRequested: waiting[3], amountApproved: waiting[3], status: "approved", decisionNote: "Approved after the home visit.", decidedBy: owner, decidedAt: clock(now - (waiting[6] - 3) * DAY, callSlots), payeeKind: waiting[4], payeeName: waiting[5], source: "person", createdBy: staff[index % staff.length], createdAt: clock(now - waiting[6] * DAY, callSlots) });

  // A visit made last week and not yet written up, so there is always a recent one waiting for its write-up.
  await db.insert("visits", { churchId, neighborId: households[20], scheduledAt: clock(now - 5 * DAY, visitSlots), status: "scheduled", visitors: [visitors[1], visitors[4]].map((memberId) => ({ memberId, hours: 0, miles: 0, response: "accepted" as const })), notes: "", createdBy: owner, createdAt: now - 8 * DAY });

  // A request with no visit planned yet, so Home visits always has a household waiting for a pair.
  await db.insert("assistanceRequests", { churchId, neighborId: households[14], kind: "utility", summary: "Past-due water bill", amountRequested: 9500, status: "open", decisionNote: "", payeeKind: "utility", payeeName: "County Water Authority", source: "person", createdBy: staff[2], createdAt: clock(now - DAY, callSlots) });

  // A call waiting to be returned whose note names two amounts, so a draft from it leaves the amount for a person.
  await db.insert("calls", { churchId, callerName: "Denise Walker", phone: "(102) 555-0163", note: "Light bill is $145, and $60 is past due from last month.", callback: "needed", takenBy: staff[2], takenAt: clock(now - DAY, callSlots) });

  // A call with a draft already made from it and waiting for a person's yes.
  const drafted = await db.insert("calls", { churchId, callerName: "Rosa Fontaine", phone: "(102) 555-0164", note: "Behind on November rent, $450. The landlord is Mill Road Rentals.", callback: "needed", takenBy: staff[1], takenAt: clock(now - DAY, callSlots) });
  await db.insert("requestDrafts", { churchId, callId: drafted, kind: "rent", amountRequested: 45000, payeeKind: "landlord", payeeName: "Mill Road Rentals", quote: "Behind on November rent, $450.", notes: [], verification: "checked", createdBy: staff[1], createdAt: now - DAY / 2 });

  // This week's returned calls from people who are not a household here, so the help line shows how a call ends.
  const returned = [
    { callerName: "Stefan Orlov", phone: "(102) 555-0101", note: "Asked for help with rent. Lives across the county line.", outcome: "Outside our area, referred to 211.", daysAgo: 4 },
    { callerName: "Imani Nwosu", phone: "(102) 555-0102", note: "Asked when the pantry is open.", outcome: "Saturdays, 10 to noon. No request needed.", daysAgo: 3 },
    { callerName: "Leon Pemberton", phone: "(102) 555-0103", note: "Called to thank the two visitors who came in October.", outcome: "Passed his thanks on to the pair.", daysAgo: 2 },
  ];
  for (const [index, call] of returned.entries()) {
    const takenAt = clock(now - call.daysAgo * DAY, callSlots);
    await db.insert("calls", { churchId, callerName: call.callerName, phone: call.phone, note: call.note, callback: "done", takenBy: staff[index % staff.length], takenAt, ownerId: staff[(index + 1) % staff.length], returnedBy: staff[(index + 1) % staff.length], returnedAt: clock(takenAt + DAY, callSlots), outcome: call.outcome });
  }

  // What the conference spends besides help, then what comes in. Each month's collection is set close
  // to what that month paid out, so the year reads like a conference that gives away what it receives.
  const months = Array.from({ length: Math.floor(today.diff(firstMonth, "months").months) + 1 }, (_, index) => firstMonth.plus({ months: index }));
  const on = (month: DateTime, day: number) => month.set({ day, hour: 12 }).toMillis();
  for (const [index, month] of months.entries()) {
    const random = generator(3001 + index);
    if (on(month, 20) < now) await entry("expense", on(month, 20), random.between(150, 320) * 100, "Pantry purchase", "Corner Family Market", "Shelf-stable food for the pantry");
    if (month.month === 10 && on(month, 12) < now) await entry("expense", on(month, 12), 60000, "Council dues", "District Council", "Annual solidarity contribution");
    if (month.month % 4 === 2 && on(month, 9) < now) await entry("expense", on(month, 9), random.between(40, 110) * 100, "Supplies", "Main Street Office Supply", "Paper, postage and phone line");
  }
  // The conference's own kinds: one in, one out, each used once.
  await db.insert("ledgerKinds", { churchId, direction: "income", name: "Bake sale", nameKey: "bake sale", recordedBy: owner, createdAt: on(months[5], 3) });
  await db.insert("ledgerKinds", { churchId, direction: "expense", name: "Bus tokens", nameKey: "bus tokens", recordedBy: owner, createdAt: on(months[5], 3) });
  await entry("income", on(months[6], 14), 38600, "Bake sale", "Parish hall table", "Spring bake sale after the 10 o'clock Mass");
  await entry("expense", on(months[7], 8), 12000, "Bus tokens", "County Transit", "Forty tokens for the help line to hand out", { checkNumber: String(checkNumber++) });
  for (const [index, month] of months.entries()) {
    const random = generator(5003 + index);
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
  for (const line of book) if (line.date < cutoff) await db.patch("ledgerEntries", line.id, { clearedOn: monthEnd(line.date) });
  const signed = (line: (typeof book)[number]) => (line.kind === "income" ? line.amount : -line.amount);
  for (const month of months.filter((month) => month < lastMonth).slice(-6)) {
    const endsOn = month.endOf("month").toFormat("yyyy-MM-dd");
    const balance = book.reduce((sum, line) => (line.date <= endsOn ? sum + signed(line) : sum), 0);
    await db.insert("bankStatements", { churchId, endsOn, balance, agreedBy: owner, agreedAt: month.endOf("month").plus({ days: 5 }).toMillis() });
  }

  // A deposit for every month before this one: each month's gifts carried to the bank together. Those up
  // to the month before last have cleared with their statements; last month's is not yet matched.
  // This month's gifts stay undeposited.
  const gifts = (month: DateTime) => book.filter((line) => line.kind === "income" && line.category !== "Opening balance" && line.date.startsWith(month.toFormat("yyyy-MM")));
  for (const month of months.filter((month) => month <= lastMonth)) {
    const carried = gifts(month);
    if (!carried.length) continue;
    const date = carried.reduce((latest, line) => (line.date > latest ? line.date : latest), carried[0].date);
    const depositId = await db.insert("deposits", { churchId, date, total: carried.reduce((sum, line) => sum + line.amount, 0), memo: "Carried to the bank after the collection was counted", recordedBy: owner, createdAt: DateTime.fromISO(date, { zone }).toMillis() });
    for (const line of carried) await db.patch("ledgerEntries", line.id, { depositId });
  }

  // The voucher shelf: two lots received from the thrift store, one given on each granted voucher request.
  const shelf = (time: number, change: number, item: string, note: string, requestId?: Id<"assistanceRequests">) =>
    db.insert("voucherStock", { churchId, date: isoDay(time), change, item, note, ...(requestId ? { requestId } : {}), recordedBy: owner, createdAt: time });
  await shelf(start + DAY, 40, "Furniture voucher", "From the conference thrift store");
  await shelf(start + DAY, 40, "Clothing voucher", "From the conference thrift store");
  for (const given of vouchersGiven) await shelf(Math.min(given.time, now), -1, given.item, "Given on a request", given.requestId);
  await laying.patch("churches", churchId, { householdCount: figures.households, waitingCount: figures.waiting.length, waitingHouseholdIds: figures.waiting.slice(0, WAITING_KEPT) });

  return churchId;
}

/**
 * The made-up year as a plan: every row `fill` would write, held in memory under stand-in ids ("plan:0",
 * "plan:1", in the order written) that the database never sees. Nothing is read and nothing is written.
 */
async function plan(visitor?: Owner, now?: number) {
  const planned: { table: TableName; id: string; doc: Record<string, unknown> }[] = [];
  const byId = new Map<string, Record<string, unknown>>();
  const db = {
    insert: async (table: TableName, doc: Record<string, unknown>) => {
      const id = `plan:${planned.length}`;
      const row = { ...doc };
      planned.push({ table, id, doc: row });
      byId.set(id, row);
      return id;
    },
    get: async (_table: TableName, id: string) => {
      const row = byId.get(id);
      return row ? { ...row, _id: id } : null;
    },
    patch: async (_table: TableName, id: string, change: Record<string, unknown>) => {
      const row = byId.get(id);
      if (!row) throw new Error("A planned row was patched before it was planned.");
      Object.assign(row, change);
    },
  } as unknown as SampleDb;
  await fill(db, visitor, now);
  return planned;
}

/**
 * The sample conference as the seed alone makes it at `now`, for the one public read (demo.firstRoom): rows by
 * table, each with its stand-in id, as the visitor account would own them. No database row is read, so nothing
 * a visitor typed can be in it and it costs none of the month's database allowance.
 */
export async function seeded(now: number, visitor: { name: string; email: string }) {
  const planned = await plan({ userId: "plan:visitor" as Id<"users">, ...visitor }, now);
  return <Table extends TableName>(table: Table) => planned.filter((row) => row.table === table).map((row) => ({ ...row.doc, _id: row.id }) as unknown as Doc<Table>);
}

export const load = internalMutation({
  args: { owner: v.optional(owner) },
  returns: v.id("churches"),
  handler: (ctx, args) => fill(ctx.db, args.owner),
});

/** The tables a conference's rows sit in, reached by their `by_church` index. */
const churchTables = ["ledgerEntries", "visits", "requestDrafts", "assistanceRequests", "calls", "neighbors", "auditEvents", "calendarFeeds", "payees", "invitations", "outbox", "meetings", "meetingResponses", "series", "deposits", "voucherStock", "ledgerKinds", "bankStatements", "neighborNotes", "referralAgencies", "announcements", "tasks", "timeOff", "availability", "requests", "commitments", "teamMembers", "teams", "memberships"] as const;

/**
 * Every row of a sample conference, each read once: its own tables, the two reached only through a parent
 * (a meeting's invitees, a commitment's history), and the placeholder accounts of its invented people.
 * A real visitor's account is never among them. The AI allowance (aiUsageByChurch) is left out on purpose:
 * it belongs to the sample as a whole and survives a reset.
 */
async function sampleRows(ctx: MutationCtx, churchId: Id<"churches">) {
  const church = await ctx.db.get("churches", churchId);
  if (!church?.sample) throw new Error("Only a sample group can be cleared.");
  const rows: Row[] = [{ table: "churches", doc: church }];
  for (const table of churchTables) {
    const found = table === "ledgerKinds"
      ? await ctx.db.query("ledgerKinds").withIndex("by_church_key", (q) => q.eq("churchId", churchId)).collect()
      : await ctx.db.query(table).withIndex("by_church", (q) => q.eq("churchId", churchId)).collect();
    for (const doc of found) rows.push({ table, doc });
    for (const doc of found) {
      if (table === "meetings") for (const invitee of await ctx.db.query("meetingInvitees").withIndex("by_meeting_member", (q) => q.eq("meetingId", doc._id as Id<"meetings">)).collect()) rows.push({ table: "meetingInvitees", doc: invitee });
      if (table === "commitments") for (const change of await ctx.db.query("commitmentHistory").withIndex("by_commitment", (q) => q.eq("commitmentId", doc._id as Id<"commitments">)).collect()) rows.push({ table: "commitmentHistory", doc: change });
      if (table === "memberships" && (doc as Doc<"memberships">).email.endsWith(`@${emailDomain}`)) {
        const user = await ctx.db.get("users", (doc as Doc<"memberships">).userId);
        if (user) rows.push({ table: "users", doc: user });
      }
    }
  }
  return rows;
}

export const clear = internalMutation({
  args: { churchId: v.id("churches") },
  returns: v.null(),
  handler: async (ctx, { churchId }) => {
    for (const { doc } of (await sampleRows(ctx, churchId)).reverse()) await ctx.db.delete(doc._id);
    return null;
  },
});

/** A row's content as text, keys in order, without what the database adds, for telling equal rows apart. */
function content(doc: Record<string, unknown>) {
  const sorted = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(sorted)
      : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).filter((name) => name !== "_id" && name !== "_creationTime").sort().map((name) => [name, sorted((value as Record<string, unknown>)[name])]))
      : value;
  return JSON.stringify(sorted(doc));
}

/**
 * The nightly reset. It writes the made-up year as a plan first, then compares it with the sample that is
 * there: a row that came out the same is kept as it is, and only rows that differ (what moved with today,
 * or what a visitor changed) are written, and rows the plan does not hold are deleted. The closed year
 * holds still, so most rows are kept and the reset costs a read of the sample and a small write, where
 * throwing it away and loading it again wrote every row twice. The conference keeps its id.
 */
export const renew = internalMutation({
  args: { churchId: v.id("churches"), owner },
  returns: v.object({ kept: v.number(), written: v.number(), deleted: v.number() }),
  handler: async (ctx, { churchId, owner: visitor }) => {
    const there = await sampleRows(ctx, churchId);
    // The plan: rows held in memory under stand-in ids, which the database never sees.
    const planned = await plan(visitor);

    // Rows of the sample that are there, by table and content, each to be claimed at most once.
    const unclaimed = new Map<string, string[]>();
    for (const { table, doc } of there.slice(1)) {
      const at = `${table} ${content(doc)}`;
      unclaimed.set(at, [...(unclaimed.get(at) ?? []), doc._id]);
    }
    // A planned row names other rows by stand-in id; each becomes the real id once that row is settled.
    const real = new Map<string, string>();
    const swap = (value: unknown): unknown =>
      typeof value === "string" && value.startsWith("plan:") ? real.get(value) ?? value
        : Array.isArray(value) ? value.map(swap)
        : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([name, inner]) => [name, swap(inner)]))
        : value;
    const waiting = (value: unknown): boolean =>
      typeof value === "string" ? value.startsWith("plan:") && !real.has(value)
        : Array.isArray(value) ? value.some(waiting)
        : value && typeof value === "object" ? Object.values(value).some(waiting) : false;
    // The conference row is the one kept whatever it holds, so the sample keeps its id and its address.
    const claimed = new Set<string>([churchId]);
    real.set(planned[0].id, churchId);
    const church = there[0].doc;
    let kept = 0, written = 0, left = planned.slice(1);
    // The conference row names its waiting households, so it is settled last, once they have their ids.
    // A row is settled once every row it names is. A row that names one planned after it (a gift names its
    // deposit) waits a round.
    while (left.length) {
      const later: typeof planned = [];
      for (const row of left) {
        if (waiting(row.doc)) { later.push(row); continue; }
        const doc = swap(row.doc) as Record<string, unknown>;
        const same = unclaimed.get(`${row.table} ${content(doc)}`);
        const id = same?.shift();
        if (id) { kept++; claimed.add(id); real.set(row.id, id); continue; }
        written++;
        real.set(row.id, await ctx.db.insert(row.table, doc as never));
      }
      if (later.length === left.length) throw new Error("The sample's rows name each other in a circle.");
      left = later;
    }
    const conference = swap(planned[0].doc) as Record<string, unknown>;
    if (content(church) === content(conference)) kept++;
    else { written++; await ctx.db.replace("churches", churchId, conference as never); }
    let deleted = 0;
    for (const { doc } of there.reverse()) if (!claimed.has(doc._id)) { deleted++; await ctx.db.delete(doc._id); }
    return { kept, written, deleted };
  },
});
