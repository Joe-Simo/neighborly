import type { FirstRoom } from "@/lib/first-room";
import type { LiveWorkspaceData } from "@/components/workspace/types";

/**
 * In the iOS app, This week's first screen is kept on the device (SceneDelegate.swift, KeptRoom) so the next launch
 * draws it at once, as a first look (first-look.tsx), while the session and the live data catch up. What is kept is
 * what that screen shows: names, counts, row status, the conference's own places and its announcements. Never an
 * email, a preparation note or a time-off note, and nothing about a neighbor beyond the week's counts. The device
 * keeps it in the app's own protected storage, never in the web view's, and lets it go after a day.
 */
type Kept = { memberId: string; churchId: string; room: FirstRoom; allowed: boolean; visiting: boolean };
type Keep = { webkit?: { messageHandlers?: { kindHelpsKeep?: { postMessage: (body: string | null) => void } } } };

const GONE = "kind-helps:kept-gone";
const handler = () => (typeof window === "undefined" ? undefined : (window as Keep).webkit?.messageHandlers?.kindHelpsKeep);

/** Inside the iOS app, which keeps This week's first screen; the website keeps nothing and asks nothing for it. */
export const canKeep = () => handler() !== undefined;

/** The kept room the app handed this page at launch, if there is one. */
export function keptRoom(): Kept | null {
  if (typeof window === "undefined") return null;
  const kept: unknown = Reflect.get(window, "kindHelpsKept");
  if (!isKept(kept)) return null;
  // No email is ever kept: the room is drawn with none, as for a member whose email is not theirs to see.
  if (!withoutEmails.has(kept.room)) {
    kept.room.user.email = "";
    for (const person of kept.room.people) person.email = "";
    withoutEmails.add(kept.room);
  }
  return kept;
}
const has = (value: unknown, key: string) => typeof value === "object" && value !== null && key in value;
/** What the app hands over is the app's own file, read back as written: its two ids, and a room with a user and people. */
const isKept = (value: unknown): value is Kept =>
  has(value, "memberId") && has(value, "churchId") && has(value, "room") &&
  typeof Reflect.get(Object(value), "memberId") === "string" && typeof Reflect.get(Object(value), "churchId") === "string" &&
  has(Reflect.get(Object(value), "room"), "user") && Array.isArray(Reflect.get(Reflect.get(Object(value), "room"), "people"));
const withoutEmails = new WeakSet<object>();

/**
 * The help line's first screen, kept the same way and with the same protection (SceneDelegate.swift, KeptRoom): the
 * three readings the room draws from, for a launch from the Home Screen's widget or its quick action. It holds callers'
 * names and numbers, so it is the device's protected file, never the web view's, gone on sign-out and after a day.
 */
type KeptHelpLine = { memberId: string; churchId: string; answers: Record<string, unknown> };

/** The help line the app handed this page at launch, if it is the kept room's own member and conference. */
export function keptHelpLine(): KeptHelpLine | null {
  if (typeof window === "undefined") return null;
  const kept: unknown = Reflect.get(window, "kindHelpsKeptHelpLine");
  const room = keptRoom();
  if (!room || !has(kept, "answers")) return null;
  const field = (key: string): unknown => Reflect.get(Object(kept), key);
  const answers = field("answers");
  if (field("memberId") !== room.memberId || field("churchId") !== room.churchId || typeof answers !== "object" || answers === null) return null;
  return { memberId: room.memberId, churchId: room.churchId, answers: Object.fromEntries(Object.entries(answers)) };
}

/** Keeps the help line's readings as the signed-in member has them now. Only inside the app. */
export function keepHelpLine(memberId: string, churchId: string, answers: Record<string, unknown>) {
  const keep = handler();
  if (!keep) return;
  keep.postMessage(JSON.stringify({ helpLine: { memberId, churchId, answers } }));
}

/** The week's counts for someone who may not see them: never drawn (week-note.tsx draws nothing then), kept as zeros. */
export const emptyNote: FirstRoom["weekNote"] = { callsWaiting: 0, callsFirstByAssistant: 0, callsFirstByRules: 0, callsFirstByPerson: 0, oldestWaitingDays: 0, visitsPlanned: 0, requestsOpen: 0, approvedUnpaid: 0, approvedUnpaidCents: 0, openPlaces: 0, away: 0 };

/** Lets the kept room go: on the device, and for this page and its reloads. */
export function forgetKeptRoom() {
  // Only the iOS app keeps a room; the website has nothing to let go.
  const keep = handler();
  if (!keep) return;
  delete (window as { kindHelpsKept?: unknown }).kindHelpsKept;
  delete (window as { kindHelpsKeptHelpLine?: unknown }).kindHelpsKeptHelpLine;
  try {
    sessionStorage.setItem(GONE, "1");
  } catch {
    // The device has let it go below; only a reload in this same session could be handed it again.
  }
  keep.postMessage(null);
}

/** Keeps This week's first screen as the signed-in member has it now. Only inside the app; the website keeps nothing. */
export function keepRoom(
  data: LiveWorkspaceData,
  look: Pick<FirstRoom, "weekNote" | "draftsWaiting"> & { allowed: boolean; visiting: boolean },
  requestCommitments: LiveWorkspaceData["commitments"],
) {
  const keep = handler();
  if (!keep) return;
  const commitment = (shift: LiveWorkspaceData["commitments"][number]) => ({
    id: shift.id, teamId: shift.teamId, title: shift.title, start: shift.start, end: shift.end, location: shift.location,
    preparation: "", assigneeId: shift.assigneeId, version: shift.version, status: shift.status, coordinatorName: shift.coordinatorName,
  });
  const announcement = (note: LiveWorkspaceData["announcements"][number]) => ({ id: note.id, title: note.title, body: note.body, authorName: note.authorName, createdAt: note.createdAt });
  const request = (asking: LiveWorkspaceData["requests"][number]) => ({ id: asking.id, commitmentId: asking.commitmentId, recipientId: asking.recipientId, status: asking.status });
  const byId = new Map(requestCommitments.map((shift) => [shift.id, shift]));
  const room = {
    church: { id: data.church.id, name: data.church.name, timeZone: data.church.timeZone, sample: data.church.sample, wordSet: data.church.wordSet },
    user: { id: data.user.id, name: data.user.name, language: data.user.language },
    canCoordinate: data.canCoordinate,
    truncated: data.truncated,
    teams: data.teams.map((team) => ({ id: team.id, name: team.name, description: team.description, memberIds: team.memberIds, approvedMemberIds: team.approvedMemberIds, myInvitation: team.myInvitation, canCoordinate: team.canCoordinate, memberRoles: team.memberRoles.map((role) => ({ personId: role.personId, role: role.role })) })),
    people: data.people.map((person) => ({ id: person.id, name: person.name, role: person.role, active: person.active, approved: person.approved, coverOptIn: person.coverOptIn })),
    commitments: data.commitments.map(commitment),
    requests: data.requests.map(request),
    availability: data.availability.map((free) => ({ id: free.id, personId: free.personId, start: free.start, end: free.end })),
    timeOff: data.timeOff.map((away) => ({ id: away.id, personId: away.personId, start: away.start, end: away.end, note: "" })),
    tasks: data.tasks.map((task) => ({ id: task.id, title: task.title, dueAt: task.dueAt, assigneeId: task.assigneeId, complete: task.complete })),
    meetings: data.meetings.map((meeting) => ({ id: meeting.id, title: meeting.title, start: meeting.start, end: meeting.end, location: meeting.location, fanoutStatus: meeting.fanoutStatus, responsesLimitedToSelf: meeting.responsesLimitedToSelf, responses: meeting.responses.map((answer) => ({ personId: answer.personId, response: answer.response })) })),
    announcements: data.announcements.map(announcement),
    invitations: [],
    firstRequests: data.requests.map((asking) => {
      const shift = byId.get(asking.commitmentId);
      return { ...request(asking), commitment: shift ? commitment(shift) : null };
    }),
    firstAnnouncements: data.announcements.map(announcement),
    weekNote: look.weekNote,
    draftsWaiting: look.draftsWaiting,
  };
  keep.postMessage(JSON.stringify({ memberId: data.user.id, churchId: data.church.id, room, allowed: look.allowed, visiting: look.visiting }));
}
