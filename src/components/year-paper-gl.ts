import { whenIdle } from "@/lib/idle";
import { DONE, EDGE, HAIRLINE, LIGHT, PAPER, placeSlips, SHADE, SHADOW, SLIP, slips, SLIPS, viewProjection, WAITING } from "@/lib/year-paper";

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
out vec2 uv;
out float lit;
out float waiting;
void main() {
  // The shade pass draws each slip again, grown past its edge and set just behind it, down and away from the light.
  vec2 at = mix(corner, corner * (1.0 + 2.0 * ${SHADE.grow.toFixed(3)}) - ${SHADE.grow.toFixed(3)}, shade);
  uv = at;
  waiting = waits;
  vec3 facing = normalize(mat3(model) * vec3(0.0, 0.0, 1.0));
  lit = 0.8 + 0.2 * abs(dot(facing, light));
  vec3 local = vec3((at.x - 0.5) * ${SLIP.w.toFixed(3)}, at.y * ${SLIP.h.toFixed(3)}, 0.0) + shade * vec3(${SHADE.x.toFixed(3)}, ${SHADE.y.toFixed(3)}, ${SHADE.z.toFixed(3)});
  gl_Position = view * model * vec4(local, 1.0);
}`;
// The slip's face: its paper lit by its facing, a hairline edge of the pile's ink-warm colour, three ruled lines where a request is written
// (never letters), and the done corner, the page's one done language, at its upper right.
const fragment = `#version 300 es
precision highp float;
in vec2 uv;
in float lit;
in float waiting;
uniform float shade;
uniform vec3 shadow;
uniform vec3 wait;
uniform vec3 paper;
uniform vec3 edge;
uniform vec3 done;
uniform vec2 hair;
out vec4 colour;
void main() {
  if (shade > 0.5) {
    // Soft at its edge: full only inside the slip's own outline, fading to nothing at the grown edge.
    vec2 inside = min(uv, 1.0 - uv);
    float soft = smoothstep(-${SHADE.grow.toFixed(3)}, 0.0, min(inside.x, inside.y));
    colour = vec4(shadow, ${SHADE.ink.toFixed(3)} * soft);
    return;
  }
  vec3 c = paper;
  float ruled = step(0.12, uv.x) * step(uv.x, 0.78) * (step(abs(uv.y - 0.62), hair.y) + step(abs(uv.y - 0.44), hair.y) + step(abs(uv.y - 0.26), hair.y) * step(uv.x, 0.56));
  c = mix(c, edge, 0.55 * min(ruled, 1.0));
  if ((1.0 - uv.x) * ${SLIP.w.toFixed(3)} + (1.0 - uv.y) * ${SLIP.h.toFixed(3)} < 0.085) c = waiting > 0.5 ? wait : done;
  if (uv.x < hair.x || uv.x > 1.0 - hair.x || uv.y < hair.y || uv.y > 1.0 - hair.y) c = mix(paper, edge, ${HAIRLINE.toFixed(2)});
  colour = vec4(c * lit, 1.0);
}`;

export type YearPaperCanvas = { draw: (through: number) => void; size: (width: number, height: number) => void; dispose: () => void };

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

  const matrices = new Float32Array(SLIPS * 16);
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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(slips.map(slip => Number(slip.waiting))), gl.STATIC_DRAW);
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
  const shade = gl.getUniformLocation(program, "shade");
  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0xee / 255, 0xe7 / 255, 0xd7 / 255, 1);

  let aspect = 1;
  return {
    size(width, height) {
      const ratio = Math.min(2, devicePixelRatio || 1), w = Math.round(width * ratio), h = Math.round(height * ratio);
      // Setting a canvas's size clears it: an unchanged size is left alone, so the frame already drawn stays.
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w; canvas.height = h;
      aspect = width / height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(hair, .006, .006 * SLIP.w / SLIP.h);
    },
    draw(through) {
      placeSlips(through, matrices);
      gl.bindBuffer(gl.ARRAY_BUFFER, models);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrices);
      gl.uniformMatrix4fv(view, false, viewProjection(aspect, through));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // The slips first, then their shades, tested against the slips' depth but never written: a shade lies only on the sheets behind its slip.
      gl.uniform1f(shade, 0); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, SLIPS);
      gl.uniform1f(shade, 1); gl.depthMask(false); gl.enable(gl.BLEND);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, SLIPS);
    },
    dispose() { gl.getExtension("WEBGL_lose_context")?.loseContext(); },
  };
}
