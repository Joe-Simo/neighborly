"use client";

import { Suspense, lazy, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { noSessionKept } from "@/lib/no-session-kept";
import { fetchRoom } from "@/components/workspace/sections";
import { fetchAhead } from "@/components/workspace/relief-ahead";
import { headings } from "@/components/workspace/navigation";
import { useAction, useConvexConnectionState, useMutation, useQueries, type RequestForQueries } from "convex/react";
import { useHour, usePaginatedQuery, useQuery } from "@/components/workspace/query";
import { FirstLookProvider, firstLookData, useAfterLook, useFirstRoom, useKeptPress } from "@/components/workspace/first-look";
import { useClerk } from "@clerk/nextjs";
import { forgetThisBrowser, forgetWhoWasHere } from "@/lib/forget-browser";
import { useAccount } from "@/components/live-providers";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useDashboard, useFirstChurch } from "@/components/workspace/dashboard";
import { LiveAuth, type LiveEntryIntent } from "@/components/live-auth";
import { authWords, DrawnIn, leftKey, useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor, type Language, type Words } from "@/lib/words";
import { useBook } from "@/lib/words/use-book";
import type { LiveArea } from "@/components/workspace/areas";
import { stateWords } from "@/components/workspace/failure";
import { LiveRoomLoading } from "@/components/workspace/primitives";
import "@/components/public-state.css";
import { LiveWorkspace } from "@/components/workspace/shell";
import { RoomsAhead } from "@/components/workspace/rooms-ahead";
import { canKeep, emptyNote, forgetKeptRoom, keepRoom, keptHelpLine, keptRoom } from "@/lib/kept-room";
import { DoorSweep, carryTheCard, useDoor } from "@/components/workspace/door";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { randomId } from "@/lib/random-id";

const noChange = () => () => {};

/**
 * No connection: the device says it is offline, the backend's socket has tried and failed to open, or this site
 * itself does not answer (asked every few seconds while there is no backend connection; the device's own flag is
 * often still "online" on a network that reaches nothing). A page still opening its first connection is not offline.
 */
function useOffline() {
  const offDevice = useSyncExternalStore(
    (changed) => {
      window.addEventListener("online", changed);
      window.addEventListener("offline", changed);
      return () => {
        window.removeEventListener("online", changed);
        window.removeEventListener("offline", changed);
      };
    },
    () => !navigator.onLine,
    () => false,
  );
  const link = useConvexConnectionState();
  const [unanswered, setUnanswered] = useState(false);
  useEffect(() => {
    if (link.isWebSocketConnected) return;
    let live = true;
    const ask = () =>
      fetch(`${window.location.origin}/app`, { method: "HEAD", cache: "no-store" })
        .then(() => live && setUnanswered(false))
        .catch(() => live && setUnanswered(true));
    const first = window.setTimeout(ask, 2000);
    const again = window.setInterval(ask, 5000);
    window.addEventListener("online", ask);
    return () => {
      live = false;
      window.clearTimeout(first);
      window.clearInterval(again);
      window.removeEventListener("online", ask);
    };
  }, [link.isWebSocketConnected]);
  return offDevice || (unanswered && !link.isWebSocketConnected) || (!link.isWebSocketConnected && link.connectionRetries > 1);
}

/** The first welcome (start or join a conference) is met once by each member: it travels on its own, asked for at the sign-in sheet. */
const welcome = () => import("@/components/live-welcome");
const LiveWelcome = lazy(() => welcome().then(({ LiveWelcome }) => ({ default: LiveWelcome })));

/** The app, with the door's sweep above whatever it is showing. */
let opened: number | undefined;
/** The hour this page was opened in, the same for every reading of it. */
const hourOpened = () => (opened ??= Math.floor(Date.now() / 3_600_000) * 3_600_000);

export function LiveApp(props: Parameters<typeof LiveRooms>[0]) {
  useRoomAhead(props.area ?? "week");
  return (
    <>
      <LiveRooms {...props} />
      <DoorSweep />
    </>
  );
}

/**
 * The room in the address is asked for the moment the page wakes: its code and its head picture (in the cut it will
 * be shown in) travel while Clerk and the backend are still saying who is here, instead of after the room's data
 * arrives. A browser that holds no session is going to the door, not a room, and asks for neither.
 */
function useRoomAhead(area: LiveArea) {
  const [first] = useState(area);
  useEffect(() => {
    if (noSessionKept(document.cookie)) return;
    void fetchRoom(first).catch(() => {});
    fetchAhead([headings[first].art.picture]);
  }, [first]);
}

function LiveRooms({
  area = "week",
  invitationToken = "",
  intent = "signin",
  sampleEntry = false,
  enterSample = false,
}: {
  area?: LiveArea;
  invitationToken?: string;
  intent?: LiveEntryIntent;
  sampleEntry?: boolean;
  /** Arrived by the home page's sample door: the sample opens without a second press. */
  enterSample?: boolean;
}) {
  const router = useRouter();
  const [entryHandled, setEntryHandled] = useState(false);
  const { ready, isAuthenticated, signedOut, unknown, clerkAnswered } = useAccount();
  // Through the sample door, This week is first drawn from the seed's public answer while the session is being made
  // (first-look.tsx). The look ends when the signed-in room is whole in hand, or when the sample will not open.
  // The seed's look is This week's: arriving in another room, the room simply waits for the session.
  const [viaSample] = useState(enterSample && sampleEntry && area === "week");
  const seedRoom = useFirstRoom(viaSample);
  // In the iOS app, This week as the member last saw it, kept on the device (lib/kept-room.ts), is the look instead:
  // drawn at once on launch while the session and the live data catch up.
  // Read after hydration (the server never has it), so the page the server drew is the page the client first draws.
  const handed = useSyncExternalStore(noChange, keptRoom, () => null);
  // The help line is kept too (for the Home Screen's widget and quick action); every other room waits for the session.
  const helpHanded = useSyncExternalStore(noChange, keptHelpLine, () => null);
  const helpKept = area === "help-line" ? helpHanded : null;
  const kept = viaSample || (area !== "week" && !helpKept) ? null : handed;
  const firstRoom = viaSample ? seedRoom : (kept?.room ?? null);
  const [lookOver, setLookOver] = useState(false);
  const [signedInRoom, setSignedInRoom] = useState(false);
  const look = firstRoom && !lookOver && !signedInRoom ? firstRoom : null;
  // Whether there will be a look is not known yet: until it is, neither the sheet nor the door stands in its place.
  const lookComing = firstRoom === undefined && !lookOver && !signedInRoom;
  const afterLook = useAfterLook(look !== null);
  useKeptPress(look !== null);
  // Through the sample door the account is always the one made-up visitor, whose row the nightly reset keeps, so its
  // rooms are asked for as soon as the backend accepts the token, beside the account check instead of after it.
  const asking = ready || (enterSample && isAuthenticated);
  const clerk = useClerk();
  // The sweep starts in the frame the sign-in sheet (or the sample's) leaves.
  // A first look is no door: the home page's card lifts off it by itself, and the session arriving behind it sweeps nothing.
  useDoor(signedOut && !look && !lookComing);
  // Said on the page for the home story's sheet (paper-arrival.tsx): a first look is a room it may lift off by itself;
  // without one, the door's sweep comes up over it and takes it.
  const firstLook = look !== null || lookComing;
  useLayoutEffect(() => void document.documentElement.toggleAttribute("data-first-look", firstLook), [firstLook]);
  // Someone at the door may be about to start or join a conference: the welcome is fetched while they sign in.
  useEffect(() => void (signedOut && welcome().catch(() => {})), [signedOut]);
  // With no seed answer the sample opens through the door as before, and the door's last sheet is the home page's card.
  // (The way in does not say so itself when it starts behind a look, where no sweep would ever take the card.)
  const noLook = viaSample && firstRoom === null;
  useEffect(() => {
    if (noLook && signedOut) carryTheCard();
  }, [noLook, signedOut]);
  // A session that ended without the app's sign-out leaves the last visit's traces; they go before the sheet is seen.
  useLayoutEffect(() => {
    if (signedOut) forgetWhoWasHere();
  }, [signedOut]);
  const signOut = () => {
    forgetThisBrowser();
    try {
      window.sessionStorage.setItem(leftKey, "1");
    } catch {
      // Without it the sign-in sheet opens as usual, without its "signed out" line.
    }
    return clerk.signOut({ redirectUrl: "/app" });
  };
  const viewer = useQuery(api.workspace.viewer, asking ? {} : "skip");
  const sampleVisitor = useQuery(api.demo.visiting, asking ? {} : "skip");
  // Sample visitors share one made-up member, so each reads the rooms in their own device's language, never a saved one.
  const [deviceLanguage] = useEntryLanguage();
  // The sample link always opens the sample. Someone already signed in as themselves is signed out
  // first; the sign-in screen then opens the sample without a second press.
  const leavingForSample = enterSample && sampleEntry && sampleVisitor === false;
  const leftForSample = useRef(false);
  useEffect(() => {
    if (!leavingForSample || leftForSample.current) return;
    leftForSample.current = true;
    forgetThisBrowser();
    void clerk.signOut({ redirectUrl: "/app?intent=sample" });
  }, [leavingForSample, clerk]);
  const churchPage = usePaginatedQuery(
    api.pages.churchesPage,
    asking ? {} : "skip",
    { initialNumItems: 30 },
  );
  const createChurch = useMutation(api.workspace.createChurch);
  const joinChurch = useAction(api.invitations.accept);
  const invite = useAction(api.invitations.create);
  const revokeInvitation = useMutation(api.invitations.revoke);
  const retryMeetingFanout = useMutation(api.workspace.retryMeetingFanout);
  const invitationRequest = useRef<{ key: string; id: string } | null>(null);
  const execute = useMutation(api.workspace.execute);
  const [invitationConsumed, setInvitationConsumed] = useState(false);
  // An invitation link is asked about once, for the name of its conference and nothing else (no name is a no), as soon as it is known who is here. Not
  // before: Convex drops an action in flight when the session is handed to it. A link that is no longer good is
  // said so on the sheet and then dropped, so nobody signs up for nothing. A question that fails is asked twice
  // more; if it still fails, or no answer comes in six seconds, the link is left to stand and joining checks it.
  const askInvitation = useAction(api.invitations.conference);
  /** The conference the link leads to, said on the welcome. Unknown if the question could not be asked. */
  const [invitedTo, setInvitedTo] = useState("");
  // A link whose token is not sixty-four hex digits was cut short or mistyped and can never be good: that is
  // said at once, with no question asked (the backend holds the same test before it reads anything).
  const couldBeAnInvitation = /^[0-9a-f]{64}$/.test(invitationToken);
  const [invitationGood, setInvitationGood] = useState<boolean | undefined>(
    !invitationToken ? true : couldBeAnInvitation ? undefined : false,
  );
  const invitationAnswered = useRef(!invitationToken || !couldBeAnInvitation);
  const whoIsKnown = (signedOut && clerkAnswered) || isAuthenticated;
  useEffect(() => {
    if (invitationAnswered.current || !whoIsKnown) return;
    let current = true;
    let again: ReturnType<typeof setTimeout> | undefined;
    const answer = (good: boolean, name = "") => {
      if (!current || invitationAnswered.current) return;
      invitationAnswered.current = true;
      setInvitedTo(name);
      setInvitationGood(good);
    };
    const ask = (left: number) =>
      void askInvitation({ token: invitationToken }).then((name) => answer(name !== null, name ?? ""), (cause: unknown) => {
        if (!current) return;
        if (left > 0) again = setTimeout(() => ask(left - 1), 600);
        else {
          console.error("The invitation link could not be checked.", cause);
          answer(true);
        }
      });
    ask(2);
    const limit = setTimeout(() => answer(true), 6000);
    return () => {
      current = false;
      clearTimeout(again);
      clearTimeout(limit);
    };
  }, [askInvitation, invitationToken, whoIsKnown]);
  const badInvite = invitationGood === false;
  const liveToken = badInvite ? "" : invitationToken;
  const [selectedChurch, setSelectedChurch] = useState<Id<"churches"> | null>(
    null,
  );
  const churches = [
    ...new Map(
      [...(viewer?.churches ?? []), ...churchPage.results].map((church) => [
        church.id,
        church,
      ]),
    ).values(),
  ];
  const churchId =
    churches.find((church) => church.id === selectedChurch)?.id ??
    churches[0]?.id;
  const dashboard = useDashboard({ churchId, enterSample, ready: asking, listing: viewer === undefined, sampleVisitor });
  // The rooms are first drawn in a transition, not in the update that brought their data: React then builds them a few
  // milliseconds at a time between frames, where in one piece they held a phone's frame for 60ms. The page stands as
  // it was meanwhile; a room already in hand (kept, or seen before) is drawn at once.
  const roomDrawn = useDeferredValue(!!dashboard);
  // The first room's lists name the same conference the room data does, asked as early (dashboard.ts), not after the list.
  const firstChurch = useFirstChurch({ churchId, enterSample, ready: asking, listing: viewer === undefined });
  // The page says which language it is showing, so a screen reader speaks Spanish as Spanish, in the rooms and in
  // every dialog (dialogs are drawn outside the rooms, straight under <body>). Before the rooms it is the door's.
  const shown = dashboard && !sampleVisitor ? dashboard.user.language : deviceLanguage;
  useEffect(() => {
    document.documentElement.lang = shown;
    return () => {
      document.documentElement.lang = "en";
    };
  }, [shown]);
  // A room, the welcome and the launch failure are drawn only once their reader's book is in hand: until then the launch
  // line stands, as it does while their data comes, so a Spanish reader never sees them in English first.
  const bookReady = useBook([deviceLanguage, shown, kept && !kept.visiting ? kept.room.user.language : undefined]);
  // Asked from the hour the app was opened, so the question stays the same and the first page is what is coming.
  // Read after the page wakes (0 on the server, which has no present hour), so the server can draw the door.
  const openedAt = useSyncExternalStore(noChange, hourOpened, () => 0);
  const commitmentPage = usePaginatedQuery(
    api.pages.commitmentsPage,
    firstChurch && openedAt && (area === "commitments" || area === "mine")
      ? { ...firstChurch, scope: area === "mine" ? "mine" : "all", from: openedAt }
      : "skip",
    { initialNumItems: 30 },
  );
  const peoplePage = usePaginatedQuery(
    api.pages.peoplePage,
    churchId && area === "people" ? { churchId } : "skip",
    { initialNumItems: 30 },
  );
  const taskPage = usePaginatedQuery(
    api.pages.tasksPage,
    churchId && area === "tasks" ? { churchId } : "skip",
    { initialNumItems: 30 },
  );
  const meetingPage = usePaginatedQuery(
    api.pages.meetingsPage,
    churchId && area === "tasks" ? { churchId } : "skip",
    { initialNumItems: 30 },
  );
  const requestPage = usePaginatedQuery(
    api.pages.requestsPage,
    firstChurch && (area === "week" || area === "mine" || area === "commitments")
      ? firstChurch
      : "skip",
    { initialNumItems: 30 },
  );
  const announcementPage = usePaginatedQuery(
    api.pages.announcementsPage,
    firstChurch && area === "week" ? firstChurch : "skip",
    { initialNumItems: 30 },
  );
  const invitationPage = usePaginatedQuery(
    api.pages.invitationsPage,
    churchId &&
      area === "people" &&
      dashboard?.people.find((person) => person.id === dashboard.user.id)
        ?.role === "owner"
      ? { churchId }
      : "skip",
    { initialNumItems: 30 },
  );
  const absencePage = usePaginatedQuery(
    api.pages.timeOffPage,
    churchId && area === "time-off" ? { churchId } : "skip",
    { initialNumItems: 30 },
  );
  const availabilityPage = usePaginatedQuery(
    api.pages.availabilityPage,
    churchId && area === "time-off" ? { churchId } : "skip",
    { initialNumItems: 30 },
  );
  const teamPage = usePaginatedQuery(
    api.pages.teamsPage,
    churchId && area === "team" ? { churchId } : "skip",
    { initialNumItems: 15 },
  );
  // A room's own first lists, on a first visit. A room seen in the last few minutes has them already.
  const firstPages: Partial<Record<LiveArea, { status: string }[]>> = {
    week: [requestPage, announcementPage],
    mine: [commitmentPage, requestPage],
    commitments: [commitmentPage, requestPage],
    people: [peoplePage],
    tasks: [taskPage, meetingPage],
    "time-off": [absencePage, availabilityPage],
    team: [teamPage],
  };
  const roomWaiting = (firstPages[area] ?? []).some((page) => page.status === "LoadingFirstPage");
  // Behind a first look the week's own three readings are asked for too, so the signed-in room has every answer on
  // its first frame. They are let go a moment after the change, once the room itself is asking them.
  const [aheadOfWeek, setAheadOfWeek] = useState(viaSample);
  // A kept look that ends without its live room (a wait that failed, no conference, access refused) lets the copy
  // go, so the next launch never draws a room this member can no longer open.
  useEffect(() => {
    if (kept && lookOver) forgetKeptRoom();
  }, [kept, lookOver]);
  // A kept room is read just after hydration: its look asks the week's readings ahead from that render on.
  if (kept && look && !aheadOfWeek) setAheadOfWeek(true);
  const hour = useHour();
  const week = useQueries(
    useMemo(
      (): RequestForQueries =>
        aheadOfWeek && firstRoom && churchId && hour
          ? {
              allowed: { query: api.access.canOpenNeighborRecords, args: { churchId } },
              note: { query: api.drafts.weekNote, args: { churchId, at: hour } },
              drafts: { query: api.assistance.drafts, args: { churchId } },
            }
          : {},
      [aheadOfWeek, firstRoom, churchId, hour],
    ),
  );
  const looking = look !== null;
  useEffect(() => {
    // Still to be learned whether there is a look, or one is on the page: the readings stay.
    if (lookComing || looking) return;
    const later = setTimeout(() => setAheadOfWeek(false), 2000);
    return () => clearTimeout(later);
  }, [lookComing, looking]);
  // The change is one commit: the look's rows and the signed-in room's are never on the page together.
  const weekInHand = !roomWaiting && week.allowed !== undefined && week.note !== undefined && week.drafts !== undefined;
  // In the iOS app, This week's first screen is kept on the device once it is whole and live, for the next launch to
  // draw at once (lib/kept-room.ts). It asks only what the room on screen is already asking, so nothing more is read.
  const keeping = area === "week" && look === null && !!dashboard && !!churchId && !!hour && canKeep();
  const allowedHere = useQuery(api.access.canOpenNeighborRecords, keeping && churchId ? { churchId } : "skip");
  const noteHere = useQuery(api.drafts.weekNote, keeping && churchId && allowedHere ? { churchId, at: hour } : "skip");
  const draftsHere = useQuery(api.assistance.drafts, keeping && churchId && sampleVisitor ? { churchId } : "skip");
  const keptNow = keeping && !roomWaiting && allowedHere !== undefined && (!allowedHere || noteHere !== undefined) && (!sampleVisitor || draftsHere !== undefined);
  useEffect(() => {
    if (!keptNow || !dashboard) return;
    keepRoom(
      { ...dashboard, requests: requestPage.results, announcements: announcementPage.results },
      { weekNote: noteHere ?? emptyNote, draftsWaiting: draftsHere?.length ?? 0, allowed: allowedHere === true, visiting: sampleVisitor === true },
      requestPage.results.flatMap((request) => (request.commitment ? [request.commitment] : [])),
    );
  }, [keptNow, dashboard, requestPage.results, announcementPage.results, noteHere, draftsHere, allowedHere, sampleVisitor]);
  // A kept help line changes over once the live calls are in hand (the room's own reading; nothing more is asked).
  const helpCalls = useQuery(api.assistance.calls, helpKept && churchId && hour ? { churchId, at: hour } : "skip");
  const roomInHand = area === "week" ? weekInHand : helpKept ? helpCalls !== undefined : true;
  if (look && dashboard && (kept ? sampleVisitor !== undefined : sampleVisitor === true) && roomInHand) setSignedInRoom(true);
  // A kept room is only ever the signed-in member's own: someone signed out, or another member or conference, ends it.
  if (kept && look && (signedOut || (dashboard && (dashboard.user.id !== kept.memberId || dashboard.church.id !== kept.churchId)))) {
    forgetKeptRoom();
    setLookOver(true);
  }
  // The signed-in room is in hand with no look on the page (the seed's answer is late, or the visitor was already
  // inside): the moment for a look has passed, and a late answer starts none.
  if (viaSample && !look && !signedInRoom && dashboard && sampleVisitor === true) setSignedInRoom(true);
  // Waiting to learn who is here, or for their workspace to arrive. A wait that outlasts ten seconds
  // (a session the backend will not accept, no connection) is said plainly, with a way on and a way out.
  const waiting = !leavingForSample && !signedOut && (!asking || !viewer || sampleVisitor === undefined);
  const offline = useOffline();
  // A kept room opened with no connection: when the connection returns, the sign-in service (whose own script never
  // came) is brought back by opening the page once more, the kept room drawn again at once and the cover laid over the
  // change by the app (SceneDelegate, kindHelpsReload), so the page is never seen half there. Once a visit.
  const wasOffline = useRef(false);
  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current || !kept || (window as { Clerk?: { loaded?: boolean } }).Clerk?.loaded) return;
    wasOffline.current = false;
    try {
      if (sessionStorage.getItem("kind-helps:back-online")) return;
      sessionStorage.setItem("kind-helps:back-online", "1");
    } catch {
      return;
    }
    const reload = (window as { webkit?: { messageHandlers?: { kindHelpsReload?: { postMessage: (body: null) => void } } } }).webkit?.messageHandlers?.kindHelpsReload;
    if (reload) reload.postMessage(null);
    else window.location.reload();
  }, [offline, kept]);
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    // The wait is counted with a connection only: it starts again from the moment the connection returns.
    if (!waiting || offline) return;
    const timer = setTimeout(() => setWaitedLong(true), 10000);
    return () => {
      clearTimeout(timer);
      setWaitedLong(false);
    };
  }, [waiting, offline]);
  // The sign-in sheet is for someone known to be signed out. Until that is known, and from then until
  // the workspace has arrived, there is one waiting screen and nothing else: a signed-in person goes
  // from it straight to their room. In a first look the sheet is not drawn, and the way in runs behind the room;
  // the sheet and the room keep their places here and below, so neither is ever made a second time.
  // A look is no way round a wait or a reset: a session the backend has not confirmed in ten seconds, or a sample
  // that is being laid anew, ends it, and what is said below is said as it always was.
  // With no connection a kept room stays as it was last seen, under one line that says so, until the connection
  // returns and the live room takes its place; it is neither ended nor let go for want of an answer.
  if (look && !(kept && offline) && ((waiting && waitedLong) || (!waiting && !signedOut && sampleVisitor === true && !churchId))) setLookOver(true);
  // A kept room whose member has no conference any more (removed, or the conference closed) ends here too.
  if (kept && look && !waiting && !signedOut && viewer && !churchId) setLookOver(true);
  if (look || signedOut || unknown) {
    // A sample visitor reads the rooms in their own device's language, kept room or not; a member in their saved one.
    const lookLanguage = kept && !kept.visiting ? kept.room.user.language : deviceLanguage;
    const first = look && bookReady && firstLookData(look, lookLanguage, kept ? { allowed: kept.allowed, visiting: kept.visiting, answers: helpKept?.answers } : {});
    // The sheet is drawn once, as what it will stay: not as "join" and then as sign-in with a notice.
    const sheetKnown = invitationGood !== undefined;
    const entry = badInvite ? "signin" : intent;
    // Someone with an invitation in hand came to join their own people: the sample is not offered on the way.
    return (
      <>
        {/* Drawn by the server too, with the launch line beside it: the page's head shows the one that holds
            (lib/door-early.ts), and the sheet is the same element once the page knows, so it is never drawn twice. */}
        {(signedOut || unknown) && sheetKnown && (unknown ? (["en", "es"] as const) : [deviceLanguage]).map((language) => (
          <div key={`door-${language}`} className="door-out" data-maybe={unknown ? "" : undefined} data-language={language}>
            <DrawnIn value={unknown ? language : null}>
              <LiveAuth key={entry} intent={entry} sampleEntry={sampleEntry && !liveToken} enterSample={enterSample} badInvite={badInvite} behind={!!first || lookComing || (!!look && !bookReady)} onSampleRefused={() => setLookOver(true)} />
            </DrawnIn>
          </div>
        ))}
        {/* Nor is the sheet drawn before it is known whether a room will be: the launch line stands until then. */}
        {!first && (unknown || lookComing || (!!look && !bookReady) || !sheetKnown) && (
          <div key="wait" className="door-wait" data-maybe={unknown ? "" : undefined}>
            <LiveRoomLoading />
          </div>
        )}
        {first && (
          <FirstLookProvider key="room" value={first.look}>
            <LiveWorkspace
              area={area}
              // Any other room waits for the session, on This week's head, as a room does while its lists load.
              roomWaiting={area !== "week" && !helpKept}
              requestCommitments={first.requestCommitments}
              data={first.data}
              sampleVisitor={kept ? kept.visiting : true}
              keptNotice={kept && offline ? <p className="kept-offline" role="status">{wordsFor(lookLanguage, kept.room.church.wordSet).states.keptOffline}</p> : undefined}
              signOut={() => afterLook(signOut)}
              // Nothing in a first look can ask for a write: every press in the room is kept until the look is over.
              run={() => Promise.reject(new Error(stateWords.kept))}
            />
          </FirstLookProvider>
        )}
      </>
    );
  }
  if (leavingForSample) return <LiveRoomLoading label={authWords[deviceLanguage].sampleOpening} />;
  // The shared visitor never starts a conference. With none to show, theirs is being rebuilt.
  if (waiting) return waitedLong && bookReady ? <LaunchFailure language={deviceLanguage} leave={signOut} /> : <LiveRoomLoading />;
  if (sampleVisitor && !churchId) return <SampleResetting language={deviceLanguage} leave={signOut} />;
  if (!bookReady) return <LiveRoomLoading />;
  if (
    !churchId ||
    (liveToken && !invitationConsumed) ||
    (!entryHandled && !badInvite && (intent === "start" || intent === "join"))
  )
    return (
      <Suspense fallback={<LiveRoomLoading />}>
      <LiveWelcome
        initialToken={liveToken}
        conference={invitedTo}
        initialMode={!badInvite && (intent === "join" || invitationToken) ? "join" : "create"}
        badInvite={badInvite}
        signOut={signOut}
        createChurch={async (value) => {
          setSelectedChurch(await createChurch(value));
          setEntryHandled(true);
          router.replace("/app");
        }}
        joinChurch={async (value) => {
          setSelectedChurch(await joinChurch(value));
          setInvitationConsumed(true);
          setEntryHandled(true);
          router.replace("/app");
        }}
      />
      </Suspense>
    );
  if (!dashboard || !roomDrawn)
    return (
      <LiveRoomLoading />
    );
  // The buttons under long lists stand outside the rooms, so they read the same words the rooms do.
  const shell = wordsFor(sampleVisitor ? deviceLanguage : dashboard.user.language, dashboard.church.wordSet).shell;
  const more = shell.more;
  return (
    <>
    <RoomsAhead key="ahead" data={dashboard} sample={sampleVisitor === true} area={area} />
    <FirstLookProvider key="room" value={null}>
    <LiveWorkspace
      area={area}
      roomWaiting={roomWaiting}
      requestCommitments={requestPage.results.flatMap((request) => request.commitment ? [request.commitment] : [])}
      data={{
        ...dashboard,
        user: sampleVisitor ? { ...dashboard.user, language: deviceLanguage } : dashboard.user,
        teams: area === "team" ? teamPage.results : dashboard.teams,
        requests: ["week", "mine", "commitments"].includes(area)
          ? requestPage.results
          : dashboard.requests,
        announcements:
          area === "week" ? announcementPage.results : dashboard.announcements,
        invitations:
          area === "people" ? invitationPage.results : dashboard.invitations,
        timeOff: area === "time-off" ? absencePage.results : dashboard.timeOff,
        availability:
          area === "time-off"
            ? availabilityPage.results
            : dashboard.availability,
        commitments:
          area === "commitments" || area === "mine"
            ? commitmentPage.results
            : dashboard.commitments,
        people:
          area === "people"
            ? [
                ...new Map(
                  [
                    ...dashboard.people.filter(
                      (person) => person.id === dashboard.user.id,
                    ),
                    ...peoplePage.results,
                  ].map((person) => [person.id, person]),
                ).values(),
              ]
            : dashboard.people,
        tasks: area === "tasks" ? taskPage.results : dashboard.tasks,
        meetings: area === "tasks" ? meetingPage.results : dashboard.meetings,
      }}
      pagination={
        <>
          {(area === "commitments" || area === "mine") && (
            <PageMore page={commitmentPage} label={more.what.commitments} words={more} />
          )}
          {area === "people" && (
            <>
              <PageMore page={peoplePage} label={more.what.people} words={more} />
              {dashboard.people.find(
                (person) => person.id === dashboard.user.id,
              )?.role === "owner" && (
                <PageMore page={invitationPage} label={more.what.invitations} words={more} />
              )}
            </>
          )}
          {area === "team" && (
            <PageMore page={teamPage} label={more.what.teams} words={more} count={15} />
          )}
          {area === "week" && (
            <PageMore page={announcementPage} label={more.what.announcements} words={more} />
          )}
          {["week", "mine", "commitments"].includes(area) && (
            <PageMore page={requestPage} label={more.what.cover} words={more} />
          )}
          {area === "time-off" && (
            <>
              <PageMore page={absencePage} label={more.what.timeOff} words={more} />
              <PageMore page={availabilityPage} label={more.what.availability} words={more} />
            </>
          )}
          {area === "tasks" && (
            <>
              <PageMore page={taskPage} label={more.what.tasks} words={more} />
              <PageMore page={meetingPage} label={more.what.meetings} words={more} />
            </>
          )}
        </>
      }
      signOut={signOut}
      sampleVisitor={sampleVisitor === true}
      run={async (command) => {
        if (command.type === "invite") {
          const key = `${churchId}:${command.email}:${command.role}`;
          if (invitationRequest.current?.key !== key)
            invitationRequest.current = { key, id: randomId() };
          const result = await invite({
            churchId,
            email: command.email,
            role: command.role,
            requestId: invitationRequest.current.id,
          });
          invitationRequest.current = null;
          return {
            invitationToken: result.token ?? undefined,
            delivery: result.delivery,
          };
        }
        if (command.type === "revokeInvitation") {
          await revokeInvitation({ invitationId: command.invitationId });
          return null;
        }
        if (command.type === "retryMeetingFanout") {
          await retryMeetingFanout({ churchId, meetingId: command.meetingId });
          return null;
        }
        await execute({ churchId, command });
        return null;
      }}
      selectChurch={
        churches.length > 1 || churchPage.status === "CanLoadMore" ? (
          <div className="live-row-actions">
            <NativeSelect
              aria-label={shell.groups.label}
              value={churchId}
              onChange={(event) => {
                const church = churches.find(
                  (item) => item.id === event.target.value,
                );
                if (church) setSelectedChurch(church.id);
              }}
            >
              {churches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.name}
                </option>
              ))}
            </NativeSelect>
            {churchPage.status === "CanLoadMore" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => churchPage.loadMore(30)}
              >
                {shell.groups.more}
              </Button>
            )}
          </div>
        ) : undefined
      }
    />
    </FirstLookProvider>
    </>
  );
}

function PageMore({
  page,
  label,
  words,
  count = 30,
}: {
  words: Words["shell"]["more"];
  page: {
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
    loadMore: (count: number) => void;
  };
  label: string;
  count?: number;
}) {
  // Until its first page is in there is nothing more to ask for, so no button is drawn: a disabled "Loading…"
  // button under a list that has not arrived is half a room, and with no connection it would stand there for good.
  if (page.status === "Exhausted" || page.status === "LoadingFirstPage") return null;
  return (
    <div className="live-section">
      <Button
        variant="outline"
        disabled={page.status !== "CanLoadMore"}
        onClick={() => page.loadMore(count)}
      >
        {page.status === "CanLoadMore"
          ? words.load(label)
          : words.loading(label)}
      </Button>
    </div>
  );
}

/** The workspace did not arrive: one line, one sentence, try again, and sign out as the quiet way out. */
function LaunchFailure({ language, leave }: { language: Language; leave: () => void }) {
  const said = wordsFor(language);
  const states: Partial<Record<keyof typeof stateWords, string>> = said.states;
  return (
    <div className="public-state">
      <main className="live-auth" lang={said.locale}>
        <div className="live-auth-art" aria-hidden="true" />
        <p className="public-state-mark">kind helps</p>
        <h1 role="alert">{states.launchTitle ?? stateWords.launchTitle}</h1>
        <p className="live-deck">{states.launchDeck ?? stateWords.launchDeck}</p>
        <Button onClick={() => window.location.reload()} style={{ marginTop: 24 }}>
          {said.states.tryAgain}
        </Button>
        <p style={{ marginTop: 16 }}>
          <button type="button" className="live-link" onClick={leave}>
            {said.shell.signOut}
          </button>
        </p>
      </main>
    </div>
  );
}

/** Shown to the sample visitor in the moment between the old sample being cleared and the new one arriving. */
function SampleResetting({ language, leave }: { language: keyof typeof authWords; leave: () => void }) {
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitedLong(true), 20000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <LiveRoomLoading label={authWords[language].sampleResetting}>
      {waitedLong ? (
        <p className="mt-4">
          <Button variant="outline" onClick={leave}>
            {authWords[language].leaveSample}
          </Button>
        </p>
      ) : null}
    </LiveRoomLoading>
  );
}

