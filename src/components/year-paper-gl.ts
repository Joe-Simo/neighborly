import { cameraZ, DONE, EDGE, LIGHT, PAPER, placeSlips, SLIP, SLIPS, viewProjection } from "@/lib/year-paper";

/**
 * The year's slips on one canvas, in one instanced draw: every slip the same quad, placed by its own matrix (year-paper.ts).
 * No word is ever drawn here; the month and the year's total are the page's own text beside the canvas (year-paper.tsx).
 * Loaded only once the band is near, and drawn only when the reader's place in it changes.
 */
const vertex = `#version 300 es
in vec2 corner;
in mat4 model;
uniform mat4 view;
uniform vec3 light;
out vec2 uv;
out float lit;
void main() {
  uv = corner;
  vec3 facing = normalize(mat3(model) * vec3(0.0, 0.0, 1.0));
  lit = 0.8 + 0.2 * abs(dot(facing, light));
  gl_Position = view * model * vec4((corner.x - 0.5) * ${SLIP.w.toFixed(3)}, corner.y * ${SLIP.h.toFixed(3)}, 0.0, 1.0);
}`;
// The slip's face: its paper lit by its facing, a hairline edge of the pile's ink-warm colour, three ruled lines where a request is written
// (never letters), and the done corner, the page's one done language, at its upper right.
const fragment = `#version 300 es
precision mediump float;
in vec2 uv;
in float lit;
uniform vec3 paper;
uniform vec3 edge;
uniform vec3 done;
uniform vec2 hair;
out vec4 colour;
void main() {
  vec3 c = paper;
  float ruled = step(0.12, uv.x) * step(uv.x, 0.78) * (step(abs(uv.y - 0.62), hair.y) + step(abs(uv.y - 0.44), hair.y) + step(abs(uv.y - 0.26), hair.y) * step(uv.x, 0.56));
  c = mix(c, edge, 0.55 * min(ruled, 1.0));
  if ((1.0 - uv.x) * ${SLIP.w.toFixed(3)} + (1.0 - uv.y) * ${SLIP.h.toFixed(3)} < 0.085) c = done;
  if (uv.x < hair.x || uv.x > 1.0 - hair.x || uv.y < hair.y || uv.y > 1.0 - hair.y) c = edge;
  colour = vec4(c * lit, 1.0);
}`;

export type YearPaperCanvas = { draw: (through: number) => void; size: (width: number, height: number) => void; dispose: () => void };

export function yearPaperCanvas(canvas: HTMLCanvasElement): YearPaperCanvas | null {
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return null;
  const compile = (type: number, source: string) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); return shader; };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
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

  const view = gl.getUniformLocation(program, "view"), hair = gl.getUniformLocation(program, "hair");
  gl.uniform3fv(gl.getUniformLocation(program, "light"), new Float32Array(LIGHT).map((v, _, all) => v / Math.hypot(...all)));
  gl.uniform3fv(gl.getUniformLocation(program, "paper"), PAPER);
  gl.uniform3fv(gl.getUniformLocation(program, "edge"), EDGE);
  gl.uniform3fv(gl.getUniformLocation(program, "done"), DONE);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0xee / 255, 0xe7 / 255, 0xd7 / 255, 1);

  let aspect = 1;
  return {
    size(width, height) {
      const ratio = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      aspect = width / height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(hair, .006, .006 * SLIP.w / SLIP.h);
    },
    draw(through) {
      placeSlips(through, matrices);
      gl.bindBuffer(gl.ARRAY_BUFFER, models);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrices);
      gl.uniformMatrix4fv(view, false, viewProjection(aspect, cameraZ(through)));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, SLIPS);
    },
    dispose() { gl.getExtension("WEBGL_lose_context")?.loseContext(); },
  };
}
