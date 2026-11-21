import { useEffect, type RefObject } from "react";
import { lessMotion } from "@/lib/less-motion";
import { frameStep } from "@/lib/scroll-frame";
import { paperTurnAt, turnLeaf } from "@/lib/paper-turn";

/**
 * A room's sheets arrive as the home page's chapters do (paper-turn.ts): a sheet coming up from below the window lifts one leaf, hinged
 * from its top edge, and lies flat by the time its top is at 60% of the window. Scroll-scrubbed and reversible, on the shared frame.
 * A sheet already in the window when the room is shown lies flat (the first frame is the room as drawn), as does one the keyboard has
 * entered, until it has left the window below. A stack of sheets lies still: a turning leaf would pass over the sheet beside it. Nothing
 * turns for anyone who asks for less motion.
 */
export function useSheetLeaves(room: RefObject<HTMLElement | null>, shown: string | null) {
  useEffect(() => {
    const column = room.current;
    if (!column || !shown || lessMotion()) return;
    const alone = (sheet: Element) => !sheet.previousElementSibling?.matches(".help-sheet") && !sheet.nextElementSibling?.matches(".help-sheet");
    const sheets = () => [...column.querySelectorAll<HTMLElement>(".help-sheet")].filter(alone);
    // The window's height too is read by the watcher: asked here, it makes the browser work out the new room's styles.
    let height = 0;
    let read: { sheet: HTMLElement; top: number }[] = [];
    // Where each sheet lies untouched: its box less the 0 to 24px its own turn has set it down.
    const down = new WeakMap<HTMLElement, number>();
    // Which sheets are in the window as the room is shown is told by the first look of the watcher below, from the layout
    // the frame has already made: asking each sheet here would lay the new room out before its first frame is drawn.
    const flat = new Set<HTMLElement>();
    const looked = new WeakSet<Element>();
    const { ask, drop } = frameStep(
      () => {
        height = innerHeight;
        read = sheets().filter((sheet) => near.has(sheet)).map((sheet) => ({ sheet, top: sheet.getBoundingClientRect().top - (down.get(sheet) ?? 0) }));
      },
      () => {
        for (const { sheet, top } of read) {
          if (top > height) flat.delete(sheet);
          turnLeaf(sheet, sheet, paperTurnAt(top, height), flat.has(sheet));
          down.set(sheet, Number(/translate3d\(0,([\d.]+)px/.exec(sheet.style.transform)?.[1] ?? 0));
        }
      },
    );
    // Read only while a sheet is near the window: the rest of the room's scroll asks nothing of the frame.
    const near = new Set<Element>();
    const watch = new IntersectionObserver((seen) => {
      height = innerHeight;
      for (const one of seen) {
        if (!looked.has(one.target)) {
          looked.add(one.target);
          if (one.boundingClientRect.top < height) flat.add(one.target as HTMLElement);
        }
        if (one.isIntersecting) near.add(one.target);
        else {
          near.delete(one.target);
          // Gone below the window: it is a new leaf when it comes up again.
          if (one.boundingClientRect.top > 0) flat.delete(one.target as HTMLElement);
        }
      }
      ask();
    }, { rootMargin: "0px 0px 50% 0px" });
    for (const sheet of sheets()) watch.observe(sheet);
    const scrolled = () => { if (near.size) ask(); };
    const focused = (event: FocusEvent) => {
      const sheet = (event.target as Element | null)?.closest<HTMLElement>(".help-sheet");
      if (sheet) { flat.add(sheet); ask(); }
    };
    addEventListener("scroll", scrolled, { passive: true });
    addEventListener("resize", ask);
    column.addEventListener("focusin", focused);
    return () => {
      drop();
      removeEventListener("scroll", scrolled);
      watch.disconnect();
      removeEventListener("resize", ask);
      column.removeEventListener("focusin", focused);
      for (const sheet of column.querySelectorAll<HTMLElement>(".help-sheet")) { sheet.style.transform = ""; sheet.removeAttribute("data-leaf-turning"); }
    };
  }, [room, shown]);
}
