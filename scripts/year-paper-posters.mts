/**
 * Draws the year in paper's posters from the same numbers the canvas draws (src/lib/year-paper.ts): its first frame for each of the stage's two
 * shapes, and its last, which Reduce Motion shows. Run after any change to year-paper.ts: bun scripts/year-paper-posters.mts
 */
import { writeFileSync } from "node:fs";
import { ASPECT, DONE, EDGE, HAIRLINE, PAPER, SHADE, SHADOW, slips, WAITING, placeSlips, shade, SLIP, SLIPS, viewProjection, cameraZ, type Shape } from "../src/lib/year-paper";

const size: Record<Shape, [number, number]> = { wide: [1600, 1000], tall: [600, 800] };
const hex = (c: readonly number[], lit: number) => "#" + c.map(v => Math.round(Math.min(1, v * lit) * 255).toString(16).padStart(2, "0")).join("");
const mixed = PAPER.map((p, i) => p + (EDGE[i] - p) * .55);
const HAIR = .006, HAIR_Y = HAIR * SLIP.w / SLIP.h;

for (const shape of ["wide", "tall"] as const) for (const [name, through] of [["start", 0], ["end", 1]] as const) {
  const [W, H] = size[shape], view = viewProjection(ASPECT[shape], cameraZ(through)), models = placeSlips(through);
  const faces: { depth: number; svg: string }[] = [];
  for (let s = 0; s < SLIPS; s++) {
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
    const poly = (points: [number, number][], colour: string) => `<path d="M${points.map(([u, v]) => screen(project(u, v)).map(n => n.toFixed(1)).join(" ")).join("L")}Z" fill="${colour}"/>`;
    const quad = (u0: number, v0: number, u1: number, v1: number, colour: string) => poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], colour);
    const wide = Math.hypot(flat[1][0] - flat[0][0], flat[1][1] - flat[0][1]);
    // The contact shade, soft at its edge as the shader draws it: three steps from the grown edge to the slip's outline.
    const g = SHADE.grow, shadow = hex(SHADOW, 1);
    let svg = [1, 2 / 3, 1 / 3].map(f => `<path d="M${([[-g * f, -g * f], [1 + g * f, -g * f], [1 + g * f, 1 + g * f], [-g * f, 1 + g * f]] as const).map(([u, v]) => screen(project(u, v, 1)).map(n => n.toFixed(1)).join(" ")).join("L")}Z" fill="${shadow}" fill-opacity="${(SHADE.ink / 3).toFixed(3)}"/>`).join("");
    svg += quad(0, 0, 1, 1, hex(PAPER.map((p, i) => p + (EDGE[i] - p) * HAIRLINE), lit)) + quad(HAIR, HAIR_Y, 1 - HAIR, 1 - HAIR_Y, hex(PAPER, lit));
    if (wide > 14) svg += quad(.12, .62 - HAIR_Y, .78, .62 + HAIR_Y, hex(mixed, lit)) + quad(.12, .44 - HAIR_Y, .78, .44 + HAIR_Y, hex(mixed, lit)) + quad(.12, .26 - HAIR_Y, .56, .26 + HAIR_Y, hex(mixed, lit));
    // The done corner: the triangle the shader paints, inside the slip's hairline.
    const k = .085;
    svg += poly([[1 - HAIR, 1 - HAIR_Y], [1 - k / SLIP.w, 1 - HAIR_Y], [1 - HAIR, 1 - k / SLIP.h]], hex(slips[s].waiting ? WAITING : DONE, lit));
    faces.push({ depth: corners.reduce((sum, p) => sum + p[2] / p[3], 0), svg });
  }
  faces.sort((a, b) => b.depth - a.depth);
  writeFileSync(`public/assets/home/year-paper-${shape}-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#eee7d7"/>${faces.map(f => f.svg).join("")}</svg>\n`);
}
