"use client";

import Link from "next/link";
import { PaperSurface } from "@/components/paper-surface";
import { DateTime } from "luxon";
import { upcomingCommitments, withoutIncomingRequests } from "@/lib/commitment-visibility";
import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  HeartHandshake,
  LoaderCircle,
  Menu,
  LogOut,
  Plus,
  Users,
  UserRound,
  Umbrella,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const liveAreas = [
  "week",
  "team",
  "people",
  "commitments",
  "mine",
  "time-off",
  "tasks",
] as const;
export type LiveArea = (typeof liveAreas)[number];
const navigation = [
  { id: "week", label: "This week", icon: CalendarDays },
  { id: "team", label: "Teams", icon: Users },
  { id: "people", label: "People", icon: UserRound },
  { id: "commitments", label: "Commitments", icon: HeartHandshake },
  { id: "mine", label: "My commitments", icon: Check },
  { id: "time-off", label: "Time off", icon: Umbrella },
  { id: "tasks", label: "Tasks & meetings", icon: ClipboardList },
] as const;

export type LiveWorkspaceData = FunctionReturnType<
  typeof api.workspace.dashboard
>;
export type LiveCommand =
  | FunctionArgs<typeof api.workspace.execute>["command"]
  | { type: "revokeInvitation"; invitationId: Id<"invitations"> }
  | { type: "retryMeetingFanout"; meetingId: Id<"meetings"> };

type ActionKind =
  | "team"
  | "invite"
  | "commitment"
  | "timeOff"
  | "task"
  | "meeting"
  | "announcement";
const actionTitles: Record<ActionKind, string> = {
  team: "Create a team",
  invite: "Invite someone",
  commitment: "Add a commitment",
  timeOff: "Plan time off",
  task: "Add a task",
  meeting: "Plan a meeting",
  announcement: "Share an announcement",
};
const headings: Record<LiveArea, { title: string; deck: string }> = {
  week: {
    title: "Good work, this week.",
    deck: "Your commitments, shared plans and the things to know.",
  },
  team: {
    title: "A place on the team.",
    deck: "People belong here, even when their plans change.",
  },
  people: {
    title: "People, together.",
    deck: "Your community and the teams they make possible.",
  },
  commitments: {
    title: "Clear commitments.",
    deck: "See what’s covered, what’s open and what’s awaiting a reply.",
  },
  mine: {
    title: "Your part in it.",
    deck: "What you’ve accepted, with the preparation to feel ready.",
  },
  "time-off": {
    title: "Room for life.",
    deck: "Keep your team informed while you take time away.",
  },
  tasks: {
    title: "The little things matter.",
    deck: "Shared tasks and meetings, each with a clear next step.",
  },
};

export function LiveLoading({
  label = "Opening your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="live-loading" role="status">
      <LoaderCircle size={20} aria-hidden="true" />
      {label}
    </div>
  );
}
export function LiveEmpty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="live-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function LiveField({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <label className="live-field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

export function LiveWorkspace({
  area,
  data,
  run,
  signOut,
  selectChurch,
  pagination,
  requestCommitments = [],
}: {
  area: LiveArea;
  data: LiveWorkspaceData;
  run: (command: LiveCommand) => Promise<{
    invitationToken?: string;
    delivery?: "not_sent" | "queued";
  } | null>;
  signOut: () => Promise<void>;
  selectChurch?: ReactNode;
  pagination?: ReactNode;
  requestCommitments?: LiveWorkspaceData["commitments"];
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<ActionKind | null>(null);
  const commitmentTrigger = useRef<HTMLButtonElement | null>(null);
  const outcomeNotice = useRef<HTMLDivElement | null>(null);
  const [selectedCommitment, setSelectedCommitment] = useState<
    LiveWorkspaceData["commitments"][number] | null
  >(null);
  const [editingCommitment, setEditingCommitment] = useState<
    LiveWorkspaceData["commitments"][number] | null
  >(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
    command: LiveCommand;
  } | null>(null);
  const [release, setRelease] = useState<
    LiveWorkspaceData["commitments"][number] | null
  >(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invitationLink, setInvitationLink] = useState("");
  const [invitationDelivery, setInvitationDelivery] = useState<
    "not_sent" | "queued"
  >("not_sent");
  const [teamFilter, setTeamFilter] = useState("");
  const ownPerson = data.people.find((person) => person.id === data.user.id);
  const isOwner = ownPerson?.role === "owner";
  const selected = selectedCommitment;
  const format = (time: number, options?: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en", {
      timeZone: data.church.timeZone,
      month: "short",
      day: "numeric",
      ...options,
    }).format(time);
  const when = (start: number, end: number) =>
    `${format(start, { weekday: "short" })} · ${format(start, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}–${format(end, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}`;
  const personName = (id: string | null) =>
    data.people.find((person) => person.id === id)?.name ??
    (id ? "Member" : "Unassigned");
  const teamName = (id: string) =>
    data.teams.find((team) => team.id === id)?.name ?? "Team";
  const [now] = useState(() => Date.now());
  const weekEnd = now + 7 * 86400000;
  const datedCommitments = upcomingCommitments(data.commitments, now, true);
  const upcoming = upcomingCommitments(data.commitments, now);
  const mine = upcoming.filter((item) => item.assigneeId === data.user.id);
  const incoming = data.requests.filter(
    (request) =>
      request.recipientId === data.user.id && request.status === "pending",
  );
  async function perform(command: LiveCommand, success?: string) {
    setPending(true);
    setError("");
    setNotice("");
    if (command.type === "invite") setInvitationLink("");
    try {
      const result = await run(command);
      if (result?.delivery) setInvitationDelivery(result.delivery);
      if (result?.invitationToken)
        setInvitationLink(
          `${window.location.origin}/app?invite=${encodeURIComponent(result.invitationToken)}`,
        );
      if (command.type === "invite")
        setNotice(
          result?.delivery === "queued"
            ? "Invitation created and email queued. Delivery is not yet confirmed."
            : "Invitation created. No email was sent.",
        );
      else if (success) setNotice(success);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^.*?Uncaught Error:\s*/, "").split("\n")[0]
          : "That change couldn’t be saved. Please try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  function open(kind: ActionKind) {
    setError("");
    setDialog(kind);
  }
  const primary =
    area === "team"
      ? "team"
      : area === "people"
        ? "invite"
        : area === "commitments"
          ? "commitment"
          : area === "time-off"
            ? "timeOff"
            : area === "tasks"
              ? "task"
              : "announcement";
  const commitmentRows = (
    items: LiveWorkspaceData["commitments"],
    empty: { title: string; detail: string } = {
      title: "No upcoming commitments.",
      detail: "New commitments will appear here with their date, person and preparation.",
    },
  ) =>
    items.length ? (
      <div className="live-list">
        {items.map((item) => (
          <div className="live-row live-commitment-row" key={item.id}>
            <div className="live-date-leaf" aria-hidden="true"><span>{format(item.start, { day: undefined, month: "short" })}</span><strong>{format(item.start, { month: undefined, day: "numeric" })}</strong><span>{format(item.start, { month: undefined, day: undefined, weekday: "short" })}</span></div>
            <div className="live-row-main">
              <div className="live-meta">
                <span>{teamName(item.teamId)}</span>
                <span className="live-commitment-time">{when(item.start, item.end)}</span>
              </div>
              <h3>{item.title}</h3>
              <p>
                {item.assigneeId
                  ? personName(item.assigneeId)
                  : "A place is open"}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
            <div className="live-row-actions">
              <span className="live-status" data-state={item.status}>
                {item.status.replaceAll("_", " ")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => {
                  commitmentTrigger.current = event.currentTarget;
                  setError("");
                  setSelectedCommitment(item);
                }}
              >
                {item.assigneeId === data.user.id && item.status === "accepted"
                  ? item.preparation.trim() ? "View preparation" : "View commitment"
                  : "Details"} <ArrowRight size={15} aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <LiveEmpty title={empty.title}>{empty.detail}</LiveEmpty>
    );
  const requests = incoming.length ? (
    <section className="live-section live-request-section" aria-labelledby="live-requests-title">
      <div className="live-section-head">
        <h2 id="live-requests-title">Your choice</h2>
        <span className="live-count">
          {incoming.length} awaiting your reply
        </span>
      </div>
      <div className="live-list">
        {incoming.map((request) => {
          const item = requestCommitments.find(
            (commitment) => commitment.id === request.commitmentId,
          ) ?? data.commitments.find(
            (commitment) => commitment.id === request.commitmentId,
          );
          return (
            <div className="live-row" key={request.id}>
              <div>
                <h3>{item?.title ?? "Cover request"}</h3>
                <p>
                  {item
                    ? when(item.start, item.end)
                    : "Commitment details unavailable"}
                </p>
                {item?.location && <p className="live-request-location">{item.location}</p>}
              </div>
              <div className="live-row-actions">
                {item && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      commitmentTrigger.current = event.currentTarget;
                      setError("");
                      setSelectedCommitment(item);
                    }}
                  >
                    Details
                  </Button>
                )}
                <Button
                  disabled={pending || !item}
                  size="sm"
                  onClick={async () => {
                    const saved = await perform(
                      {
                        type: "respondCover",
                        requestId: request.id,
                        accept: true,
                      },
                      "Commitment accepted. Your plan is updated.",
                    );
                    if (saved) requestAnimationFrame(() => outcomeNotice.current?.focus({ preventScroll: true }));
                  }}
                >
                  Accept
                </Button>
                <Button
                  disabled={pending}
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const saved = await perform(
                      {
                        type: "respondCover",
                        requestId: request.id,
                        accept: false,
                      },
                      "Request declined. No commitment has been assigned.",
                    );
                    if (saved) requestAnimationFrame(() => outcomeNotice.current?.focus({ preventScroll: true }));
                  }}
                >
                  Decline
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  ) : null;
  const taskRows = (
    <div className="live-list">
      {data.tasks.length ? (
        data.tasks.map((task) => (
          <div className="live-row" key={task.id}>
            <div>
              <h3>{task.title}</h3>
              <p>
                {personName(task.assigneeId)}
                {task.dueAt ? ` · Due ${format(task.dueAt)}` : ""}
              </p>
            </div>
            <Button
              variant={task.complete ? "secondary" : "outline"}
              size="sm"
              disabled={
                pending || (!isOwner && task.assigneeId !== data.user.id)
              }
              onClick={() =>
                void perform({
                  type: "setTaskComplete",
                  taskId: task.id,
                  complete: !task.complete,
                })
              }
            >
              {task.complete ? (
                <>
                  <Check size={16} /> Complete
                </>
              ) : (
                "Mark complete"
              )}
            </Button>
          </div>
        ))
      ) : (
        <LiveEmpty title="A clear list, for now.">
          Shared tasks will appear here with their owner and due date.
        </LiveEmpty>
      )}
    </div>
  );
  return (
    <div className="live-app">
      <a className="live-skip" href="#workspace-content">Skip to your workspace</a>
      <header className="live-header">
        <Link href="/" className="live-wordmark">
          neighborly
        </Link>
        <div className="live-header-actions">
          {selectChurch}
          <span className="live-account">
            {data.user.name || data.user.email}
          </span>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </Button>
        </div>
      </header>
      <nav className="live-mobile-nav" aria-label="Workspace">
        <Link href="/app/week" aria-current={area === "week" ? "page" : undefined}><CalendarDays size={17} aria-hidden="true" />This week</Link>
        <Link href="/app/mine" aria-current={area === "mine" ? "page" : undefined}><Check size={17} aria-hidden="true" />My commitments</Link>
        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogTrigger asChild><Button variant="ghost" className="live-mobile-menu-trigger" aria-label={area !== "week" && area !== "mine" ? `Workspace menu, current section: ${navigation.find(item => item.id === area)?.label}` : "Workspace menu"}><Menu size={17} aria-hidden="true" />{area !== "week" && area !== "mine" ? navigation.find(item => item.id === area)?.label : "Menu"}</Button></DialogTrigger>
          <DialogContent className="live-mobile-menu">
            <DialogHeader><DialogTitle>Your workspace</DialogTitle><DialogDescription>{data.church.name}</DialogDescription></DialogHeader>
            <nav aria-label="All workspace sections">{navigation.map(({ id, label, icon: Icon }) => <Link key={id} href={`/app/${id}`} aria-current={area === id ? "page" : undefined} onClick={() => setMobileMenuOpen(false)}><Icon size={19} aria-hidden="true" /><span>{label}</span>{area === id && <span className="live-menu-current">Current</span>}</Link>)}</nav>
          </DialogContent>
        </Dialog>
      </nav>
      <div className="live-layout">
        <nav className="live-nav" aria-label="Workspace">
          <p className="live-church-name">{data.church.name}</p>
          {navigation.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={`/app/${id}`}
              aria-current={area === id ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <main className="live-main" id="workspace-content" tabIndex={-1}>
          <div className="live-page-head">
            <div>
              <p className="live-kicker">
                {data.church.name} · {data.church.timeZone}
              </p>
              <h1>{headings[area].title}</h1>
              <p className="live-deck">{headings[area].deck}</p>
            </div>
            {((isOwner && area !== "mine") ||
              (data.canCoordinate && area === "commitments") ||
              area === "time-off") && (
              <Button onClick={() => open(primary)}>
                <Plus size={17} aria-hidden="true" />
                {actionTitles[primary]}
              </Button>
            )}
          </div>
          {data.truncated.length > 0 && (
            <div className="live-note">
              Some overview lists show a limited set of records. Use Load more
              in the matching section to see additional records.
            </div>
          )}
          {error && (
            <div className="live-error" role="alert">
              {error}
            </div>
          )}
          {invitationLink && (
            <div className="live-success">
              <p>
                {invitationDelivery === "queued"
                  ? "Invitation created and email queued."
                  : "Invitation created. No email was sent."}{" "}
                Share this private link with the invited person:
              </p>
              <Input
                readOnly
                aria-label="Private invitation link"
                value={invitationLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInvitationLink("")}
              >
                Dismiss
              </Button>
            </div>
          )}
          {notice && (
            <div className="live-success" role="status" tabIndex={-1} ref={outcomeNotice}>
              {notice}
            </div>
          )}
          {area === "week" && (
            <>
              {requests}
              <section className="live-section">
                <div className="live-section-head">
                  <h2>Coming up</h2>
                  <span className="live-count">Next 7 days</span>
                </div>
                {commitmentRows(
                  withoutIncomingRequests(upcoming.filter((item) => item.start <= weekEnd), incoming),
                  { title: incoming.length ? "Your next choice is above." : "A little breathing room.", detail: incoming.length ? "Reply to your invitation when you’re ready. Other upcoming commitments will appear here." : "No commitments are scheduled in the next seven days. Later dates are in Commitments." },
                )}
              </section>
              <section className="live-section">
                <h2>From your group</h2>
                {data.announcements.length ? (
                  <div className="live-list">
                    {data.announcements.map((item) => (
                      <article className="live-row" key={item.id}>
                        <div>
                          <h3>{item.title}</h3>
                          <p className="live-prep">{item.body}</p>
                          <div className="live-meta">
                            {item.authorName} · {format(item.createdAt)}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <LiveEmpty title="No announcements yet.">
                    Updates from your coordinators will be kept here.
                  </LiveEmpty>
                )}
              </section>
            </>
          )}
          {area === "team" && (
            <div className="live-grid">
              {data.teams.length ? (
                data.teams.map((team) => (
                  <section className="live-team" key={team.id}>
                    <h2>{team.name}</h2>
                    <p>
                      {team.description || "A team with room to contribute."}
                    </p>
                    {team.myInvitation && (
                      <div className="live-note">
                        <p>
                          You’re invited to this team. Joining does not accept a
                          commitment.
                        </p>
                        <div className="live-row-actions">
                          <Button
                            disabled={pending}
                            size="sm"
                            onClick={() =>
                              void perform({
                                type: "respondTeam",
                                teamId: team.id,
                                accept: true,
                              })
                            }
                          >
                            Join team
                          </Button>
                          <Button
                            disabled={pending}
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void perform({
                                type: "respondTeam",
                                teamId: team.id,
                                accept: false,
                              })
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="live-meta">
                      {team.memberIds.length}{" "}
                      {team.memberIds.length === 1 ? "member" : "members"}
                    </div>
                    {!team.myInvitation && (
                      <LiveTeamRoster
                        data={data}
                        team={team}
                        isOwner={isOwner}
                        run={perform}
                        pending={pending}
                      />
                    )}
                    {team.canCoordinate && (
                      <NativeSelect
                        aria-label={`Add a member to ${team.name}`}
                        value=""
                        disabled={pending}
                        onChange={(event) => {
                          const person = data.people.find(
                            (item) => item.id === event.target.value,
                          );
                          if (person)
                            void perform({
                              type: "setTeamMember",
                              teamId: team.id,
                              personId: person.id,
                              member: true,
                            });
                        }}
                      >
                        <option value="">Add a member…</option>
                        {data.people
                          .filter(
                            (person) => !team.memberIds.includes(person.id),
                          )
                          .map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                      </NativeSelect>
                    )}
                  </section>
                ))
              ) : (
                <LiveEmpty title="Start with one team.">
                  Give your first team a name, then add people when they join
                  your group workspace.
                </LiveEmpty>
              )}
            </div>
          )}
          {area === "people" && (
            <>
              <div className="live-list">
                {data.people.map((person) => (
                  <div className="live-row" key={person.id}>
                    <div className="live-person">
                      <span className="live-avatar">
                        {person.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <h3>{person.name}</h3>
                        <p>{person.email}</p>
                      </div>
                    </div>
                    <div className="live-meta">
                      <span>
                        {person.active ? person.role : "Access removed"}
                      </span>
                      <span>
                        {person.approved
                          ? "Approved for service"
                          : "Approval pending"}
                      </span>
                    </div>
                    {isOwner && person.role !== "owner" && (
                      <div className="live-row-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            setConfirmation({
                              title: person.approved
                                ? "Revoke service approval?"
                                : "Approve for service?",
                              body: "Team qualifications are managed separately. Revoking approval withdraws pending cover requests; accepted commitments stay intact.",
                              command: {
                                type: "setApproval",
                                personId: person.id,
                                approved: !person.approved,
                              },
                            })
                          }
                        >
                          {person.approved ? "Revoke approval" : "Approve"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            setConfirmation({
                              title: person.active
                                ? "Remove workspace access?"
                                : "Restore workspace access?",
                              body: "This changes access to your group workspace. Accepted commitments remain recorded; pending cover requests are withdrawn when access is removed.",
                              command: {
                                type: "setMembership",
                                personId: person.id,
                                active: !person.active,
                                role:
                                  person.role === "coordinator"
                                    ? "coordinator"
                                    : "member",
                              },
                            })
                          }
                        >
                          {person.active ? "Remove access" : "Restore access"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {isOwner && (
                <section className="live-section">
                  <h2>Invitations</h2>
                  <p className="live-deck">
                    An invitation gives someone a way to join. It never accepts
                    work on their behalf.
                  </p>
                  {data.invitations.length ? (
                    <div className="live-list">
                      {data.invitations.map((invite) => (
                        <div className="live-row" key={invite.id}>
                          <div>
                            <h3>{invite.email}</h3>
                            <p>{invite.role}</p>
                          </div>
                          <div className="live-row-actions">
                            <span className="live-status" data-state="pending">
                              {invite.status}
                            </span>
                            {invite.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  setConfirmation({
                                    title: "Revoke this invitation?",
                                    body: "The link will stop working. This does not remove anyone who has already joined.",
                                    command: {
                                      type: "revokeInvitation",
                                      invitationId: invite.id,
                                    },
                                  })
                                }
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <LiveEmpty title="No open invitations.">
                      Invite people when you’re ready to bring them into this
                      workspace.
                    </LiveEmpty>
                  )}
                </section>
              )}
            </>
          )}
          {area === "commitments" && (
            <>
              <div style={{ marginBottom: 22 }}>
                <NativeSelect
                  aria-label="Filter by team"
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                >
                  <option value="">All teams</option>
                  {data.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {commitmentRows(
                datedCommitments.filter(
                  (item) => !teamFilter || item.teamId === teamFilter,
                ),
                teamFilter
                  ? { title: "No upcoming dates for this team.", detail: "Choose another team or view all teams to see the rest of your group’s commitments." }
                  : undefined,
              )}
            </>
          )}
          {area === "mine" && (
            <>
              {requests}
              <section className="live-section">
                <h2>Accepted commitments</h2>
                {commitmentRows(mine, { title: "Nothing on your calendar yet.", detail: "Commitments you accept will appear here with everything you need to prepare." })}
              </section>
            </>
          )}
          {area === "time-off" && (
            <>
              <div className="live-note">
                Time off does not remove you from your teams. Existing
                commitments need a separate change so everyone knows what is
                covered.
              </div>
              <div className="live-list">
                {data.timeOff.filter((item) => item.personId === data.user.id)
                  .length ? (
                  data.timeOff
                    .filter((item) => item.personId === data.user.id)
                    .map((item) => (
                      <div className="live-row" key={item.id}>
                        <div>
                          <h3>
                            {item.start} — {item.end}
                          </h3>
                          {item.note && <p>{item.note}</p>}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            void perform(
                              { type: "removeTimeOff", timeOffId: item.id },
                              "Time off removed.",
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                ) : (
                  <LiveEmpty title="No time away planned.">
                    Add dates when you won’t be available. Your place on the
                    team stays the same.
                  </LiveEmpty>
                )}
              </div>
              <section className="live-section">
                <h2>Cover requests</h2>
                <p className="live-deck">
                  Choose whether coordinators may ask you to cover an open
                  commitment. Every request still needs your acceptance.
                </p>
                <Button
                  style={{ marginTop: 20 }}
                  variant="outline"
                  disabled={pending || !ownPerson}
                  onClick={() =>
                    void perform({
                      type: "setCoverOptIn",
                      optedIn: !ownPerson?.coverOptIn,
                    })
                  }
                >
                  {ownPerson?.coverOptIn
                    ? "Stop receiving cover requests"
                    : "Receive cover requests"}
                </Button>
              </section>
            </>
          )}
          {area === "time-off" && (
            <LiveAvailability data={data} run={perform} />
          )}
          {area === "tasks" && (
            <>
              <section>
                <div className="live-section-head">
                  <h2>Tasks</h2>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => open("task")}
                    >
                      <Plus size={15} /> Add task
                    </Button>
                  )}
                </div>
                {taskRows}
              </section>
              <section className="live-section">
                <div className="live-section-head">
                  <h2>Meetings</h2>
                  {isOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => open("meeting")}
                    >
                      <Plus size={15} /> Plan meeting
                    </Button>
                  )}
                </div>
                {data.meetings.length ? (
                  <div className="live-list">
                    {data.meetings.map((meeting) => {
                      const response = meeting.responses.find(
                        (item) => item.personId === data.user.id,
                      )?.response;
                      return (
                        <div className="live-row" key={meeting.id}>
                          <div>
                            <h3>{meeting.title}</h3>
                            {meeting.fanoutStatus === "processing" && (
                              <span
                                className="live-status"
                                data-state="pending"
                              >
                                Preparing invitations
                              </span>
                            )}
                            {isOwner &&
                              meeting.fanoutStatus === "processing" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() =>
                                    void perform(
                                      {
                                        type: "retryMeetingFanout",
                                        meetingId: meeting.id,
                                      },
                                      "Invitation preparation restarted.",
                                    )
                                  }
                                >
                                  Retry preparation
                                </Button>
                              )}
                            <p>
                              {when(meeting.start, meeting.end)}
                              {meeting.location ? ` · ${meeting.location}` : ""}
                            </p>
                            {response && (
                              <span
                                className="live-status"
                                data-state={response}
                              >
                                Your reply: {response}
                              </span>
                            )}
                            {isOwner && (
                              <LiveMeetingResponses
                                churchId={data.church.id}
                                meetingId={meeting.id}
                              />
                            )}
                          </div>
                          <div className="live-row-actions">
                            <Button
                              size="sm"
                              variant={
                                response === "accepted"
                                  ? "secondary"
                                  : "outline"
                              }
                              disabled={pending}
                              onClick={() =>
                                void perform({
                                  type: "respondMeeting",
                                  meetingId: meeting.id,
                                  response: "accepted",
                                })
                              }
                            >
                              Attend
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() =>
                                void perform({
                                  type: "respondMeeting",
                                  meetingId: meeting.id,
                                  response: "declined",
                                })
                              }
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <LiveEmpty title="No meetings planned.">
                    Meeting replies are separate from task completion.
                  </LiveEmpty>
                )}
              </section>
            </>
          )}
          {pagination}
        </main>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(value) => {
          if (!value && !pending) setDialog(null);
        }}
      >
        <DialogContent className="live-dialog">
          <DialogHeader>
            <DialogTitle>{dialog && actionTitles[dialog]}</DialogTitle>
            <DialogDescription>
              {dialog === "invite"
                ? "They’ll choose to join your private group workspace."
                : dialog === "commitment" || dialog === "meeting"
                  ? `Times are in ${data.church.timeZone}.`
                  : "Make the next step clear for your team."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "timeOff" ? (
            <LiveTimeOffForm
              data={data}
              onSaved={() => {
                setDialog(null);
                setNotice(
                  "Time off saved. Only the reviewed commitments were released.",
                );
              }}
            />
          ) : (
            dialog && (
              <LiveCreateForm
                kind={dialog}
                data={data}
                pending={pending}
                error={error}
                onSubmit={async (command) => {
                  if (await perform(command, "Saved.")) setDialog(null);
                }}
              />
            )
          )}
        </DialogContent>
      </Dialog>
      <PaperSurface
        title={selected?.title ?? "Commitment"}
        variant="workspace"
        returnFocusRef={commitmentTrigger}
        open={!!selected}
        onOpenChange={(value) => {
          if (!value && !pending) setSelectedCommitment(null);
        }}
      >
        <p className="live-kicker">{selected && teamName(selected.teamId)}</p>
        {selected && (
          <>
            {selected.status === "cancelled" && (
              <div className="live-note">
                This commitment is cancelled. Its history is retained, and no
                one is expected to serve.
              </div>
            )}
            {selected.status !== "cancelled" &&
              data.teams.find((team) => team.id === selected.teamId)
                ?.canCoordinate && (
                <div className="live-row-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingCommitment(selected);
                      setSelectedCommitment(null);
                      setError("");
                    }}
                  >
                    Edit details
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmation({
                        title: "Cancel this commitment?",
                        body: "This cancels this date, releases its accepted person and withdraws pending cover requests. The record is kept in the history. Other dates and team memberships stay unchanged.",
                        command: {
                          type: "cancelCommitment",
                          commitmentId: selected.id,
                          expectedVersion: selected.version,
                        },
                      });
                      setSelectedCommitment(null);
                    }}
                  >
                    Cancel commitment
                  </Button>
                </div>
              )}
            <dl className="live-detail">
              <div>
                <dt>When</dt>
                <dd>
                  {when(selected.start, selected.end)}
                  <br />
                  <small>{data.church.timeZone}</small>
                </dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>{selected.location || "Location to be confirmed"}</dd>
              </div>
              <div>
                <dt>Person</dt>
                <dd>{personName(selected.assigneeId)}</dd>
              </div>
              <div>
                <dt>Coordinator</dt>
                <dd>{selected.coordinatorName}</dd>
              </div>
            </dl>
            {selected.status !== "cancelled" &&
              selected.assigneeId === data.user.id && (
                <section>
                  <h3>Ready to take part</h3>
                  <p className="live-prep">
                    {selected.preparation ||
                      "No preparation has been added yet. Ask your coordinator for what you need."}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedCommitment(null);
                      setRelease(selected);
                    }}
                  >
                    Change this commitment
                  </Button>
                </section>
              )}
            {data.teams.find((team) => team.id === selected.teamId)
              ?.canCoordinate &&
              !selected.assigneeId &&
              selected.status !== "cancelled" && (
                <LiveCoverChooser
                  data={data}
                  commitment={selected}
                  run={perform}
                  pending={pending}
                />
              )}
            {error && (
              <div role="alert" className="live-error">
                {error}
              </div>
            )}
          </>
        )}
      </PaperSurface>
      <Dialog
        open={editingCommitment !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setEditingCommitment(null);
        }}
      >
        <DialogContent className="live-dialog">
          <DialogHeader>
            <DialogTitle>Edit commitment</DialogTitle>
            <DialogDescription>
              Times use {data.church.timeZone}. You’ll review the changes before
              saving.
            </DialogDescription>
          </DialogHeader>
          {editingCommitment && (
            <LiveCommitmentEditor
              key={editingCommitment.id + ":" + editingCommitment.version}
              item={editingCommitment}
              timeZone={data.church.timeZone}
              pending={pending}
              error={error}
              save={async (command) => {
                if (
                  await perform(
                    command,
                    "Commitment updated. Material changes require a new acceptance.",
                  )
                )
                  setEditingCommitment(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmation !== null}
        onOpenChange={(value) => {
          if (!value && !pending) setConfirmation(null);
        }}
      >
        <DialogContent className="live-dialog">
          <DialogHeader>
            <DialogTitle>{confirmation?.title}</DialogTitle>
            <DialogDescription>{confirmation?.body}</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="live-error" role="alert">
              {error}
            </div>
          )}
          <div className="live-form-actions">
            <Button
              variant="outline"
              onClick={() => setConfirmation(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={async () => {
                if (
                  confirmation &&
                  (await perform(confirmation.command, "Updated."))
                )
                  setConfirmation(null);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!release}
        onOpenChange={(value) => {
          if (!value && !pending) setRelease(null);
        }}
      >
        <DialogContent className="live-dialog">
          <DialogHeader>
            <DialogTitle>Change one commitment</DialogTitle>
            <DialogDescription>
              {release &&
                `${release.title} · ${when(release.start, release.end)}`}
            </DialogDescription>
          </DialogHeader>
          <p>
            This releases this date only. Your other commitments and your place
            on the team stay the same. The date will need cover.
          </p>
          {error && (
            <div className="live-error" role="alert">
              {error}
            </div>
          )}
          <div className="live-form-actions">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRelease(null)}
            >
              Keep commitment
            </Button>
            <Button
              disabled={pending}
              onClick={async () => {
                if (
                  release &&
                  (await perform(
                    {
                      type: "release",
                      commitmentId: release.id,
                      expectedVersion: release.version,
                    },
                    "Commitment released. Your other dates are unchanged.",
                  ))
                )
                  setRelease(null);
              }}
            >
              Confirm change
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LiveCreateForm({
  kind,
  data,
  pending,
  error,
  onSubmit,
}: {
  kind: ActionKind;
  data: LiveWorkspaceData;
  pending: boolean;
  error: string;
  onSubmit: (command: LiveCommand) => Promise<void>;
}) {
  const suggest = useAction(api.drafts.suggestTeam);
  const [draftDescription, setDraftDescription] = useState("");
  const [teamName, setTeamName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [preparing, setPreparing] = useState(false);
  async function prepare() {
    setPreparing(true);
    setDraftNote("");
    try {
      const result = await suggest({ description: draftDescription });
      setTeamName(result.teamName);
      setDraftNote(
        (result.verification === "checked"
          ? "Draft checked with AI. "
          : "Draft prepared from your words. ") +
          "Review the team name before saving. " +
          result.notes.join(" "),
      );
    } catch {
      setDraftNote(
        "We couldn’t prepare a draft. You can enter the team name below.",
      );
    } finally {
      setPreparing(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? "").trim();
    let command: LiveCommand;
    switch (kind) {
      case "team":
        command = {
          type: "createTeam",
          name: value("name"),
          description: value("description"),
        };
        break;
      case "invite":
        command = {
          type: "invite",
          email: value("email"),
          role: value("role") === "coordinator" ? "coordinator" : "member",
        };
        break;
      case "commitment": {
        const team = data.teams.find((item) => item.id === value("teamId"));
        if (!team) return;
        command = {
          type: "createCommitment",
          teamId: team.id,
          title: value("title"),
          start: value("start"),
          end: value("end"),
          location: value("location"),
          preparation: value("preparation"),
          intervalWeeks: Number(value("intervalWeeks") || 1),
          count: Number(value("count") || 1),
        };
        break;
      }
      case "timeOff":
        command = {
          type: "addTimeOff",
          start: value("start"),
          end: value("end"),
          note: value("note"),
        };
        break;
      case "task":
        command = {
          type: "createTask",
          title: value("title"),
          dueAt: value("dueAt"),
          assigneeId:
            data.people.find((person) => person.id === value("assigneeId"))
              ?.id ?? "",
        };
        break;
      case "meeting":
        command = {
          type: "createMeeting",
          title: value("title"),
          start: value("start"),
          end: value("end"),
          location: value("location"),
        };
        break;
      case "announcement":
        command = {
          type: "createAnnouncement",
          title: value("title"),
          body: value("body"),
        };
        break;
    }
    await onSubmit(command);
  }
  return (
    <form className="live-form" onSubmit={submit}>
      {kind === "team" && (
        <>
          <LiveField
            label="Describe your team (optional)"
            help="We’ll prepare a name for you to review. Don’t include private member information."
          >
            <Textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              maxLength={1000}
            />
          </LiveField>
          <Button
            type="button"
            variant="outline"
            disabled={!draftDescription.trim() || preparing}
            onClick={() => void prepare()}
          >
            {preparing ? "Preparing…" : "Prepare a draft"}
          </Button>
          {draftNote && (
            <div className="live-note" role="status">
              {draftNote}
            </div>
          )}
          <LiveField label="Team name">
            <Input
              name="name"
              required
              maxLength={100}
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />
          </LiveField>
          <LiveField label="What this team does">
            <Textarea name="description" maxLength={1500} rows={3} />
          </LiveField>
        </>
      )}
      {kind === "invite" && (
        <>
          <LiveField label="Email">
            <Input type="email" name="email" required maxLength={254} />
          </LiveField>
          <LiveField label="Role">
            <NativeSelect name="role">
              <option value="member">Member</option>
              <option value="coordinator">Coordinator</option>
            </NativeSelect>
          </LiveField>
          <div className="live-note">
            The invitation’s delivery status will be shown in People. A saved
            invitation is not a confirmed email delivery.
          </div>
        </>
      )}
      {(kind === "commitment" ||
        kind === "task" ||
        kind === "meeting" ||
        kind === "announcement") && (
        <LiveField label="Title">
          <Input name="title" required maxLength={180} />
        </LiveField>
      )}
      {kind === "meeting" && (
        <div className="live-note">
          All current group members will be invited. Each person chooses whether
          to attend.
        </div>
      )}
      {kind === "commitment" && (
        <LiveField label="Team">
          <NativeSelect name="teamId" required defaultValue="">
            <option value="" disabled>
              Choose a team…
            </option>
            {data.teams
              .filter((team) => team.canCoordinate)
              .map((team) => (
                <option value={team.id} key={team.id}>
                  {team.name}
                </option>
              ))}
          </NativeSelect>
        </LiveField>
      )}
      {(kind === "commitment" || kind === "meeting" || kind === "timeOff") && (
        <div className="live-form-grid">
          <LiveField label={kind === "timeOff" ? "First day" : "Starts"}>
            <Input
              type={kind === "timeOff" ? "date" : "datetime-local"}
              name="start"
              required
            />
          </LiveField>
          <LiveField label={kind === "timeOff" ? "Last day" : "Ends"}>
            <Input
              type={kind === "timeOff" ? "date" : "datetime-local"}
              name="end"
              required
            />
          </LiveField>
        </div>
      )}
      {(kind === "commitment" || kind === "meeting") && (
        <LiveField label="Where to meet">
          <Input name="location" maxLength={300} required />
        </LiveField>
      )}
      {kind === "commitment" && (
        <LiveField
          label="Preparation"
          help="What should the person know or do beforehand?"
        >
          <Textarea name="preparation" rows={4} maxLength={5000} />
        </LiveField>
      )}
      {kind === "commitment" && (
        <div className="live-form-grid">
          <LiveField label="Repeat every (weeks)">
            <Input
              type="number"
              name="intervalWeeks"
              defaultValue="1"
              min={1}
              max={52}
              required
            />
          </LiveField>
          <LiveField
            label="Number of dates"
            help="Choose 1 for a one-off commitment. Up to 52 dates within one year."
          >
            <Input
              type="number"
              name="count"
              defaultValue="1"
              min={1}
              max={52}
              required
            />
          </LiveField>
        </div>
      )}
      {kind === "timeOff" && (
        <LiveField
          label="Note (optional)"
          help="Only include what your coordinators need to know."
        >
          <Textarea name="note" rows={3} maxLength={1000} />
        </LiveField>
      )}
      {kind === "task" && (
        <>
          <LiveField label="Due (optional)">
            <Input type="datetime-local" name="dueAt" />
          </LiveField>
          <LiveField label="Owner">
            <NativeSelect name="assigneeId">
              <option value="">Unassigned</option>
              {data.people.map((person) => (
                <option value={person.id} key={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          </LiveField>
        </>
      )}
      {kind === "announcement" && (
        <LiveField label="Message">
          <Textarea name="body" required rows={5} maxLength={6000} />
        </LiveField>
      )}
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <div className="live-form-actions">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle size={16} />
              Saving…
            </>
          ) : kind === "invite" ? (
            "Create invitation"
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </form>
  );
}

function LiveTimeOffForm({
  data,
  onSaved,
}: {
  data: LiveWorkspaceData;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({ start: "", end: "", note: "" });
  const [review, setReview] = useState<typeof draft | null>(null);
  const [error, setError] = useState("");
  const affected = useQuery(
    api.workspace.previewTimeOff,
    review
      ? { churchId: data.church.id, start: review.start, end: review.end }
      : "skip",
  );
  if (review)
    return affected === undefined ? (
      <LiveLoading label="Checking your commitments…" />
    ) : (
      <TimeOffConfirmation
        key={`${review.start}:${review.end}`}
        data={data}
        review={review}
        initial={affected}
        onBack={() => setReview(null)}
        onSaved={onSaved}
      />
    );
  return (
    <form
      className="live-form"
      onSubmit={(event) => {
        event.preventDefault();
        const { start, end } = draft;
        if (end < start) {
          setError("The last day must be on or after the first day.");
          return;
        }
        setError("");
        setReview({ ...draft });
      }}
    >
      <div className="live-form-grid">
        <LiveField label="First day">
          <Input type="date" name="start" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} required />
        </LiveField>
        <LiveField label="Last day">
          <Input type="date" name="end" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} required />
        </LiveField>
      </div>
      <LiveField
        label="Note (optional)"
        help="Only include what your coordinators need to know."
      >
        <Textarea name="note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} maxLength={1000} />
      </LiveField>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <Button type="submit">Review affected commitments</Button>
    </form>
  );
}

function LiveAvailability({
  data,
  run,
}: {
  data: LiveWorkspaceData;
  run: (command: LiveCommand) => Promise<boolean>;
}) {
  return (
    <section className="live-section">
      <h2>When you can help</h2>
      <p className="live-deck">
        Volunteer dates when you’re available for cover. Availability is not an
        accepted commitment.
      </p>
      <div className="live-list" style={{ marginTop: 20 }}>
        {data.availability
          .filter((item) => item.personId === data.user.id)
          .map((item) => (
            <div className="live-row" key={item.id}>
              <span>
                {item.start} — {item.end}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void run({
                    type: "removeAvailability",
                    availabilityId: item.id,
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
      </div>
      <form
        className="live-form live-inline-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const f = new FormData(form);
          if (
            await run({
              type: "addAvailability",
              start: String(f.get("start")),
              end: String(f.get("end")),
            })
          )
            form.reset();
        }}
      >
        <div className="live-form-grid">
          <LiveField label="First available day">
            <Input type="date" name="start" required />
          </LiveField>
          <LiveField label="Last available day">
            <Input type="date" name="end" required />
          </LiveField>
        </div>
        <Button type="submit" variant="outline">
          Add available dates
        </Button>
      </form>
    </section>
  );
}

function LiveTeamRoster({
  data,
  team,
  isOwner,
  run,
  pending,
}: {
  data: LiveWorkspaceData;
  team: LiveWorkspaceData["teams"][number];
  isOwner: boolean;
  run: (command: LiveCommand) => Promise<boolean>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const roster = usePaginatedQuery(
    api.pages.teamRosterPage,
    open ? { churchId: data.church.id, teamId: team.id } : "skip",
    { initialNumItems: 20 },
  );
  return (
    <div style={{ marginTop: 20 }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        {open ? "Hide members" : "View members"}
      </Button>
      {open && (
        <>
          <div className="live-list" style={{ marginTop: 18 }}>
            {roster.results.map((person) => (
              <div className="live-row" key={person.personId}>
                <div>
                  <h3>{person.name}</h3>
                  <p>
                    {person.status === "invited"
                      ? "Invitation pending"
                      : person.approved
                        ? "Approved for this team"
                        : "Team approval pending"}{" "}
                    · {person.role}
                  </p>
                </div>
                {team.canCoordinate && (
                  <div className="live-row-actions">
                    {person.status === "active" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            void run({
                              type: "setTeamApproval",
                              teamId: team.id,
                              personId: person.personId,
                              approved: !person.approved,
                            })
                          }
                        >
                          {person.approved
                            ? "Revoke approval"
                            : "Approve for team"}
                        </Button>
                        {isOwner && (
                          <NativeSelect
                            aria-label={`Team role for ${person.name}`}
                            value={person.role}
                            disabled={pending}
                            onChange={(event) =>
                              void run({
                                type: "setTeamRole",
                                teamId: team.id,
                                personId: person.personId,
                                role:
                                  event.target.value === "coordinator"
                                    ? "coordinator"
                                    : "member",
                              })
                            }
                          >
                            <option value="member">Member</option>
                            <option value="coordinator">Coordinator</option>
                          </NativeSelect>
                        )}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void run({
                          type: "setTeamMember",
                          teamId: team.id,
                          personId: person.personId,
                          member: false,
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {roster.status !== "Exhausted" && (
            <Button
              style={{ marginTop: 16 }}
              variant="outline"
              disabled={roster.status !== "CanLoadMore"}
              onClick={() => roster.loadMore(20)}
            >
              {roster.status === "CanLoadMore"
                ? "Load more members"
                : "Loading members…"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function TimeOffConfirmation({
  data,
  review,
  initial,
  onBack,
  onSaved,
}: {
  data: LiveWorkspaceData;
  review: { start: string; end: string; note: string };
  initial: FunctionReturnType<typeof api.workspace.previewTimeOff>;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [snapshot] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = useMutation(api.workspace.confirmTimeOff);
  return (
    <div className="live-form">
      <p>
        {review.start} — {review.end}
      </p>
      <h3>
        {snapshot.length
          ? `${snapshot.length} ${snapshot.length === 1 ? "commitment" : "commitments"} affected`
          : "No commitments affected"}
      </h3>
      {snapshot.map((item) => (
        <div className="live-note" key={item.id}>
          {item.title} ·{" "}
          {new Intl.DateTimeFormat("en", {
            timeZone: data.church.timeZone,
            dateStyle: "medium",
          }).format(item.start)}
        </div>
      ))}
      <p>
        Confirming will release only these commitments and record your time off.
        Team memberships and other dates stay the same.
      </p>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <div className="live-form-actions">
        <Button variant="outline" disabled={saving} onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await confirm({
                churchId: data.church.id,
                ...review,
                reviewed: snapshot.map(({ id, version }) => ({ id, version })),
              });
              onSaved();
            } catch {
              setError(
                "We couldn’t confirm these dates. Your commitments may have changed. Go back to review the current list.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Confirm time off"}
        </Button>
      </div>
    </div>
  );
}

function LiveCoverChooser({
  data,
  commitment,
  run,
  pending,
}: {
  data: LiveWorkspaceData;
  commitment: LiveWorkspaceData["commitments"][number];
  run: (command: LiveCommand, success?: string) => Promise<boolean>;
  pending: boolean;
}) {
  const waiting = data.requests.filter(
    (request) =>
      request.commitmentId === commitment.id && request.status === "pending",
  );
  const candidates = usePaginatedQuery(
    api.pages.coverCandidates,
    waiting.length
      ? "skip"
      : { churchId: data.church.id, commitmentId: commitment.id },
    { initialNumItems: 10 },
  );
  const [recipient, setRecipient] = useState<Id<"memberships"> | "">("");
  return (
    <section>
      <h3>Ask someone to help</h3>
      <p>
        These people have opted in, confirmed availability and are approved for
        this team. Each person can accept or decline.
      </p>
      {waiting.map((request) => (
        <div className="live-note" key={request.id}>
          Awaiting a reply from{" "}
          {data.people.find((person) => person.id === request.recipientId)
            ?.name ?? "the invited member"}
          .{" "}
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              void run(
                { type: "withdrawCover", requestId: request.id },
                "Request withdrawn.",
              )
            }
          >
            Withdraw request
          </Button>
        </div>
      ))}
      {!waiting.length && (
        <>
          <LiveField label="Person">
            <NativeSelect
              value={recipient}
              onChange={(event) =>
                setRecipient(
                  candidates.results.find(
                    (person) => person.id === event.target.value,
                  )?.id ?? "",
                )
              }
            >
              <option value="">Choose a person…</option>
              {candidates.results.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          </LiveField>
          {candidates.status === "Exhausted" && !candidates.results.length && (
            <p>No eligible people are available for this date.</p>
          )}
          {candidates.status !== "Exhausted" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={candidates.status !== "CanLoadMore"}
              onClick={() => candidates.loadMore(10)}
            >
              {candidates.status === "CanLoadMore"
                ? "Load more eligible people"
                : "Checking availability…"}
            </Button>
          )}
          <Button
            style={{ marginTop: 16 }}
            disabled={pending || !recipient}
            onClick={async () => {
              if (!recipient) return;
              if (
                await run(
                  {
                    type: "requestCover",
                    commitmentId: commitment.id,
                    expectedVersion: commitment.version,
                    recipientId: recipient,
                  },
                  "Cover request saved. It is awaiting their reply.",
                )
              )
                setRecipient("");
            }}
          >
            Ask for cover
          </Button>
        </>
      )}
    </section>
  );
}

function LiveCommitmentEditor({
  item,
  timeZone,
  pending,
  error,
  save,
}: {
  item: LiveWorkspaceData["commitments"][number];
  timeZone: string;
  pending: boolean;
  error: string;
  save: (
    command: Extract<LiveCommand, { type: "reviseCommitment" }>,
  ) => Promise<void>;
}) {
  const [review, setReview] = useState<Extract<
    LiveCommand,
    { type: "reviseCommitment" }
  > | null>(null);
  const local = (value: number) =>
    DateTime.fromMillis(value, { zone: timeZone }).toFormat(
      "yyyy-MM-dd'T'HH:mm",
    );
  const [draft, setDraft] = useState(() => ({
    title: item.title,
    start: local(item.start),
    end: local(item.end),
    location: item.location,
    preparation: item.preparation,
  }));
  if (review)
    return (
      <div className="live-form">
        <h3>{review.title}</h3>
        <dl className="live-detail">
          <div>
            <dt>Starts</dt>
            <dd>{review.start.replace("T", " ")}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{review.end.replace("T", " ")}</dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{review.location}</dd>
          </div>
        </dl>
        <p className="live-prep">{review.preparation}</p>
        <div className="live-note">
          Changing the date, time, role, location or preparation releases an
          accepted person and withdraws pending cover requests. Someone must
          explicitly accept the updated commitment. Saving unchanged details
          preserves acceptance.
        </div>
        {error && (
          <div className="live-error" role="alert">
            {error}
          </div>
        )}
        <div className="live-form-actions">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setReview(null)}
          >
            Back
          </Button>
          <Button disabled={pending} onClick={() => void save(review)}>
            {pending ? "Saving…" : "Confirm changes"}
          </Button>
        </div>
      </div>
    );
  return (
    <form
      className="live-form"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        const value = (name: string) => String(f.get(name) ?? "").trim();
        const next = {
          title: value("title"),
          start: value("start"),
          end: value("end"),
          location: value("location"),
          preparation: value("preparation"),
        };
        setDraft(next);
        setReview({
          type: "reviseCommitment",
          commitmentId: item.id,
          expectedVersion: item.version,
          ...next,
        });
      }}
    >
      <LiveField label="Role / title">
        <Input
          name="title"
          defaultValue={draft.title}
          required
          maxLength={180}
        />
      </LiveField>
      <div className="live-form-grid">
        <LiveField label="Starts">
          <Input
            type="datetime-local"
            name="start"
            defaultValue={draft.start}
            required
          />
        </LiveField>
        <LiveField label="Ends">
          <Input
            type="datetime-local"
            name="end"
            defaultValue={draft.end}
            required
          />
        </LiveField>
      </div>
      <LiveField label="Where">
        <Input
          name="location"
          defaultValue={draft.location}
          required
          maxLength={300}
        />
      </LiveField>
      <LiveField label="Preparation">
        <Textarea
          name="preparation"
          defaultValue={draft.preparation}
          maxLength={5000}
          rows={4}
        />
      </LiveField>
      <Button type="submit">Review changes</Button>
    </form>
  );
}

function LiveMeetingResponses({
  churchId,
  meetingId,
}: {
  churchId: Id<"churches">;
  meetingId: Id<"meetings">;
}) {
  const [open, setOpen] = useState(false);
  const responses = usePaginatedQuery(
    api.pages.meetingResponsesPage,
    open ? { churchId, meetingId } : "skip",
    { initialNumItems: 20 },
  );
  return (
    <div style={{ marginTop: 12 }}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        {open ? "Hide replies" : "Review member replies"}
      </Button>
      {open && (
        <>
          <div className="live-list">
            {responses.results.map((item) => (
              <div className="live-row" key={item.personId}>
                <span>{item.name}</span>
                <span className="live-status" data-state={item.response}>
                  {item.response}
                </span>
              </div>
            ))}
          </div>
          {responses.status === "Exhausted" && !responses.results.length && (
            <p>No replies yet.</p>
          )}
          {responses.status !== "Exhausted" && (
            <Button
              variant="outline"
              size="sm"
              disabled={responses.status !== "CanLoadMore"}
              onClick={() => responses.loadMore(20)}
            >
              {responses.status === "CanLoadMore"
                ? "Load more replies"
                : "Loading replies…"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
