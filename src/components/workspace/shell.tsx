"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ArrowLeft, CircleCheck, LogOut, Menu, Plus } from "lucide-react";
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
import { readFailure } from "@/components/workspace/failure";
import { LiveLoading } from "@/components/workspace/primitives";
import { LiveConnection, RoomBoundary } from "@/components/workspace/states";
import { zoneName } from "@/components/workspace/zone";
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
  type LiveHeading,
  type LiveHeadingOverride,
} from "@/components/workspace/navigation";
import { LanguageChooser } from "@/components/workspace/language-chooser";
import { AsideSlot, useWideScreen } from "@/components/workspace/aside";
import { useSavedLine } from "@/components/workspace/fold";
import { ReliefPicture } from "@/components/workspace/relief";
import { ArrivingRelief } from "@/components/workspace/relief-arrival";
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
  sampleVisitor = false,
  selectChurch,
  pagination,
  requestCommitments = [],
  roomWaiting = false,
}: {
  area: LiveArea;
  data: LiveWorkspaceData;
  run: (command: LiveCommand) => Promise<{
    invitationToken?: string;
    delivery?: "not_sent" | "queued";
  } | null>;
  signOut: () => Promise<void>;
  /** Someone who came in by the sample link leaves the sample; they have no account to sign out of. */
  sampleVisitor?: boolean;
  selectChurch?: ReactNode;
  pagination?: ReactNode;
  requestCommitments?: LiveWorkspaceData["commitments"];
  /** The room's own first lists are still on their way: the frame stands and the room says it is opening. */
  roomWaiting?: boolean;
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
  // A leaders' room is English throughout: its head, its dialogs, its notices and whatever shared piece
  // reads the workspace's words inside it. The bar and the menu stay in the person's own language.
  const english = navigation.some((item) => item.id === area && "leadersOnly" in item);
  const roomWords = english ? wordsFor("en", data.church.wordSet) : words;
  const translatedHeadings: Partial<Record<LiveArea, { title: string; deck: string }>> = roomWords.headings;
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
  const now = useSyncExternalStore(noChange, openedAt, () => 0);
  // The sample says so once, in its mark, not also in its name.
  const churchName = data.church.sample ? data.church.name.replace(/\s*\(sample\)\s*$/i, "") : data.church.name;
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
      const said = readFailure(cause, words.notices.failed);
      setError(words.notices.refused[said] ?? said);
      return false;
    } finally {
      setPending(false);
    }
  }
  function open(kind: ActionKind) {
    setError("");
    setDialog(kind);
  }
  // An act's name, in the reader's language where the tables have it. Tasks keep theirs with the room's words.
  const actName = (kind: ActionKind) => (kind === "task" ? words.tasks.add : (actions[kind] ?? actionTitles[kind]));
  const primary = primaryActions[area];
  // A menu line marked for leaders is shown only to coordinators and owners of the group.
  const leads = ownPerson?.role === "owner" || ownPerson?.role === "coordinator";
  const menuItems = navigation.filter((item) => leads || !("leadersOnly" in item));
  // On a phone the menu button says "Menu" and tells a screen reader which room this is.
  const menuLabel = menu[area] ?? navigation.find((item) => item.id === area)?.label;
  const navRef = useNavMarker(area);
  const waveRef = useArrival();
  // From 1280px up a room may fill one side column; under that the place for it does not exist.
  const wide = useWideScreen();
  const [aside, setAside] = useState<HTMLElement | null>(null);
  useSystemTextSize();
  useKeysInUse();
  // A room change itself is taken by the frame (LiveFrame); the old room stays until the next one stands in its place.
  const leave = () => setMobileMenuOpen(false);
  const leaveLabel = sampleVisitor ? words.shell.leaveSample : words.shell.signOut;
  const Section = sections[area];
  const heading = headingOverride
    ? { ...headings[area], ...translatedHeadings[area], title: headingOverride.title, deck: headingOverride.deck }
    : { ...headings[area], ...translatedHeadings[area] };
  // Between rooms the picture of the room just left lies under the new one for a moment, so one sheet is laid on another.
  const [headArt, setHeadArt] = useState<{ area: LiveArea; under: LiveHeading["art"] | null }>({ area, under: null });
  if (headArt.area !== area) setHeadArt({ area, under: headings[headArt.area].art });
  const under = headArt.under && headArt.under.picture !== heading.art.picture ? headArt.under : null;
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
  const roomWorkspace = english ? { ...workspace, words: roomWords } : workspace;
  return (
    <WorkspaceProvider value={workspace}>
    <div className="live-app" lang={words.locale}>
      <a className="live-skip" href="#workspace-content">{words.shell.skip}</a>
      <header className="live-header">
        <Link href="/" className="live-wordmark">
          kind helps
        </Link>
        {data.church.sample && <p className="live-sample-mark live-header-sample">{words.shell.sampleMark}</p>}
        <div className="live-header-actions">
          <div className="live-header-desk contents">
            {selectChurch}
            <LanguageChooser />
            <span className="live-account">
              {data.user.name || data.user.email}
            </span>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" /> {leaveLabel}
            </Button>
          </div>
          <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DialogTrigger asChild><Button variant="ghost" className="live-menu-trigger" aria-label={menuLabel ? words.shell.menuCurrent(menuLabel) : words.shell.menuLabel}><Menu aria-hidden="true" />{words.shell.menu}</Button></DialogTrigger>
            <DialogContent className="live-mobile-menu" onOpenAutoFocus={(event) => {
              // Opening the menu lands on the sheet itself, not on its first control.
              event.preventDefault();
              if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
            }}>
              <DialogHeader><DialogTitle>{words.shell.menuTitle}</DialogTitle><DialogDescription>{churchName}</DialogDescription>{data.church.sample && <p className="live-sample-mark">{words.shell.sampleMark}</p>}</DialogHeader>
              <div className="live-menu-rooms">
                <nav aria-label={words.shell.allSections}>{menuItems.map(({ id, label, icon: Icon }) => <Link key={id} href={`/app/${id}`} aria-current={area === id ? "page" : undefined} onClick={leave}><Icon size={19} aria-hidden="true" /><span>{menu[id] ?? label}</span>{area === id && <span className="live-menu-current">{words.shell.current}</span>}</Link>)}</nav>
                {selectChurch}
              </div>
              <div className="live-menu-foot">
                <LanguageChooser />
                <Button variant="outline" className="live-menu-leave" disabled={pending} onClick={() => void signOut()}>
                  <LogOut size={17} aria-hidden="true" /> {leaveLabel}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <div className="live-layout">
        <nav className="live-nav" aria-label={words.shell.workspace} ref={navRef}>
          <span className="live-nav-marker" aria-hidden="true" />
          <p className="live-church-name" data-sample={data.church.sample ? "" : undefined}>{churchName}</p>
          {data.church.sample && <p className="live-sample-mark">{words.shell.sampleMark}</p>}
          {menuItems.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={`/app/${id}`}
              aria-current={area === id ? "page" : undefined}
              onClick={leave}
            >
              <Icon aria-hidden="true" />
              {menu[id] ?? label}
            </Link>
          ))}
        </nav>
        <WorkspaceProvider value={roomWorkspace}>
        <main
          className="live-main"
          id="workspace-content"
          tabIndex={-1}
          data-room={heading.room}
          lang={roomWords.locale}
          style={{ "--room-relief": `url(/assets/relief/relief-${heading.art.picture}-640.webp)` } as CSSProperties}
        >
          <div className="live-page-head" key={`head-${area}`}>
            {heading.art && (
              <div
                className="live-head-art"
                data-laid={under ? "" : undefined}
                style={heading.art.band === undefined ? undefined : ({ "--relief-y": heading.art.band } as CSSProperties)}
              >
                {under && (
                  <span
                    className="live-head-under"
                    style={{ "--relief-y": under.band ?? 0.5 } as CSSProperties}
                    onAnimationEnd={() => setHeadArt((now) => ({ ...now, under: null }))}
                  >
                    <ReliefPicture name={under.picture} focus={under.focus} />
                  </span>
                )}
                <ArrivingRelief name={heading.art.picture} focus={heading.art.focus} />
              </div>
            )}
            <div className="live-head-words">
              {headingOverride?.back && (
                <button type="button" className="live-back live-head-back" onClick={headingOverride.back.run}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  {headingOverride.back.label}
                </button>
              )}
              <p className="live-kicker">
                {churchName}
                {data.church.sample ? ` · ${roomWords.shell.sample}` : ""}
              </p>
              <h1>{heading.title}</h1>
              <p className="live-deck">{heading.deck}</p>
              {words.locale !== "en" && (english || !translatedHeadings[area]) && (
                <p className="!mt-4 text-[15px] text-[#68715f]">{roomWords.shell.roomInEnglish}</p>
              )}
            </div>
            <div className="live-head-actions">
              {primary &&
                ((isOwner && area !== "mine") ||
                (data.canCoordinate && area === "commitments") ||
                area === "time-off") && (
                <Button onClick={() => open(primary)}>
                  <Plus size={17} aria-hidden="true" />
                  {actName(primary)}
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
            </div>
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
          {notice && <Outcome ref={outcomeNotice}>{notice}</Outcome>}
          <LiveConnection />
          {wide && <div className="live-aside" key={`aside-${area}`} ref={setAside} />}
          <AsideSlot value={aside}>
          <div className="live-room" key={area}>
            <RoomBoundary key={area}>
              {roomWaiting ? <LiveLoading label={roomWords.states.opening} /> : <Section />}
              {pagination}
            </RoomBoundary>
          </div>
          </AsideSlot>
        </main>
        </WorkspaceProvider>
      </div>
      <div className="paper-wave" aria-hidden="true" ref={waveRef}>
        {["#365c46", "#6f5f93", "#f7f4ed"].map((fill, sheet) => (
          <svg key={fill} viewBox="0 0 100 100" preserveAspectRatio="none">
            <path fill={fill} d={["M0 9C18 1 34 13 53 7S84 0 100 8V100H0Z", "M0 5C22 12 40 0 60 6S88 12 100 4V100H0Z", "M0 10C16 3 38 9 56 4S86 11 100 6V100H0Z"][sheet]} />
          </svg>
        ))}
      </div>
      <WorkspaceProvider value={roomWorkspace}>
          <LiveDialog
            open={dialog !== null}
            onClose={() => {
              if (!pending) setDialog(null);
            }}
            title={dialog && actName(dialog)}
            description={
              dialog === "invite"
                ? "They’ll choose to join your conference."
                : dialog === "commitment"
                  ? words.actions.commitmentTimes(zoneName(data.church.timeZone, words.locale))
                  : dialog === "meeting"
                  ? `Times are ${zoneName(data.church.timeZone)}.`
                  : dialog === "timeOff"
                    ? words.timeOffForm.teamSees
                    : dialog === "announcement"
                      ? words.actions.announcementSees
                      : undefined
            }
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
          <LiveDialog
            title={selected?.title ?? words.detail.fallbackTitle}
            className="live-detail-dialog"
            open={!!selected}
            onClose={() => {
              if (!pending) setSelectedCommitment(null);
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
          </LiveDialog>
        <LiveDialog
          open={editingCommitment !== null}
          onClose={() => {
            if (!pending) setEditingCommitment(null);
          }}
          title={<>Edit commitment</>}
          description={<>Times are {zoneName(data.church.timeZone)}. You’ll review the changes before
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
                Go back
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
                {confirmation?.action ?? "Confirm"}
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
      </WorkspaceProvider>
      </div>
    </WorkspaceProvider>
  );
}

/** Where the menu's marker last sat, so it can slide from the room just left even though the page is new. */
let lastMarker: Record<string, string> | null = null;

/** Lays the marker under the current room's line and slides it there from where it was. */
function useNavMarker(area: LiveArea) {
  const nav = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = nav.current;
    const marker = element?.querySelector<HTMLElement>(".live-nav-marker");
    if (!element || !marker) return;
    const place = (slide: boolean) => {
      const current = element.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!current) return;
      const next = {
        "--marker-x": `${current.offsetLeft}px`,
        "--marker-y": `${current.offsetTop}px`,
        "--marker-w": `${current.offsetWidth}px`,
        "--marker-h": `${current.offsetHeight}px`,
      };
      if (slide && lastMarker) {
        delete marker.dataset.sliding;
        for (const [name, value] of Object.entries(lastMarker)) marker.style.setProperty(name, value);
        void marker.offsetWidth;
        marker.dataset.sliding = "";
      }
      for (const [name, value] of Object.entries(next)) marker.style.setProperty(name, value);
      lastMarker = next;
      // In the sideways row of an upright tablet, bring the current room into view.
      if (element.scrollWidth > element.clientWidth)
        element.scrollLeft = current.offsetLeft - (element.clientWidth - current.offsetWidth) / 2;
    };
    place(true);
    const resized = new ResizeObserver(() => {
      delete marker.dataset.sliding;
      place(false);
    });
    resized.observe(element);
    return () => resized.disconnect();
  }, [area]);
  return nav;
}

/**
 * The green line that says what was done. It is seen for six seconds, then leaves the page and
 * stays as a message for screen readers. Each new outcome is a new line (the old one is cleared first).
 */
function Outcome({ children, ref }: { children: string; ref: RefObject<HTMLDivElement | null> }) {
  // It is laid down like a slip, and after six seconds it closes up so the page below does not jump.
  const seen = useSavedLine(ref);
  return (
    <div className={seen ? "live-success help-done paper-settle" : "sr-only"} role="status" tabIndex={-1} ref={ref}>
      {seen && <CircleCheck size={22} aria-hidden="true" />}
      {seen ? <span>{children}</span> : children}
    </div>
  );
}

/** On the first room after sign-in or the sample link, and only then, the paper sweeps up and settles as the page. */
function useArrival() {
  const wave = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = wave.current;
    const app = element?.closest<HTMLElement>(".live-app");
    if (!element || !app) return;
    try {
      // Only for someone who has just come through the door (sign-in or the sample link). A person already
      // signed in goes from the launch mark straight to their room. The sheet carried over from the home
      // page is its own arrival.
      const fromTheDoor = sessionStorage.getItem("kind-helps-door");
      sessionStorage.removeItem("kind-helps-door");
      if (!fromTheDoor || sessionStorage.getItem("neighborly-paper")) return;
    } catch {
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.dataset.playing = "";
    app.dataset.arriving = "";
    const done = window.setTimeout(() => {
      delete element.dataset.playing;
      delete app.dataset.arriving;
    }, 1200);
    return () => {
      window.clearTimeout(done);
      delete element.dataset.playing;
      delete app.dataset.arriving;
    };
  }, []);
  return wave;
}

/**
 * A focus ring is for someone finding their way with keys. Focus that the app moves itself (back to Menu when
 * its sheet closes, onto a sheet as it opens) or that follows a tap draws none; boxes to type in always show it.
 * The page is marked while keys are in use, and the mark goes with the next touch or click.
 */
function useKeysInUse() {
  useEffect(() => {
    const root = document.documentElement;
    const keys = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.matches("input, textarea, [contenteditable]");
      if (event.key === "Tab" || (!typing && !event.metaKey && !event.ctrlKey && !event.altKey)) root.dataset.liveKeys = "";
    };
    const pointer = () => delete root.dataset.liveKeys;
    window.addEventListener("keydown", keys, true);
    window.addEventListener("pointerdown", pointer, true);
    return () => {
      window.removeEventListener("keydown", keys, true);
      window.removeEventListener("pointerdown", pointer, true);
      pointer();
    };
  }, []);
}

/**
 * On iPhone and iPad the app follows the system's text size (Settings, Larger Text), up to 130%.
 * The system's body size is read from a probe set in `-apple-system-body`, which is 17px at the
 * standard setting, and every size in the app is scaled by the same share. Elsewhere nothing changes.
 */
function useSystemTextSize() {
  useEffect(() => {
    if (!CSS.supports("font", "-apple-system-body")) return;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;font:-apple-system-body;-webkit-text-size-adjust:100%";
    document.body.append(probe);
    const root = document.documentElement.style;
    const fit = () => {
      const share = Math.min(1.3, Math.max(1, parseFloat(getComputedStyle(probe).fontSize) / 17));
      root.setProperty("-webkit-text-size-adjust", `${Math.round(share * 100)}%`);
    };
    fit();
    // The setting can change while the app is in the background.
    document.addEventListener("visibilitychange", fit);
    return () => {
      document.removeEventListener("visibilitychange", fit);
      root.removeProperty("-webkit-text-size-adjust");
      probe.remove();
    };
  }, []);
}

/**
 * The moment this workspace opened in the browser, read once and kept. A server
 * render has no such moment and says 0, so no route reads the clock while prerendering.
 */
let opened: number | undefined;
const openedAt = () => (opened ??= Date.now());
const noChange = () => () => {};
