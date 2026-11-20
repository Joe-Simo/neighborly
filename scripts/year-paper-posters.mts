/**
 * Draws the year in paper's posters from the same numbers the canvas draws (src/lib/year-paper.ts): its first frame for each of the stage's two
 * shapes, and its last, which Reduce Motion shows. Run after any change to year-paper.ts: bun scripts/year-paper-posters.mts
 */
import { writeFileSync } from "node:fs";
import { ASPECT, deckle, DECKLE, DONE, EDGE, HAIRLINE, INK, isKraft, KRAFT, KRAFT_EDGE, lineEnd, PAPER, SHADE, SHADOW, INSTANCES, kinds, slips, WAITING, placeSlips, shade, SLIP, SLIPS, viewProjection, type Shape } from "../src/lib/year-paper";

const size: Record<Shape, [number, number]> = { wide: [1600, 1000], tall: [600, 800] };
const hex = (c: readonly number[], lit: number) => "#" + c.map(v => Math.round(Math.min(1, v * lit) * 255).toString(16).padStart(2, "0")).join("");
const HAIR = .006, HAIR_Y = HAIR * SLIP.w / SLIP.h;

for (const shape of ["wide", "tall"] as const) for (const [name, through] of [["start", 0], ["end", 1]] as const) {
  const [W, H] = size[shape], view = viewProjection(ASPECT[shape], through), models = placeSlips(through);
  const faces: { depth: number; svg: string }[] = [];
  for (let s = 0; s < INSTANCES; s++) {
    const at = s * 16;
    const project = (u: number, v: number, behind = 0) => {
      const x = (u - .5) * SLIP.w + behind * SHADE.x, y = v * SLIP.h + behind * SHADE.y, z = behind * SHADE.z, p = [0, 0, 0, 0];
      const m = models.subarray(at, at + 16);
      const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
      for (let r = 0; r < 4; r++) p[r] = view[r] * wx + view[4 + r] * wy + view[8 + r] * wz + view[12 + r];
      return p;
    };
    const corners = [project(0, 0), project(1, 0), project(1, 1), project(0, 1)];
    if (corners.some(p => p[3] < .15)) continue;
    const screen = (p: number[]) => [(p[0] / p[3] + 1) / 2 * W, (1 - p[1] / p[3]) / 2 * H];
    const flat = corners.map(screen);
    if (flat.every(([x]) => x < 0) || flat.every(([x]) => x > W) || flat.every(([, y]) => y < 0) || flat.every(([, y]) => y > H)) continue;
    const lit = shade(models, at);
    // In the end's pile only the top few slips show a face; under them each shows no more than its edge, drawn as a plain sheet with no shade.
    const buried = through === 1 && s < SLIPS - 8;
    const poly = (points: [number, number][], colour: string, layer = 0, opacity = "") => `<path d="M${points.map(([u, v]) => screen(project(u, v, layer)).map(n => n.toFixed(0)).join(" ")).join("L")}Z" fill="${colour}"${opacity && ` fill-opacity="${opacity}"`}/>`;
    const quad = (u0: number, v0: number, u1: number, v1: number, colour: string) => poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], colour);
    const wide = Math.hypot(flat[1][0] - flat[0][0], flat[1][1] - flat[0][1]);
    // The book's pages and board, as the shader draws them: cut straight, a page ruled in faint ink with its one margin line, the board kraft.
    if (s >= SLIPS) {
      const g = SHADE.grow, page = kinds[s] < 2.5, face = page ? PAPER : KRAFT, rule = hex(face.map((p, i) => p + (INK[i] - p) * .16), lit);
      let svg = [1, 2 / 3, 1 / 3].map(f => poly([[-g * f, -g * f], [1 + g * f, -g * f], [1 + g * f, 1 + g * f], [-g * f, 1 + g * f]], hex(SHADOW, 1), 1, (SHADE.ink / 3).toFixed(3))).join("");
      svg += quad(0, 0, 1, 1, hex(face.map((p, i) => p + ((page ? EDGE : KRAFT_EDGE)[i] - p) * HAIRLINE), lit)) + quad(.004, .004, .996, .996, hex(face, lit));
      if (page) {
        for (let r = 0; r < 26; r++) { const v = (r + .5) / 26 + .5 / 26; if (v > .07 && v < .95) svg += quad(.004, v - .06 / 26, .996, v + .06 / 26, rule); }
        svg += quad(.097, .004, .103, .996, hex(face.map((p, i) => p + (INK[i] - p) * .3), lit));
      }
      faces.push({ depth: corners.reduce((sum, p) => sum + p[2] / p[3], 0), svg });
      continue;
    }
    // The slip's material and its torn outline, as the shader draws them: kraft or paper, each edge torn in from the same knots (year-paper.ts).
    const face = isKraft(s) ? KRAFT : PAPER, rim = isKraft(s) ? KRAFT_EDGE : EDGE;
    const torn = (inset: number): [number, number][] => {
      if (wide < 140 || buried) return [[inset / SLIP.w, inset / SLIP.h], [1 - inset / SLIP.w, inset / SLIP.h], [1 - inset / SLIP.w, 1 - inset / SLIP.h], [inset / SLIP.w, 1 - inset / SLIP.h]];
      const n = Math.max(3, Math.min(DECKLE.knots, Math.round(wide / 100))), out: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const t = i / n; out.push([t, (deckle(s, 2, t) + inset) / SLIP.h]); }
      for (let i = 0; i <= n; i++) { const t = i / n; out.push([1 - (deckle(s, 1, t) + inset) / SLIP.w, t]); }
      for (let i = n; i >= 0; i--) { const t = i / n; out.push([t, 1 - (deckle(s, 3, t) + inset) / SLIP.h]); }
      for (let i = n; i >= 0; i--) { const t = i / n; out.push([(deckle(s, 0, t) + inset) / SLIP.w, t]); }
      // The tear's corners are where two edges cross: a point outside the other edge's tear is drawn on it.
      return out.map(([u, v]) => [Math.min(Math.max(u, deckle(s, 0, v) / SLIP.w + inset / SLIP.w), 1 - (deckle(s, 1, v) + inset) / SLIP.w), Math.min(Math.max(v, (deckle(s, 2, u) + inset) / SLIP.h), 1 - (deckle(s, 3, u) + inset) / SLIP.h)]);
    };
    // The contact shade, as the shader draws it: the slip's own torn outline, grown and softened in a few steps past its tear.
    const g = SHADE.grow * SLIP.h, shadow = hex(SHADOW, 1), steps = buried ? [] : wide > 24 ? [1, 2 / 3, 1 / 3] : [1 / 2];
    let svg = steps.map(f => poly(torn(-g * f), shadow, 1, (SHADE.ink / steps.length).toFixed(3))).join("");
    svg += poly(torn(0), hex(face.map((p, i) => p + (rim[i] - p) * HAIRLINE), lit)) + poly(torn(HAIR * SLIP.w), hex(face, lit));
    if (wide > 14 && !buried) svg += quad(.12, .5 - HAIR_Y * 1.4, lineEnd(s), .5 + HAIR_Y * 1.4, hex(face.map((p, i) => p + (INK[i] - p) * .7), lit));
    // The done corner: the triangle the shader paints, inside the slip's hairline.
    const k = .085 + DECKLE.depth;
    if (!buried) svg += poly([[1 - HAIR, 1 - HAIR_Y], [1 - k / SLIP.w, 1 - HAIR_Y], [1 - HAIR, 1 - k / SLIP.h]], hex(slips[s].waiting ? WAITING : DONE, lit));
    faces.push({ depth: corners.reduce((sum, p) => sum + p[2] / p[3], 0), svg });
  }
  faces.sort((a, b) => b.depth - a.depth);
  writeFileSync(`public/assets/home/year-paper-${shape}-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#eee7d7"/>${faces.map(f => f.svg).join("")}</svg>\n`);
}
