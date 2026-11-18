/**
 * A page turned from its lower right corner: a gently curved crease sweeps along the page's diagonal to the far corner,
 * and what has been lifted is seen from behind, folded back over the crease. Shared by the turn between chapters (chapter-sheets.tsx)
 * and the courtyard's door into the workspace (courtyard-door.tsx). Only transforms are set: nothing is redrawn.
 */
export type TurnParts = { round: HTMLElement; page: HTMLElement; back: HTMLElement; roll: HTMLElement; shade: HTMLElement };

/** The page: w by h. The crease travels `far`, corner to corner, along (nx, ny); its round has radius r and stands at (x0, y0) on the corner. */
export function turnGeometry(w: number, h: number) {
  const far = Math.hypot(w, h), nx = -w / far, ny = -h / far, r = Math.round(far * 4);
  // The round is set on whole pixels, so the still page inside it lies exactly on the window.
  return { w, h, far, nx, ny, r, x0: Math.round(w + nx * r), y0: Math.round(h + ny * r), long: Math.round(2 * w * h / far + 240) };
}
export type TurnGeometry = ReturnType<typeof turnGeometry>;

/** The values the turn's CSS reads (chapter-sheets.css), set on the element that holds the parts. */
export function setTurnGeometry(on: HTMLElement, { r, x0, y0, w, long }: TurnGeometry) {
  on.style.setProperty("--turn-r", `${r}px`);
  on.style.setProperty("--turn-x", `${x0}px`);
  on.style.setProperty("--turn-y", `${y0}px`);
  on.style.setProperty("--turn-w", `${w}px`);
  on.style.setProperty("--turn-long", `${long}px`);
}

/** Where the round crosses the page's edges: the two ends of the crease. */
function ends({ w, h, r }: TurnGeometry, ox: number, oy: number) {
  const found: number[][] = [];
  for (const [ax, ay, bx, by] of [[0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]]) {
    const dx = bx - ax, dy = by - ay, fx = ax - ox, fy = ay - oy;
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), root = b * b - 4 * a * (fx * fx + fy * fy - r * r);
    if (root < 0) continue;
    for (const s of [(-b - Math.sqrt(root)) / (2 * a), (-b + Math.sqrt(root)) / (2 * a)]) if (s >= 0 && s < 1) found.push([ax + dx * s, ay + dy * s]);
  }
  return found;
}

/** Lays the parts for a page turned this far (0 to 1); answers "no", "part" or "yes", how much of the page is lifted. */
export function placeTurn(geometry: TurnGeometry, { round, page, back, roll, shade }: TurnParts, turned: number): "no" | "part" | "yes" {
  const { far, nx, ny, r, x0, y0 } = geometry;
  const gone = far * turned, ox = x0 + nx * gone, oy = y0 + ny * gone, crease = turned > 0 && turned < 1 ? ends(geometry, ox, oy) : [];
  const state = turned <= 0 ? "no" : turned >= 1 || crease.length !== 2 ? "yes" : "part";
  if (crease.length !== 2) { round.style.transform = page.style.transform = ""; return state; }
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
  return state;
}
