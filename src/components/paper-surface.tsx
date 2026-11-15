"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import "./paper-surface.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  variant?: "entry" | "workspace" | "invitation";
  ready?: boolean;
  onEntered?: () => void;
  onExited?: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  originRef?: RefObject<HTMLElement | null>;
};

/** Semantic reading surface; artwork is decoration, never the source of controls. */
export function PaperSurface({ open, onOpenChange, title, children, variant = "workspace", ready = true, onEntered, onExited, returnFocusRef, originRef }: Props) {
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const focusFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);
  useEffect(() => {
    if (open && ready) {
      onEntered?.();
      document.getElementById(`paper-heading-${variant}`)?.focus({ preventScroll: true });
    }
  }, [open, ready, onEntered, variant]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogPortal>
      <DialogOverlay className="paper-overlay" />
      <Primitive.Content ref={content} className={`paper-surface paper-surface-${variant}`} aria-labelledby={`paper-heading-${variant}`} data-ready={ready} onCloseAutoFocus={(event) => {
        event.preventDefault();
        onExited?.();
        const target = returnFocusRef?.current ?? opener.current;
        if (target?.isConnected) target.focus({ preventScroll: true });
      }} onOpenAutoFocus={(event) => {
        event.preventDefault();
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (variant === "invitation" && content.current) {
          const surface = content.current;
          const origin = (originRef?.current ?? returnFocusRef?.current ?? opener.current)?.getBoundingClientRect();
          if (origin && origin.width > 0 && origin.height > 0) {
            surface.style.setProperty("--paper-origin-x", `${origin.left + origin.width / 2 - surface.offsetLeft}px`);
            surface.style.setProperty("--paper-origin-y", `${origin.top + origin.height / 2 - surface.offsetTop}px`);
            surface.style.setProperty("--paper-origin-scale-x", String(Math.min(1, origin.width / surface.offsetWidth)));
            surface.style.setProperty("--paper-origin-scale-y", String(Math.min(1, origin.height / surface.offsetHeight)));
          }
        }
        cancelAnimationFrame(focusFrame.current);
        if (ready) focusFrame.current = requestAnimationFrame(() => document.getElementById(`paper-heading-${variant}`)?.focus({ preventScroll: true }));
      }}>
        <div className="paper-reading" inert={!ready}>
          <header className="paper-heading-row">
            <span className="paper-imprint">neighborly <span>·</span> people helping people</span>
            <Primitive.Close asChild><Button variant="ghost" size="icon" aria-label="Close paper"><X size={19} /></Button></Primitive.Close>
          </header>
          <DialogTitle id={`paper-heading-${variant}`} tabIndex={-1} className="paper-heading">{title}</DialogTitle>
          <DialogDescription className="sr-only">A place to organize volunteering with your people.</DialogDescription>
          <div className="paper-body">{children}</div>
        </div>
      </Primitive.Content>
    </DialogPortal>
  </Dialog>;
}
