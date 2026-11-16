"use client";

import { SavedWords } from "@/components/workspace/saved-words";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ArrowLeft, CircleCheck, LogOut, Menu, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
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
import { useSystemTextSize } from "@/components/system-text-size";
import { readyToSpeak, useSavedLine } from "@/components/workspace/fold";
import type { ReliefName } from "@/components/workspace/relief";
import { ArrivingRelief, fetchAhead } from "@/components/workspace/relief-arrival";
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
  // The way back offered on the saved line, when the act has one.
  const [undo, setUndo] = useState<{ command: LiveCommand; said: string; returnTo?: HTMLElement }>();
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
  async function perform(command: LiveCommand, success?: string, back?: { command: LiveCommand; said: string; returnTo?: HTMLElement }) {
    setPending(true);
    setError("");
    setNotice("");
    setUndo(undefined);
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
      else if (success) {
        setNotice(success);
        setUndo(back);
      }
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
  // From 1280px up a room may fill one side column; under that the place for it does not exist.
  const wide = useWideScreen();
  const [aside, setAside] = useState<HTMLElement | null>(null);
  useSystemTextSize();
  useKeysInUse();
  // A room change itself is taken by the frame (LiveFrame); the old room stays until the next one stands in its place.
  const leave = () => setMobileMenuOpen(false);
  useEffect(readyToSpeak, []);
  const leaveLabel = sampleVisitor ? words.shell.leaveSample : words.shell.signOut;
  const Section = sections[area];
  const heading = headingOverride
    ? { ...headings[area], ...translatedHeadings[area], title: headingOverride.title, deck: headingOverride.deck }
    : { ...headings[area], ...translatedHeadings[area] };
  // Between rooms the picture of the room just left lies under the new one for a moment, so one sheet is laid on another.
  // A room opened before in this visit comes back with its head at rest (phones only, in paper.css): the full
  // head is the arrival, and an arrival happens once. Decided as the room is entered, so nothing below ever jumps.
  const [rested, setRested] = useState(false);
  useEffect(() => void roomsOpened.add(area), [area]);
  // The first room after the door is drawn finished under the sweep's paper (door.css). The next room arrives as rooms do.
  const firstArea = useRef(area);
  useLayoutEffect(() => {
    if (area !== firstArea.current) delete document.documentElement.dataset.fromDoor;
  }, [area]);
  // `laid` stays for the life of the head, so the picture's entrance is never swapped (and so run again) when
  // the last room's picture is taken away from under it.
  const [headArt, setHeadArt] = useState<{ area: LiveArea; under: LiveHeading["art"] | null; laid: boolean }>({ area, under: null, laid: false });
  if (headArt.area !== area) {
    setRested(roomsOpened.has(area));
    const last = headings[headArt.area].art;
    const differs = !!last && last.picture !== heading.art?.picture;
    setHeadArt({ area, under: differs ? last : null, laid: differs });
  }
  const under = headArt.under;
  // The room whose picture is in and can be painted. Until then the head's moves wait, so one picture is never
  // let go before the next can be seen.
  const [pictured, setPictured] = useState<LiveArea>();
  const picturedNow = useCallback(() => setPictured(area), [area]);
  // The held bar (under 900px) draws its hairline only once the page has moved, and names the room once the
  // headline has gone under it.
  const bar = useRef<HTMLElement>(null);
  const [barNow, setBarNow] = useState({ scrolled: false, named: false });
  useEffect(() => {
    const read = () => {
      const headline = app.current?.querySelector(".live-page-head h1");
      const under = bar.current?.getBoundingClientRect().bottom ?? 0;
      const next = { scrolled: window.scrollY > 0, named: !!headline && headline.getBoundingClientRect().bottom < under };
      setBarNow((now) => (now.scrolled === next.scrolled && now.named === next.named ? now : next));
    };
    const first = requestAnimationFrame(read);
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [area]);
  // A keyboard on a phone slides the view down the page without moving the page itself, so anything held at the
  // top would be left behind above the view. The shell says how far the view has slid; the bar and a held
  // saved line add it to their place (`--live-pan`).
  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    const root = document.documentElement.style;
    const read = () => root.setProperty("--live-pan", `${Math.max(0, view.offsetTop)}px`);
    read();
    view.addEventListener("resize", read);
    view.addEventListener("scroll", read);
    return () => {
      view.removeEventListener("resize", read);
      view.removeEventListener("scroll", read);
      root.removeProperty("--live-pan");
    };
  }, []);
  // `data-room-whole` is for the door's sweep (door.tsx): heading, picture and head button are in, so its paper may lift.
  // The first room is whole: its sheet has arrived and its picture is in. The iPhone app's launch cover may wait
  // for `.live-app[data-room-in]`, so the mark never lifts on a room that is still coming up under it.
  const app = useRef<HTMLDivElement>(null);
  const whole = pictured !== undefined && !roomWaiting;
  // Kept as state, so the mark is drawn with the shell and is never lost when the shell is drawn again.
  const [roomIn, setRoomIn] = useState(false);
  useEffect(() => {
    const room = app.current?.querySelector(".live-room");
    if (!whole || !room || roomIn) return;
    let waiting = true;
    void Promise.allSettled(room.getAnimations().map((move) => move.finished)).then(() => waiting && setRoomIn(true));
    return () => {
      waiting = false;
    };
  }, [whole, roomIn]);
  // The page's layout wraps the shell in a `.live-app` of its own, and that is the first one a cover finds:
  // it carries the same mark for as long as the shell does.
  useEffect(() => {
    const frame = app.current?.parentElement?.closest<HTMLElement>(".live-app");
    if (!roomIn || !frame) return;
    frame.dataset.roomIn = "";
    return () => {
      delete frame.dataset.roomIn;
    };
  }, [roomIn]);
  // Once the first room's picture is in, the other rooms' pictures are fetched quietly behind it.
  const settled = pictured !== undefined;
  const others = menuItems.map((item) => headings[item.id].art.picture).join(" ");
  useEffect(() => {
    if (!settled) return;
    const later = window.setTimeout(() => fetchAhead(others.split(" ") as ReliefName[]), 900);
    return () => window.clearTimeout(later);
  }, [settled, others]);
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
    <div className="live-app" lang={words.locale} ref={app} data-room-in={roomIn ? "" : undefined} data-room-whole={whole && !headAction?.unsettled ? "" : undefined}>
      <a className="live-skip" href="#workspace-content">{words.shell.skip}</a>
      <header className="live-header" ref={bar} data-scrolled={barNow.scrolled ? "" : undefined}>
        <Link href="/" className="live-wordmark">
          kind helps
        </Link>
        {/* Under 900px, once the headline has gone under the held bar, the bar says which room this is. For the
            eye only: the Menu button already tells a screen reader. Left out whole if it does not fit. */}
        <span className="live-bar-room" aria-hidden="true" data-shown={barNow.named ? "" : undefined}>
          <i />
          <span>{menuLabel}</span>
        </span>
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
            <DialogContent className="live-mobile-menu" aria-modal="true" showCloseButton={false} onOpenAutoFocus={(event) => {
              // Opening the menu lands on the sheet itself, not on its first control.
              event.preventDefault();
              if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
            }}>
              {/* Close comes first, for a reader and for Tab; it sits where the eye expects it, top right. */}
              <DialogClose asChild><Button variant="ghost" size="icon-sm" className="live-menu-close absolute top-2 right-2" aria-label={words.shell.close}><X aria-hidden="true" /></Button></DialogClose>
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
          <div className="live-page-head" data-rested={rested ? "" : undefined}>
            {heading.art && (
              // The band stands across rooms and each picture is known by its name, so the last room's picture
              // is the very one that was on screen (never a fresh copy that has to load and decode again).
              <div className="live-head-art" data-laid={headArt.laid ? "" : undefined} data-ready={pictured === area ? "" : undefined}>
                <ArrivingRelief key={heading.art.picture} name={heading.art.picture} focus={heading.art.focus} band={heading.art.band} onReady={picturedNow} />
                {under && (
                  <ArrivingRelief
                    key={under.picture}
                    name={under.picture}
                    focus={under.focus}
                    band={under.band}
                    onReady={nothing}
                    className="live-head-under"
                    onAnimationEnd={(event) => {
                      if (event.target === event.currentTarget) setHeadArt((now) => ({ ...now, under: null }));
                    }}
                  />
                )}
              </div>
            )}
            <div className="live-head-words" key={`words-${area}`}>
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
            <div className="live-head-actions" key={`actions-${area}`}>
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
                  // A new style is a new button: it never fades from one fill to the other with its label lost between.
                  key={headAction.quiet ? "quiet" : "filled"}
                  variant={headAction.quiet ? "outline" : "default"}
                  style={headAction.unsettled ? { visibility: "hidden" } : undefined}
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
          {notice && (
            <Outcome
              ref={outcomeNotice}
              action={undo && (
                <Button variant="link" className="help-text-action" disabled={pending} onClick={async () => {
                  // The line's button leaves with the line, so focus goes back to the thing the act was taken on.
                  if (await perform(undo.command, undo.said)) focusWhenAwake(undo.returnTo);
                }}>
                  {words.tasks.undo}
                </Button>
              )}
            >
              {notice}
            </Outcome>
          )}
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
                      if (await perform(command, command.type === "createTask" ? words.tasks.added(command.title) : "Saved.")) setDialog(null);
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
                {confirmation?.action}
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
function Outcome({ children, action, ref }: { children: string; action?: ReactNode; ref: RefObject<HTMLDivElement | null> }) {
  // It is laid down like a slip, and after six seconds (twelve with a way back) it closes up so the page below does not jump.
  const seen = useSavedLine(ref, { action: !!action, of: children });
  return (
    // Not a status region of its own: the words are said in the page's one polite region (fold.ts), which was there first.
    <div className={seen ? "live-success help-done paper-settle" : "sr-only"} tabIndex={-1} ref={ref}>
      {seen && <CircleCheck size={22} aria-hidden="true" />}
      {seen ? <SavedWords>{children}</SavedWords> : children}
      {seen && action}
    </div>
  );
}

/** Focus for a control that may still be asleep while a save settles: wait for it, never let focus fall to the page. */
function focusWhenAwake(target: HTMLElement | undefined, tries = 90) {
  if (!target?.isConnected) return;
  requestAnimationFrame(() => {
    if (target instanceof HTMLButtonElement && target.disabled && tries > 0) return focusWhenAwake(target, tries - 1);
    target.focus();
  });
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
 * The moment this workspace opened in the browser, read once and kept. A server
 * render has no such moment and says 0, so no route reads the clock while prerendering.
 */
let opened: number | undefined;
const openedAt = () => (opened ??= Date.now());
const noChange = () => () => {};
const nothing = () => {};
/** The rooms opened since the page was loaded. */
const roomsOpened = new Set<LiveArea>();
