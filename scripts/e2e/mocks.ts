// Stand-ins for Clerk and Convex, for the browser checks in scripts/ that run against a built site (`next start`)
// with no real accounts: Clerk's script is answered with a small fake whose sign-in, sign-out and ended-elsewhere are
// driven from the check, and Convex's socket is answered by a fake backend that reads the caller's token and answers
// for that member only (nobody signed in is refused, as the real backend refuses). The fake keeps its session in the
// tab's sessionStorage (`__mock_signed_in`) and sets no cookie, so the server, which cannot check a fake, sends every
// page as to someone signed out and the session is picked up again in the browser. It also stands in for the iOS
// app's side of the kept room (lib/kept-room.ts), the way SceneDelegate.swift hands it to the page.
import type { BrowserContext, Page } from "playwright-core";

/** One member, with everything the fake backend says about them and their conference. */
export type Member = {
  userId: string;
  sessionId: string;
  name: string;
  email: string;
  church: { id: string; name: string };
  /** Other members of the conference, by name. */
  people: string[];
  team: string;
  announcement: string;
};

/** Every string of a member's that would say who was here, if it showed for someone else. */
export const traces = (member: Member) => [
  member.userId,
  member.sessionId,
  member.name,
  member.email,
  member.church.id,
  member.church.name,
  ...member.people,
  member.team,
  member.announcement,
];

const token = (member: Member) => {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256", typ: "JWT" })}.${part({ sub: member.userId, sid: member.sessionId, iat: 1700000000, exp: 4000000000 })}.sig`;
};

/** Clerk's browser script, faked. `window.__clerkMock` signs a member in, signs out, or ends the session elsewhere. */
function clerkScript() {
  type Who = { userId: string; sessionId: string; name: string; email: string; jwt: string };
  type Listener = (resources: object) => void;
  const listeners = new Set<Listener>();
  const statusListeners = new Set<(status: string) => void>();
  const errors = { fields: {}, raw: [], global: [] };
  const signals = {
    signIn: { errors, fetchStatus: "idle", signIn: { status: null } },
    signUp: { errors, fetchStatus: "idle", signUp: { status: null } },
    waitlist: { errors, fetchStatus: "idle", waitlist: {} },
  };
  let options: { routerPush?: (to: string) => unknown } = {};
  const clerk: Record<string, unknown> & { session: unknown; user: unknown; client: unknown } = {
    loaded: false,
    version: "5.0.0",
    sdkMetadata: {},
    client: undefined,
    session: null,
    user: null,
    organization: null,
    status: "loading",
  };
  const emit = () => {
    const resources = { client: clerk.client, session: clerk.session, user: clerk.user, organization: null };
    clerk.__internal_lastEmittedResources = resources;
    for (const listener of listeners) listener(resources);
  };
  const signIn = (who: Who) => {
    const user = { id: who.userId, firstName: who.name, fullName: who.name, primaryEmailAddress: { emailAddress: who.email }, emailAddresses: [], publicMetadata: {}, unsafeMetadata: {}, organizationMemberships: [] };
    const session = {
      id: who.sessionId,
      status: "active",
      user,
      lastActiveToken: { jwt: { claims: { sub: who.userId, sid: who.sessionId } }, getRawString: () => who.jwt },
      lastActiveOrganizationId: null,
      actor: null,
      factorVerificationAge: null,
      checkAuthorization: () => true,
      getToken: () => Promise.resolve(who.jwt),
    };
    clerk.user = user;
    clerk.session = session;
    clerk.client = { signIn: {}, signUp: {}, sessions: [session], activeSessions: [session], lastActiveSessionId: who.sessionId };
    sessionStorage.setItem("__mock_signed_in", JSON.stringify(who));
    emit();
  };
  const signedOut = () => {
    clerk.user = null;
    clerk.session = null;
    clerk.client = { signIn: {}, signUp: {}, sessions: [], activeSessions: [] };
    sessionStorage.removeItem("__mock_signed_in");
    emit();
  };
  Object.assign(clerk, {
    load(given: typeof options) {
      options = given ?? {};
      clerk.loaded = true;
      clerk.status = "ready";
      const held = sessionStorage.getItem("__mock_signed_in");
      if (held) signIn(JSON.parse(held));
      else {
        clerk.client = { signIn: {}, signUp: {}, sessions: [] };
        emit();
      }
      queueMicrotask(() => statusListeners.forEach((listener) => listener("ready")));
      return Promise.resolve();
    },
    addListener(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    on(event: string, listener: (status: string) => void, notify?: { notify?: boolean }) {
      if (event !== "status") return;
      statusListeners.add(listener);
      if (notify?.notify) listener(clerk.status as string);
    },
    off(_event: string, listener: (status: string) => void) {
      statusListeners.delete(listener);
    },
    // Clerk's own sign-out: the session goes, then the page is taken to the address asked for, through Next's router.
    async signOut(asked?: { redirectUrl?: string }) {
      signedOut();
      const to = asked?.redirectUrl ?? "/";
      if (options.routerPush) await options.routerPush(to);
      else window.location.assign(to);
    },
    setActive: () => Promise.resolve(),
    __internal_getOption: () => undefined,
    __internal_state: {
      // The same object every time: React reads these as external stores.
      signInSignal: () => signals.signIn,
      signUpSignal: () => signals.signUp,
      waitlistSignal: () => signals.waitlist,
      __internal_effect: (run: () => void) => {
        run();
        return () => {};
      },
      __internal_computed: (run: () => unknown) => run,
    },
  });
  Object.assign(window, { Clerk: clerk, __clerkMock: { signIn, endElsewhere: signedOut } });
}

/** The iOS app's part: what it keeps, and the kept room handed to the page before its scripts run (SceneDelegate.swift). */
function appScript(kept: string | null) {
  Object.assign(window, {
    webkit: {
      messageHandlers: {
        kindHelpsKeep: { postMessage: (body: string | null) => void (window as unknown as { __appKeep: (body: string | null) => Promise<void> }).__appKeep(body) },
      },
    },
  });
  try {
    if (kept && !sessionStorage.getItem("kind-helps:kept-gone")) Object.assign(window, { kindHelpsKept: JSON.parse(kept) });
  } catch {
    // As the app's own script: storage closed, nothing handed.
  }
}

const now = Date.now();
const dashboard = (member: Member) => ({
  church: { id: member.church.id, name: member.church.name, timeZone: "America/Chicago", sample: false, wordSet: "vincentian" },
  user: { id: member.userId, name: member.name, email: member.email, language: "en", joinedAt: now - 86400000 },
  canCoordinate: true,
  truncated: [],
  teams: [{ id: `${member.church.id}_team`, name: member.team, description: "", memberIds: [member.userId], approvedMemberIds: [member.userId], myInvitation: null, canCoordinate: true, memberRoles: [{ personId: member.userId, role: "leader" }] }],
  people: [member.name, ...member.people].map((name, index) => ({
    id: index === 0 ? member.userId : `${member.userId}_p${index}`,
    name,
    email: "",
    role: index === 0 ? "owner" : "member",
    active: true,
    approved: true,
    coverOptIn: false,
  })),
  commitments: [],
  requests: [],
  availability: [],
  timeOff: [],
  tasks: [],
  meetings: [],
  announcements: [],
  invitations: [],
});
const announcement = (member: Member) => ({ id: `${member.church.id}_note`, title: member.announcement, body: member.announcement, authorName: member.name, createdAt: now - 3600000 });
const weekNote = { callsWaiting: 0, callsFirstByAssistant: 0, callsFirstByRules: 0, callsFirstByPerson: 0, oldestWaitingDays: 0, visitsPlanned: 0, requestsOpen: 0, approvedUnpaid: 0, approvedUnpaidCents: 0, openPlaces: 0, away: 0 };

/** What the fake backend answers a reading, for the member signed in on that socket. `undefined`: refused. */
function answer(member: Member | undefined, path: string, args: Record<string, unknown>) {
  if (!member) return undefined;
  if (args.churchId !== undefined && args.churchId !== member.church.id) return undefined;
  if (args.paginationOpts) return { page: path === "pages:announcementsPage" ? [announcement(member)] : [], isDone: true, continueCursor: "end" };
  switch (path) {
    case "workspace:viewer": return { churches: [member.church], truncated: false };
    case "demo:visiting": return false;
    case "workspace:dashboard": return dashboard(member);
    case "drafts:weekNote": return weekNote;
    case "assistance:drafts": return [];
    case "access:canOpenNeighborRecords": return true;
    case "glance:home": return { own: { visitAsks: 0, tasks: 0, tasksLate: 0 }, conference: null, councils: [] };
    case "quilt:week": return [];
    case "assistance:calls": return { waiting: [], returned: [], spanishSpeakers: [] };
    default: return null;
  }
}

export type Mocked = {
  /** Signs this member in through the fake Clerk, as a finished sign-in does. */
  signIn: (page: Page, member: Member) => Promise<void>;
  /** The session ends without the app's sign-out (it ran out, or was ended on another device). */
  endElsewhere: (page: Page) => Promise<void>;
  /** The room the iOS app holds for the next launch, as the page last asked it to keep. */
  appKept: () => string | null;
  /** A new launch of the app: the page is handed what the app holds now. */
  launch: (page: Page) => Promise<void>;
};

/**
 * Answers Clerk and Convex for every page of the context. With `app`, the context is the iOS app's web view: its user
 * agent says so (the offline worker keeps its pages then, app/sw.ts) and it keeps This week for the next launch.
 */
export async function mock(context: BrowserContext, members: Member[], { app = false } = {}): Promise<Mocked> {
  const byToken = new Map(members.map((member) => [token(member), member]));
  let kept: string | null = null;
  await context.route(/clerk\.browser|clerk-js|@clerk\/ui|ui\.browser/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: /clerk\.browser|clerk-js/.test(route.request().url()) ? `(${clerkScript.toString()})()` : "",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await context.route(/clerk\.example\.com\/v1/, (route) => route.abort());
  if (app) await context.exposeFunction("__appKeep", (body: string | null) => void (kept = body));
  await context.routeWebSocket(/convex\.cloud/, (socket) => {
    const u64 = (n: number) => {
      const bytes = Buffer.alloc(8);
      bytes.writeBigUInt64LE(BigInt(n));
      return bytes.toString("base64");
    };
    type Version = { querySet: number; ts: number; identity: number };
    let version: Version = { querySet: 0, ts: 0, identity: 0 };
    let member: Member | undefined;
    const queries = new Map<number, { udfPath: string; args: Record<string, unknown>[] }>();
    const encode = (at: Version) => ({ querySet: at.querySet, ts: u64(at.ts), identity: at.identity });
    const send = (message: object) => socket.send(JSON.stringify(message));
    const result = (queryId: number) => {
      const query = queries.get(queryId)!;
      const value = answer(member, query.udfPath, query.args[0] ?? {});
      return value === undefined
        ? { type: "QueryFailed", queryId, errorMessage: "Not signed in, or not a member of this conference.", logLines: [], journal: null }
        : { type: "QueryUpdated", queryId, value, logLines: [], journal: null };
    };
    const transition = (next: Version, modifications: object[]) => {
      send({ type: "Transition", startVersion: encode(version), endVersion: encode(next), modifications });
      version = next;
    };
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.type === "ModifyQuerySet") {
        const modifications: object[] = [];
        for (const change of message.modifications) {
          if (change.type === "Add") {
            queries.set(change.queryId, change);
            modifications.push(result(change.queryId));
          } else if (change.type === "Remove") {
            queries.delete(change.queryId);
            modifications.push({ type: "QueryRemoved", queryId: change.queryId });
          }
        }
        transition({ ...version, querySet: message.newVersion, ts: version.ts + 1 }, modifications);
      } else if (message.type === "Authenticate") {
        // Every reading is asked again for whoever the new token names, as the real backend does.
        member = message.tokenType === "User" ? byToken.get(message.value) : undefined;
        transition({ ...version, ts: version.ts + 1, identity: message.baseVersion + 1 }, [...queries.keys()].map(result));
      } else if (message.type === "Mutation") {
        const ts = version.ts + 1;
        send({ type: "MutationResponse", requestId: message.requestId, success: true, result: null, ts: u64(ts), logLines: [] });
        transition({ ...version, ts }, []);
      } else if (message.type === "Action") {
        send({ type: "ActionResponse", requestId: message.requestId, success: true, result: null, logLines: [] });
      }
    });
  });
  if (app) await context.addInitScript(appScript, null);
  const who = (member: Member) => ({ userId: member.userId, sessionId: member.sessionId, name: member.name, email: member.email, jwt: token(member) });
  return {
    signIn: (page, member) => page.evaluate((signedIn) => (window as unknown as { __clerkMock: { signIn: (who: object) => void } }).__clerkMock.signIn(signedIn), who(member)),
    endElsewhere: (page) => page.evaluate(() => (window as unknown as { __clerkMock: { endElsewhere: () => void } }).__clerkMock.endElsewhere()),
    appKept: () => kept,
    launch: async (page) => {
      await page.addInitScript(appScript, kept);
      await page.reload();
    },
  };
}
