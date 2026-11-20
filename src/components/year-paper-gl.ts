import { whenIdle } from "@/lib/idle";
import * as year from "@/lib/year-paper";
import { DECKLE, deckle, DONE, EDGE, HAIRLINE, INK, INSTANCES, kinds, KRAFT, KRAFT_EDGE, LIGHT, PAPER, lineEnd, placeSlips, SHADE, SHADOW, SLIP, viewProjection, WAITING } from "@/lib/year-paper";

/**
 * The year's slips on one canvas, in one instanced draw: every slip the same quad, placed by its own matrix (year-paper.ts).
 * No word is ever drawn here; the month and the year's total are the page's own text beside the canvas (year-paper.tsx).
 * Loaded only once the band is near, and drawn only when the reader's place in it changes.
 */
const vertex = `#version 300 es
in vec2 corner;
in mat4 model;
in float waits;
uniform mat4 view;
uniform vec3 light;
uniform float shade;
uniform float landed;
out vec2 uv;
out float lit;
out float waiting;
flat out uint slip;
void main() {
  slip = uint(gl_InstanceID);
  // The shade pass draws each slip again, grown past its edge and set just behind it, down and away from the light.
  vec2 at = mix(corner, corner * (1.0 + 2.0 * ${SHADE.grow.toFixed(3)}) - ${SHADE.grow.toFixed(3)}, shade);
  uv = at;
  waiting = waits;
  vec3 facing = normalize(mat3(model) * vec3(0.0, 0.0, 1.0));
  lit = 0.8 + 0.2 * abs(dot(facing, light));
  vec3 local = vec3((at.x - 0.5) * ${SLIP.w.toFixed(3)}, at.y * ${SLIP.h.toFixed(3)}, 0.0) + shade * vec3(${SHADE.x.toFixed(3)}, ${SHADE.y.toFixed(3)}, ${SHADE.z.toFixed(3)});
  gl_Position = view * model * vec4(local, 1.0);
  // In the pile, only the bottom slip throws a shade on the page: the rest lie on one another, and their shades would only darken its sides.
  if (shade > 0.5 && gl_InstanceID > 0 && float(gl_InstanceID) < landed) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const v3 = (c: readonly number[]) => `vec3(${c.map(v => v.toFixed(4)).join(", ")})`;
// The slip's face: kraft or paper, lit by its facing, its four edges deckled (torn in from knots, the same numbers the poster draws), a hairline
// of its own darker tone along the tear, one line of ink where a request is written (never letters), and the done corner at its upper right.
const fragment = `#version 300 es
precision highp float;
in vec2 uv;
in float lit;
in float waiting;
flat in uint slip;
uniform float shade;
uniform vec3 shadow;
uniform vec3 wait;
uniform vec3 paper;
uniform vec3 edge;
uniform vec3 done;
uniform vec2 hair;
out vec4 colour;
// year-paper.ts's hash, in the same 32-bit steps.
float hash(uint a, uint b) {
  uint h = (a + 1u) * 0x9e3779b1u ^ (b + 1u) * 0x85ebca6bu;
  h = (h ^ (h >> 15u)) * 0x2c1b3c6du;
  return float(h ^ (h >> 13u)) / 4294967296.0;
}
float torn(uint side, float along) {
  float k = clamp(along, 0.0, 0.99999) * ${DECKLE.knots}.0, i = floor(k);
  uint at = slip * 4u + side + 5000u;
  return ${DECKLE.depth.toFixed(4)} * (0.3 + 0.7 * mix(hash(at, uint(i)), hash(at, uint(i) + 1u), k - i));
}
void main() {
  // How far in from each edge, in the world's units, less that edge's tear: below nothing, the paper is torn away.
  float w = ${SLIP.w.toFixed(3)}, h = ${SLIP.h.toFixed(3)};
  float inside = min(min(uv.x * w - torn(0u, uv.y), (1.0 - uv.x) * w - torn(1u, uv.y)), min(uv.y * h - torn(2u, uv.x), (1.0 - uv.y) * h - torn(3u, uv.x)));
  // The book's pages and board: bound, so cut straight; a page is ruled in faint ink with one margin line, the board is kraft.
  if (waiting > 1.5) {
    if (shade > 0.5) { vec2 inside = min(uv, 1.0 - uv); colour = vec4(shadow, ${SHADE.ink.toFixed(3)} * smoothstep(-${SHADE.grow.toFixed(3)}, 0.0, min(inside.x, inside.y))); return; }
    vec3 c = waiting > 2.5 ? ${v3(KRAFT)} : paper;
    if (waiting < 2.5) {
      float rule = step(0.44, abs(fract(uv.y * 26.0) - 0.5));
      c = mix(c, ${v3(INK)}, 0.16 * rule * step(0.07, uv.y) * step(uv.y, 0.95));
      c = mix(c, ${v3(INK)}, 0.3 * (1.0 - step(0.003, abs(uv.x - 0.1))));
    }
    if (min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)) < 0.004) c = mix(c, waiting > 2.5 ? ${v3(KRAFT_EDGE)} : edge, ${HAIRLINE.toFixed(2)});
    colour = vec4(c * lit, 1.0);
    return;
  }
  if (shade > 0.5) {
    // The slip's own torn outline, blurred: full inside it, fading to nothing a little past its tear.
    colour = vec4(shadow, ${SHADE.ink.toFixed(3)} * smoothstep(-${(SHADE.grow * SLIP.h).toFixed(4)}, 0.0, inside));
    return;
  }
  if (inside < 0.0) discard;
  bool kraft = hash(slip + 2000u, 7u) < 0.28;
  vec3 face = kraft ? ${v3(KRAFT)} : paper, rim = kraft ? ${v3(KRAFT_EDGE)} : edge;
  vec3 c = face;
  float ink = step(0.12, uv.x) * step(uv.x, 0.46 + 0.3 * hash(slip + 3000u, 3u)) * step(abs(uv.y - 0.5), hair.y * 1.4);
  c = mix(c, ${v3(INK)}, 0.7 * ink);
  if ((1.0 - uv.x) * w + (1.0 - uv.y) * h < 0.085 + ${DECKLE.depth.toFixed(4)}) c = waiting > 0.5 ? wait : done;
  if (inside < hair.x * w) c = mix(face, rim, ${HAIRLINE.toFixed(2)});
  colour = vec4(c * lit, 1.0);
}`;

/** The canvas's size in CSS pixels, and the window's box inside it: the picture is framed by the window and runs on to the canvas's edges. */
export type Frame = { width: number; height: number; window: { x: number; y: number; w: number; h: number } };
/** Where a slip lies on the stage, in CSS pixels: its middle, its width and height along its own edges, and its turn in degrees. */
/** `quad`: its corners as the canvas draws them, top left, top right, bottom right, bottom left. */
export type SlipOnStage = { x: number; y: number; w: number; h: number; r: number; line: number; quad: number[][]; outline: string; within: string };
/** `draw`'s `held`: October's first slip is left out, while the travelling card is still on its way to lie there (thread-card.tsx). */
export type YearPaperCanvas = { draw: (through: number, held?: boolean) => void; size: (frame: Frame) => void; slip: (through: number) => SlipOnStage; dispose: () => void };

const idle = () => new Promise<void>(done => { whenIdle(done, 500); });

/**
 * Made in idle time, never on a frame of the scroll: the shaders are handed to the driver and left to compile on its own thread where it can
 * (KHR_parallel_shader_compile), asked after only between idle moments; the buffers are filled in another; the caller draws its first frame
 * and shows the canvas only once all of it is ready, and the poster stands until then.
 */
export async function yearPaperCanvas(canvas: HTMLCanvasElement, gone: () => boolean): Promise<YearPaperCanvas | null> {
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return null;
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const compile = (type: number, source: string) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (parallel) while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) { await idle(); if (gone()) return null; }
  else await idle();
  if (gone() || !gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  await idle();
  if (gone()) return null;
  gl.useProgram(program);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  const matrices = new Float32Array(INSTANCES * 16);
  const models = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, models);
  gl.bufferData(gl.ARRAY_BUFFER, matrices.byteLength, gl.DYNAMIC_DRAW);
  const model = gl.getAttribLocation(program, "model");
  for (let column = 0; column < 4; column++) {
    gl.enableVertexAttribArray(model + column);
    gl.vertexAttribPointer(model + column, 4, gl.FLOAT, false, 64, column * 16);
    gl.vertexAttribDivisor(model + column, 1);
  }

  const waits = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waits);
  gl.bufferData(gl.ARRAY_BUFFER, kinds, gl.STATIC_DRAW);
  const waitsAt = gl.getAttribLocation(program, "waits");
  gl.enableVertexAttribArray(waitsAt);
  gl.vertexAttribPointer(waitsAt, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(waitsAt, 1);

  const view = gl.getUniformLocation(program, "view"), hair = gl.getUniformLocation(program, "hair");
  gl.uniform3fv(gl.getUniformLocation(program, "light"), new Float32Array(LIGHT).map((v, _, all) => v / Math.hypot(...all)));
  gl.uniform3fv(gl.getUniformLocation(program, "paper"), PAPER);
  gl.uniform3fv(gl.getUniformLocation(program, "edge"), EDGE);
  gl.uniform3fv(gl.getUniformLocation(program, "done"), DONE);
  gl.uniform3fv(gl.getUniformLocation(program, "shadow"), SHADOW);
  gl.uniform3fv(gl.getUniformLocation(program, "wait"), WAITING);
  const shade = gl.getUniformLocation(program, "shade"), pile = gl.getUniformLocation(program, "landed");
  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0xee / 255, 0xe7 / 255, 0xd7 / 255, 1);

  let aspect = 1, place = { x: 0, y: 0, w: 1, h: 1 }, stageWidth = 1, stageHeight = 1;
  // October's first slip's torn outline, as the face shader tears it (torn, from deckle's knots), in the card's own percentages: top, right, bottom, left.
  // October's first slip's torn outline, as the face shader tears it (torn, from deckle's knots), in the card's own percentages: top, right,
  // bottom, left. Each edge stops where the next edge's tear begins, so the corners close without a spur. `rim` more in: the hairline's inner edge.
  const steps = Array.from({ length: DECKLE.knots + 1 }, (_, i) => i / DECKLE.knots), pc = (u: number, v: number) => `${(u * 100).toFixed(2)}% ${(v * 100).toFixed(2)}%`;
  const torn = (rim: number) => {
    const t = (edge: number, along: number) => (deckle(0, edge, along) + rim), lo = (a: number, b: number) => (v: number) => Math.min(b, Math.max(a, v));
    const top = lo(t(0, 1) / SLIP.w, 1 - t(1, 1) / SLIP.w), right = lo(t(3, 1) / SLIP.h, 1 - t(2, 1) / SLIP.h), bottom = lo(t(0, 0) / SLIP.w, 1 - t(1, 0) / SLIP.w), left = lo(t(3, 0) / SLIP.h, 1 - t(2, 0) / SLIP.h);
    return `polygon(${[
      ...steps.map(s => pc(top(s), t(3, s) / SLIP.h)),
      ...steps.map(s => pc(1 - t(1, 1 - s) / SLIP.w, right(s))),
      ...steps.map(s => pc(bottom(1 - s), 1 - t(2, 1 - s) / SLIP.h)),
      ...steps.map(s => pc(t(0, s) / SLIP.w, left(1 - s))),
    ].join(",")})`;
  };
  // The hairline is as wide as the shader draws it: `hair.x` of the slip's width (size, below).
  const outline = torn(0), within = torn(.006 * SLIP.w);
  const one = new Float32Array(INSTANCES * 16);
  return {
    size({ width, height, window: box }) {
      stageWidth = width; stageHeight = height;
      place = { x: box.x / width, y: box.y / height, w: box.w / width, h: box.h / height };
      aspect = box.w / box.h;
      const ratio = Math.min(2, devicePixelRatio || 1), w = Math.round(width * ratio), h = Math.round(height * ratio);
      // Setting a canvas's size clears it: an unchanged size is left alone, so the frame already drawn stays.
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(hair, .006, .006 * SLIP.w / SLIP.h);
    },
    draw(through, held = false) {
      placeSlips(through, matrices);
      if (held) matrices.fill(0, 0, 16);
      gl.bindBuffer(gl.ARRAY_BUFFER, models);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrices);
      gl.uniformMatrix4fv(view, false, viewProjection(aspect, through, place));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // The slips first, then their shades, tested against the slips' depth but never written: a shade lies only on the sheets behind its slip.
      gl.uniform1f(shade, 0); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, INSTANCES);
      gl.uniform1f(pile, year.landed); gl.uniform1f(shade, 1); gl.depthMask(false); gl.enable(gl.BLEND);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, INSTANCES);
    },
    slip(through) {
      // The first slip's four corners, through the same matrices the canvas draws with, onto the stage.
      placeSlips(through, one);
      const m = one.subarray(0, 16), v = viewProjection(aspect, through, place);
      const on = (x: number, y: number) => {
        const p = [0, 1, 2, 3].map(r => m[r] * x + m[4 + r] * y + m[12 + r]);
        const c = [0, 1, 2, 3].map(r => v[r] * p[0] + v[4 + r] * p[1] + v[8 + r] * p[2] + v[12 + r] * p[3]);
        return [(c[0] / c[3] + 1) / 2 * stageWidth, (1 - c[1] / c[3]) / 2 * stageHeight];
      };
      const [a, b, c, d] = [on(-SLIP.w / 2, 0), on(SLIP.w / 2, 0), on(-SLIP.w / 2, SLIP.h), on(SLIP.w / 2, SLIP.h)];
      const len = (p: number[], q: number[]) => Math.hypot(q[0] - p[0], q[1] - p[1]);
      const r = Math.atan2(b[1] - a[1] + d[1] - c[1], b[0] - a[0] + d[0] - c[0]) * 180 / Math.PI;
      return { x: (a[0] + b[0] + c[0] + d[0]) / 4, y: (a[1] + b[1] + c[1] + d[1]) / 4, w: (len(a, b) + len(c, d)) / 2, h: (len(a, c) + len(b, d)) / 2, r, line: lineEnd(0), quad: [c, d, b, a], outline, within };
    },
    dispose() { gl.getExtension("WEBGL_lose_context")?.loseContext(); },
  };
}
