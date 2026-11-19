"use client";

import { nothingMadeYet } from "@/lib/first-days";
import { sampleSayer } from "@/lib/words/sample-names";
import { nameKeeper } from "@/components/workspace/keep-names";
import { RoomShown, RoomStill, useEdgeTurn, useMenuArea, useWholeRoom } from "@/components/workspace/room-sheet";
import { useSearchParams } from "next/navigation";
import { SavedWords } from "@/components/workspace/saved-words";
import Link from "next/link";
import { useConvexConnectionState } from "convex/react";
import { Suspense, useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
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
import { sayRefused } from "@/lib/refusals";
import { LaunchMark, LiveLoading } from "@/components/workspace/primitives";
import { LiveConnection, LiveState, LiveWaiting, RoomBoundary } from "@/components/workspace/states";
import { sayZoneLater, zoneName, ZoneSaid } from "@/components/workspace/zone";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { WorkspaceKeys } from "@/components/workspace/keys";
import { KeptTyping } from "@/components/workspace/kept-typing";
import { UndoAct } from "@/components/workspace/undo";
import {
  WorkspaceProvider,
  type LiveHeadAction,
  type Workspace,
  type WayBack,
} from "@/components/workspace/context";
import {
  actionTitles,
  headings,
  navigation,
  primaryActions,
  type ActionKind,
  type LiveHeadingOverride,
} from "@/components/workspace/navigation";
import { LanguageChooser } from "@/components/workspace/language-chooser";
import { AsidePlace, useWideScreen } from "@/components/workspace/aside";
import { RowMenu } from "@/components/workspace/row-menu";
import { useSystemTextSize } from "@/components/system-text-size";
import { useSheetLeaves } from "@/components/workspace/sheet-leaves";
import { lineStay, readyToSpeak, useSavedLine } from "@/components/workspace/fold";
import type { ReliefName } from "@/components/workspace/relief";
import { fetchAhead } from "@/components/workspace/relief-ahead";
import { ArrivingRelief } from "@/components/workspace/relief-arrival";
import { fetchRoomsAhead, roomSection } from "@/components/workspace/sections";
import { fetchMonthAhead } from "@/components/workspace/date-field";
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

// One empty list for every draw, so a workspace with no requests stays the same workspace.
const NO_COMMITMENTS: LiveWorkspaceData["commitments"] = [];

export function LiveWorkspace({
  area,
  data,
  run,
  signOut,
  sampleVisitor = false,
  selectChurch,
  pagination,
  keptNotice,
  requestCommitments = NO_COMMITMENTS,
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
  /** One line laid at the head of the column, above the room (a kept room shown with no connection). */
  keptNotice?: ReactNode;
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
  // The dialog the save now on its way (or the last one) was sent from; null when it was sent from the page, or
  // when its dialog has been left since. Only that dialog says it is saving and shows what came of it: a dialog
  // opened later sent nothing, so it claims nothing.
  const [saveFrom, setSaveFrom] = useState<DialogName | null>(null);
  const [notice, setNotice] = useState("");
  // The way back offered on the saved line, when the act has one.
  const [undo, setUndo] = useState<WayBack>();
  // The saved line belongs to the room it was put up in; another room does not show it. Back there within its time
  // (ten seconds with a way back, six without), it stands again for what is left, its Undo and ⌘Z with it; then it goes.
  const [noticeHome, setNoticeHome] = useState<{ area: LiveArea; at: number }>();
  const [noticeLeft, setNoticeLeft] = useState<number>();
  const kept = useRef({ area, noticeHome, undo });
  useEffect(() => {
    kept.current = { area, noticeHome, undo };
  });
  useLayoutEffect(() => {
    setNoticeHome(notice ? { area: kept.current.area, at: Date.now() } : undefined);
    setNoticeLeft(undefined);
  }, [notice]);
  useLayoutEffect(() => {
    const home = kept.current.noticeHome;
    if (!home || home.area !== area) return;
    const left = home.at + lineStay(!!kept.current.undo) - Date.now();
    if (left > 500) setNoticeLeft(left);
    else {
      setNotice("");
      setUndo(undefined);
    }
  }, [area]);
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
  const sheets = words.rooms.sheets;
  // The browser tab names the room in the person's language, in the menu's own words.
  const tabTitle = menu[area];
  const groupName = data.church.name;
  useEffect(() => {
    if (tabTitle) document.title = `${tabTitle} · ${groupName} · Kind Helps`;
  }, [tabTitle, groupName]);
  // Every room reads in the person's own language, the leaders' rooms included (words/rooms).
  const translatedHeadings: Partial<Record<LiveArea, { title: string; deck: string }>> = words.headings;
  const ownPerson = data.people.find((person) => person.id === data.user.id);
  const isOwner = ownPerson?.role === "owner";
  const selected = selectedCommitment;
  // At most one of the shell's dialogs is open at a time.
  const openDialog: DialogName | null = dialog !== null ? "create" : selectedCommitment ? "detail" : editingCommitment ? "editor" : confirmation ? "confirmation" : release ? "release" : null;
  // The ways a room says a date, a name or a team. (The compiler keeps them while the data and the words hold.)
  const format = (time: number, options?: Intl.DateTimeFormatOptions) =>
    formatDate(words.locale, time, {
      timeZone: data.church.timeZone,
      month: "short",
      day: "numeric",
      ...options,
    });
  const when = (start: number, end: number) =>
    `${format(start, { weekday: "short" })} · ${format(start, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}–${format(end, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" })}`;
  const sampleSaid = sampleSayer(data.church.sample, words.locale);
  // The conference's zone, said in sheets, is worked out once the room is drawn and the page is idle.
  useEffect(() => sayZoneLater(data.church.timeZone, words.locale), [data.church.timeZone, words.locale]);
  const keepNames = nameKeeper(data.people.map((person) => person.name));
  const personName = (id: string | null) => {
    const name = data.people.find((person) => person.id === id)?.name;
    return name ? sampleSaid(name) : id ? words.shell.member : words.detail.unassigned;
  };
  const teamName = (id: string) => {
    const team = data.teams.find((one) => one.id === id);
    return team ? sampleSaid(team.name) : words.shell.team;
  };
  const now = useSyncExternalStore(noChange, openedAt, () => 0);
  // The sample says so once, in its mark, not also in its name.
  const churchName = data.church.sample ? data.church.name.replace(/\s*\(sample\)\s*$/i, "") : data.church.name;
  async function perform(command: LiveCommand, success?: string, back?: { command: LiveCommand; said: string; returnTo?: HTMLElement }) {
    setPending(true);
    setSaveFrom(openDialog);
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
            ? words.rooms.sheets.invite.queued
            : words.rooms.sheets.invite.noEmail,
        );
      else if (success) {
        setNotice(success);
        setUndo(back && { run: () => run(back.command), said: back.said, returnTo: back.returnTo });
        // A step that takes away the control it was taken from (a removed row) leaves focus nowhere: it goes to the
        // saved line, which then reads itself, and its Undo is the next key.
        if (back) requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!document.activeElement || document.activeElement === document.body) outcomeNotice.current?.focus({ preventScroll: true });
        }));
      }
      return true;
    } catch (cause) {
      const said = readFailure(cause, words.notices.failed);
      setError(sayRefused(words.notices, said));
      return false;
    } finally {
      setPending(false);
    }
  }
  function open(kind: ActionKind) {
    setError("");
    setDialog(kind);
  }
  // A save sent while the connection is down is held and goes by itself when the connection returns, and nobody
  // can say how long that will be. So a dialog that is waiting on such a save can still be left, by its cross,
  // by Escape or by its quiet button; with the connection up a save answers at once and the dialog stays put
  // until it has. (The connection is read here a second time only for `hasEverConnected`: a page that has never
  // connected is opening, not cut off.)
  const link = useConvexConnectionState();
  const cutOff = link.hasEverConnected && !link.isWebSocketConnected;
  const held = pending && !cutOff;
  // Counts the dialogs left while their save was still on its way. A save that lands after its dialog was left
  // has nothing to close, and must not close whatever dialog the person has opened since.
  const left = useRef(0);
  function leaveDialog(close: () => void) {
    if (held) return;
    if (pending) {
      left.current += 1;
      // The save goes on without its dialog: what comes of it is said on the page, not in the next dialog opened.
      setSaveFrom(null);
    }
    close();
  }
  /** Sends the save and, when it has gone through, closes the dialog it was sent from, if the person is still in it. */
  // What a create form said it did, named, so the line is enough when it is heard alone.
  function doneLine(command: Parameters<typeof perform>[0]) {
    switch (command.type) {
      case "createTask": return words.tasks.added(command.title);
      case "createAnnouncement": return sheets.done.announcementShared(command.title);
      case "createTeam": return sheets.done.teamCreated(command.name);
      case "createCommitment": return sheets.done.commitmentAdded(command.title);
      case "createMeeting": return sheets.done.meetingPlanned(command.title);
      default: return undefined;
    }
  }
  async function performThenClose(close: () => void, ...save: Parameters<typeof perform>) {
    const at = left.current;
    if ((await perform(...save)) && at === left.current) close();
  }
  // An act's name, in the reader's language where the tables have it. Tasks keep theirs with the room's words.
  const actName = (kind: ActionKind) => (kind === "task" ? words.tasks.add : (actions[kind] ?? actionTitles[kind]));
  // A brand-new conference has no one to tell yet: This week's one press is the invitation.
  const primary = area === "week" && nothingMadeYet(data) ? "invite" : primaryActions[area];
  // A menu line marked for leaders is shown only to coordinators and owners of the group.
  const leads = ownPerson?.role === "owner" || ownPerson?.role === "coordinator";
  const menuItems = navigation.filter((item) => leads || !("leadersOnly" in item));
  // The rooms' names for the keys' sheet, one per line: equal from draw to draw while the names stay, so the keys are not drawn again.
  const roomNames = menuItems.map(({ id, label }) => menu[id] ?? label).join("\n");
  // On a phone the menu button says "Menu" and tells a screen reader which room this is.
  const menuLabel = menu[area] ?? navigation.find((item) => item.id === area)?.label;
  const navRef = useNavMarker(area);
  // In the iPhone app a phone keeps three rooms and the menu in a bar at its foot (shell-ios.css draws it; the
  // website never has it). Leaders get the rooms they work in; a member, who has no Help line, their own.
  const inApp = useSyncExternalStore(noChange, () => document.documentElement.dataset.shell === "ios", () => false);
  const tabRooms = leads ? ["week", "help-line", "visits"] : ["week", "mine", "time-off"];
  const tabs = menuItems.filter((item) => tabRooms.includes(item.id));
  const tabMenu = useRef<HTMLButtonElement>(null);
  // From 1280px up a room may fill one side column; under that the place for it does not exist.
  const wide = useWideScreen();
  useSystemTextSize("data-text-large", "data-text-ax");
  // The iOS app draws the system's own tab bar, and on iPad its sidebar, in place of this bar and the side menu
  // (SceneDelegate, kindHelpsBar): it is told the bar's tabs, every room of the menu (read from the menu itself, so
  // there is one list), which is current, and whether anything lies over the bar, whenever any of it changes.
  useEffect(() => {
    type Place = { name: string; room: string; current: boolean };
    type Bar = { webkit?: { messageHandlers?: { kindHelpsBar?: { postMessage: (state: { covered: boolean; tabs: Place[]; rooms: Place[] }) => void } } } };
    const tell = (window as Bar).webkit?.messageHandlers?.kindHelpsBar;
    const bar = document.querySelector<HTMLElement>(".live-tab-bar");
    const side = document.querySelector<HTMLElement>(".live-nav");
    if (!inApp || !tell || !bar || !side) return;
    // The tabs stand down while anything lies over the bar: the Menu or any other sheet or dialog,
    // a row's long-press sheet, a page held to be turned (the way in), or the keyboard, which takes the bottom of the screen.
    const covered = () =>
      !!document.querySelector('[data-slot="dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"], [data-vaul-drawer][data-state="open"], [role="dialog"][data-state="open"], .row-menu-shade, #courtyard-held') ||
      (window.visualViewport?.height ?? window.innerHeight) < window.innerHeight - 100;
    // A tab or room by the room it opens ("menu" for the Menu), and whether it is where the person is.
    const place = (link: HTMLElement, within: HTMLElement): Place => {
      const room = link.getAttribute("href")?.split("/").pop() ?? "menu";
      const current = link.getAttribute("aria-current") === "page" || (room === "menu" && !within.querySelector('[aria-current="page"]'));
      return { name: link.textContent?.trim() ?? "", room, current };
    };
    let last = "";
    const say = () => {
      const state = {
        covered: covered(),
        tabs: [...bar.querySelectorAll<HTMLElement>(".live-tab")].map((tab) => place(tab, bar)),
        rooms: [...side.querySelectorAll<HTMLElement>("a[href]")].map((room) => place(room, side)),
      };
      const said = JSON.stringify(state);
      if (said === last) return;
      last = said;
      tell.postMessage(state);
    };
    say();
    // A sheet or dialog opening or closing, or the room changing, is a change to the page's own nodes and their state.
    const opened = new MutationObserver(say);
    opened.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-state", "aria-current"] });
    window.visualViewport?.addEventListener("resize", say);
    return () => {
      opened.disconnect();
      window.visualViewport?.removeEventListener("resize", say);
      tell.postMessage({ covered: false, tabs: [], rooms: [] });
    };
  }, [inApp]);
  // A room change itself is taken by the frame (LiveFrame); the old room stays until the next one stands in its place.
  const leave = () => setMobileMenuOpen(false);
  useEffect(readyToSpeak, []);
  // The iPhone app's pull to refresh asks the page whether it is current (see `Window.kindHelpsPulled` below).
  // The answer comes from the connection the page already holds: nothing is read from the backend for it.
  const { isWebSocketConnected } = useConvexConnectionState();
  const pulled = useEffectEvent(() => {
    // A sheet is open: a pull would take the words being typed with it. The page stays as it is and says nothing.
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
    const room = document.querySelector(".live-app .live-room");
    const current = isWebSocketConnected && !roomWaiting && !!room && !room.querySelector('.live-state[data-kind="error"]');
    if (!current) return false;
    setError("");
    setUndo(undefined);
    setNotice(words.states.upToDate);
    return true;
  });
  useEffect(() => {
    window.kindHelpsPulled = () => pulled();
    return () => {
      delete window.kindHelpsPulled;
    };
  }, []);
  const leaveLabel = sampleVisitor ? words.shell.leaveSample : words.shell.signOut;
  const heading = headingOverride
    ? { ...headings[area], ...translatedHeadings[area], title: headingOverride.title, deck: headingOverride.deck }
    : area === "week" && nothingMadeYet(data)
      ? { ...headings[area], ...translatedHeadings[area], title: words.rooms.firstDays.week.head }
      : { ...headings[area], ...translatedHeadings[area] };
  // A room opened before in this visit comes back with its head at rest (phones only, in paper.css): the full
  // head is the arrival, and an arrival happens once. Decided as the room is entered, so nothing below ever jumps.
  const [rested, setRested] = useState(false);
  useEffect(() => void roomsOpened.add(area), [area]);
  // Once the first room is in, the others are fetched while nothing else is happening.
  useEffect(() => fetchRoomsAhead(fetchMonthAhead), []);
  // The first room after the door is drawn finished under the sweep's paper (door.css). The next room arrives as rooms do.
  const firstArea = useRef(area);
  useLayoutEffect(() => {
    if (area !== firstArea.current) delete document.documentElement.dataset.fromDoor;
  }, [area]);
  // The room's code is chosen as the room is entered and kept while it stands, so the room is never drawn afresh.
  const [entered, setEntered] = useState(() => ({ area, Section: roomSection(area) }));
  if (entered.area !== area) {
    setEntered({ area, Section: roomSection(area) });
    setRested(roomsOpened.has(area));
  }
  // (A render in which the room has just changed is drawn again at once with the room entered, before anything is shown.)
  const { Section } = entered;
  // The room whose picture is in and can be painted: the room is not shown before it.
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
      // In the iOS app the headline goes under the bar as the room scrolls: how far, 0 to 1, for shell-ios.css.
      if (headline && document.documentElement.dataset.shell === "ios") {
        // Measured from its foot and its laid-out height, which its own shrinking (from the foot) does not change.
        const tall = (headline as HTMLElement).offsetHeight;
        const top = headline.getBoundingClientRect().bottom - tall;
        app.current?.style.setProperty("--head-gone", `${Math.min(1, Math.max(0, (under - top) / tall))}`);
      }
    };
    const first = requestAnimationFrame(read);
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    // A new headline in the same room (a neighbor's record opened over the list, and the list again) is read as it
    // stands, not left at the last one's place under the bar.
    const head = app.current?.querySelector(".live-page-head");
    const changed = new MutationObserver(read);
    if (head) changed.observe(head, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(first);
      changed.disconnect();
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [area]);
  // A headline word that is longer than its column even at the measured size (a long surname) drops a size, and
  // another, until it fits whole: a word is never broken inside itself (paper.css).
  useEffect(() => {
    const words = app.current?.querySelector<HTMLElement>(".live-page-head .live-head-words");
    if (!words) return;
    const fit = () => {
      const headline = words.querySelector<HTMLElement>("h1");
      if (!headline) return;
      headline.style.removeProperty("font-size");
      let size = parseFloat(getComputedStyle(headline).fontSize);
      while (headline.scrollWidth > headline.clientWidth + 1 && size > 24) {
        size -= 4;
        headline.style.fontSize = `${size}px`;
      }
    };
    // First fitted when the room's layout is done (an observer's first call, before that frame is painted), not
    // here in the middle of drawing it, where each try would make the page work out the room's styles again.
    const resized = new ResizeObserver(fit);
    resized.observe(words);
    const changed = new MutationObserver(fit);
    changed.observe(words, { childList: true, subtree: true, characterData: true });
    return () => {
      resized.disconnect();
      changed.disconnect();
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
  // A room is drawn whole or not at all (room-sheet.tsx): until it is, the room just left stands, or after 400ms
  // the one "Opening…" line. `data-room-shown` (for the door's sweep, door.tsx) is set in the frame the room is
  // shown, and `data-room-whole` once it is at rest: its figures landed and its picture's piece set down. The
  // iPhone app's launch cover waits for `.live-app[data-room-in]`, set once with the first room shown.
  const app = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLElement>(null);
  const { shown, opening, lost, settled } = useWholeRoom(area, column);
  useSheetLeaves(column, shown ? area : null);
  // The room the side column and the bar name: held on the room being left while a finger turns its page back.
  const menuArea = useMenuArea(area);
  // The room itself, with nothing opened inside it (a record, a sheet): the edge's step back is the page turn there.
  const inside = useSearchParams().size > 0;
  // A record (?neighbor=) is turned back by the finger too; inside anything else the app's own swipe is the way back.
  const record = useSearchParams().has("neighbor");
  useEdgeTurn(inApp, !inside || record, shown);
  // Kept as state, so the mark is drawn with the shell and is never lost when the shell is drawn again.
  const [roomIn, setRoomIn] = useState(false);
  if (shown && !roomIn) setRoomIn(true);
  // Until then the bar and the menu are held with the room (`data-shell-held`, paper.css): on a visit straight to
  // /app they were drawn at once, a few frames ahead of a room still on its way. Only a lost connection shows
  // them early, so that someone with no room to wait for still has the menu and the way out.
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
  // Arriving by keyboard from the home page's card, the card that held focus is gone and the browser has lost its
  // place: the first Tab would be spent finding it. Focus rests on the page itself once the room is in, so the
  // first Tab is "Skip to your conference". No ring is drawn and nothing new joins the Tab order.
  useEffect(() => {
    if (!roomIn || (document.activeElement && document.activeElement !== document.body)) return;
    const page = document.body;
    page.tabIndex = -1;
    page.focus({ preventScroll: true });
    page.removeAttribute("tabindex");
  }, [roomIn]);
  // Moving to another room, focus lands on its headline once the room is at rest (the page turn over), also when the
  // room was picked from the phone's Menu, whose closing hands focus back to its button first: a screen
  // reader says the room once, by its name, and the next Tab goes on from the top of the room. A ring is drawn there
  // only for someone on keys. The first room keeps focus where the arrival put it.
  const headline = useRef<HTMLHeadingElement>(null);
  const focusedArea = useRef(area);
  useEffect(() => {
    if (!settled || focusedArea.current === area) return;
    focusedArea.current = area;
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest("nav, .live-tab-bar, [data-slot='dialog-content'], .live-menu-trigger, .live-tab") && document.contains(active)) return;
    headline.current?.focus({ preventScroll: true });
  }, [settled, area]);
  const shellHeld = !roomIn && !lost;
  // Shown in that same frame: a button that eases everything it changes would otherwise come a frame or two late.
  useLayoutEffect(() => {
    if (!roomIn) return;
    for (const part of app.current?.querySelectorAll(":scope > .live-header, .live-nav") ?? [])
      for (const move of part.getAnimations({ subtree: true })) if (move instanceof CSSTransition) move.finish();
  }, [roomIn]);
  // Once the first room is shown, the other rooms' pictures are fetched quietly behind it.
  const others = menuItems.map((item) => headings[item.id].art.picture).join(" ");
  useEffect(() => {
    if (!roomIn) return;
    const later = window.setTimeout(() => fetchAhead(others.split(" ") as ReliefName[]), 900);
    return () => window.clearTimeout(later);
  }, [roomIn, others]);
  // What a room calls when something happens is the same function from draw to draw (it always runs the latest
  // one), and what a room reads changes only with what it reads from: so the workspace below is drawn again only
  // when its data, the hour, the save under way, the team chosen or the words change, never because the shell's own
  // line, sheet or menu did.
  const latest = useRef({ perform, open });
  useLayoutEffect(() => {
    latest.current = { perform, open };
  });
  const steadyPerform = useCallback((...save: Parameters<typeof perform>) => latest.current.perform(...save), []);
  const steadyOpen = useCallback((kind: ActionKind) => latest.current.open(kind), []);
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
    sampleSaid,
    keepNames,
    perform: steadyPerform,
    offerUndo: (said, back) => {
      setError("");
      setNotice(said);
      setUndo(back);
    },
    openAction: steadyOpen,
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
    <div className="live-app" lang={words.locale} ref={app} data-room-in={roomIn ? "" : undefined} data-shell-held={shellHeld ? "" : undefined} data-room-shown={shown ? "" : undefined} data-room-whole={settled ? "" : undefined}>
      {/* The launch screen's mark stays where it was until the room takes its place: one wait, one picture. */}
      {shellHeld && <LaunchMark />}
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
            <LanguageChooser words={words} churchId={data.church.id} />
            <span className="live-account">
              {data.user.name || data.user.email}
            </span>
            {/* At rest while a save is on its way: leaving then would drop a save the person was told is kept. */}
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" /> {leaveLabel}
            </Button>
          </div>
          <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DialogTrigger asChild><Button variant="ghost" className="live-menu-trigger" aria-label={menuLabel ? words.shell.menuCurrent(menuLabel) : words.shell.menuLabel}><Menu aria-hidden="true" />{words.shell.menu}</Button></DialogTrigger>
            <DialogContent className="live-mobile-menu" aria-modal="true" showCloseButton={false} onCloseAutoFocus={(event) => {
              // Where the foot bar stands the header has no Menu button: focus goes back to the bar's, once it is drawn again.
              const tab = tabMenu.current;
              if (!tab || !window.matchMedia("(max-width: 699px)").matches) return;
              event.preventDefault();
              requestAnimationFrame(() => tab.focus());
            }} onOpenAutoFocus={(event) => {
              // Opening the menu lands on the sheet itself, not on its first control. In the sheet's first frame, as a
              // room's sheet does (live-dialog.tsx): focusing inside the press made the browser work out the whole page's styles there.
              event.preventDefault();
              const sheet = event.currentTarget;
              if (sheet instanceof HTMLElement) requestAnimationFrame(() => { if (sheet.isConnected) sheet.focus({ preventScroll: true }); });
            }}>
              {/* Close comes first, for a reader and for Tab; it sits where the eye expects it, top right. */}
              <DialogClose asChild><Button variant="ghost" size="icon-sm" className="live-menu-close absolute top-2 right-2" aria-label={words.shell.close}><X aria-hidden="true" /></Button></DialogClose>
              <DialogHeader><DialogTitle>{words.shell.menuTitle}</DialogTitle><DialogDescription>{churchName}</DialogDescription>{data.church.sample && <p className="live-sample-mark">{words.shell.sampleMark}</p>}</DialogHeader>
              <div className="live-menu-rooms">
                <nav aria-label={words.shell.allSections}>{menuItems.map(({ id, label, icon: Icon }) => <Link key={id} href={`/app/${id}`} aria-current={area === id ? "page" : undefined} onClick={leave}><Icon size={19} aria-hidden="true" /><span>{menu[id] ?? label}</span>{area === id && <span className="live-menu-current">{words.shell.current}</span>}</Link>)}</nav>
                {selectChurch}
              </div>
              {!sampleVisitor && <p className="live-menu-who">{words.shell.signedInAs(data.user.name || data.user.email)}</p>}
              <div className="live-menu-foot">
                <LanguageChooser words={words} churchId={data.church.id} />
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
              aria-current={menuArea === id ? "page" : undefined}
              onClick={leave}
            >
              <Icon aria-hidden="true" />
              {menu[id] ?? label}
            </Link>
          ))}
        </nav>
        <WorkspaceProvider value={workspace}>
        <KeptTyping member={data.user.id} conference={data.church.id} />
        <WorkspaceKeys nav={navRef} rooms={roomNames} keys={words.shell.keys} />
        <RoomStill area={area} column={column}>
        <RoomShown value={shown}>
        <main
          className="live-main"
          id="workspace-content"
          tabIndex={-1}
          ref={column}
          data-room={heading.room}
          data-room-held={shown ? undefined : ""}
          data-room-lost={opening && lost ? "" : undefined}
          aria-busy={shown ? undefined : true}
          lang={words.locale}
        >
          {keptNotice}
          {/* The one way a room waits: a quiet line where its title will be, once the wait has lasted 400ms. */}
          {/* The one way a room waits: a quiet line where its title will be, once the wait has lasted 400ms. A room
              held because the connection is down says that instead, in the family every other room state uses: its
              picture's card, one serif line and one sentence, as a room that did not open does. */}
          {opening &&
            (lost ? (
              <div className="live-opening" data-lost="">
                <LiveState kind="offline" title={words.states.offlineTitle}>
                  {words.states.offlineRoom}
                </LiveState>
              </div>
            ) : (
              <p className="live-opening" role="status">
                <span className="text-balance">{words.states.opening}</span>
              </p>
            ))}
          <div className="live-page-head" data-rested={rested ? "" : undefined}>
            {heading.art && (
              <div className="live-head-art" data-ready={pictured === area ? "" : undefined}>
                <ArrivingRelief key={heading.art.picture} name={heading.art.picture} focus={heading.art.focus} band={heading.art.band} onReady={picturedNow} />
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
                {data.church.sample ? ` · ${words.shell.sample}` : ""}
              </p>
              <h1 ref={headline} tabIndex={-1}>{heading.title}</h1>
              <p className="live-deck">{heading.deck}</p>
            </div>
            <div className="live-head-actions" key={`actions-${area}`}>
              {primary &&
                ((isOwner && area !== "mine") ||
                (data.canCoordinate && area === "commitments") ||
                area === "time-off") && (
                // A room's head button is always outline: the solid fill belongs to the decision on a sheet.
                <Button variant="outline" data-opens="" onClick={() => open(primary)}>
                  <Plus size={17} aria-hidden="true" />
                  {actName(primary)}
                </Button>
              )}
              {headAction && (
                <Button
                  variant="outline"
                  data-unsettled={headAction.unsettled ? "" : undefined}
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
          {/* A refusal from a sheet is said in that sheet, once; only one from the page itself is said here. */}
          {error && !saveFrom && (
            <div className="live-error" role="alert">
              {error}
            </div>
          )}
          {invitationLink && (
            <div className="live-success">
              <p>
                {invitationDelivery === "queued" ? sheets.invite.linkQueued : sheets.invite.linkNoEmail}
              </p>
              <Input
                readOnly
                aria-label={sheets.invite.linkLabel}
                value={invitationLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInvitationLink("")}
              >
                {sheets.invite.dismiss}
              </Button>
            </div>
          )}
          {notice && (!noticeHome || noticeHome.area === area) && (
            <Outcome
              ref={outcomeNotice}
              remaining={noticeLeft}
              action={undo && (
                <UndoAct
                  key={notice}
                  run={async () => {
                    // The line's button leaves with the line, so focus goes back to the thing the act was taken on.
                    setPending(true);
                    setUndo(undefined);
                    try {
                      await undo.run();
                      setNotice(undo.said);
                      // The pressed Undo has gone with its line; without a control of its own to go back to, focus
                      // goes to the line that now says what came back, so it is never left to fall to the page.
                      focusWhenAwake(undo.returnTo ?? outcomeNotice.current ?? undefined);
                    } catch (cause) {
                      const said = readFailure(cause, words.notices.failed);
                      setNotice("");
                      setError(sayRefused(words.notices, said));
                    } finally {
                      setPending(false);
                    }
                  }}
                />
              )}
            >
              {notice}
            </Outcome>
          )}
          <LiveConnection />
          <AsidePlace key={`aside-${area}`} on={wide}>
          <div className="live-room" key={area}>
            <RoomBoundary key={area}>
              {roomWaiting ? <LiveLoading label={words.states.opening} /> : <Suspense fallback={<LiveLoading label={words.states.opening} />}><Section /></Suspense>}
              {pagination}
            </RoomBoundary>
          </div>
          </AsidePlace>
        </main>
        </RoomShown>
        </RoomStill>
        </WorkspaceProvider>
      </div>
      <RowMenu />
      {inApp && (
        <nav className="live-tab-bar" aria-label={words.shell.workspace}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <Link key={id} className="live-tab" href={`/app/${id}`} aria-current={menuArea === id ? "page" : undefined}>
              <Icon aria-hidden="true" />
              <span>{id === "visits" ? words.shell.tabVisits : id === "mine" ? words.shell.tabMine : (menu[id] ?? label)}</span>
            </Link>
          ))}
          <Button ref={tabMenu} variant="ghost" className="live-tab" aria-haspopup="dialog" aria-expanded={mobileMenuOpen} aria-label={menuLabel ? words.shell.menuCurrent(menuLabel) : words.shell.menuLabel} onClick={() => setMobileMenuOpen(true)}>
            <Menu aria-hidden="true" />
            <span>{words.shell.menu}</span>
          </Button>
        </nav>
      )}
      <WorkspaceProvider value={workspace}>
          <LiveDialog
            open={dialog !== null}
            onClose={() => leaveDialog(() => setDialog(null))}
            title={dialog && actName(dialog)}
            description={
              dialog === "invite"
                ? sheets.invite.deck
                : dialog === "commitment"
                  ? words.actions.commitmentTimes(zoneName(data.church.timeZone, words.locale))
                  : dialog === "meeting"
                  ? words.actions.commitmentTimes(zoneName(data.church.timeZone, words.locale))
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
                    saving={pending && saveFrom === "create"}
                    error={saveFrom === "create" ? error : ""}
                    onSubmit={(command) =>
                      performThenClose(() => setDialog(null), command, doneLine(command))
                    }
                  />
                )
              )}
          </LiveDialog>
          <LiveDialog
            title={selected ? keepNames(sampleSaid(selected.title)) : words.detail.fallbackTitle}
            className="live-detail-dialog"
            open={!!selected}
            onClose={() => leaveDialog(() => setSelectedCommitment(null))}
          >
        <CommitmentDetail
          selected={selected}
          error={saveFrom === "detail" ? error : ""}
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
          onClose={() => leaveDialog(() => setEditingCommitment(null))}
          title={sheets.edit.title}
          description={<ZoneSaid timeZone={data.church.timeZone} language={words.locale} say={sheets.edit.deck} />}
        >
            {editingCommitment && (
              <LiveCommitmentEditor
                key={editingCommitment.id + ":" + editingCommitment.version}
                item={editingCommitment}
                timeZone={data.church.timeZone}
                pending={pending}
                saving={pending && saveFrom === "editor"}
                error={saveFrom === "editor" ? error : ""}
                save={(command) =>
                  performThenClose(
                    () => setEditingCommitment(null),
                    command,
                    sheets.edit.done,
                  )
                }
              />
            )}
        </LiveDialog>
        <LiveDialog
          open={confirmation !== null}
          onClose={() => leaveDialog(() => setConfirmation(null))}
          title={confirmation?.title}
          description={confirmation?.body}
        >
            {saveFrom === "confirmation" && error && (
              <div className="live-error" role="alert">
                {error}
              </div>
            )}
            <LiveWaiting when={pending && saveFrom === "confirmation"} />
            <div className="live-form-actions">
              <Button
                variant="outline"
                onClick={() => leaveDialog(() => setConfirmation(null))}
                disabled={held}
              >
                {sheets.goBack}
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  if (confirmation) void performThenClose(() => setConfirmation(null), confirmation.command, confirmation.done);
                }}
              >
                {confirmation?.action}
              </Button>
            </div>
        </LiveDialog>
        <LiveDialog
          open={!!release}
          onClose={() => leaveDialog(() => setRelease(null))}
          title={words.detail.changeTitle}
          description={<>{release &&
                  `${sampleSaid(release.title)} · ${when(release.start, release.end)}`}</>}
        >
            <p>{sheets.release.body}</p>
            {saveFrom === "release" && error && (
              <div className="live-error" role="alert">
                {error}
              </div>
            )}
            <LiveWaiting when={pending && saveFrom === "release"} />
            <div className="live-form-actions">
              <Button
                variant="outline"
                disabled={held}
                onClick={() => leaveDialog(() => setRelease(null))}
              >
                {sheets.release.keep}
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  if (release)
                    void performThenClose(
                      () => setRelease(null),
                      { type: "release", commitmentId: release.id, expectedVersion: release.version },
                      words.detail.released,
                    );
                }}
              >
                {sheets.release.confirm}
              </Button>
            </div>
        </LiveDialog>
      </WorkspaceProvider>
      </div>
    </WorkspaceProvider>
  );
}

/** The shell's own dialogs: the form an act opens, a commitment's details, its editor, a yes-or-no, and giving a date back. */
type DialogName = "create" | "detail" | "editor" | "confirmation" | "release";

/**
 * Lays the marker under the current room's line. It goes straight there (paper.css): where each line sits is read
 * when the menu is laid out (an observer's call, after layout), so a room change places the marker without asking
 * the page to lay itself out in the middle of drawing the next room.
 */
function useNavMarker(area: LiveArea) {
  const nav = useRef<HTMLElement | null>(null);
  const places = useRef(new Map<HTMLElement, Record<string, string>>());
  useLayoutEffect(() => {
    const element = nav.current;
    const marker = element?.querySelector<HTMLElement>(".live-nav-marker");
    if (!element || !marker) return;
    const measure = (link: HTMLElement) => {
      const place = {
        "--marker-x": `${link.offsetLeft}px`,
        "--marker-y": `${link.offsetTop}px`,
        "--marker-w": `${link.offsetWidth}px`,
        "--marker-h": `${link.offsetHeight}px`,
      };
      places.current.set(link, place);
      return place;
    };
    const current = () => element.querySelector<HTMLElement>('a[aria-current="page"]');
    const place = (link: HTMLElement | null, known?: Record<string, string>) => {
      const next = link && (known ?? places.current.get(link) ?? measure(link));
      if (next) for (const [name, value] of Object.entries(next)) marker.style.setProperty(name, value);
    };
    place(current());
    const resized = new ResizeObserver(() => {
      for (const link of element.querySelectorAll<HTMLElement>("a")) measure(link);
      const now = current();
      place(now);
      // In the sideways row of an upright tablet, bring the current room into view.
      if (now && element.scrollWidth > element.clientWidth)
        element.scrollLeft = now.offsetLeft - (element.clientWidth - now.offsetWidth) / 2;
    });
    resized.observe(element);
    for (const link of element.querySelectorAll<HTMLElement>("a")) resized.observe(link);
    return () => resized.disconnect();
  }, [area]);
  return nav;
}

declare global {
  interface Window {
    /**
     * Only while a room is on the page. The iPhone app calls it on a pull: exactly `true` means the room is
     * current (and the page has said "Up to date"); anything else, or no function at all, and the app reloads.
     */
    kindHelpsPulled?: () => boolean | Promise<boolean>;
  }
}

/**
 * The green line that says what was done. It is seen for six seconds, then leaves the page and
 * stays as a message for screen readers. Each new outcome is a new line (the old one is cleared first).
 */
function Outcome({ children, action, ref, remaining }: { children: string; action?: ReactNode; ref: RefObject<HTMLDivElement | null>; remaining?: number }) {
  // It is laid down like a slip, and after six seconds (ten with a way back) it closes up so the page below does not jump.
  // Put back on returning to its room, it stands whole for what is left of that time.
  const seen = useSavedLine(ref, { action: !!action, of: children, remaining });
  return (
    // Not a status region of its own: the words are said in the page's one polite region (fold.ts), which was there first.
    <div className={seen ? (remaining === undefined ? "live-success help-done paper-settle" : "live-success help-done") : "sr-only"} tabIndex={-1} ref={ref}>
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
 * The moment this workspace opened in the browser, read once and kept. A server
 * render has no such moment and says 0, so no route reads the clock while prerendering.
 */
let opened: number | undefined;
const openedAt = () => (opened ??= Date.now());
const noChange = () => () => {};
/** The rooms opened since the page was loaded. */
const roomsOpened = new Set<LiveArea>();
