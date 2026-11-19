"use client";

import { useEffect } from "react";

/**
 * A focus ring is for someone finding their way with keys. Focus that the app moves itself (back to Menu when
 * its sheet closes, onto a sheet as it opens) or that follows a tap draws none, a box to type in included (its edge goes ink instead).
 * The page is marked while keys are in use, and the mark goes with the next touch or click. The frame (live-frame.tsx)
 * holds it, so the sign-in sheet and every room share it.
 */
export function useKeysInUse() {
  useEffect(() => {
    const root = document.documentElement;
    const keys = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.matches("input, textarea, [contenteditable]");
      if (event.key === "Tab" || (!typing && !event.metaKey && !event.ctrlKey && !event.altKey)) root.dataset.liveKeys = "";
    };
    const pointer = () => delete root.dataset.liveKeys;
    window.addEventListener("keydown", keys, true);
    window.addEventListener("pointerdown", pointer, true);
    return () => {
      window.removeEventListener("keydown", keys, true);
      window.removeEventListener("pointerdown", pointer, true);
      pointer();
    };
  }, []);
}
