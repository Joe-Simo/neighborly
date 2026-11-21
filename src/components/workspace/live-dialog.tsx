"use client";

import { createContext, startTransition, useContext, useDeferredValue, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { cn } from "@/lib/utils";

/**
 * The one dialog every room uses. Its title and its way out stay in view while a long
 * form scrolls, and so does the form's last line, the button (any `live-form-actions`).
 * With a mouse it opens in the first box to fill in. On a touch screen it opens on its
 * title instead, so the whole form shows and the keyboard waits for a tap; once the
 * keyboard is up, the dialog fits the space above it so the button stays in view.
 */
const touchScreen = "(hover: none) and (pointer: coarse)";
const InSheet = createContext(false);

/**
 * Every sheet's buttons stand in one order: Cancel, then the press that does the work, last on the right.
 * Cancel closes the sheet as its X does. Outside a sheet (a form set in a page) there is nothing to close, so it is left out.
 */
export function SheetCancel({ disabled }: { disabled?: boolean }) {
  const inSheet = useContext(InSheet);
  const cancel = useWorkspaceIfAny()?.words.shell.cancel ?? "Cancel";
  if (!inSheet) return null;
  return (
    <DialogClose asChild>
      <Button type="button" variant="ghost" disabled={disabled}>
        {cancel}
      </Button>
    </DialogClose>
  );
}
export function LiveDialog({
  title,
  description,
  open = true,
  onClose,
  closeLabel,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  open?: boolean;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const view = window.visualViewport;
    if (!open || !view || !window.matchMedia(touchScreen).matches) return;
    const root = document.documentElement.style;
    // The sheet reaches its new height a moment after the keyboard moves it, so the box being typed in
    // is brought back into view each time the sheet's own size changes, not only once.
    const settled = new ResizeObserver(() => keepInView(document.activeElement));
    // The tallest the view has been since the dialog opened is the screen without its keyboard.
    let tallest = window.innerHeight;
    const fit = () => {
      tallest = Math.max(tallest, view.height);
      // A see-through keyboard shows whatever lies under it, and nothing fixed to the window can be drawn
      // there. So while the keyboard is up the page behind steps back, and what shows is plain paper.
      document.documentElement.toggleAttribute("data-live-keyboard", view.height < tallest - 120);
      const sheet = document.activeElement?.closest(".live-dialog-fixed");
      if (sheet) settled.observe(sheet);
      root.setProperty("--live-view-height", `${view.height}px`);
      root.setProperty("--live-view-top", `${view.offsetTop}px`);
      // Only a phone on its side has too little height for a held title; there it scrolls away with the form.
      document.documentElement.toggleAttribute("data-live-short", view.height < 240);
      // On the smallest phones with the keyboard up, the held title and the held button are drawn closer,
      // so the box being filled in, its label and the button all fit above the keyboard.
      document.documentElement.toggleAttribute("data-live-tight", view.height < 360);
      // The keyboard has moved the sheet: bring the box being typed in back between the title and the buttons.
      requestAnimationFrame(() => keepInView(document.activeElement));
    };
    // Nothing is read or set as the sheet opens: no keyboard is up yet, so the view is the window and the page's
    // own values (100dvh, no offset) already hold. Only the held title's two sizes are set, from the window's height,
    // which needs no layout. Reading the view here would lay the whole page out inside the press that opens it.
    document.documentElement.toggleAttribute("data-live-short", window.innerHeight < 240);
    document.documentElement.toggleAttribute("data-live-tight", window.innerHeight < 360);
    view.addEventListener("resize", fit);
    view.addEventListener("scroll", fit);
    return () => {
      settled.disconnect();
      view.removeEventListener("resize", fit);
      view.removeEventListener("scroll", fit);
      root.removeProperty("--live-view-height");
      root.removeProperty("--live-view-top");
      document.documentElement.removeAttribute("data-live-short");
      document.documentElement.removeAttribute("data-live-tight");
      document.documentElement.removeAttribute("data-live-keyboard");
    };
  }, [open]);
  // The way out is named in the reader's language wherever the dialog opens inside the workspace.
  const words = useWorkspaceIfAny()?.words;
  const close = words?.shell.close ?? "Close";
  const opener = useRef<HTMLElement | null>(null);
  const [sheet, setSheet] = useState<HTMLElement | null>(null);
  useEffect(() => (sheet ? dragDownToClose(sheet, onClose) : undefined), [sheet, onClose]);
  // A save button that waits is disabled (or the step it was on is redrawn), and the browser drops its focus to the
  // page itself: a screen reader is then outside the sheet and the next Tab starts from the top. Focus is kept on the
  // sheet instead, until the room puts it where the answer is (the refusal, or the saved line).
  useEffect(() => {
    if (!sheet) return;
    const keep = (event: FocusEvent) => {
      const from = event.target;
      if (event.relatedTarget || !(from instanceof Element)) return;
      window.setTimeout(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if (lost && sheet.isConnected && (!from.isConnected || from.matches(":disabled"))) sheet.focus({ preventScroll: true });
      });
    };
    sheet.addEventListener("focusout", keep);
    return () => sheet.removeEventListener("focusout", keep);
  }, [sheet]);
  // Taken away with its step (the room stops drawing it), the dialog still closes the way it opened.
  const drawn = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    drawn.current = sheet;
  }, [sheet]);
  useLayoutEffect(() => () => leaving(drawn.current), []);
  // Opened in a transition too: the press is answered in its own frame, and the sheet, form and all, is drawn in the next.
  // It closes at once. What is drawn is the same; only the press no longer waits for the sheet to be built.
  const ready = useDeferredValue(open, false);
  return (
    // Closed in a transition: the key or press is answered in the next frame, and the room under the sheet is drawn after.
    <Dialog open={open && ready} onOpenChange={(next) => !next && startTransition(onClose)}>
      <DialogContent
        // A dialog is drawn under <body>, outside its room: it says its own language, so a leaders' English
        // form is not read aloud in the page's Spanish.
        lang={words?.locale}
        ref={setSheet}
        className={cn("live-dialog live-dialog-fixed", className)}
        showCloseButton={false}
        onFocus={({ target }) => {
          keepInView(target);
          // A phone scrolls a focused box into view by itself a moment later, without saying so; look once more.
          window.setTimeout(() => document.activeElement === target && keepInView(target), 400);
        }}
        onCloseAutoFocus={(event) => {
          // No DialogTrigger here, so the way back is ours: to what was focused when the dialog
          // opened, unless the room has already moved focus somewhere of its own (a saved notice).
          event.preventDefault();
          const from = opener.current;
          const free = !document.activeElement || document.activeElement === document.body;
          // The person is where they were when they opened it; coming back must not move the page.
          if (free && from?.isConnected) from.focus({ preventScroll: true });
        }}
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          // A desk opens on the first box to fill, or on the one control a sheet marks as its point (data-sheet-first).
          const first =
            event.currentTarget instanceof HTMLElement &&
            event.currentTarget.querySelector<HTMLElement>(
              window.matchMedia(touchScreen).matches
                ? '[data-slot="dialog-title"]'
                : "[data-sheet-first], input, textarea, select",
            );
          if (!first) return;
          event.preventDefault();
          // Focus waits until the sheet's first frame has been painted. A frame callback alone runs before that paint, so
          // focusing there made the browser work out the sheet's styles and layout (and keep the box in view) inside the
          // very frame that first draws it; one frame on, they are already worked out.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (first.isConnected && !first.closest("[inert]")) first.focus();
          }));
        }}
      >
        <DialogHeader>
          <DialogTitle tabIndex={-1}>{title}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={closeLabel ?? close}>
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>
        {description && <DialogDescription>{description}</DialogDescription>}
        <InSheet.Provider value>{children}</InSheet.Provider>
      </DialogContent>
    </Dialog>
  );
}

/**
 * In the iOS app a phone's sheet goes the way a sheet goes on iOS: pulled down by its title (where its grabber is drawn), or by
 * its paper once it is scrolled to the top, it follows the finger and lets go of the room when pulled far or fast
 * enough; otherwise it settles back. Anywhere else nothing is listened to.
 */
function dragDownToClose(sheet: HTMLElement, close: () => void) {
  if (document.documentElement.dataset.shell !== "ios" || !window.matchMedia("(max-width: 699px)").matches) return;
  let from: { y: number; at: number; held: boolean } | null = null;
  let pulled = 0;
  const begin = (event: TouchEvent) => {
    const held = event.target instanceof Element && !!event.target.closest('[data-slot="dialog-header"]');
    from = held || sheet.scrollTop <= 0 ? { y: event.touches[0].clientY, at: event.timeStamp, held } : null;
    pulled = 0;
  };
  const follow = (event: TouchEvent) => {
    if (!from) return;
    const down = event.touches[0].clientY - from.y;
    // Upward, or a sheet with more to read above: the paper scrolls as before.
    if (pulled === 0 && (down <= 0 || (!from.held && sheet.scrollTop > 0))) return void (from = null);
    event.preventDefault();
    pulled = Math.max(0, down);
    sheet.style.transition = "none";
    sheet.style.transform = `translateY(${pulled}px)`;
  };
  const end = (event: TouchEvent) => {
    if (!from || pulled === 0) return void (from = null);
    const fast = pulled / Math.max(1, event.timeStamp - from.at) > 0.5;
    from = null;
    sheet.style.transition = "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)";
    if (pulled > Math.min(140, sheet.offsetHeight / 3) || fast) {
      sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
      window.setTimeout(close, 200);
    } else sheet.style.transform = "";
  };
  sheet.addEventListener("touchstart", begin, { passive: true });
  sheet.addEventListener("touchmove", follow, { passive: false });
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
  return () => {
    sheet.removeEventListener("touchstart", begin);
    sheet.removeEventListener("touchmove", follow);
    sheet.removeEventListener("touchend", end);
    sheet.removeEventListener("touchcancel", end);
  };
}

/**
 * A box being filled in is wholly in view with its label: the label's top at least 16px under the title held
 * at the top of its dialog, the box's foot clear of the buttons held at the bottom. This matters most on a
 * phone once the keyboard is up. The sheet is also told those two edges (scroll padding), so the phone's own
 * scroll to a focused box lands in the same place and the two never pull against each other.
 */
function keepInView(target: Element | EventTarget | null) {
  if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select")) return;
  const sheet = target.closest<HTMLElement>(".live-dialog-fixed");
  if (!sheet) return;
  const head = sheet.querySelector<HTMLElement>('[data-slot="dialog-header"]');
  const held = !!head && getComputedStyle(head).position === "sticky";
  const top = held ? head.getBoundingClientRect().bottom : sheet.getBoundingClientRect().top;
  const actions = sheet.querySelector<HTMLElement>(".live-form-actions");
  const footHeld = !!actions && getComputedStyle(actions).position === "sticky";
  const foot = footHeld ? actions.getBoundingClientRect().top : sheet.getBoundingClientRect().bottom;
  // Its label comes along, so the person still reads what the box is for.
  const whole = target.closest(".live-field") ?? target;
  const field = whole.getBoundingClientRect();
  sheet.style.scrollPaddingTop = `${(held ? head.offsetHeight : 0) + ABOVE + Math.max(0, target.getBoundingClientRect().top - field.top)}px`;
  sheet.style.scrollPaddingBottom = `${(footHeld ? actions.offsetHeight : 0) + BELOW}px`;
  // Where both cannot be had, the label wins: the box is never pushed up under the title.
  if (field.top < top + ABOVE) sheet.scrollBy({ top: field.top - top - ABOVE });
  else if (field.height <= foot - BELOW - top - ABOVE) {
    if (field.bottom > foot - BELOW) sheet.scrollBy({ top: field.bottom - foot + BELOW });
  } else {
    // Label, box and the helper line under it do not all fit. A helper is shown whole or not at all: the box's
    // foot is brought to the buttons, so the helper lies wholly under them and no line of it is cut in half.
    const box = target.getBoundingClientRect();
    const helper = whole.querySelector("small")?.getBoundingClientRect();
    const gap = helper && helper.top >= box.bottom ? Math.min(BELOW, helper.top - box.bottom) : BELOW;
    sheet.scrollBy({ top: Math.min(box.bottom - foot + gap, field.top - top - ABOVE) });
  }
}
const ABOVE = 16;
const BELOW = 12;

/**
 * A dialog that is taken away while open, rather than closed in place, goes the way it came: a still copy of it and
 * of the shade behind it is laid where they stood and closes there (paper.css: back down on a phone, a quick fade
 * and settle on a desk). Its words and what was typed stay as they were seen. For less motion there is no copy.
 * Called as the dialog is taken away, while it is still on the page.
 */
function leaving(sheet: HTMLElement | null) {
  if (!sheet?.isConnected || sheet.dataset.state !== "open") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const shade = sheet.parentElement?.querySelector<HTMLElement>(':scope > [data-slot="dialog-overlay"]');
  const frame = document.createElement("div");
  frame.setAttribute("aria-hidden", "true");
  frame.inert = true;
  // A sheet already filed away (visits/file-away.ts) has left, and its shade came off with the file, at once.
  if (sheet.dataset.filed !== undefined) return;
  for (const part of [shade, sheet]) {
    if (!part) continue;
    const copy = part.cloneNode(true) as HTMLElement;
    const from = [part, ...part.querySelectorAll("*")];
    [copy, ...copy.querySelectorAll("*")].forEach((twin, index) => {
      const source = from[index];
      if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement || source instanceof HTMLSelectElement)
        (twin as typeof source).value = source.value;
      twin.removeAttribute("id");
    });
    copy.dataset.state = "closed";
    copy.style.pointerEvents = "none";
    // Each part stays where its own close leaves it until the last has finished: on a phone the shade's fade is
    // shorter than the sheet's way down, and must not come back meanwhile.
    copy.style.animationFillMode = "forwards";
    frame.append(copy);
  }
  // Just before the shade and the dialog, beside them in the body, so it is set in the same type and a dialog
  // opened in its stead is laid over it.
  (shade ?? sheet).before(frame);
  // Its moves are asked for in the copy's first frame, where the browser works out its styles anyway: asked here,
  // inside the press, they make it work out the whole page's styles once more before it draws.
  requestAnimationFrame(() => {
    // Only a move with an end in time is waited for: one run by the sheet's scroll (its title's rule) never ends here.
    const moves = frame.getAnimations({ subtree: true }).filter((move) => Number.isFinite(move.effect?.getComputedTiming().endTime));
    if (!moves.length) return frame.remove();
    void Promise.allSettled(moves.map((move) => move.finished)).then(() => frame.remove());
  });
}
