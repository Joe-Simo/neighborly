"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, LogOut, Menu, Plus } from "lucide-react";
import { PaperSurface } from "@/components/paper-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { LiveArea } from "@/components/workspace/areas";
import {
  WorkspaceProvider,
  type LiveHeadAction,
  type Workspace,
} from "@/components/workspace/context";
import {
  actionTitles,
  headings,
  navigation,
  primaryActions,
  type ActionKind,
  type LiveHeadingOverride,
} from "@/components/workspace/navigation";
import { sections } from "@/components/workspace/sections";
import type {
  LiveCommand,
  LiveConfirmation,
  LiveWorkspaceData,
} from "@/components/workspace/types";
import { CommitmentDetail } from "@/components/workspace/volunteer/commitment-detail";
import { LiveCommitmentEditor } from "@/components/workspace/volunteer/commitment-editor";
import { LiveCreateForm } from "@/components/workspace/volunteer/create-form";
import { LiveTimeOffForm } from "@/components/workspace/volunteer/time-off-form";

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
  const [confirmation, setConfirmation] = useState<LiveConfirmation | null>(
    null,
  );
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
  const [headingOverride, setHeadingOverride] =
    useState<LiveHeadingOverride | null>(null);
  const [headAction, setHeadAction] = useState<LiveHeadAction | null>(null);
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
  const primary = primaryActions[area];
  // An area with no menu line yet shows the plain menu button on a phone.
  const menuLabel =
    area !== "week" && area !== "mine"
      ? navigation.find((item) => item.id === area)?.label
      : undefined;
  const Section = sections[area];
  const heading = headingOverride
    ? { ...headings[area], art: undefined, ...headingOverride }
    : headings[area];
  const workspace: Workspace = {
    area,
    data,
    requestCommitments,
    ownPerson,
    isOwner,
    pending,
    now,
    teamFilter,
    setTeamFilter,
    format,
    when,
    personName,
    teamName,
    perform,
    openAction: open,
    showCommitment: (item, trigger) => {
      commitmentTrigger.current = trigger;
      setError("");
      setSelectedCommitment(item);
    },
    confirm: setConfirmation,
    setHeading: setHeadingOverride,
    setHeadAction,
    focusOutcome: () =>
      requestAnimationFrame(() =>
        outcomeNotice.current?.focus({ preventScroll: true }),
      ),
  };
  return (
    <WorkspaceProvider value={workspace}>
    <div className="live-app">
      <a className="live-skip" href="#workspace-content">Skip to your workspace</a>
      <header className="live-header">
        <Link href="/" className="live-wordmark">
          kind helps
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
          <DialogTrigger asChild><Button variant="ghost" className="live-mobile-menu-trigger" aria-label={menuLabel ? `Workspace menu, current section: ${menuLabel}` : "Workspace menu"}><Menu size={17} aria-hidden="true" />{menuLabel ?? "Menu"}</Button></DialogTrigger>
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
        <main
          className="live-main"
          id="workspace-content"
          tabIndex={-1}
          data-room={heading.room}
        >
          <div className="live-page-head" data-art={heading.art ? "" : undefined}>
            <div>
              <p className="live-kicker">
                {data.church.name} · {data.church.timeZone}
              </p>
              <h1>{heading.title}</h1>
              <p className="live-deck">{heading.deck}</p>
            </div>
            {primary &&
              ((isOwner && area !== "mine") ||
              (data.canCoordinate && area === "commitments") ||
              area === "time-off") && (
              <Button onClick={() => open(primary)}>
                <Plus size={17} aria-hidden="true" />
                {actionTitles[primary]}
              </Button>
            )}
            {headAction && (
              <Button onClick={headAction.run}>
                <Plus size={17} aria-hidden="true" />
                {headAction.label}
              </Button>
            )}
            {heading.art && (
              <div
                className="live-head-art"
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${heading.art.src})`,
                  backgroundPosition: heading.art.position,
                  backgroundSize: heading.art.size ?? "cover",
                }}
              />
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
          <Section />
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
        <CommitmentDetail
          selected={selected}
          error={error}
          onEdit={(item) => {
            setEditingCommitment(item);
            setSelectedCommitment(null);
            setError("");
          }}
          onRelease={(item) => {
            setSelectedCommitment(null);
            setRelease(item);
          }}
          onClose={() => setSelectedCommitment(null)}
        />
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
    </WorkspaceProvider>
  );
}
