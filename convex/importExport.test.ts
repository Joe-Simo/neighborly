/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { signedIn } from "./clerk.testing";
import { api } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

async function setup() {
  const t = convexTest(schema, modules);
  const emails = new Map<string, string>();
  const ids = await t.run(async (ctx) => {
    const church = await ctx.db.insert("churches", { name: "St. Example Conference", timeZone: "America/New_York" });
    const join = async (name: string, role: "owner" | "coordinator" | "member") => {
      const userId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("memberships", { churchId: church, userId, name, email: `${name.toLowerCase()}@neighborly.example`, role, active: true, approved: true, coverOptIn: false });
      return { userId, memberId };
    };
    const owner = await join("Marisol", "owner"), coordinator = await join("Thomas", "coordinator"), member = await join("Renee", "member");
    await ctx.db.insert("invitations", { churchId: church, email: "walter@neighborly.example", role: "member", tokenHash: "a".repeat(64), expiresAt: Date.now() + 86400000, status: "pending", createdBy: owner.memberId, createdAt: Date.now(), requestId: "earlier-invitation-0001" });
    return { church, owner, coordinator, member };
  });
  for (const person of [ids.owner, ids.coordinator, ids.member]) emails.set(person.userId, `${person.userId}@neighborly.example`);
  return { t, ids, as: (person: { userId: string }) => signedIn(t, person.userId, emails.has(person.userId)) };
}
const batchId = "batch-0000-0000-0001";
const sheet = [
  { line: 2, name: "Hannah Lindqvist", email: " Hannah.Lindqvist@Neighborly.example ", role: "" },
  { line: 3, name: "Victor Salgado", email: "victor.salgado-at-neighborly.example", role: "" },
  { line: 4, name: "Priya Raman", email: "priya.raman@neighborly.example", role: "Coordinator" },
  { line: 5, name: "", email: "nameless@neighborly.example", role: "" },
  { line: 6, name: "Hannah L.", email: "hannah.lindqvist@neighborly.example", role: "" },
  { line: 7, name: "Thomas Okafor", email: "thomas@neighborly.example", role: "" },
  { line: 8, name: "Walter Brzezinski", email: "walter@neighborly.example", role: "" },
  { line: 9, name: "Colleen Marsh", email: "colleen.marsh@neighborly.example", role: "treasurer" },
];

describe("bringing members in from a spreadsheet", () => {
  test("a file with bad rows imports the good rows and reports each bad one", async () => {
    const { t, ids, as } = await setup();
    const results = await as(ids.owner).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet });
    expect(results.map((row) => [row.line, row.outcome])).toEqual([[2, "invited"], [3, "bad_email"], [4, "invited"], [5, "no_name"], [6, "repeated"], [7, "already_member"], [8, "already_invited"], [9, "bad_role"]]);
    for (const row of results) expect(row.token === null).toBe(row.outcome !== "invited");
    for (const row of results.filter((row) => row.token)) expect(row.token).toMatch(/^[0-9a-f]{64}$/);

    const invitations = await t.run((ctx) => ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect());
    expect(invitations.map((invite) => [invite.email, invite.role, invite.status]).sort()).toEqual([
      ["hannah.lindqvist@neighborly.example", "member", "pending"],
      ["priya.raman@neighborly.example", "coordinator", "pending"],
      ["walter@neighborly.example", "member", "pending"],
    ]);
    // Nobody is added on their behalf, and the link token itself is never stored.
    expect(await t.run((ctx) => ctx.db.query("memberships").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).toHaveLength(3);
    for (const row of results.filter((row) => row.token)) expect(invitations.some((invite) => invite.tokenHash === row.token)).toBe(false);
  });

  test("checking a file changes nothing, and sending the same file twice invites nobody twice", async () => {
    const { t, ids, as } = await setup();
    const count = () => t.run(async (ctx) => (await ctx.db.query("invitations").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect()).length);
    const preview = await as(ids.owner).query(api.importExport.checkMembers, { churchId: ids.church, rows: sheet });
    expect(preview.filter((row) => row.outcome === "ready").map((row) => row.email)).toEqual(["hannah.lindqvist@neighborly.example", "priya.raman@neighborly.example"]);
    expect(await count()).toBe(1);
    await as(ids.owner).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet });
    const again = await as(ids.owner).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet });
    expect(again.filter((row) => row.outcome === "invited")).toEqual([]);
    expect(again.find((row) => row.line === 2)?.outcome).toBe("already_invited");
    expect(await count()).toBe(3);
  });

  test("only the owner may bring people in", async () => {
    const { t, ids, as } = await setup();
    for (const person of [ids.coordinator, ids.member]) {
      await expect(as(person).query(api.importExport.checkMembers, { churchId: ids.church, rows: sheet })).rejects.toThrow("Owner access required.");
      await expect(as(person).action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet })).rejects.toThrow("Owner access required.");
    }
    await expect(t.action(api.importExport.importMembers, { churchId: ids.church, batchId, rows: sheet })).rejects.toThrow("Sign in required.");
    const tooMany = Array.from({ length: 301 }, (_, index) => ({ line: index + 2, name: "Sample Person", email: `person${index}@neighborly.example`, role: "" }));
    await expect(as(ids.owner).query(api.importExport.checkMembers, { churchId: ids.church, rows: tooMany })).rejects.toThrow("up to 300");
  });
});

const blank = { phone: "", email: "", address: "", adults: "", children: "", language: "", notes: "" };
const households = [
  { line: 2, ...blank, name: "Alma Almonte", phone: "(100) 555-0100", address: "12 Sample St, Apt 3", adults: "2", children: "3", language: "Spanish", notes: "Prefers a call after 5." },
  { line: 3, ...blank, name: "Benito Castellanos", phone: "(100) 555-0142" },
  { line: 4, ...blank, name: "  ", phone: "(100) 555-0103" },
  { line: 5, ...blank, name: "Celeste Desrosiers", phone: "(100) 555-0104", adults: "two" },
  { line: 6, ...blank, name: "ALMA  ALMONTE" },
  { line: 7, ...blank, name: "Darnell Eastman", phone: "100.555.0100" },
  { line: 8, ...blank, name: "celeste hyppolite", phone: "(100) 555-0199" },
  { line: 9, ...blank, name: "Esperanza Figueroa", language: "  mandarin " },
  { line: 10, ...blank, name: "Fabrice Greenhalgh", language: "kreyòl", children: "0" },
];

describe("bringing neighbors in from a spreadsheet", () => {
  async function withNeighbor() {
    const world = await setup();
    await world.t.run((ctx) => ctx.db.insert("neighbors", { churchId: world.ids.church, name: "Celeste Hyppolite", nameKey: "celeste hyppolite", phone: "(100) 555-0142", phoneKey: "1005550142", email: "", address: "412 Placeholder Rd", adults: 1, children: 2, language: "ht", notes: "", createdBy: world.ids.owner.memberId, createdAt: 0 }));
    const neighbors = () => world.t.run((ctx) => ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", world.ids.church)).collect());
    return { ...world, neighbors };
  }

  test("good rows are added; a duplicate phone or name, in the file or on file, is caught and reported", async () => {
    const { ids, as, neighbors } = await withNeighbor();
    const preview = await as(ids.coordinator).query(api.importExport.checkNeighbors, { churchId: ids.church, rows: households });
    expect(preview.map((row) => [row.line, row.outcome])).toEqual([[2, "ready"], [3, "same_phone"], [4, "no_name"], [5, "bad_count"], [6, "repeated"], [7, "repeated"], [8, "same_name"], [9, "ready"], [10, "ready"]]);
    expect(await neighbors()).toHaveLength(1);

    const results = await as(ids.coordinator).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households });
    expect(results.map((row) => row.outcome)).toEqual(["added", "same_phone", "no_name", "bad_count", "repeated", "repeated", "same_name", "added", "added"]);
    const added = (await neighbors()).filter((neighbor) => neighbor.name !== "Celeste Hyppolite");
    expect(added).toMatchObject([
      { name: "Alma Almonte", nameKey: "alma almonte", phone: "(100) 555-0100", phoneKey: "1005550100", address: "12 Sample St, Apt 3", adults: 2, children: 3, language: "es", notes: "Prefers a call after 5.", createdBy: ids.coordinator.memberId },
      // Any language is kept as written: it is the household's, not one of the app's.
      { name: "Esperanza Figueroa", language: "other", languageName: "Mandarin" },
      { name: "Fabrice Greenhalgh", phone: "", phoneKey: "", adults: 1, children: 0, language: "ht" },
    ]);
    // Sending the file again adds nobody: everyone in it is now on file.
    const again = await as(ids.coordinator).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households });
    expect(again.filter((row) => row.outcome === "added")).toEqual([]);
    expect(await neighbors()).toHaveLength(4);
  });

  test("a member is refused, and what comes back never carries more than the name", async () => {
    const { t, ids, as, neighbors } = await withNeighbor();
    const refused = "Neighbor records are open to coordinators and owners only.";
    await expect(as(ids.member).query(api.importExport.checkNeighbors, { churchId: ids.church, rows: households })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households })).rejects.toThrow(refused);
    await expect(t.mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households })).rejects.toThrow("Sign in required.");
    expect(await neighbors()).toHaveLength(1);
    const preview = await as(ids.owner).query(api.importExport.checkNeighbors, { churchId: ids.church, rows: households });
    for (const row of preview) expect(Object.keys(row).sort()).toEqual(["line", "name", "outcome"]);
    const events = async () => (await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).filter((event) => event.action === "neighbors_imported");
    expect(await events()).toHaveLength(0);
    await as(ids.owner).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: households });
    expect(await events()).toMatchObject([{ actorId: ids.owner.userId, targetId: "3" }]);
  });
});

describe("bringing past requests over from another system", () => {
  const blank = { phone: "", status: "Completed", type: "Rent", amount: "$1,250.00", payee: "Sample Street Apartments", notes: "Behind after reduced hours" };
  const history = [
    { line: 2, name: "Celeste Hyppolite", date: "03/14/2026", ...blank },
    { line: 3, name: "Someone Else", date: "03/14/2026", ...blank, phone: "(100) 555-0142", type: "Electric bill", amount: "86.5", status: "Call Back", notes: "" },
    { line: 4, name: "Nestor Orlov", date: "03/14/2026", ...blank },
    { line: 5, name: "Celeste Hyppolite", date: "14 March", ...blank },
    { line: 6, name: "Celeste Hyppolite", date: "03/15/2026", ...blank, amount: "a lot" },
    { line: 7, name: "Celeste Hyppolite", date: "03/15/2026", ...blank, status: "Maybe" },
    { line: 8, name: "Celeste Hyppolite", date: "2026-03-14", ...blank },
    { line: 9, name: "", date: "03/14/2026", ...blank },
  ];
  const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  async function withNeighbor() {
    const world = await setup();
    const neighborId = await world.t.run((ctx) => ctx.db.insert("neighbors", { churchId: world.ids.church, name: "Celeste Hyppolite", nameKey: "celeste hyppolite", phone: "(100) 555-0142", phoneKey: "1005550142", email: "", address: "412 Placeholder Rd", adults: 1, children: 2, language: "ht", notes: "", createdBy: world.ids.owner.memberId, createdAt: 0 }));
    const requests = () => world.t.run((ctx) => ctx.db.query("assistanceRequests").withIndex("by_neighbor", (q) => q.eq("neighborId", neighborId)).collect());
    return { ...world, requests };
  }

  test("history comes in as history: dated, never approved or paid, no ledger entry, and never twice", async () => {
    const { t, ids, as, requests } = await withNeighbor();
    const preview = await as(ids.coordinator).query(api.importExport.checkRequests, { churchId: ids.church, rows: history });
    expect(preview.map((row) => [row.line, row.outcome])).toEqual([[2, "ready"], [3, "ready"], [4, "no_neighbor"], [5, "bad_date"], [6, "bad_amount"], [7, "bad_status"], [8, "repeated"], [9, "no_name"]]);
    for (const row of preview) expect(Object.keys(row).sort()).toEqual(["line", "name", "outcome"]);
    expect(await requests()).toHaveLength(0);

    await as(ids.coordinator).mutation(api.importExport.importRequests, { churchId: ids.church, rows: history });
    const added = await requests();
    expect(added).toMatchObject([
      { source: "import", status: "closed", kind: "rent", payeeKind: "landlord", payeeName: "Sample Street Apartments", importedAmount: 125000, amountRequested: 125000, summary: "Behind after reduced hours", createdBy: ids.coordinator.memberId },
      { source: "import", status: "closed", kind: "utility", payeeKind: "utility", importedAmount: 8650, summary: "Electric bill" },
    ]);
    // Left open in the other system months ago, it is history; only a recent one is still waiting.
    await as(ids.coordinator).mutation(api.importExport.importRequests, { churchId: ids.church, rows: [{ line: 2, name: "Celeste Hyppolite", date: recent, ...blank, status: "Open", type: "Food", amount: "" }] });
    expect((await requests()).at(-1)).toMatchObject({ status: "open", kind: "food", importedAmount: 0 });
    expect(new Date(added[0].createdAt).toISOString()).toBe("2026-03-14T16:00:00.000Z");
    for (const request of added) expect(request.amountApproved).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("ledgerEntries").collect())).toEqual([]);

    const again = await as(ids.coordinator).mutation(api.importExport.importRequests, { churchId: ids.church, rows: history });
    expect(again.slice(0, 2).map((row) => row.outcome)).toEqual(["already_here", "already_here"]);
    expect(await requests()).toHaveLength(3);
    const events = (await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).filter((event) => event.action === "requests_imported");
    expect(events).toMatchObject([{ actorId: ids.coordinator.userId, targetId: "2" }, { targetId: "1" }]);
  });

  test("a member is refused", async () => {
    const { ids, as, requests } = await withNeighbor();
    const refused = "Neighbor records are open to coordinators and owners only.";
    await expect(as(ids.member).query(api.importExport.checkRequests, { churchId: ids.church, rows: history })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.importExport.importRequests, { churchId: ids.church, rows: history })).rejects.toThrow(refused);
    expect(await requests()).toHaveLength(0);
  });
});

describe("bringing over the list of payees", () => {
  const blank = { type: "", address: "", phone: "", email: "", notes: "" };
  const list = [
    { line: 2, ...blank, name: "Sample Street Apartments", type: "Landlord", phone: "(100) 555-0150" },
    { line: 3, ...blank, name: "Demo Power & Light" },
    { line: 4, ...blank, name: "sample street  apartments" },
    { line: 5, ...blank, name: " " },
    { line: 6, ...blank, name: "Conference thrift store", type: "Store" },
  ];
  test("each payee comes in once, with its kind read from the file, and the list can be offered where a payee is typed", async () => {
    const { t, ids, as } = await setup();
    expect((await as(ids.coordinator).query(api.importExport.checkPayees, { churchId: ids.church, rows: list })).map((row) => row.outcome)).toEqual(["ready", "ready", "repeated", "no_name", "ready"]);
    expect(await as(ids.coordinator).query(api.importExport.payees, { churchId: ids.church })).toEqual([]);
    await as(ids.coordinator).mutation(api.importExport.importPayees, { churchId: ids.church, rows: list });
    const again = await as(ids.coordinator).mutation(api.importExport.importPayees, { churchId: ids.church, rows: list });
    expect(again.map((row) => row.outcome)).toEqual(["already_here", "already_here", "repeated", "no_name", "already_here"]);
    expect(await as(ids.owner).query(api.importExport.payees, { churchId: ids.church })).toMatchObject([
      { name: "Conference thrift store", kind: "vendor" },
      { name: "Demo Power & Light", kind: "utility" },
      { name: "Sample Street Apartments", kind: "landlord", phone: "(100) 555-0150" },
    ]);
    expect(await t.run((ctx) => ctx.db.query("ledgerEntries").collect())).toEqual([]);
  });
  test("a member is refused", async () => {
    const { ids, as } = await setup();
    const refused = "Neighbor records are open to coordinators and owners only.";
    await expect(as(ids.member).query(api.importExport.payees, { churchId: ids.church })).rejects.toThrow(refused);
    await expect(as(ids.member).mutation(api.importExport.importPayees, { churchId: ids.church, rows: list })).rejects.toThrow(refused);
  });
});

describe("taking the records out", () => {
  async function withRecords() {
    const world = await setup();
    const { ids } = world;
    await world.t.run(async (ctx) => {
      const base = { churchId: ids.church, createdBy: ids.owner.memberId, createdAt: Date.UTC(2026, 2, 14, 16) };
      const neighborId = await ctx.db.insert("neighbors", { ...base, name: "Celeste Hyppolite", nameKey: "celeste hyppolite", phone: "(100) 555-0142", phoneKey: "1005550142", email: "", address: "412 Placeholder Rd, Apt 7", adults: 1, children: 2, language: "ht", notes: "=cmd", accounts: [{ kind: "utility", name: "Demo Power & Light", accountNumber: "0098 7654 4821", phone: "" }] });
      const requestId = await ctx.db.insert("assistanceRequests", { ...base, neighborId, kind: "utility", summary: "Shut-off notice", amountRequested: 8650, amountApproved: 8000, status: "paid", decisionNote: "", payeeKind: "utility", payeeName: "Demo Power & Light", source: "person" });
      await ctx.db.insert("visits", { ...base, neighborId, requestId, scheduledAt: Date.UTC(2026, 2, 16, 14), status: "completed", visitors: [{ memberId: ids.coordinator.memberId, hours: 1.5, miles: 6 }, { memberId: ids.member.memberId, hours: 1.5, miles: 0 }], notes: "Kind welcome" });
      await ctx.db.insert("ledgerEntries", { churchId: ids.church, kind: "expense", amount: 8000, date: "2026-03-17", category: "utility", payee: "Demo Power & Light", memo: "", requestId, neighborId, checkNumber: "1042", recordedBy: ids.owner.memberId, createdAt: 0 });
      await ctx.db.insert("payees", { ...base, kind: "utility", name: "Demo Power & Light", nameKey: "demo power light", address: "", phone: "", email: "", notes: "" });
      // What a conference would also want to keep if it closed for good.
      const at = Date.UTC(2026, 2, 13, 14, 5);
      await ctx.db.insert("neighborNotes", { churchId: ids.church, neighborId, body: "Prefers a call after five", authorId: ids.coordinator.memberId, createdAt: at });
      await ctx.db.insert("calls", { churchId: ids.church, neighborId, callerName: "Celeste Hyppolite", phone: "(100) 555-0142", note: "Shut-off notice for Friday", callback: "done", takenBy: ids.member.memberId, takenAt: at, returnedBy: ids.coordinator.memberId, returnedAt: at + 3_600_000, outcome: "Visit planned", urgent: { reasons: ["shutoff", "noFood"], by: "person" } });
      await ctx.db.insert("deposits", { churchId: ids.church, date: "2026-03-15", total: 22500, memo: "Poor box", recordedBy: ids.owner.memberId, createdAt: at });
      await ctx.db.insert("bankStatements", { churchId: ids.church, endsOn: "2026-03-31", balance: 104250, agreedBy: ids.owner.memberId, agreedAt: Date.UTC(2026, 3, 2, 15) });
      await ctx.db.insert("voucherStock", { churchId: ids.church, date: "2026-03-10", change: 20, item: "Grocery voucher", note: "From the district", recordedBy: ids.owner.memberId, createdAt: at });
      await ctx.db.insert("referralAgencies", { churchId: ids.church, name: "Example Food Pantry", phone: "(100) 555-0100", helpsWith: "Food" });
      const teamId = await ctx.db.insert("teams", { churchId: ids.church, name: "Help line", description: "Answers the phone" });
      await ctx.db.insert("teamMembers", { churchId: ids.church, teamId, memberId: ids.member.memberId, teamRole: "member", approved: true, status: "active" });
      await ctx.db.insert("commitments", { churchId: ids.church, teamId, title: "Help line morning", start: Date.UTC(2026, 2, 16, 13), end: Date.UTC(2026, 2, 16, 16), location: "Parish office", preparation: "", assigneeId: ids.member.memberId, coordinatorId: ids.coordinator.memberId, version: 1 });
      await ctx.db.insert("auditEvents", { churchId: ids.church, actorId: ids.owner.userId, action: "removePerson", targetId: "kept-inside", at });
    });
    return world;
  }
  const files = ["neighbors", "notes", "calls", "requests", "visits", "ledger", "deposits", "statements", "vouchers", "payees", "referrals", "members", "teams", "commitments", "history"] as const;

  test("an owner gets every file; an account number leaves with only its last four digits", async () => {
    const { t, ids, as } = await withRecords();
    const pages = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await as(ids.owner).query(api.importExport.exportPage, { churchId: ids.church, file, cursor: null })] as const)));
    for (const file of files) expect(pages[file].done).toBe(true);
    expect(pages.neighbors.rows).toEqual([["Celeste Hyppolite", "(100) 555-0142", "", "412 Placeholder Rd, Apt 7", "1", "2", "Haitian Creole", "=cmd", "", "", "", "", "Utility: Demo Power & Light, account ending 4821"]]);
    expect(JSON.stringify(pages)).not.toContain("7654");
    expect(pages.requests.rows[0].slice(0, 9)).toEqual(["Celeste Hyppolite", "(100) 555-0142", "03/14/2026", "Completed", "Utility", "80.00", "Demo Power & Light", "Shut-off notice", "Paid"]);
    expect(pages.visits.rows).toEqual([["Celeste Hyppolite", "03/16/2026", "10:00 AM", "Completed", "Thomas; Renee", "3", "6", "Kind welcome", ""]]);
    expect(pages.ledger.rows).toEqual([["03/17/2026", "Money out", "80.00", "Utility", "Demo Power & Light", "", "1042", "", "Celeste Hyppolite", "No", "No"]]);
    expect(pages.members.rows.map((row) => row[2])).toEqual(["Owner", "Coordinator", "Member"]);
    expect(pages.notes.rows).toEqual([["Celeste Hyppolite", "03/13/2026", "Prefers a call after five", "Thomas"]]);
    expect(pages.calls.rows).toEqual([["03/13/2026", "10:05 AM", "Celeste Hyppolite", "(100) 555-0142", "Celeste Hyppolite", "Shut-off notice for Friday", "Returned", "Renee", "Thomas", "03/13/2026", "Visit planned", "Shut-off notice; No food in the house"]]);
    expect(pages.deposits.rows).toEqual([["03/15/2026", "225.00", "Poor box", "Marisol"]]);
    expect(pages.statements.rows).toEqual([["03/31/2026", "1042.50", "Marisol", "04/02/2026"]]);
    expect(pages.vouchers.rows).toEqual([["03/10/2026", "20", "", "Grocery voucher", "From the district", "Marisol"]]);
    expect(pages.referrals.rows).toEqual([["Example Food Pantry", "(100) 555-0100", "Food"]]);
    expect(pages.teams.rows).toEqual([["Help line", "Answers the phone", "Renee", "Member", "Active"]]);
    expect(pages.commitments.rows).toEqual([["03/16/2026", "9:00 AM", "12:00 PM", "Help line morning", "Help line", "Parish office", "Renee", "Thomas", "No"]]);
    // The history says who and what, never which record.
    expect(pages.history.rows).toEqual([["03/13/2026", "10:05 AM", "Marisol", "Removed a member"]]);
    expect(JSON.stringify(pages.history)).not.toContain("kept-inside");

    // What went out comes back in: the same column names, read into another conference, are all ready.
    const elsewhere = await t.run(async (ctx) => {
      const church = await ctx.db.insert("churches", { name: "Second Example Conference", timeZone: "America/New_York" });
      await ctx.db.insert("memberships", { churchId: church, userId: ids.owner.userId, name: "Marisol", email: "marisol@neighborly.example", role: "owner", active: true, approved: true, coverOptIn: false });
      return church;
    });
    const cell = (file: (typeof files)[number], row: string[], column: string) => row[pages[file].columns.indexOf(column)];
    const neighbors = pages.neighbors.rows.map((row, index) => ({ line: index + 2, name: cell("neighbors", row, "Name"), phone: cell("neighbors", row, "Phone"), email: cell("neighbors", row, "Email"), address: cell("neighbors", row, "Address"), adults: cell("neighbors", row, "Adults"), children: cell("neighbors", row, "Children"), language: cell("neighbors", row, "Language"), notes: cell("neighbors", row, "Notes") }));
    expect((await as(ids.owner).mutation(api.importExport.importNeighbors, { churchId: elsewhere, rows: neighbors })).map((row) => row.outcome)).toEqual(["added"]);
    const requests = pages.requests.rows.map((row, index) => ({ line: index + 2, name: cell("requests", row, "Name"), phone: cell("requests", row, "Phone"), date: cell("requests", row, "Request Date"), status: cell("requests", row, "Request Status"), type: cell("requests", row, "Assistance Type"), amount: cell("requests", row, "Value"), payee: cell("requests", row, "Payee"), notes: cell("requests", row, "Request Notes") }));
    expect((await as(ids.owner).mutation(api.importExport.importRequests, { churchId: elsewhere, rows: requests })).map((row) => row.outcome)).toEqual(["added"]);
    const payees = pages.payees.rows.map((row, index) => ({ line: index + 2, name: cell("payees", row, "Name"), type: cell("payees", row, "Type"), address: "", phone: "", email: "", notes: "" }));
    expect((await as(ids.owner).mutation(api.importExport.importPayees, { churchId: elsewhere, rows: payees })).map((row) => row.outcome)).toEqual(["added"]);
  });

  test("a removed record leaves as 'Record removed': dates and amounts, nothing that names the household, and it is never brought back in as a household", async () => {
    const { t, ids, as } = await withRecords();
    // The shape neighbors.remove leaves behind.
    await t.run(async (ctx) => {
      const [neighbor] = await ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect();
      await ctx.db.patch("neighbors", neighbor._id, { name: "Record removed", nameKey: "", phone: "", phoneKey: "", email: "", address: "", notes: "", alert: undefined, household: undefined, money: undefined, accounts: undefined });
      for (const note of await ctx.db.query("neighborNotes").collect()) await ctx.db.delete("neighborNotes", note._id);
      for (const call of await ctx.db.query("calls").collect()) await ctx.db.patch("calls", call._id, { callerName: "", phone: "", note: "", outcome: undefined, urgent: undefined });
      for (const visit of await ctx.db.query("visits").collect()) await ctx.db.patch("visits", visit._id, { notes: "" });
      for (const request of await ctx.db.query("assistanceRequests").collect()) await ctx.db.patch("assistanceRequests", request._id, { summary: "Record removed", decisionNote: "", payeeName: "" });
      for (const entry of await ctx.db.query("ledgerEntries").collect()) await ctx.db.patch("ledgerEntries", entry._id, { memo: "Record removed" });
      await ctx.db.insert("auditEvents", { churchId: ids.church, actorId: ids.owner.userId, action: "neighbor.removed", targetId: neighbor._id, at: Date.UTC(2026, 2, 20, 14, 5) });
    });
    const pages = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await as(ids.owner).query(api.importExport.exportPage, { churchId: ids.church, file, cursor: null })] as const)));
    expect(pages.neighbors.rows).toEqual([["Record removed", "", "", "", "1", "2", "Haitian Creole", "", "", "", "", "", ""]]);
    expect(pages.notes.rows).toEqual([]);
    expect(pages.calls.rows).toEqual([["03/13/2026", "10:05 AM", "Record removed", "", "Record removed", "", "Returned", "Renee", "Thomas", "03/13/2026", "", ""]]);
    expect(pages.requests.rows[0].slice(0, 9)).toEqual(["Record removed", "", "03/14/2026", "Completed", "Utility", "80.00", "", "Record removed", "Paid"]);
    expect(pages.visits.rows).toEqual([["Record removed", "03/16/2026", "10:00 AM", "Completed", "Thomas; Renee", "3", "6", "", ""]]);
    expect(pages.ledger.rows).toEqual([["03/17/2026", "Money out", "80.00", "Utility", "Demo Power & Light", "Record removed", "1042", "", "Record removed", "No", "No"]]);
    expect(pages.history.rows.at(-1)).toEqual(["03/20/2026", "10:05 AM", "Marisol", "Removed a neighbor’s record"]);
    for (const word of ["Celeste", "Hyppolite", "555-0142", "Placeholder", "4821", "Shut-off", "Kind welcome"]) expect(JSON.stringify(pages)).not.toContain(word);

    // Read back in, the line is left out: it is not a household, and its request has nobody to belong to.
    const line = { line: 2, name: "Record removed", phone: "", email: "", address: "", adults: "1", children: "2", language: "Creole", notes: "" };
    expect((await as(ids.owner).mutation(api.importExport.importNeighbors, { churchId: ids.church, rows: [line, { ...line, line: 3, name: "record  REMOVED" }] })).map((row) => row.outcome)).toEqual(["no_name", "no_name"]);
    expect((await as(ids.owner).mutation(api.importExport.importRequests, { churchId: ids.church, rows: [{ line: 2, name: "Record removed", phone: "", date: "03/14/2026", status: "Completed", type: "Utility", amount: "80.00", payee: "", notes: "" }] })).map((row) => row.outcome)).toEqual(["no_name"]);
    expect(await t.run((ctx) => ctx.db.query("neighbors").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).toHaveLength(1);
  });

  test("only an owner may, and taking the records out is written down", async () => {
    const { t, ids, as } = await withRecords();
    for (const person of [ids.coordinator, ids.member]) {
      await expect(as(person).query(api.importExport.exportPage, { churchId: ids.church, file: "members", cursor: null })).rejects.toThrow();
      await expect(as(person).mutation(api.importExport.recordExport, { churchId: ids.church })).rejects.toThrow();
    }
    await as(ids.owner).mutation(api.importExport.recordExport, { churchId: ids.church });
    const events = (await t.run((ctx) => ctx.db.query("auditEvents").withIndex("by_church", (q) => q.eq("churchId", ids.church)).collect())).filter((event) => event.action === "records_exported");
    expect(events).toMatchObject([{ actorId: ids.owner.userId }]);
  });
});
