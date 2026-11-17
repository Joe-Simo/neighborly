"use client";

import { type ReactNode, useEffect, useRef } from "react";
import "./chapter-sheets.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Where one chapter gives way to the next, the next chapter's paper is drawn over the last as a cut sheet.
 * The sheet is only ever the colour of the paper already lying beneath it, so when it has crossed, it is put away and nothing changes.
 */
// `under` is how far the sheet reaches below the next chapter's first edge: the close's own paper begins with a 56 px cut edge, and the sheet lies beneath it there.
const sheets = {
  // The story's paper is drawn across the courtyard from the right. It answers the first pixel, then keeps most of its crossing for late in the change, so the courtyard is in sight and little paper lies bare for as long as may be.
  story: { next: ".relief-story", under: 1, pace: (risen: number) => risen * .25 + risen ** 2.2 * .75 },
  // The close's paper is laid back down from the top, as the opening's sheet was lifted from the foot. It waits longer still: the sample's sheet above it is something to be read and used.
  close: { next: ".neighborly-together", under: 57, pace: (risen: number) => risen * .06 + risen ** 4 * .94 },
};

export function ChapterSheet({ to }: { to: keyof typeof sheets }) {
  const paper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sheet = paper.current, next = sheet?.closest<HTMLElement>(sheets[to].next) ?? sheet?.parentElement?.querySelector<HTMLElement>(sheets[to].next);
    if (!sheet || !next) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, across = "", foot = "", lie = "", tall = "";
    const update = () => {
      frame = 0;
      const box = next.getBoundingClientRect(), top = box.top, height = innerHeight;
      // The next chapter's paper comes over as that chapter's first edge rises from the foot of the window to its top.
      const crossed = sheets[to].pace(clamp((height - top) / height));
      if (to === "close") {
        // The close's sheet is part of the page above the rooms, so it is not moved: only its foot is, counted from the sheet's own top, which stands one window above the rooms' edge.
        const edge = Math.max(36, Math.min(64, innerWidth * .044));
        const shown = top <= 0 || crossed <= 0 ? -200 : (still.matches ? Number(crossed >= .5) : crossed) * (height + edge) - edge - (top + sheets.close.under - sheet.offsetHeight);
        const nowLie = `${shown.toFixed(1)}px`, nowTall = `${box.height.toFixed(0)}px`;
        if (nowLie !== lie) { lie = nowLie; sheet.style.setProperty("--lie", lie); sheet.toggleAttribute("data-away", shown === -200); }
        if (nowTall !== tall) { tall = nowTall; sheet.style.setProperty("--paper-h", tall); }
        return;
      }
      const nowAcross = top <= 0 || crossed <= 0 ? "0" : still.matches ? String(Number(crossed >= .5)) : crossed.toFixed(4);
      const nowFoot = `${Math.max(0, Math.min(height, top + sheets[to].under)).toFixed(1)}px`;
      // Each value is written on the sheet alone, and only when it has changed.
      if (nowAcross !== across) { across = nowAcross; sheet.style.setProperty("--across", across); sheet.toggleAttribute("data-away", across === "0"); }
      if (across !== "0" && nowFoot !== foot) { foot = nowFoot; sheet.style.setProperty("--foot", foot); }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    still.addEventListener("change", request);
    update();
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", request); removeEventListener("resize", request); still.removeEventListener("change", request); };
  }, [to]);
  return <div ref={paper} className={to === "close" ? "chapter-sheet-close" : `chapter-sheet chapter-sheet-${to}`} data-away="" aria-hidden="true" />;
}

/**
 * A chapter's page is turned from its lower right corner, and the next chapter is found lying beneath it.
 * The page holds still for one page of scroll while a gently curved crease sweeps along its diagonal to the far corner. What has been lifted is seen from behind, folded back over the crease.
 * Only five places are moved, none redrawn: the crease's round (which trims the page), the page within it, the turned-back underside (with the close shade its free edges throw on the page it lies over), the roll of light along its crease, and the shade on the paper beneath.
 */
export function PageTurn({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const turn = root.current, from = turn?.closest<HTMLElement>(".relief-panel"), to = from?.nextElementSibling;
    const part = (name: string) => turn?.querySelector<HTMLElement>(`.relief-turn-${name}`);
    const round = part("round"), page = part("page"), back = part("back"), roll = part("roll"), shade = part("shade"), hold = turn?.querySelector<HTMLElement>(".relief-hold");
    if (!turn || !from || !(to instanceof HTMLElement) || !round || !page || !back || !roll || !shade || !hold) return;
    const beneath = to.querySelector<HTMLElement>(".relief-hold");
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    // The page: w by h (the whole window), `tall` of it the chapter's own. The crease travels `far`, corner to corner, along (nx, ny); its round has radius r.
    let frame = 0, on = false, w = 0, h = 0, tall = 0, far = 1, nx = 0, ny = 0, r = 0, last = -1, near = false, x0 = 0, y0 = 0;
    const measure = () => {
      // A page taller than the window cannot be held whole, and with less motion nothing is turned: the chapters then follow one another as plain pages.
      const fits = !still.matches && hold.offsetHeight <= innerHeight + 1;
      if (!fits) {
        if (on) { on = false; last = -1; for (const panel of [from, to]) { panel.removeAttribute("data-turn"); panel.style.removeProperty("--turn-page"); panel.style.removeProperty("--turn-own"); } to.style.removeProperty("--e"); to.style.removeProperty("--h"); }
        return;
      }
      on = true;
      from.dataset.turn = "from"; to.dataset.turn = "to";
      tall = hold.getBoundingClientRect().height; w = turn.clientWidth; h = Math.max(page.offsetHeight, tall);
      far = Math.hypot(w, h); nx = -w / far; ny = -h / far; r = Math.round(far * 4);
      // The round is set on whole pixels, so the still page inside it lies exactly on the window.
      x0 = Math.round(w + nx * r); y0 = Math.round(h + ny * r);
      for (const panel of [from, to]) panel.style.setProperty("--turn-page", `${tall}px`);
      to.style.setProperty("--turn-own", `${beneath?.getBoundingClientRect().height ?? tall}px`);
      // The chapter beneath is found as it will stay: its picture at rest and its figures standing.
      to.style.setProperty("--e", "1"); to.style.setProperty("--h", "1");
      // The round's centre when the crease stands on the corner, and the turn of the two bands that follow the crease.
      turn.style.setProperty("--turn-r", `${r}px`);
      turn.style.setProperty("--turn-x", `${x0}px`);
      turn.style.setProperty("--turn-y", `${y0}px`);
      turn.style.setProperty("--turn-w", `${w}px`);
      turn.style.setProperty("--turn-long", `${(2 * w * h / far + 240).toFixed(0)}px`);
      last = -1;
      update();
    };
    // Where the round crosses the page's edges: the two ends of the crease.
    const ends = (ox: number, oy: number) => {
      const found: number[][] = [];
      for (const [ax, ay, bx, by] of [[0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]]) {
        const dx = bx - ax, dy = by - ay, fx = ax - ox, fy = ay - oy;
        const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), root = b * b - 4 * a * (fx * fx + fy * fy - r * r);
        if (root < 0) continue;
        for (const s of [(-b - Math.sqrt(root)) / (2 * a), (-b + Math.sqrt(root)) / (2 * a)]) if (s >= 0 && s < 1) found.push([ax + dx * s, ay + dy * s]);
      }
      return found;
    };
    const update = () => {
      frame = 0;
      if (!on) return;
      const bottom = from.getBoundingClientRect().bottom;
      const close = bottom < tall * 2.5 && bottom > -tall;
      if (close !== near) { near = close; turn.toggleAttribute("data-near", near); }
      const turned = clamp(1 - bottom / tall);
      if (turned === last) return;
      last = turned;
      const gone = far * turned, ox = x0 + nx * gone, oy = y0 + ny * gone, crease = turned > 0 && turned < 1 ? ends(ox, oy) : [];
      turn.dataset.turned = turned <= 0 ? "no" : turned >= 1 || crease.length !== 2 ? "yes" : "part";
      if (crease.length !== 2) { round.style.transform = page.style.transform = ""; return; }
      round.style.transform = `translate3d(${(nx * gone).toFixed(2)}px,${(ny * gone).toFixed(2)}px,0)`;
      page.style.transform = `translate3d(${(-nx * gone).toFixed(2)}px,${(-ny * gone).toFixed(2)}px,0)`;
      // The underside is the page mirrored in the straight line between the crease's two ends.
      const [[px, py], [qx, qy]] = crease, twice = 2 * Math.atan2(qy - py, qx - px), c = Math.cos(twice), s = Math.sin(twice);
      const ex = px - (c * px + s * py), ey = py - (s * px - c * py);
      back.style.transform = `matrix(${c.toFixed(5)},${s.toFixed(5)},${s.toFixed(5)},${(-c).toFixed(5)},${ex.toFixed(2)},${ey.toFixed(2)})`;
      // The roll of light keeps to the crease. It lies on the mirrored underside, so it is mirrored back to where the crease is.
      const kx = ox - nx * r, ky = oy - ny * r, mx = c * kx + s * ky + ex, my = s * kx - c * ky + ey;
      // The band's own axes: along the crease, and in towards the round's centre.
      const ux = -ny, uy = nx;
      shade.style.transform = `matrix(${ux.toFixed(5)},${uy.toFixed(5)},${nx.toFixed(5)},${ny.toFixed(5)},${kx.toFixed(2)},${ky.toFixed(2)})`;
      const a = c * ux + s * uy, b = s * ux - c * uy, d = c * nx + s * ny, e = s * nx - c * ny;
      roll.style.transform = `matrix(${a.toFixed(5)},${b.toFixed(5)},${d.toFixed(5)},${e.toFixed(5)},${mx.toFixed(2)},${my.toFixed(2)})`;
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    const sizes = new ResizeObserver(measure);
    sizes.observe(hold); sizes.observe(page); if (beneath) sizes.observe(beneath);
    addEventListener("scroll", request, { passive: true });
    still.addEventListener("change", measure);
    measure();
    return () => { cancelAnimationFrame(frame); sizes.disconnect(); removeEventListener("scroll", request); still.removeEventListener("change", measure); };
  }, []);
  return <div ref={root} className="relief-turn" data-turned="no">
    <div className="relief-turn-shade" aria-hidden="true" />
    <div className="relief-turn-round">
      <div className="relief-turn-page">
        {children}
        <div className="relief-turn-back" aria-hidden="true"><div className="relief-turn-under"><div className="relief-turn-roll" /></div></div>
      </div>
    </div>
  </div>;
}
