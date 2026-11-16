"use client";

import { useEffect } from "react";

/** The one place that decides how far the page grows with the reader's text size. Past this the rooms' rows and bars no longer fit a phone. */
const MOST = 1.3;
/** From this share on, things set side by side take a line each. */
const LARGE = 1.1;

/**
 * On iPhone and iPad the page follows the system's text size (Settings, Larger Text), up to 130%.
 * The system's body size is read from a probe set in `-apple-system-body`, which is 17px at the
 * standard setting, and every size on the page is scaled by the same share. Elsewhere nothing changes.
 * `large` names an attribute put on <html> while the words are large, for a layout that must give way.
 */
export function useSystemTextSize(large?: string) {
  useEffect(() => {
    if (!CSS.supports("font", "-apple-system-body")) return;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;font:-apple-system-body;-webkit-text-size-adjust:100%";
    document.body.append(probe);
    const root = document.documentElement;
    const fit = () => {
      const share = Math.min(MOST, Math.max(1, parseFloat(getComputedStyle(probe).fontSize) / 17));
      root.style.setProperty("-webkit-text-size-adjust", `${Math.round(share * 100)}%`);
      if (large) root.toggleAttribute(large, share > LARGE);
    };
    fit();
    // The setting can change while the app is in the background.
    document.addEventListener("visibilitychange", fit);
    return () => {
      document.removeEventListener("visibilitychange", fit);
      root.style.removeProperty("-webkit-text-size-adjust");
      if (large) root.removeAttribute(large);
      probe.remove();
    };
  }, [large]);
}
