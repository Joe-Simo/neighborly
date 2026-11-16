"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { usePaginatedQuery, useQuery } from "convex-helpers/react/cache/hooks";
import { useClerk } from "@clerk/nextjs";
import { useAccount } from "@/components/live-providers";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LiveAuth, type LiveEntryIntent } from "@/components/live-auth";
import { leftKey, useEntryLanguage } from "@/components/live-auth-words";
import type { LiveArea } from "@/components/workspace/areas";
import { LiveRoomLoading } from "@/components/workspace/primitives";
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
  const { isLoading, isAuthenticated, ready } = useAccount();
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
  const commitmentPage = usePaginatedQuery(
    api.pages.commitmentsPage,
    churchId && (area === "commitments" || area === "mine")
      ? { churchId, scope: area === "mine" ? "mine" : "all" }
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
  if (isLoading)
    return (
      <LiveRoomLoading label="Checking your session…" />
    );
  if (leavingForSample) return <LiveRoomLoading label="Opening the sample conference…" />;
  if (!isAuthenticated)
    return (
      <LiveAuth key={intent} intent={intent} sampleEntry={sampleEntry} enterSample={enterSample} />
    );
  if (!viewer)
    return (
      <LiveRoomLoading />
    );
  // The shared visitor never starts a conference. With none to show, theirs is being rebuilt.
  if (sampleVisitor === undefined)
    return (
      <LiveRoomLoading />
    );
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
            <PageMore page={commitmentPage} label="commitments" />
          )}
          {area === "people" && (
            <>
              <PageMore page={peoplePage} label="people" />
              {dashboard.people.find(
                (person) => person.id === dashboard.user.id,
              )?.role === "owner" && (
                <PageMore page={invitationPage} label="invitations" />
              )}
            </>
          )}
          {area === "team" && (
            <PageMore page={teamPage} label="teams" count={15} />
          )}
          {area === "week" && (
            <PageMore page={announcementPage} label="announcements" />
          )}
          {["week", "mine", "commitments"].includes(area) && (
            <PageMore page={requestPage} label="cover requests" />
          )}
          {area === "time-off" && (
            <>
              <PageMore page={absencePage} label="time off" />
              <PageMore page={availabilityPage} label="availability" />
            </>
          )}
          {area === "tasks" && (
            <>
              <PageMore page={taskPage} label="tasks" />
              <PageMore page={meetingPage} label="meetings" />
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
              aria-label="Group workspace"
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
                More groups
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
  count = 30,
}: {
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
          ? `Load more ${label}`
          : `Loading ${label}…`}
      </Button>
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
