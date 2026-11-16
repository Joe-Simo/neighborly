"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
    let tallest = view.height;
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
    fit();
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
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        // A dialog is drawn under <body>, outside its room: it says its own language, so a leaders' English
        // form is not read aloud in the page's Spanish.
        lang={words?.locale}
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
          if (free && from?.isConnected) from.focus();
        }}
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const first =
            event.currentTarget instanceof HTMLElement &&
            event.currentTarget.querySelector<HTMLElement>(
              window.matchMedia(touchScreen).matches
                ? '[data-slot="dialog-title"]'
                : "input, textarea, select",
            );
          if (!first) return;
          event.preventDefault();
          first.focus();
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
        {children}
      </DialogContent>
    </Dialog>
  );
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
