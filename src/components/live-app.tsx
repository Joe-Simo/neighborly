"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQueries, type RequestForQueries } from "convex/react";
import { useHour, usePaginatedQuery, useQuery } from "@/components/workspace/query";
import { FirstLookProvider, firstLookData, useAfterLook, useFirstRoom, useKeptPress } from "@/components/workspace/first-look";
import { useClerk } from "@clerk/nextjs";
import { useAccount } from "@/components/live-providers";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useDashboard } from "@/components/workspace/dashboard";
import { LiveAuth, type LiveEntryIntent } from "@/components/live-auth";
import { authWords, leftKey, useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor, type Language, type Words } from "@/lib/words";
import type { LiveArea } from "@/components/workspace/areas";
import { stateWords } from "@/components/workspace/failure";
import { LiveRoomLoading } from "@/components/workspace/primitives";
import "@/components/public-state.css";
import { LiveWorkspace } from "@/components/workspace/shell";
import { RoomsAhead } from "@/components/workspace/rooms-ahead";
import { DoorSweep, carryTheCard, useDoor } from "@/components/workspace/door";
import { LiveWelcome } from "@/components/live-welcome";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

/** The app, with the door's sweep above whatever it is showing. */
export function LiveApp(props: Parameters<typeof LiveRooms>[0]) {
  return (
    <>
      <LiveRooms {...props} />
      <DoorSweep />
    </>
  );
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
  const { ready, isAuthenticated, signedOut } = useAccount();
  // Through the sample door, This week is first drawn from the seed's public answer while the session is being made
  // (first-look.tsx). The look ends when the signed-in room is whole in hand, or when the sample will not open.
  const [viaSample] = useState(enterSample && sampleEntry);
  const firstRoom = useFirstRoom(viaSample);
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
  // With no seed answer the sample opens through the door as before, and the door's last sheet is the home page's card.
  // (The way in does not say so itself when it starts behind a look, where no sweep would ever take the card.)
  const noLook = viaSample && firstRoom === null;
  useEffect(() => {
    if (noLook && signedOut) carryTheCard();
  }, [noLook, signedOut]);
  const signOut = () => {
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
  // An invitation link is asked about once, yes or no and nothing else, as soon as it is known who is here. Not
  // before: Convex drops an action in flight when the session is handed to it. A link that is no longer good is
  // said so on the sheet and then dropped, so nobody signs up for nothing. A question that fails is asked twice
  // more; if it still fails, or no answer comes in six seconds, the link is left to stand and joining checks it.
  const askInvitation = useAction(api.invitations.good);
  // A link whose token is not sixty-four hex digits was cut short or mistyped and can never be good: that is
  // said at once, with no question asked (the backend holds the same test before it reads anything).
  const couldBeAnInvitation = /^[0-9a-f]{64}$/.test(invitationToken);
  const [invitationGood, setInvitationGood] = useState<boolean | undefined>(
    !invitationToken ? true : couldBeAnInvitation ? undefined : false,
  );
  const invitationAnswered = useRef(!invitationToken || !couldBeAnInvitation);
  const whoIsKnown = signedOut || isAuthenticated;
  useEffect(() => {
    if (invitationAnswered.current || !whoIsKnown) return;
    let current = true;
    let again: ReturnType<typeof setTimeout> | undefined;
    const answer = (good: boolean) => {
      if (!current || invitationAnswered.current) return;
      invitationAnswered.current = true;
      setInvitationGood(good);
    };
    const ask = (left: number) =>
      void askInvitation({ token: invitationToken }).then(answer, (cause: unknown) => {
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
  // The page says which language it is showing, so a screen reader speaks Spanish as Spanish, in the rooms and in
  // every dialog (dialogs are drawn outside the rooms, straight under <body>). Before the rooms it is the door's.
  const shown = dashboard && !sampleVisitor ? dashboard.user.language : deviceLanguage;
  useEffect(() => {
    document.documentElement.lang = shown;
    return () => {
      document.documentElement.lang = "en";
    };
  }, [shown]);
  // Asked from the hour the app was opened, so the question stays the same and the first page is what is coming.
  const [openedAt] = useState(() => Math.floor(Date.now() / 3_600_000) * 3_600_000);
  const commitmentPage = usePaginatedQuery(
    api.pages.commitmentsPage,
    churchId && (area === "commitments" || area === "mine")
      ? { churchId, scope: area === "mine" ? "mine" : "all", from: openedAt }
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
    churchId && (area === "week" || area === "mine" || area === "commitments")
      ? { churchId }
      : "skip",
    { initialNumItems: 30 },
  );
  const announcementPage = usePaginatedQuery(
    api.pages.announcementsPage,
    churchId && area === "week" ? { churchId } : "skip",
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
  if (look && dashboard && sampleVisitor === true && (area !== "week" || weekInHand)) setSignedInRoom(true);
  // The signed-in room is in hand with no look on the page (the seed's answer is late, or the visitor was already
  // inside): the moment for a look has passed, and a late answer starts none.
  if (viaSample && !look && !signedInRoom && dashboard && sampleVisitor === true) setSignedInRoom(true);
  // Waiting to learn who is here, or for their workspace to arrive. A wait that outlasts ten seconds
  // (a session the backend will not accept, no connection) is said plainly, with a way on and a way out.
  const waiting = !leavingForSample && !signedOut && (!asking || !viewer || sampleVisitor === undefined);
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaitedLong(true), 10000);
    return () => {
      clearTimeout(timer);
      setWaitedLong(false);
    };
  }, [waiting]);
  // The sign-in sheet is for someone known to be signed out. Until that is known, and from then until
  // the workspace has arrived, there is one waiting screen and nothing else: a signed-in person goes
  // from it straight to their room. In a first look the sheet is not drawn, and the way in runs behind the room;
  // the sheet and the room keep their places here and below, so neither is ever made a second time.
  // A look is no way round a wait or a reset: a session the backend has not confirmed in ten seconds, or a sample
  // that is being laid anew, ends it, and what is said below is said as it always was.
  if (look && ((waiting && waitedLong) || (!waiting && !signedOut && sampleVisitor === true && !churchId))) setLookOver(true);
  if (look || signedOut) {
    const first = look && firstLookData(look, deviceLanguage);
    // The sheet is drawn once, as what it will stay: not as "join" and then as sign-in with a notice.
    const sheetKnown = invitationGood !== undefined;
    const entry = badInvite ? "signin" : intent;
    // Someone with an invitation in hand came to join their own people: the sample is not offered on the way.
    return (
      <>
        {signedOut && sheetKnown && (
          <LiveAuth key={entry} intent={entry} sampleEntry={sampleEntry && !liveToken} enterSample={enterSample} badInvite={badInvite} behind={!!first || lookComing} onSampleRefused={() => setLookOver(true)} />
        )}
        {/* Nor is the sheet drawn before it is known whether a room will be: the launch line stands until then. */}
        {!first && (lookComing || !sheetKnown) && <LiveRoomLoading key="wait" />}
        {first && (
          <FirstLookProvider key="room" value={first.look}>
            <LiveWorkspace
              area={area}
              // Any other room waits for the session, on This week's head, as a room does while its lists load.
              roomWaiting={area !== "week"}
              requestCommitments={first.requestCommitments}
              data={first.data}
              sampleVisitor
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
  if (waiting) return waitedLong ? <LaunchFailure language={deviceLanguage} leave={signOut} /> : <LiveRoomLoading />;
  if (sampleVisitor && !churchId) return <SampleResetting leave={signOut} />;
  if (
    !churchId ||
    (liveToken && !invitationConsumed) ||
    (!entryHandled && !badInvite && (intent === "start" || intent === "join"))
  )
    return (
      <LiveWelcome
        initialToken={liveToken}
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
    );
  if (!dashboard)
    return (
      <LiveRoomLoading />
    );
  // The buttons under long lists stand outside the rooms, so they read the same words the rooms do.
  const shell = wordsFor(sampleVisitor ? deviceLanguage : dashboard.user.language, dashboard.church.wordSet).shell;
  const more = shell.more;
  return (
    <>
    <RoomsAhead key="ahead" data={dashboard} />
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
            invitationRequest.current = { key, id: crypto.randomUUID() };
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
function SampleResetting({ leave }: { leave: () => void }) {
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitedLong(true), 20000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <LiveRoomLoading label="The sample is being reset. One moment.">
      {waitedLong ? (
        <p className="mt-4">
          <Button variant="outline" onClick={leave}>
            Leave the sample
          </Button>
        </p>
      ) : null}
    </LiveRoomLoading>
  );
}

