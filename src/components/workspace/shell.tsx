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
import { LiveDialog } from "@/components/workspace/live-dialog";
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
import { LanguageChooser, LanguageList } from "@/components/workspace/language-chooser";
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
import { formatDate, words as wordsFor } from "@/lib/words";

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
  const words = wordsFor(data.user.language, data.church.wordSet);
  // Areas the words do not cover yet keep their English line.
  const menu: Partial<Record<LiveArea, string>> = words.menu;
  const actions: Partial<Record<ActionKind, string>> = words.actions;
  const translatedHeadings: Partial<Record<LiveArea, { title: string; deck: string }>> = words.headings;
  const ownPerson = data.people.find((person) => person.id === data.user.id);
  const isOwner = ownPerson?.role === "owner";
  const selected = selectedCommitment;
  const format = (time: number, options?: Intl.DateTimeFormatOptions) =>
    formatDate(words.locale, time, {
      timeZone: data.church.timeZone,
      month: "short",
      day: "numeric",
      ...options,
    });
  const when = (start: number, end: number) =>
    `${format(start, { weekday: "short" })} · ${format(start, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}–${format(end, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}`;
  const personName = (id: string | null) =>
    data.people.find((person) => person.id === id)?.name ??
    (id ? words.shell.member : words.detail.unassigned);
  const teamName = (id: string) =>
    data.teams.find((team) => team.id === id)?.name ?? words.shell.team;
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
          : words.notices.failed,
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
  // On a phone the menu button names the current room when the name is short enough to sit
  // beside the two tabs; a longer name, or an area with no menu line yet, shows "Menu".
  const menuLabel =
    area !== "week" && area !== "mine"
      ? (menu[area] ?? navigation.find((item) => item.id === area)?.label)
      : undefined;
  const Section = sections[area];
  const heading = headingOverride
    ? { ...headings[area], ...translatedHeadings[area], art: undefined, ...headingOverride }
    : { ...headings[area], ...translatedHeadings[area] };
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
    words,
    setHeadAction,
    focusOutcome: () =>
      requestAnimationFrame(() =>
        outcomeNotice.current?.focus({ preventScroll: true }),
      ),
  };
  return (
    <WorkspaceProvider value={workspace}>
    <div className="live-app" lang={words.locale}>
      <a className="live-skip" href="#workspace-content">{words.shell.skip}</a>
      <header className="live-header">
        <Link href="/" className="live-wordmark">
          kind helps
        </Link>
        <div className="live-header-actions">
          {selectChurch}
          <span className="max-[760px]:hidden"><LanguageChooser /></span>
          <span className="live-account">
            {data.user.name || data.user.email}
          </span>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" /> {words.shell.signOut}
          </Button>
        </div>
      </header>
      <nav className="live-mobile-nav [&>a]:!whitespace-nowrap" aria-label={words.shell.workspace}>
        <Link href="/app/week" aria-current={area === "week" ? "page" : undefined}><CalendarDays size={17} aria-hidden="true" />{words.menu.week}</Link>
        <Link href="/app/mine" aria-current={area === "mine" ? "page" : undefined}><Check size={17} aria-hidden="true" />{words.menu.mine}</Link>
        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogTrigger asChild><Button variant="ghost" className="live-mobile-menu-trigger" aria-label={menuLabel ? words.shell.menuCurrent(menuLabel) : words.shell.menuLabel}><Menu size={17} aria-hidden="true" /><span className="live-mobile-menu-label">{words.shell.menu}</span></Button></DialogTrigger>
          <DialogContent className="live-mobile-menu max-h-[calc(100svh-2rem)] overflow-y-auto" onOpenAutoFocus={(event) => {
            // Opening the menu must not land on the language choice, where an arrow key would change it.
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}>
            <DialogHeader><DialogTitle>{words.shell.menuTitle}</DialogTitle><DialogDescription>{data.church.name}</DialogDescription>{data.church.sample && <p className="live-sample-mark">Sample · made-up people</p>}</DialogHeader>
            <nav aria-label={words.shell.allSections}>{navigation.map(({ id, label, icon: Icon }) => <Link key={id} href={`/app/${id}`} aria-current={area === id ? "page" : undefined} onClick={() => setMobileMenuOpen(false)}><Icon size={19} aria-hidden="true" /><span>{menu[id] ?? label}</span>{area === id && <span className="live-menu-current">{words.shell.current}</span>}</Link>)}</nav>
            <LanguageList />
          </DialogContent>
        </Dialog>
      </nav>
      <div className="live-layout">
        <nav className="live-nav" aria-label={words.shell.workspace}>
          <p className="live-church-name" data-sample={data.church.sample ? "" : undefined}>{data.church.name}</p>
          {data.church.sample && <p className="live-sample-mark">Sample · made-up people</p>}
          {navigation.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={`/app/${id}`}
              aria-current={area === id ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              {menu[id] ?? label}
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
                {data.church.name}
                {data.church.sample ? " · Sample" : ""}
              </p>
              <h1>{heading.title}</h1>
              <p className="live-deck">{heading.deck}</p>
              {words.locale !== "en" && !translatedHeadings[area] && (
                <p className="!mt-4 text-[15px] text-[#68715f]">{words.shell.roomInEnglish}</p>
              )}
            </div>
            {primary &&
              ((isOwner && area !== "mine") ||
              (data.canCoordinate && area === "commitments") ||
              area === "time-off") && (
              <Button onClick={() => open(primary)}>
                <Plus size={17} aria-hidden="true" />
                {actions[primary] ?? actionTitles[primary]}
              </Button>
            )}
            {headAction && (
              <Button
                variant={headAction.quiet ? "outline" : "default"}
                onClick={headAction.run}
              >
                {headAction.plus && <Plus size={17} aria-hidden="true" />}
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
              {words.shell.limited}
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
          <LiveDialog
            open={dialog !== null}
            onClose={() => {
              if (!pending) setDialog(null);
            }}
            title={dialog && (actions[dialog] ?? actionTitles[dialog])}
            description={<>{dialog === "invite"
                    ? "They’ll choose to join your private group workspace."
                    : dialog === "commitment" || dialog === "meeting"
                      ? `Times are in ${data.church.timeZone}.`
                      : "Make the next step clear for your team."}</>}
          >
              {dialog === "timeOff" ? (
                <LiveTimeOffForm
                  data={data}
                  onSaved={() => {
                    setDialog(null);
                    setNotice(
                      words.timeOffForm.saved,
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
          </LiveDialog>
          <PaperSurface
            title={selected?.title ?? words.detail.fallbackTitle}
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
        <LiveDialog
          open={editingCommitment !== null}
          onClose={() => {
            if (!pending) setEditingCommitment(null);
          }}
          title={<>Edit commitment</>}
          description={<>Times use {data.church.timeZone}. You’ll review the changes before
                saving.</>}
        >
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
        </LiveDialog>
        <LiveDialog
          open={confirmation !== null}
          onClose={() => {
            if (!pending) setConfirmation(null);
          }}
          title={confirmation?.title}
          description={confirmation?.body}
        >
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
        </LiveDialog>
        <LiveDialog
          open={!!release}
          onClose={() => {
            if (!pending) setRelease(null);
          }}
          title={words.detail.changeTitle}
          description={<>{release &&
                  `${release.title} · ${when(release.start, release.end)}`}</>}
        >
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
                      words.detail.released,
                    ))
                  )
                    setRelease(null);
                }}
              >
                Confirm change
              </Button>
            </div>
        </LiveDialog>
      </div>
    </WorkspaceProvider>
  );
}
