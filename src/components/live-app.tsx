"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { usePaginatedQuery, useQuery } from "@/components/workspace/query";
import { useClerk } from "@clerk/nextjs";
import { useAccount } from "@/components/live-providers";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LiveAuth, type LiveEntryIntent } from "@/components/live-auth";
import { leftKey, useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor, type Language, type Words } from "@/lib/words";
import type { LiveArea } from "@/components/workspace/areas";
import { stateWords } from "@/components/workspace/failure";
import { LiveRoomLoading } from "@/components/workspace/primitives";
import "@/components/public-state.css";
import { LiveWorkspace } from "@/components/workspace/shell";
import { LiveWelcome } from "@/components/live-welcome";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export function LiveApp({
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
  const { ready, signedOut } = useAccount();
  const clerk = useClerk();
  const signOut = () => {
    try {
      window.sessionStorage.setItem(leftKey, "1");
    } catch {
      // Without it the sign-in sheet opens as usual, without its "signed out" line.
    }
    return clerk.signOut({ redirectUrl: "/app" });
  };
  const viewer = useQuery(api.workspace.viewer, ready ? {} : "skip");
  const sampleVisitor = useQuery(api.demo.visiting, ready ? {} : "skip");
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
    ready ? {} : "skip",
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
  const dashboard = useQuery(
    api.workspace.dashboard,
    churchId ? { churchId } : "skip",
  );
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
  // Waiting to learn who is here, or for their workspace to arrive. A wait that outlasts ten seconds
  // (a session the backend will not accept, no connection) is said plainly, with a way on and a way out.
  const waiting = !leavingForSample && !signedOut && (!ready || !viewer || sampleVisitor === undefined);
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaitedLong(true), 10000);
    return () => {
      clearTimeout(timer);
      setWaitedLong(false);
    };
  }, [waiting]);
  if (leavingForSample) return <LiveRoomLoading label="Opening the sample conference…" />;
  // The sign-in sheet is for someone known to be signed out. Until that is known, and from then until
  // the workspace has arrived, there is one waiting screen and nothing else: a signed-in person goes
  // from it straight to their room.
  if (signedOut)
    return (
      <LiveAuth key={intent} intent={intent} sampleEntry={sampleEntry} enterSample={enterSample} />
    );
  // The shared visitor never starts a conference. With none to show, theirs is being rebuilt.
  if (waiting) return waitedLong ? <LaunchFailure language={deviceLanguage} leave={signOut} /> : <LiveRoomLoading />;
  if (sampleVisitor && !churchId) return <SampleResetting leave={signOut} />;
  if (
    !churchId ||
    (invitationToken && !invitationConsumed) ||
    (!entryHandled && (intent === "start" || intent === "join"))
  )
    return (
      <LiveWelcome
        initialToken={invitationToken}
        initialMode={intent === "join" || invitationToken ? "join" : "create"}
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
  if (page.status === "Exhausted") return null;
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
        <p className="live-kicker">Kind Helps</p>
        <h1 role="alert">{states.launchTitle ?? stateWords.launchTitle}</h1>
        <p className="live-deck">{states.launchDeck ?? stateWords.launchDeck}</p>
        <div className="live-row-actions" style={{ marginTop: 24 }}>
          <Button onClick={() => window.location.reload()}>{said.states.tryAgain}</Button>
          <Button variant="link" onClick={leave}>
            {said.shell.signOut}
          </Button>
        </div>
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
