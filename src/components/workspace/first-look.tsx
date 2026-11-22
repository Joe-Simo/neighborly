"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { askFirstRoom, firstRoom, firstRoomHere, type FirstRoom } from "@/lib/first-room";
import type { LiveWorkspaceData } from "@/components/workspace/types";
import type { Language } from "@/lib/words";
import { useWaited } from "@/lib/use-waited";

/**
 * The first look at the sample: This week drawn from the seed's public answer (demo.firstRoom) while the visitor's
 * session is still being made, then changed over to the signed-in room in one commit.
 * - Nothing in a first look reaches the backend. Its rows carry seed keys where the signed-in room has ids, so every
 *   reading inside the room is skipped (query.ts) and the few the week draws from are answered here.
 * - A press that would open a row or write is kept, and made the moment the signed-in room is in (useKeptPress).
 */
type Look = {
  /** What drafts.weekNote answers for the hour the room was asked for. */
  weekNote: FunctionReturnType<typeof api.drafts.weekNote>;
  /** How many drafts wait for a yes; the week only says whether one does. */
  draftsWaiting: number;
  /** Whether the person may open neighbor records (the week's counts): always so in the sample. */
  allowed?: boolean;
  /** Whether the person is the sample's visitor: always so in a look at the sample. */
  visiting?: boolean;
  /** Readings kept on the device for a room other than the week (the help line), by the reading's name. */
  answers?: Record<string, unknown>;
};
const FirstLook = createContext<Look | null>(null);
export const FirstLookProvider = FirstLook.Provider;
/** Inside a first look: the answers the week draws from. Null in every signed-in room. */
export const useFirstLook = () => useContext(FirstLook);

/** The seed's answer once it is here: undefined while on its way, null when there is none and the room waits for sign-in. */
export function useFirstRoom(wanted: boolean) {
  // Already here at the press (asked for as the card neared the window): the room is drawn from it in this first pass.
  const [room, setRoom] = useState<FirstRoom | null | undefined>(() => (wanted ? firstRoomHere() : undefined));
  // The room comes in under the home page's card, or straight after the launch mark: it is drawn finished, as
  // a room under the door's paper is (door.css), and the shell lifts the mark at the next room.
  // (Not when a room is already on the page: an answer that late starts no look.)
  useLayoutEffect(() => {
    if (room && !document.querySelector(".live-app[data-room-shown]")) document.documentElement.dataset.fromDoor = "";
  }, [room]);
  useEffect(() => {
    if (!wanted) return;
    let current = true;
    // A fresh load of the address asks here; an answer still on its way is waited for. One already drawn changes nothing.
    askFirstRoom(async () => api.demo.firstRoom);
    void (firstRoom() ?? Promise.resolve(null)).then((answer) => current && setRoom(answer));
    return () => {
      current = false;
    };
  }, [wanted]);
  return wanted ? room : null;
}

/**
 * The room's data for a first look. The answer has the dashboard's fields with a seed key wherever the signed-in
 * room has an id; a key is never sent anywhere, so it stands in the id's place for as long as the look lasts.
 */
export function firstLookData(room: FirstRoom, language: Language, standing: Pick<Look, "allowed" | "visiting" | "answers"> = {}) {
  const { firstRequests, firstAnnouncements, weekNote, draftsWaiting, ...dashboard } = room;
  const seeded = { ...dashboard, user: { ...dashboard.user, language }, requests: firstRequests, announcements: firstAnnouncements };
  return {
    data: seeded as unknown as LiveWorkspaceData,
    requestCommitments: firstRequests.flatMap((request) => (request.commitment ? [request.commitment] : [])) as unknown as LiveWorkspaceData["commitments"],
    look: { weekNote, draftsWaiting, ...standing },
  };
}

type Kept = { path: number[]; said: string };
/** On a control that only opens something (a dialog, a sheet, a record): the one kind of press a first look keeps and makes later. */
const OPENS = "data-opens";
const RING = "kept-ring";
const CONTROL = "button, [role='button'], summary, input, select, textarea, label";
/** Where an element is in the room, and what it and its row say, so the same one can be found in the signed-in room. */
function place(room: HTMLElement, element: Element): Kept {
  const path: number[] = [];
  for (let at: Element | null = element; at && at !== room; at = at.parentElement) path.unshift([...(at.parentElement?.children ?? [])].indexOf(at));
  const row = element.closest(".live-row, article, li, section") ?? element;
  return { path, said: `${element.textContent}\n${row.textContent}` };
}
/** The element at that place, only if it and its row still say the same: a room that differs there keeps nothing. */
function found(room: HTMLElement, kept: Kept) {
  let at: Element | undefined = room;
  for (const index of kept.path) at = at?.children[index];
  return at instanceof HTMLElement && place(room, at).said === kept.said ? at : null;
}

/**
 * While the room is a first look, a press in it on anything but a link is held back: the pressed control rests, and
 * after 400ms its icon is the still waiting ring (paper.css). A press that opens something (`data-opens`) is then made
 * on the same control of the signed-in room in the frame that room comes in. A press that writes (a yes, Accept,
 * Decline, Done) is never made later: a person says every yes knowingly, on the room as it then is. Links go at
 * once: another room holds on this one's head until the session exists, as rooms do while loading. Where the keyboard was is kept the same way, because the rows are drawn again under their real ids.
 */
export function useKeptPress(looking: boolean) {
  const press = useRef<Kept | null>(null);
  const focus = useRef<Kept | null>(null);
  const was = useRef(false);
  const [kept, setKept] = useState<Element | null>(null);
  const waited = useWaited(looking && kept !== null);
  useEffect(() => {
    if (!waited || !kept?.hasAttribute("data-kept")) return;
    kept.setAttribute("data-kept", "waits");
    // The ring is drawn over the page, not in the control, so it stays the full ochre while the control rests at
    // half strength: in the place of the control's own icon, or just before a control that has none.
    const icon = kept.querySelector(":scope > svg:first-child");
    const box = (icon ?? kept).getBoundingClientRect();
    const ring = document.createElement("span");
    ring.className = RING;
    ring.setAttribute("aria-hidden", "true");
    ring.style.left = `${(icon ? box.left + box.width / 2 : box.left - 11) + scrollX}px`;
    ring.style.top = `${box.top + box.height / 2 + scrollY}px`;
    document.body.append(ring);
    return () => ring.remove();
  }, [waited, kept]);
  useEffect(() => {
    if (!looking) return;
    const room = () => document.querySelector<HTMLElement>(".live-app main.live-main");
    const keep = (event: MouseEvent) => {
      const column = room();
      // The look is over in this very commit (the layout effect below runs before this listener is taken away):
      // the press being made now is the kept one, on the signed-in room.
      if (!was.current) return;
      if (!column || !(event.target instanceof Element) || !column.contains(event.target) || event.target.closest("a[href]")) return;
      event.preventDefault();
      event.stopPropagation();
      const control = event.target.closest(CONTROL);
      if (!control) return;
      column.querySelector("[data-kept]")?.removeAttribute("data-kept");
      // It rests as pressed; a wait that lasts 400ms is then said by the still ochre ring where its icon is.
      control.setAttribute("data-kept", "");
      // A wait is said only once it has lasted the product's one hold (use-waited.ts), counted from this press.
      flushSync(() => setKept(null));
      setKept(control);
      // Only a press that opens something is made later. One that writes is never made for the person a moment
      // after the fact: its control rests, and at the change-over it is simply live for them to press.
      press.current = control.hasAttribute(OPENS) ? place(column, control) : null;
      // The pressed control holds the keyboard's place: when the live room comes in it is focused there, so a
      // second press acts on it at once.
      focus.current = place(column, control);
    };
    const where = () => {
      const column = room(), on = document.activeElement;
      focus.current = column && on && on !== column && column.contains(on) ? place(column, on) : null;
    };
    // A row taken off the page loses focus in that same step, before the change-over below has read where it was:
    // a loss is noted a moment later, so only one that lasts is.
    const left = () => queueMicrotask(where);
    document.addEventListener("click", keep, true);
    document.addEventListener("focusin", where);
    document.addEventListener("focusout", left);
    return () => {
      document.removeEventListener("click", keep, true);
      document.removeEventListener("focusin", where);
      document.removeEventListener("focusout", left);
    };
  }, [looking]);
  // The commit in which the signed-in room took the look's place.
  useLayoutEffect(() => {
    const changed = was.current && !looking;
    was.current = looking;
    if (!changed) return;
    const column = document.querySelector<HTMLElement>(".live-app main.live-main");
    const focused = focus.current, pressed = press.current;
    focus.current = press.current = null;
    if (!column) return;
    column.querySelector("[data-kept]")?.removeAttribute("data-kept");
    document.querySelector(`.${RING}`)?.remove();
    if (focused && (document.activeElement === document.body || !document.activeElement)) found(column, focused)?.focus({ preventScroll: true });
    if (pressed) found(column, pressed)?.click();
  }, [looking]);
}

/** Holds an act asked for during a first look until the look is over, then does it. For the way out, which names no row. */
export function useAfterLook(looking: boolean) {
  const waiting = useRef<(() => void)[]>([]);
  useEffect(() => {
    if (looking) return;
    for (const go of waiting.current.splice(0)) go();
  }, [looking]);
  return <Result,>(act: () => Promise<Result>) => new Promise<void>((go) => (looking ? waiting.current.push(go) : go())).then(act);
}
