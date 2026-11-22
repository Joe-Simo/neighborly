"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceIfAny } from "@/components/workspace/context";

type Felt = { webkit?: { messageHandlers?: { kindHelpsFelt?: { postMessage: (felt: "selected") => void } } } };
/**
 * The app's own context menu (SceneDelegate, kindHelpsMenu): as a finger comes down on a row, the page tells the app
 * where the row is and its actions in its own words; if the finger stays, the system lifts the row and shows them,
 * and answers on `window.kindHelpsMenuChose`. A finger down anywhere else clears it.
 */
type NativeMenu = { webkit?: { messageHandlers?: { kindHelpsMenu?: { postMessage: (menu: { x: number; y: number; width: number; height: number; actions: string[]; kinds: string[] }) => void } } } };
declare global {
  interface Window { kindHelpsMenuChose?: (index: number) => void }
}

const noChange = () => () => {};
function useIosShell() {
  return useSyncExternalStore(noChange, () => document.documentElement.dataset.shell === "ios", () => false);
}

/** How long a finger rests on a row before its actions come, and how far it may move before it is a scroll. */
const HOLD = 450;
const DRIFT = 10;

type Open = { row: HTMLElement; actions: { label: string; run: () => void }[]; top: number; above: boolean };

/**
 * In the iOS app a long press on a list row (marked `data-row-menu`) brings up a small sheet of paper with that
 * row's own actions, at most three, each one already on the row or in the record it opens, so nothing here is
 * reachable only here: Call (the row's `tel:` link, when there is one), Open (the row's own link), and the room's
 * one action (the row's button marked `data-row-action`, in its own words). Never a decision: those stay in the
 * record. The sheet is set down whole in one frame above or below the row, whichever has room; the rest of the
 * page lies under one flat shade, and the row keeps its pressed tint. A tap outside or a swipe down puts it away.
 * VoiceOver reads the same actions where they already are, on the row and in the record. On the website nothing
 * listens.
 */
export function RowMenu() {
  const ios = useIosShell();
  const words = useWorkspaceIfAny()?.words;
  const [open, setOpen] = useState<Open | null>(null);
  const swallow = useRef<HTMLElement | null>(null);
  const openLabel = words?.shell.rowMenu.open ?? "Open";
  const callLabel = words?.shell.rowMenu.call ?? "Call";

  useEffect(() => {
    if (!ios) return;
    let timer = 0;
    let start: { x: number; y: number } | null = null;
    const cancel = () => {
      window.clearTimeout(timer);
      start = null;
    };
    const actionsOf = (row: HTMLElement) => {
      const link = row.querySelector<HTMLAnchorElement>("a[href]:not([href^='tel:'])");
      const phone = row.querySelector<HTMLAnchorElement>("a[href^='tel:']");
      const own = row.querySelector<HTMLButtonElement>("[data-row-action]");
      return [
        phone && { kind: "call", label: callLabel, run: () => phone.click() },
        link && { kind: "open", label: openLabel, run: () => link.click() },
        own && { kind: "own", label: (own.textContent ?? "").trim(), run: () => own.click() },
      ].filter((action): action is { kind: string; label: string; run: () => void } => !!action && !!action.label);
    };
    const native = (window as NativeMenu).webkit?.messageHandlers?.kindHelpsMenu;
    const down = (event: TouchEvent) => {
      const row = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-row-menu]") : null;
      if (native) {
        // The system holds the press, lifts the row and sets the menu; the page only names what is on it.
        const actions = row && event.touches.length === 1 ? actionsOf(row) : [];
        // The row whole, with anything of it that stands past its edge (a full-width button), so the lift shows all of it.
        const boxes = row ? [row, ...row.querySelectorAll("*")].map((part) => part.getBoundingClientRect()).filter((part) => part.width && part.height) : [];
        const left = Math.min(...boxes.map((part) => part.left)), top = Math.min(...boxes.map((part) => part.top));
        const right = Math.max(...boxes.map((part) => part.right)), bottom = Math.max(...boxes.map((part) => part.bottom));
        window.kindHelpsMenuChose = (index) => actions[index]?.run();
        native.postMessage(boxes.length
          ? { x: left, y: top, width: right - left, height: bottom - top, actions: actions.map((action) => action.label), kinds: actions.map((action) => action.kind) }
          : { x: 0, y: 0, width: 0, height: 0, actions: [], kinds: [] });
        return;
      }
      if (!row || event.touches.length !== 1) return cancel();
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      timer = window.setTimeout(() => {
        const actions = actionsOf(row);
        if (!actions.length) return;
        // The press is the menu's: the click that follows the lift does not also open the row.
        swallow.current = row;
        // The sheet opening is felt as the system's selection tap (SceneDelegate, "selected").
        (window as Felt).webkit?.messageHandlers?.kindHelpsFelt?.postMessage("selected");
        const box = row.getBoundingClientRect();
        const tall = actions.length * 45 + 8;
        const above = box.bottom + tall + 12 > window.innerHeight - 90 && box.top - tall - 12 > 60;
        // A short window (a phone or iPad on its side) may have room on neither side: the sheet then stays whole on screen.
        const top = Math.max(8, Math.min(above ? box.top - tall - 8 : box.bottom + 8, window.innerHeight - tall - 8));
        setOpen({ row, actions, top, above });
      }, HOLD);
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > DRIFT) cancel();
    };
    const click = (event: MouseEvent) => {
      if (!swallow.current || !(event.target instanceof Node) || !swallow.current.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      swallow.current = null;
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", cancel, { passive: true });
    document.addEventListener("touchcancel", cancel, { passive: true });
    document.addEventListener("click", click, { capture: true });
    return () => {
      cancel();
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", cancel);
      document.removeEventListener("touchcancel", cancel);
      document.removeEventListener("click", click, { capture: true });
    };
  }, [ios, openLabel, callLabel]);

  // The pressed row keeps its tint while its sheet is open.
  useEffect(() => {
    if (!open) return;
    const row = open.row;
    row.setAttribute("data-row-pressed", "");
    return () => row.removeAttribute("data-row-pressed");
  }, [open]);

  const swipe = useRef(0);
  const close = () => {
    swallow.current = null;
    setOpen(null);
  };

  if (!ios || !open) return null;
  return createPortal(
    <div
      className="row-menu-shade"
      onClick={close}
      onTouchStart={(event) => {
        swipe.current = event.touches[0].clientY;
      }}
      onTouchMove={(event) => {
        if (event.touches[0].clientY - swipe.current > 24) close();
      }}
    >
      <div
        className="row-menu"
        role="menu"
        data-above={open.above ? "" : undefined}
        style={{ top: open.top }}
        onClick={(event) => event.stopPropagation()}
      >
        {open.actions.map((action) => (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              action.run();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
