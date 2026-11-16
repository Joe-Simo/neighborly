"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LiveApp } from "@/components/live-app";
import type { LiveEntryIntent } from "@/components/live-auth";
import { areaTitles, liveAreas } from "@/components/workspace/areas";

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

  // Any link from one room to another, in the menu or inside a room, is taken here.
  useEffect(() => {
    const step = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target || link.hasAttribute("download") || link.origin !== window.location.origin) return;
      // Only between rooms: the way in from sign-in, and every address that is not a room, stay with the router.
      if (!areaOf(link.pathname) || !areaOf(window.location.pathname) || link.search || link.hash) return;
      event.preventDefault();
      if (link.pathname === window.location.pathname) return;
      window.history.pushState(null, "", link.pathname);
      window.scrollTo(0, 0);
    };
    document.addEventListener("click", step, true);
    return () => document.removeEventListener("click", step, true);
  }, []);

  // The tab names the room; the server only does so on a fresh load.
  useEffect(() => {
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
          enterSample={entry && params.get("intent") === "sample"}
        />
      )}
      {children}
    </>
  );
}
