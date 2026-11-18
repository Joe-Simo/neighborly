"use client";

import { startTransition, useEffect, useLayoutEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LiveApp } from "@/components/live-app";
import type { LiveEntryIntent } from "@/components/live-auth";
import { areaTitles, liveAreas } from "@/components/workspace/areas";
import { askFirstRoom } from "@/lib/first-room";
import { askSampleTicket } from "@/lib/sample-ticket";

const areaOf = (pathname: string) => {
  const [, app, segment, more] = pathname.split("/");
  return app === "app" && more === undefined ? liveAreas.find((candidate) => candidate === segment) : undefined;
};

/**
 * The workspace's frame lives here, in the layout, as ONE instance for the entry address and for
 * every room, so the session, the menu and the head are never taken down between rooms.
 * Which room is read from the address. A room change is the browser's own history step: nothing is
 * asked of the server, so the next room is on screen at once and only its own content waits.
 */
export function LiveFrame({ children, sampleEntry }: { children: ReactNode; sampleEntry: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const area = areaOf(pathname);
  const entry = pathname === "/app";
  const invite = (entry && params.get("invite")) || undefined;
  const asked = entry ? params.get("intent") : null;
  const intent: LiveEntryIntent =
    asked === "start" || asked === "join" || asked === "signin" ? asked : invite ? "join" : "signin";

  // Arrived by the sample door from outside (a fresh load): the ticket is asked for now, while Clerk loads.
  const enterSample = entry && params.get("intent") === "sample";
  useEffect(() => {
    if (!enterSample || !sampleEntry) return;
    askSampleTicket();
    askFirstRoom();
  }, [enterSample, sampleEntry]);

  // Any link from one room to another, in the menu or inside a room, is taken here.
  useEffect(() => {
    let kept: { path: string; y: number } | null = null;
    const step = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target || link.hasAttribute("download") || link.origin !== window.location.origin) return;
      // Only between rooms: the way in from sign-in, and every address that is not a room, stay with the router.
      const here = window.location;
      if (!areaOf(link.pathname) || !areaOf(here.pathname) || link.hash) return;
      // A link that takes its own step (`data-step-own`, on it or around it) is left whole to whoever marked it.
      if (link.closest("[data-step-own]")) return;
      const sameRoom = link.pathname === here.pathname;
      if (link.search) {
        // Into something inside the room (a neighbor's record, a visit's sheet): the router takes it. It keeps
        // the page where it was, so the frame remembers the list's place for the way back and, once the address
        // has changed, sets what was opened at its top.
        if (!sameRoom) return;
        if (!here.search) kept = { path: here.pathname, y: window.scrollY };
        const opened = link.search;
        let tries = 120;
        const top = () => {
          if (window.location.pathname !== link.pathname) return;
          if (window.location.search === opened) window.scrollTo(0, 0);
          else if (--tries) requestAnimationFrame(top);
        };
        requestAnimationFrame(top);
        return;
      }
      event.preventDefault();
      // The room already in view stays as it is, unless it stands on something inside itself (a neighbor's
      // record at ?neighbor=…): then the plain link is the way back to the room.
      if (sameRoom && !here.search) return;
      // Only the room's own way back (a link inside the room) returns to the list's place; the menu opens a room at its top.
      const back = sameRoom && kept?.path === link.pathname && link.closest("main") ? kept.y : 0;
      kept = null;
      // The press is painted in the next frame, as paper (the link pressed), and the next room is drawn after it, in
      // a transition: the room left stays whole on screen until the next one is whole (room-sheet.tsx).
      link.setAttribute("data-going", "");
      startTransition(() => window.history.pushState(null, "", link.pathname));
      if (!back) return window.scrollTo(0, 0);
      // Back in the list where it was left: once the list is long enough to stand there again, or after a second.
      let tries = 60;
      const settle = () => {
        if (window.location.pathname !== link.pathname || window.location.search) return;
        if (document.documentElement.scrollHeight - window.innerHeight >= back || --tries === 0) window.scrollTo(0, back);
        else requestAnimationFrame(settle);
      };
      requestAnimationFrame(settle);
    };
    document.addEventListener("click", step, true);
    return () => document.removeEventListener("click", step, true);
  }, []);

  // The link pressed is let go of once its room is the one in the address.
  useEffect(() => {
    for (const link of document.querySelectorAll("a[data-going]")) link.removeAttribute("data-going");
  }, [pathname]);

  // The tab names the room; the server only does so on a fresh load. Set before paint, so the room's own
  // effect (shell.tsx), which knows the person's language, has the last word.
  useLayoutEffect(() => {
    if (area) document.title = `${areaTitles[area]} · Kind Helps`;
  }, [area]);

  return (
    <>
      {(area || entry) && (
        <LiveApp
          key={`${intent}:${invite ?? ""}`}
          area={area}
          invitationToken={invite}
          intent={intent}
          sampleEntry={sampleEntry}
          enterSample={enterSample}
        />
      )}
      {children}
    </>
  );
}
