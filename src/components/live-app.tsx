"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearEntryContext } from "@/lib/live-entry";
import {
  useAction,
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LiveAuth, type LiveEntryIntent } from "@/components/live-auth";
import {
  LiveLoading,
  LiveWorkspace,
  type LiveArea,
} from "@/components/live-workspace";
import { LiveWelcome } from "@/components/live-welcome";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export function LiveApp({
  area = "week",
  invitationToken = "",
  intent = "signin",
}: {
  area?: LiveArea;
  invitationToken?: string;
  intent?: LiveEntryIntent;
}) {
  const router = useRouter();
  const [entryHandled, setEntryHandled] = useState(false);
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.workspace.viewer, isAuthenticated ? {} : "skip");
  const churchPage = usePaginatedQuery(
    api.pages.churchesPage,
    isAuthenticated ? {} : "skip",
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
  if (isLoading)
    return (
      <main className="live-main">
        <LiveLoading label="Checking your session…" />
      </main>
    );
  if (!isAuthenticated)
    return (
      <LiveAuth
        key={intent + invitationToken}
        intent={intent}
        invitationToken={invitationToken}
      />
    );
  if (!viewer)
    return (
      <main className="live-main">
        <LiveLoading />
      </main>
    );
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
          clearEntryContext();
          router.replace("/app");
        }}
        joinChurch={async (value) => {
          setSelectedChurch(await joinChurch(value));
          setInvitationConsumed(true);
          setEntryHandled(true);
          clearEntryContext();
          router.replace("/app");
        }}
      />
    );
  if (!dashboard)
    return (
      <main className="live-main">
        <LiveLoading />
      </main>
    );
  return (
    <LiveWorkspace
      area={area}
      requestCommitments={requestPage.results.flatMap((request) => request.commitment ? [request.commitment] : [])}
      data={{
        ...dashboard,
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
