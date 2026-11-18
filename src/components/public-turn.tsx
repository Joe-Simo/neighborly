"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** The public pages: one book, turned from page to page. The workspace and its doors keep their own turn (courtyard-door.tsx). */
const PUBLIC = /^\/(?:$|about\/|sobre\/|privacy$|privacidad$)/;

/**
 * One turn between public pages: following a link from one public page to another, the page is turned off from its lower right corner
 * along its diagonal (the crease of the shared page turn, src/lib/page-turn.ts), the next page lying whole beneath it; Back lays the
 * last page down again the other way. It is the browser's own picture of the two pages that is turned (a view transition), so neither
 * page is laid out or drawn again while it moves. With Reduce Motion, or where the browser cannot, the page simply changes.
 */
export function PublicTurn() {
  const router = useRouter();
  const path = usePathname();
  const arrived = useRef<((path: string) => void) | null>(null);
  useEffect(() => { arrived.current?.(path); }, [path]);

  useEffect(() => {
    if (!("startViewTransition" in document)) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    // Resolves once the page at `to` has been laid down, or after a second at most, so a turn can never hold the page.
    const until = (to: string) => new Promise<void>(done => {
      const give = window.setTimeout(done, 1000);
      // No frame is drawn while the turn waits for the page (the browser holds them), so it is answered straight from the commit.
      arrived.current = now => { if (now === to) { clearTimeout(give); arrived.current = null; done(); } };
    });
    const turn = (way: "on" | "back", change: () => void, to: string) => {
      document.documentElement.dataset.publicTurn = way;
      const moving = document.startViewTransition(async () => { change(); await until(to); });
      void moving.finished.finally(() => { delete document.documentElement.dataset.publicTurn; });
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || still.matches) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download") || link.origin !== location.origin) return;
      const to = link.pathname;
      if (to === location.pathname || !PUBLIC.test(to) || !PUBLIC.test(location.pathname)) return;
      event.preventDefault();
      turn("on", () => router.push(link.pathname + link.search + link.hash), to);
    };
    const back = () => {
      if (still.matches || !PUBLIC.test(location.pathname)) return;
      turn("back", () => {}, location.pathname);
    };
    // Heard before the link itself, so the page is turned instead of simply changed.
    document.addEventListener("click", click, true);
    addEventListener("popstate", back);
    return () => { document.removeEventListener("click", click, true); removeEventListener("popstate", back); };
  }, [router]);
  return null;
}
