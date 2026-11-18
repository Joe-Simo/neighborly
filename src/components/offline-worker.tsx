"use client";

import { useEffect, useRef } from "react";
import { useSerwist } from "@serwist/turbopack/react";
import { ROOM_WHOLE } from "@/lib/room-whole";

/**
 * Registers the offline worker once the page is in and the browser is idle. Its first install fetches the whole release
 * (about a hundred files, near 4 MB), which on a phone must not share the line with the page's own first load: so it
 * waits for the load event and, in the app, for the first room to be shown whole (or the door to be up a while), then
 * for an idle moment. A browser that refuses service workers for this site (site data blocked) answers with a
 * SecurityError, and the site simply works without one; any other failure still surfaces.
 */
export function OfflineWorker() {
  const { serwist } = useSerwist();
  const started = useRef(false);
  // Nothing is undone when the page leaves: the root layout this stands in is never taken down.
  useEffect(() => {
    if (!serwist || started.current) return;
    started.current = true;
    let registered = false;
    const register = () => {
      if (registered) return;
      registered = true;
      serwist.register().catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
      });
    };
    const whenIdle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(register, { timeout: 4000 }) : setTimeout(register, 1500));
    const roomIn = () => !document.querySelector(".live-app") || document.querySelector(".live-app[data-room-shown]") !== null;
    let longest: ReturnType<typeof setTimeout> | undefined;
    const afterRoom = () => {
      if (roomIn()) return void whenIdle();
      const shown = () => {
        window.removeEventListener(ROOM_WHOLE, shown);
        clearTimeout(longest);
        whenIdle();
      };
      window.addEventListener(ROOM_WHOLE, shown);
      // A page that never shows a room (the door, a welcome) still gets its worker, a while after it is in.
      longest = setTimeout(shown, 8000);
    };
    if (document.readyState === "complete") afterRoom();
    else window.addEventListener("load", afterRoom, { once: true });
  }, [serwist]);
  return null;
}
