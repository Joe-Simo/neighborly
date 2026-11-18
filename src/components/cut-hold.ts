"use client";

import { useEffect, type RefObject } from "react";

/** Measures the opening's words against its painting, so the page's cut edge can swing out and hold them: past their longest line by 32px, from above the headline to below the buttons. Only where the words begin on the plain paper and run onto the painting. */
export function useCutHold(viewport: RefObject<HTMLElement | null>, on: boolean, { art: artAt = ".painted-world-art", words = ".painted-world-caption", pieces = "h1, p, nav a", when = "(min-width:701px) and (min-aspect-ratio:10/11) and (min-height:501px)" } = {}) {
  useEffect(() => {
    const view = viewport.current;
    if (!on || !view) return;
    const measure = () => {
      const art = view.querySelector<HTMLElement>(artAt), caption = view.querySelector<HTMLElement>(words);
      const clear = () => ["--hold-x", "--hold-y", "--hold-w", "--hold-h"].forEach(name => view.style.removeProperty(name));
      if (!art || !caption || !matchMedia(when).matches) return clear();
      const box = art.getBoundingClientRect();
      let right = 0, top = Infinity, bottom = 0;
      for (const piece of caption.querySelectorAll<HTMLElement>(pieces)) {
        const range = document.createRange(); range.selectNodeContents(piece);
        for (const line of range.getClientRects()) { if (!line.width) continue; right = Math.max(right, line.right); top = Math.min(top, line.top); bottom = Math.max(bottom, line.bottom); }
      }
      if (right <= box.left || !isFinite(top)) return clear();
      // The swing reaches 97% of the piece's width at its widest, so the piece is sized to put that 32px past the longest line.
      const width = (right + 32 - box.left) / .97, above = 70, below = 64;
      view.style.setProperty("--hold-x", "0px");
      view.style.setProperty("--hold-y", `${Math.round(top - above - box.top)}px`);
      view.style.setProperty("--hold-w", `${Math.round(width)}px`);
      view.style.setProperty("--hold-h", `${Math.round(bottom - top + above + below)}px`);
    };
    // The observer's first answer comes in the frame's own layout, before it is painted: the page is never measured as it lands (a page turned to is laid out inside the turn).
    const watch = new ResizeObserver(measure);
    watch.observe(view);
    void document.fonts?.ready.then(measure);
    return () => watch.disconnect();
  }, [viewport, on, artAt, words, pieces, when]);
}
