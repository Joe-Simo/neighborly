"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** The public pages: one book, turned from page to page. The workspace and its doors keep their own turn (courtyard-door.tsx). */
const PUBLIC = /^\/(?:$|about\/|sobre\/|privacy$|privacidad$)/;

/**
 * One turn between public pages: following a link from one public page to another, the page is turned off from its lower right corner
 * along its diagonal (the crease of the shared page turn, src/lib/page-turn.ts), its blank back folded over the crease, the next page whole beneath it; Back lays the
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
      // The flap and its shade are laid on the page only inside the turn, so the browser pictures them as parts of the turn and never as the page.
      const parts = ["public-turn-shade", "public-turn-flap"].map(name => Object.assign(document.createElement("div"), { className: name, ariaHidden: "true" }));
      const moving = document.startViewTransition(async () => { change(); document.body.append(...parts); await until(to); });
      // The turn is held still until the page beneath has mounted and drawn its first frames, so its own setting-up never lands inside the motion.
      void moving.ready.then(() => {
        const parts = document.getAnimations().filter(animation => (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
        parts.forEach(animation => animation.pause());
        let wait = 3;
        const go = () => { if (--wait > 0) requestAnimationFrame(go); else parts.forEach(animation => animation.play()); };
        requestAnimationFrame(go);
      }, () => {});
      void moving.finished.finally(() => { parts.forEach(part => part.remove()); delete document.documentElement.dataset.publicTurn; });
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
    // Back: the router is told only inside the turn, so the page leaving is pictured before the one coming back is laid down.
    let replaying = false;
    const back = (event: PopStateEvent) => {
      if (replaying || still.matches || !PUBLIC.test(location.pathname)) return;
      event.stopImmediatePropagation();
      const state: unknown = event.state;
      turn("back", () => { replaying = true; dispatchEvent(new PopStateEvent("popstate", { state })); replaying = false; }, location.pathname);
    };
    // Heard before the link itself, so the page is turned instead of simply changed.
    document.addEventListener("click", click, true);
    addEventListener("popstate", back, true);
    return () => { document.removeEventListener("click", click, true); removeEventListener("popstate", back, true); };
  }, [router]);
  return null;
}
