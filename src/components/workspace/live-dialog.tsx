"use client";

import type { ReactNode } from "react";
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
 * It opens in the first box to fill in, not on the close button.
 */
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
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn("live-dialog live-dialog-fixed", className)}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          const first =
            event.currentTarget instanceof HTMLElement &&
            event.currentTarget.querySelector<HTMLElement>("input, textarea, select");
          if (!first) return;
          event.preventDefault();
          first.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
