"use client";

import { useEffect } from "react";
import { paperTurnAt, turnLeaf } from "@/lib/paper-turn";

/**
 * A public page of laid sheets as the home page's book (paper-turn.ts): from 1024 up, each chapter's sheet after the first arrives as the next leaf, hinged
 * from its top edge, and the sheet above it shows the deeper crease while it turns. A sheet already in the window on the first frame, or one the
 * keyboard enters, lies flat until it has left the window below. Phones and Reduce Motion keep flat sheets.
 */
export function BookLeaves({ sheets: selector }: { sheets: string }) {
  useEffect(() => {
    const wide = matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const sheets = [...document.querySelectorAll<HTMLElement>(selector)].slice(1);
    if (!sheets.length) return;
    const flat = new Set<HTMLElement>();
    let frame = 0, seeded = false;
    const place = () => {
      frame = 0;
      const height = innerHeight;
      const tops = sheets.map(sheet => sheet.getBoundingClientRect().top);
      if (!seeded) { seeded = true; sheets.forEach((sheet, index) => { if (tops[index] < height) flat.add(sheet); }); }
      sheets.forEach((sheet, index) => {
        if (tops[index] > height) flat.delete(sheet);
        const above = sheet.previousElementSibling instanceof HTMLElement ? sheet.previousElementSibling : sheet;
        turnLeaf(above, sheet, paperTurnAt(tops[index], height), !wide.matches || flat.has(sheet));
      });
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(place); };
    const focused = (event: FocusEvent) => { const sheet = (event.target as Element | null)?.closest<HTMLElement>(selector); if (sheet) { flat.add(sheet); request(); } };
    request();
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    wide.addEventListener("change", request);
    document.addEventListener("focusin", focused);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", request); removeEventListener("resize", request); wide.removeEventListener("change", request); document.removeEventListener("focusin", focused);
      sheets.forEach(sheet => { sheet.style.transform = ""; (sheet.previousElementSibling as HTMLElement | null)?.removeAttribute("data-leaf-turning"); });
    };
  }, [selector]);
  return null;
}
