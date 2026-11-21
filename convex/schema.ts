import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { spoken } from "./spoken";
const role = v.union(v.literal("owner"), v.literal("coordinator"), v.literal("member"));
const language = v.union(v.literal("en"), v.literal("es"));
/** Money is stored as whole cents, always positive; the entry kind says which way it moves. */
const cents = v.number();
/** Calendar days are "yyyy-MM-dd" in the group's time zone, as in timeOff and availability. */
const day = v.string();
export default defineSchema({
  // One row per person. Clerk proves who is signing in; clerkId ties that proof to this row, and every
  // membership points here. legacyEmail is set only on accounts made before Clerk, until their owner returns.
  users: defineTable({ clerkId: v.optional(v.string()), legacyEmail: v.optional(v.string()) }).index("by_clerk", ["clerkId"]).index("by_legacy_email", ["legacyEmail"]),
  aiUsage: defineTable({userId:v.id("users"),windowStart:v.number(),count:v.number()}).index("by_user",["userId"]),
  // The assistant's monthly allowance per group. month is "yyyy-MM".
  /** Every name a conference holds (its neighbors' and members'), kept in the same write as the name: what the assistant's scrub takes out of a note. */
  knownNames: defineTable({ churchId: v.id("churches"), names: v.array(v.string()) }).index("by_church", ["churchId"]),
  /** The sample's visitors share one account, so each sign-in session has its own small allowance for the day. */
  aiUsageBySession: defineTable({ session: v.string(), day: v.string(), windowStart: v.number(), minute: v.number(), count: v.number() }).index("by_session_day", ["session", "day"]).index("by_day", ["day"]),
  aiUsageByChurch: defineTable({ churchId: v.id("churches"), month: v.string(), count: v.number() }).index("by_church_month", ["churchId", "month"]),
  churches: defineTable({ name: v.string(), timeZone: v.string(), sample: v.optional(v.boolean()), wordSet: v.optional(v.union(v.literal("general"), v.literal("vincentian"))), /** What the group means to approve in help each month, in cents; unset until someone sets it. */ monthlyBudget: v.optional(v.number()), /** Running figures kept by convex/counts.ts. */ householdCount: v.optional(v.number()), waitingCount: v.optional(v.number()), waitingHouseholdIds: v.optional(v.array(v.id("neighbors"))) }),
  memberships: defineTable({ churchId: v.id("churches"), userId: v.id("users"), name: v.string(), email: v.string(), role, active: v.boolean(), approved: v.boolean(), coverOptIn: v.boolean(), language: v.optional(language), /** Wants the week for deciders by email on Monday morning (convex/digest.ts). */ digestEmail: v.optional(v.boolean()), /** Set when the owner removed this person for good: the row stays, nameless, so their logged work still counts. */ removedAt: v.optional(v.number()) }).index("by_user", ["userId"]).index("by_church_user", ["churchId", "userId"]).index("by_church", ["churchId"]),
  teams: defineTable({ churchId: v.id("churches"), name: v.string(), description: v.string() }).index("by_church", ["churchId"]),
  teamMembers: defineTable({ churchId: v.id("churches"), teamId: v.id("teams"), memberId: v.id("memberships"), teamRole: v.union(v.literal("coordinator"),v.literal("member")), approved:v.boolean(), status: v.union(v.literal("invited"), v.literal("active")) }).index("by_church", ["churchId"]).index("by_team_member", ["teamId", "memberId"]).index("by_member", ["memberId"]),
  series: defineTable({ churchId: v.id("churches"), teamId: v.id("teams"), intervalWeeks:v.number(), count:v.number() }).index("by_church", ["churchId"]),
  commitments: defineTable({ seriesId:v.optional(v.id("series")), cancelled:v.optional(v.boolean()), churchId: v.id("churches"), teamId: v.id("teams"), title: v.string(), start: v.number(), end: v.number(), location: v.string(), preparation: v.string(), assigneeId: v.union(v.id("memberships"),v.null()), coordinatorId: v.id("memberships"), version: v.number() }).index("by_church", ["churchId"]).index("by_assignee", ["assigneeId"]).index("by_assignee_end", ["assigneeId","end"]).index("by_team_start", ["teamId", "start"]).index("by_church_end", ["churchId","end"]),
  commitmentHistory: defineTable({churchId:v.id("churches"),commitmentId:v.id("commitments"),actorId:v.id("users"),action:v.union(v.literal("revised"),v.literal("cancelled")),version:v.number(),title:v.string(),start:v.number(),end:v.number(),location:v.string(),preparation:v.string(),assigneeId:v.union(v.id("memberships"),v.null()),at:v.number()}).index("by_commitment",["commitmentId"]),
  requests: defineTable({ churchId: v.id("churches"), commitmentId: v.id("commitments"), recipientId: v.id("memberships"), commitmentVersion: v.number(), status: v.union(v.literal("pending"),v.literal("accepted"),v.literal("declined"),v.literal("withdrawn"),v.literal("superseded")) }).index("by_church", ["churchId"]).index("by_commitment", ["commitmentId"]).index("by_commitment_status", ["commitmentId", "status"]).index("by_commitment_version_status", ["commitmentId", "commitmentVersion", "status"]).index("by_recipient_status", ["recipientId", "status"]),
  availability: defineTable({ churchId:v.id("churches"), memberId:v.id("memberships"), start:v.string(), end:v.string() }).index("by_church",["churchId"]).index("by_member",["memberId"]).index("by_member_end",["memberId","end"]),
  timeOff: defineTable({ churchId: v.id("churches"), memberId: v.id("memberships"), start: v.string(), end: v.string(), note: v.string() }).index("by_church", ["churchId"]).index("by_member", ["memberId"]).index("by_member_end", ["memberId","end"]),
  tasks: defineTable({ churchId: v.id("churches"), title: v.string(), dueAt: v.union(v.number(),v.null()), assigneeId: v.union(v.id("memberships"),v.null()), complete: v.boolean() }).index("by_church", ["churchId"]),
  meetings: defineTable({ churchId: v.id("churches"), fanoutStatus:v.union(v.literal("processing"),v.literal("complete")), cutoff:v.number(), title: v.string(), start: v.number(), end: v.number(), location: v.string() }).index("by_church", ["churchId"]),
  meetingInvitees: defineTable({churchId:v.id("churches"),meetingId:v.id("meetings"),memberId:v.id("memberships")}).index("by_meeting_member",["meetingId","memberId"]).index("by_member",["memberId"]),
  meetingResponses: defineTable({ churchId: v.id("churches"), meetingId: v.id("meetings"), memberId: v.id("memberships"), response: v.union(v.literal("accepted"),v.literal("declined")) }).index("by_church", ["churchId"]).index("by_meeting_member", ["meetingId", "memberId"]).index("by_meeting", ["meetingId"]),
  announcements: defineTable({ churchId: v.id("churches"), title: v.string(), body: v.string(), authorId: v.id("memberships"), createdAt: v.number() }).index("by_church", ["churchId"]),
  invitations: defineTable({ churchId: v.id("churches"), email: v.string(), role: v.union(v.literal("coordinator"),v.literal("member")), tokenHash: v.string(), expiresAt: v.number(), status: v.union(v.literal("pending"),v.literal("accepted"),v.literal("revoked")), createdBy: v.id("memberships"), acceptedBy: v.optional(v.id("users")), createdAt: v.number(), requestId: v.string() }).index("by_church", ["churchId"]).index("by_token", ["tokenHash"]).index("by_church_request", ["churchId", "requestId"]),
  outbox: defineTable({ churchId: v.id("churches"), invitationId: v.optional(v.id("invitations")), requestId: v.optional(v.id("requests")), meetingId: v.optional(v.id("meetings")), memberId: v.optional(v.id("memberships")), eventKey: v.optional(v.string()), kind: v.union(v.literal("invitation"), v.literal("cover_request"), v.literal("meeting")), recipient: v.string(), state: v.union(v.literal("awaiting_configuration"), v.literal("queued"), v.literal("cancelled")), providerId: v.optional(v.string()), createdAt: v.number() }).index("by_church", ["churchId"]).index("by_invitation", ["invitationId"]).index("by_church_event", ["churchId", "eventKey"]).index("by_church_state", ["churchId", "state"]).index("by_church_kind_state", ["churchId", "kind", "state"]),
  auditEvents: defineTable({ churchId: v.id("churches"), actorId: v.id("users"), action: v.string(), invitationId: v.optional(v.id("invitations")), commitmentId: v.optional(v.id("commitments")), targetId: v.optional(v.string()), at: v.number() }).index("by_church", ["churchId"]).index("by_church_action_target", ["churchId", "action", "targetId"]),
  // One row per member: the private address of their calendar feed.
  calendarFeeds: defineTable({ churchId: v.id("churches"), memberId: v.id("memberships"), token: v.string(), createdAt: v.number() }).index("by_token", ["token"]).index("by_member", ["memberId"]).index("by_church", ["churchId"]),

  // Help line, neighbor records, assistance, home visits and treasury.
  // Cover requests already own the name "requests"; requests for help are "assistanceRequests".
  // Reading any of these goes through neighborAccess() in access.ts.
  neighbors: defineTable({
    churchId: v.id("churches"),
    name: v.string(),
    nameKey: v.string(),
    phone: v.string(),
    phoneKey: v.string(),
    email: v.string(),
    address: v.string(),
    adults: v.number(),
    children: v.number(),
    /** What the household speaks: one of three codes, or "other" with its name beside it. */
    language: spoken,
    languageName: v.optional(v.string()),
    notes: v.string(),
    alert: v.optional(v.string()),
    // No names and a birth year, not a birth date, on purpose.
    household: v.optional(v.array(v.object({ relationship: v.string(), child: v.boolean(), birthYear: v.optional(v.number()) }))),
    // Monthly amounts.
    money: v.optional(v.object({
      income: v.array(v.object({ label: v.string(), amount: cents })),
      expenses: v.array(v.object({ label: v.string(), amount: cents })),
      updatedAt: v.number(),
    })),
    accounts: v.optional(v.array(v.object({
      kind: v.union(v.literal("landlord"), v.literal("utility"), v.literal("other")),
      name: v.string(), accountNumber: v.string(), phone: v.string(),
    }))),
    /** Records a person merged into this one: the name it had, who merged it, when, and what moved. Cleared when the record is removed. */
    mergedFrom: v.optional(v.array(v.object({ name: v.string(), by: v.id("memberships"), at: v.number(), moved: v.object({ calls: v.number(), requests: v.number(), visits: v.number(), ledger: v.number(), notes: v.number() }) }))),
    createdBy: v.id("memberships"),
    createdAt: v.number(),
  }).index("by_church", ["churchId"]).index("by_church_name", ["churchId", "nameKey"]).index("by_church_phone", ["churchId", "phoneKey"]).searchIndex("search_address", { searchField: "address", filterFields: ["churchId"] }),
  neighborNotes: defineTable({ churchId: v.id("churches"), neighborId: v.id("neighbors"), body: v.string(), authorId: v.id("memberships"), createdAt: v.number() }).index("by_neighbor", ["neighborId", "createdAt"]).index("by_church", ["churchId"]),
  referralAgencies: defineTable({ churchId: v.id("churches"), name: v.string(), phone: v.string(), helpsWith: v.string() }).index("by_church", ["churchId", "name"]),
  calls: defineTable({
    churchId: v.id("churches"),
    neighborId: v.optional(v.id("neighbors")),
    callerName: v.string(),
    phone: v.string(),
    note: v.string(),
    callback: v.union(v.literal("none"), v.literal("needed"), v.literal("done")),
    takenBy: v.id("memberships"),
    takenAt: v.number(),
    ownerId: v.optional(v.id("memberships")),
    returnedBy: v.optional(v.id("memberships")),
    returnedAt: v.optional(v.number()),
    outcome: v.optional(v.string()),
    /** The one next step the assistant read in the outcome at 0.9 or more (drafts.readOutcome). Only a suggestion: nothing follows from it. */
    nextStep: v.optional(v.object({ step: v.union(v.literal("resolved"), v.literal("request"), v.literal("refer"), v.literal("callAgain")), at: v.number() })),
    urgent: v.optional(v.object({ reasons: v.array(v.string()), day: v.optional(v.number()), by: v.union(v.literal("assistant"), v.literal("rules"), v.literal("person")), byMember: v.optional(v.id("memberships")) })),
    /** Whether the assistant read the note as the caller needing Spanish, at 0.9 or more. Asked only of a call with no neighbor linked. */
    spanish: v.optional(v.boolean()),
  }).index("by_church", ["churchId", "takenAt"]).index("by_church_callback", ["churchId", "callback"]).index("by_church_callback_returned", ["churchId", "callback", "returnedAt"]).index("by_neighbor", ["neighborId"]),
  // A request the assistant drafted from a call note, waiting for a person's yes. Kept so it survives a reload.
  // Only what the draft says, the call it came from, who asked and when: no neighbor name, phone or address.
  requestDrafts: defineTable({
    churchId: v.id("churches"),
    callId: v.id("calls"),
    kind: v.optional(v.union(v.literal("rent"), v.literal("utility"), v.literal("food"), v.literal("voucher"), v.literal("other"))),
    amountRequested: v.optional(cents),
    payeeKind: v.optional(v.union(v.literal("landlord"), v.literal("utility"), v.literal("vendor"))),
    payeeName: v.string(),
    quote: v.string(),
    notes: v.array(v.string()),
    verification: v.union(v.literal("review"), v.literal("checked")),
    createdBy: v.id("memberships"),
    createdAt: v.number(),
  }).index("by_church", ["churchId", "createdAt"]).index("by_call", ["callId"]),
  // One call to the assistant about a call note, as it was made: the text exactly as it left (already scrubbed, but held
  // as sensitive, since the scrub works by rules), each question and the answer that came back, and the model that answered.
  // It goes with the call it explains, and a draft's goes with the draft. "What the assistant saw" shows the latest.
  aiReads: defineTable({
    churchId: v.id("churches"),
    callId: v.id("calls"),
    purpose: v.union(v.literal("draft"), v.literal("urgency")),
    sentText: v.string(),
    // Each question's words are kept once, in aiQuestions: they are fixed by the code, and a row points at them.
    asked: v.array(v.object({ key: v.string(), question: v.id("aiQuestions"), answer: v.union(v.number(), v.null()), choice: v.optional(v.string()), yes: v.boolean() })),
    model: v.string(),
    outcome: v.union(v.literal("checked"), v.literal("review")),
    at: v.number(),
  }).index("by_church", ["churchId", "at"]).index("by_call", ["callId", "purpose", "at"]).index("by_at", ["at"]),
  // The words of one question the assistant was asked, as the code wrote them. They hold nothing from a note.
  aiQuestions: defineTable({ text: v.string() }).index("by_text", ["text"]),
  assistanceRequests: defineTable({
    churchId: v.id("churches"),
    neighborId: v.id("neighbors"),
    callId: v.optional(v.id("calls")),
    kind: v.union(v.literal("rent"), v.literal("utility"), v.literal("food"), v.literal("voucher"), v.literal("other")),
    summary: v.string(),
    amountRequested: cents,
    amountApproved: v.optional(cents),
    status: v.union(v.literal("open"), v.literal("approved"), v.literal("declined"), v.literal("paid"), v.literal("closed")),
    decisionNote: v.string(),
    decidedBy: v.optional(v.id("memberships")),
    decidedAt: v.optional(v.number()),
    // Closing a request is recorded apart from the decision, so who approved the money is never overwritten.
    closedBy: v.optional(v.id("memberships")),
    closedAt: v.optional(v.number()),
    payeeKind: v.union(v.literal("landlord"), v.literal("utility"), v.literal("vendor"), v.literal("neighbor")),
    payeeName: v.string(),
    source: v.union(v.literal("person"), v.literal("ai_draft"), v.literal("import")),
    referral: v.optional(v.string()),
    referrals: v.optional(v.array(v.string())),
    voucher: v.optional(v.object({ item: v.string(), quantity: v.number() })),
    /** Goods handed over with the decision, as counts of items: the national report's in-kind food, furniture and clothing. */
    goods: v.optional(v.object({ food: v.number(), furniture: v.number(), clothing: v.number() })),
    // What the earlier system recorded as help provided, on a request brought over from it.
    importedAmount: v.optional(cents),
    createdBy: v.id("memberships"),
    createdAt: v.number(),
  }).index("by_church", ["churchId", "createdAt"]).index("by_church_status", ["churchId", "status"]).index("by_neighbor", ["neighborId"]),
  visits: defineTable({
    churchId: v.id("churches"),
    neighborId: v.id("neighbors"),
    requestId: v.optional(v.id("assistanceRequests")),
    scheduledAt: v.number(),
    status: v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled")),
    visitors: v.array(v.object({ memberId: v.id("memberships"), hours: v.number(), miles: v.number(), response: v.optional(v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"))) })),
    notes: v.string(),
    completedAt: v.optional(v.number()),
    /** Where the visit was, for the national report's visit lines; unset reads as a home visit. */
    place: v.optional(v.union(v.literal("home"), v.literal("prison"), v.literal("hospital"), v.literal("eldercare"), v.literal("other"))),
    /** Hours given on this visit by volunteers who are not members, all of them together. */
    guestHours: v.optional(v.number()),
    /** What the assistant read in the written-up note: a kind of help and signs, each at 0.9 or more. A person decides what follows. */
    found: v.optional(v.object({ kind: v.optional(v.union(v.literal("rent"), v.literal("utility"), v.literal("food"), v.literal("voucher"), v.literal("other"))), signs: v.array(v.string()), at: v.number() })),
    /** Who called the visit off, and when: so that one member can undo it from the line that said so. */
    cancelledBy: v.optional(v.id("memberships")),
    cancelledAt: v.optional(v.number()),
    createdBy: v.id("memberships"),
    createdAt: v.number(),
  }).index("by_church", ["churchId", "scheduledAt"]).index("by_church_status_completed", ["churchId", "status", "completedAt"]).index("by_neighbor", ["neighborId"]).index("by_request", ["requestId"]),
  ledgerEntries: defineTable({
    churchId: v.id("churches"),
    kind: v.union(v.literal("income"), v.literal("expense")),
    amount: cents,
    date: day,
    category: v.string(),
    payee: v.string(),
    memo: v.string(),
    requestId: v.optional(v.id("assistanceRequests")),
    neighborId: v.optional(v.id("neighbors")),
    voidedAt: v.optional(v.number()),
    reverses: v.optional(v.id("ledgerEntries")),
    checkNumber: v.optional(v.string()),
    clearedOn: v.optional(day),
    depositId: v.optional(v.id("deposits")),
    recordedBy: v.id("memberships"),
    createdAt: v.number(),
  }).index("by_church", ["churchId", "date"]).index("by_request", ["requestId"]).index("by_neighbor", ["neighborId"]).index("by_reverses", ["reverses"]).index("by_deposit", ["depositId"]),
  // Who the conference pays: landlords, utilities and vendors. No account numbers and no money here.
  payees: defineTable({ churchId: v.id("churches"), kind: v.union(v.literal("landlord"), v.literal("utility"), v.literal("vendor")), name: v.string(), nameKey: v.string(), address: v.string(), phone: v.string(), email: v.string(), notes: v.string(), createdBy: v.id("memberships"), createdAt: v.number() }).index("by_church", ["churchId", "name"]).index("by_church_name", ["churchId", "nameKey"]),
  // The treasury's own books: bank deposits, the voucher shelf, the group's own kinds of money in and out, and agreed bank statements.
  deposits: defineTable({ churchId: v.id("churches"), date: day, total: cents, memo: v.string(), recordedBy: v.id("memberships"), createdAt: v.number() }).index("by_church", ["churchId", "date"]),
  // change is a whole number: plus when vouchers are received, minus when given.
  voucherStock: defineTable({ churchId: v.id("churches"), date: day, change: v.number(), item: v.string(), note: v.string(), requestId: v.optional(v.id("assistanceRequests")), recordedBy: v.id("memberships"), createdAt: v.number() }).index("by_church", ["churchId", "date"]).index("by_request", ["requestId"]),
  ledgerKinds: defineTable({ churchId: v.id("churches"), direction: v.union(v.literal("income"), v.literal("expense")), name: v.string(), nameKey: v.string(), retiredAt: v.optional(v.number()), recordedBy: v.id("memberships"), createdAt: v.number() }).index("by_church_key", ["churchId", "nameKey"]),
  // balance is in cents and may be zero or negative.
  bankStatements: defineTable({ churchId: v.id("churches"), endsOn: day, balance: v.number(), agreedBy: v.id("memberships"), agreedAt: v.number() }).index("by_church", ["churchId", "endsOn"]),
  // Two records a person may need to look at as one household: once the notes have been read, or once a person said they are not.
  // `first` is the lower id of the two, so a pair has one row. Neither name nor anything said about them is kept here.
  duplicatePairs: defineTable({
    churchId: v.id("churches"), first: v.id("neighbors"), second: v.id("neighbors"),
    /** How sure the assistant was that the two records' notes describe one household, 0 to 1, and when it read them. */
    read: v.optional(v.object({ same: v.number(), at: v.number(), /** The question it answered; none means the first wording, which is asked again. */ question: v.optional(v.literal("people")) })),
    dismissedBy: v.optional(v.id("memberships")), dismissedAt: v.optional(v.number()),
  }).index("by_pair", ["first", "second"]).index("by_second", ["second"]).index("by_church", ["churchId"]),
  // A pair of members, or a phone shared by several households, that a person looked at and said is fine. `key` is the sorted ids, or the phone's digits.
  duplicateDismissals: defineTable({ churchId: v.id("churches"), kind: v.union(v.literal("person"), v.literal("phone")), key: v.string(), by: v.id("memberships"), at: v.number() }).index("by_church", ["churchId", "kind", "key"]),
});
