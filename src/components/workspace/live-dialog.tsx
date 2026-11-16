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
  closeLabel = "Close",
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
    const fit = () => {
      const sheet = document.activeElement?.closest(".live-dialog-fixed");
      if (sheet) settled.observe(sheet);
      root.setProperty("--live-view-height", `${view.height}px`);
      root.setProperty("--live-view-top", `${view.offsetTop}px`);
      // With little height left, the title scrolls away with the form so the boxes have the room.
      document.documentElement.toggleAttribute("data-live-short", view.height < 440);
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
    };
  }, [open]);
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn("live-dialog live-dialog-fixed", className)}
        showCloseButton={false}
        onFocus={(event) => keepInView(event.target)}
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
            <Button variant="ghost" size="icon" aria-label={closeLabel}>
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
 * A box being filled in stays clear of the title held at the top of its dialog and the buttons
 * held at its foot, which matters most on a small phone once the keyboard is up.
 */
function keepInView(target: Element | EventTarget | null) {
  if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select")) return;
  const sheet = target.closest<HTMLElement>(".live-dialog-fixed");
  if (!sheet) return;
  const top = sheet.querySelector('[data-slot="dialog-header"]')?.getBoundingClientRect().bottom ?? sheet.getBoundingClientRect().top;
  const foot = sheet.querySelector(".live-form-actions")?.getBoundingClientRect().top ?? sheet.getBoundingClientRect().bottom;
  // Its label comes along, so the person still reads what the box is for.
  const field = (target.closest(".live-field") ?? target).getBoundingClientRect();
  if (field.bottom > foot - 12) sheet.scrollBy({ top: Math.min(field.bottom - foot + 12, field.top - top - 12) });
  else if (field.top < top + 12) sheet.scrollBy({ top: field.top - top - 12 });
}
