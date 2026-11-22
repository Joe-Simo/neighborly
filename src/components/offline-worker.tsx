"use client";

import { useEffect } from "react";
import { ROOM_WHOLE } from "@/lib/room-whole";
import { whenIdle } from "@/lib/idle";
import { reloadOnceForCode } from "@/lib/chunk-recovery";

/**
 * Registers the offline worker once the page is in and the browser is idle. Its first install fetches the whole release
 * (about a hundred files, near 4 MB), which on a phone must not share the line with the page's own first load: so it
 * waits for the load event and, in the app, for the first room to be shown whole (or the door to be up a while), then
 * for an idle moment. A browser that refuses service workers for this site (site data blocked) answers with a
 * SecurityError, and the site simply works without one; any other failure still surfaces.
 *
 * The worker's window code is fetched only at that idle moment, so it is no part of any page's first load. From then on,
 * each page moved to is handed to the worker to keep, as the page it was moved to.
 */
async function register() {
  const { Serwist } = await import("@serwist/window");
  const serwist = new Serwist("/serwist/sw.js", { scope: "/", type: "module" });
  const keep = (url: string | URL | null | undefined) => {
    if (navigator.onLine && url) void serwist.messageSW({ type: "CACHE_URLS", payload: { urlsToCache: [String(url)] } });
  };
  for (const name of ["pushState", "replaceState"] as const) {
    const original = history[name];
    history[name] = (data, unused, url) => {
      original.call(history, data, unused, url);
      keep(url);
    };
  }
  window.addEventListener("online", () => keep(location.pathname));
  await serwist.register().catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
  });
}

let started = false;

export function OfflineWorker() {
  // Nothing is undone when the page leaves: the root layout this stands in is never taken down.
  useEffect(() => {
    if (started) return;
    started = true;
    // Code loaded from an effect or a press (a form, a month's dates) that fails across a deploy reloads the tab once in place.
    window.addEventListener("unhandledrejection", (event) => reloadOnceForCode(event.reason));
    if (!("serviceWorker" in navigator)) return;
    let registered = false;
    const once = () => {
      if (registered) return;
      registered = true;
      void register();
    };
    const registerWhenIdle = () => { whenIdle(once, 4000, 1500); };
    const roomIn = () => !document.querySelector(".live-app") || document.querySelector(".live-app[data-room-shown]") !== null;
    let longest: ReturnType<typeof setTimeout> | undefined;
    const afterRoom = () => {
      if (roomIn()) return registerWhenIdle();
      const shown = () => {
        window.removeEventListener(ROOM_WHOLE, shown);
        clearTimeout(longest);
        registerWhenIdle();
      };
      window.addEventListener(ROOM_WHOLE, shown);
      // A page that never shows a room (the door, a welcome) still gets its worker, a while after it is in.
      longest = setTimeout(shown, 8000);
    };
    if (document.readyState === "complete") afterRoom();
    else window.addEventListener("load", afterRoom, { once: true });
  }, []);
  return null;
}
