"use client";

import { useEffect } from "react";

/** The one place that decides how far the page grows with the reader's text size. Past this the rooms' rows and bars no longer fit a phone. */
const MOST = 1.3;
/** In the iOS app the rooms give way at large sizes (shell-ios.css), so the words follow the setting to twice their size. */
const MOST_IN_APP = 2;
/** From this share on, things set side by side take a line each. */
const LARGE = 1.1;
/** The accessibility sizes (AX1 is a 28pt body, 1.65 of the standard 17pt): from here the room's head gives way too. */
const ACCESSIBILITY = 1.6;

/**
 * On iPhone and iPad the page follows the system's text size (Settings, Larger Text), up to 130%, and to 200% in the app.
 * The system's body size is read from a probe set in `-apple-system-body`, which is 17px at the
 * standard setting, and every size on the page is scaled by the same share. Elsewhere nothing changes.
 * `large` names an attribute put on <html> while the words are large, for a layout that must give way, and
 * `accessibility` one put there at the accessibility sizes (AX1 and up).
 */
export function useSystemTextSize(large?: string, accessibility?: string) {
  useEffect(() => {
    if (!CSS.supports("font", "-apple-system-body")) return;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;font:-apple-system-body;-webkit-text-size-adjust:100%";
    document.body.append(probe);
    const root = document.documentElement;
    const fit = () => {
      const most = root.dataset.shell === "ios" ? MOST_IN_APP : MOST;
      const share = Math.min(most, Math.max(1, parseFloat(getComputedStyle(probe).fontSize) / 17));
      root.style.setProperty("-webkit-text-size-adjust", `${Math.round(share * 100)}%`);
      if (large) root.toggleAttribute(large, share > LARGE);
      if (accessibility) root.toggleAttribute(accessibility, share >= ACCESSIBILITY);
    };
    fit();
    // The setting can change while the app is in the background.
    document.addEventListener("visibilitychange", fit);
    return () => {
      document.removeEventListener("visibilitychange", fit);
      root.style.removeProperty("-webkit-text-size-adjust");
      if (large) root.removeAttribute(large);
      if (accessibility) root.removeAttribute(accessibility);
      probe.remove();
    };
  }, [large, accessibility]);
}
