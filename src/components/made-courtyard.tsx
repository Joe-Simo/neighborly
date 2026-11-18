"use client";

import { useEffect, useRef } from "react";
import "@/components/made-courtyard.css";

/** The courtyard's sheets, back to front: the painting cut along its own depth map, and its people on a sheet of their own after the far cloister. */
const sheets = ["0", "1", "people", "2", "3", "4", "5"] as const;

const source = (sheet: (typeof sheets)[number], width: 960 | 1774) =>
  sheet === "people" ? `/assets/made/courtyard-people-${width}.webp` : `/assets/made/courtyard-sheet-${sheet}-${width}.webp`;

/**
 * The courtyard drawn apart into its paper sheets, laid back together as the page scrolls past it.
 * `--open` is 1 apart and 0 whole; the scroll sets it in the same event, so the first scroll answers at once.
 * With Reduce Motion, or before the script arrives, the courtyard lies whole.
 */
export function MadeCourtyard({ label, apart, whole }: { label: string; apart: string; whole: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = -1;
    const place = () => {
      const { top, height } = element.getBoundingClientRect();
      const run = Math.max(1, height - innerHeight);
      // Apart for the first third of the run, laid together over the middle, whole for the last fifth.
      const travelled = Math.min(1, Math.max(0, (-top / run - .2) / .6));
      const open = Math.round((1 - travelled * travelled * (3 - 2 * travelled)) * 1000) / 1000;
      if (open === last) return;
      last = open;
      element.style.setProperty("--open", String(open));
      element.dataset.whole = String(open === 0);
    };
    element.dataset.live = "true";
    // The sheets are shown together or not at all, so no sheet of the courtyard arrives after the others.
    Promise.all([...element.querySelectorAll("img")].map(image => image.decode().catch(() => undefined))).then(() => { element.dataset.ready = "true"; });
    place();
    addEventListener("scroll", place, { passive: true });
    addEventListener("resize", place);
    return () => { removeEventListener("scroll", place); removeEventListener("resize", place); };
  }, []);

  return <div ref={host} className="made-courtyard" data-whole="true">
    <div className="made-courtyard-stage">
      <div className="made-courtyard-stack" role="img" aria-label={label}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the sheets are already cut at two widths and must stay in register, pixel for pixel */}
        {sheets.map((sheet, index) => <img
          key={sheet}
          src={source(sheet, 1774)}
          srcSet={`${source(sheet, 960)} 960w, ${source(sheet, 1774)} 1774w`}
          sizes="(max-width: 700px) 96vw, min(88vw, 1480px)"
          alt=""
          width={1774}
          height={887}
          loading="lazy"
          decoding="async"
          style={{ "--sheet": index } as React.CSSProperties}
        />)}
      </div>
      <p className="made-courtyard-said" aria-hidden="true"><span>{apart}</span><span>{whole}</span></p>
    </div>
  </div>;
}
