"use client";

import { useEffect, type ReactNode } from "react";
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
    const fit = () => {
      root.setProperty("--live-view-height", `${view.height}px`);
      root.setProperty("--live-view-top", `${view.offsetTop}px`);
    };
    fit();
    view.addEventListener("resize", fit);
    view.addEventListener("scroll", fit);
    return () => {
      view.removeEventListener("resize", fit);
      view.removeEventListener("scroll", fit);
      root.removeProperty("--live-view-height");
      root.removeProperty("--live-view-top");
    };
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn("live-dialog live-dialog-fixed", className)}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
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
