import { sampleYear } from "@/lib/sample-year";
import { cameraZ, ease, FLIGHT, MONTHS, monthZ } from "@/lib/year-paper-flight";
export { FIRST_MONTH, MONTHS, monthAt } from "@/lib/year-paper-flight";

/**
 * "The year in paper": the sample conference's year as one slip for every request it was asked, fanned in depth a month at a time,
 * October to September. The flight is a pure function of how far through the band the reader is, so the poster (scripts/year-paper-posters.mts)
 * and the live canvas (year-paper-gl.ts) draw the same slips from the same numbers, and the canvas's first frame is the poster.
 * Synthetic: the sample conference's own requests, month by month, and which are still waiting, all as its Reports room adds them up.
 */
export const SLIPS = sampleYear.requests;
/** The two shapes the stage is cut to: wide from 768px, tall below it (year-paper.css). Width over height. */
export const ASPECT = { wide: 16 / 10, tall: 3 / 4 } as const;
export type Shape = keyof typeof ASPECT;

const DEPTH = .11, FOV = 38 * Math.PI / 180;
/** A slip: one by .62, in the world's units. */
export const SLIP = { w: 1, h: .62 } as const;

export const hash = (a: number, b: number) => {
  let h = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** The months' slips: as many as the sample's Reports room counts in each month. */
const perMonth = sampleYear.requestsByMonth;

type Slip = { month: number; place: number; of: number; turn: number; tilt: number; lift: number; waiting: boolean };
/** A month's waiting requests are its last ones in: the slips at the back of its fan. */
const waits = (month: number, place: number, of: number) => place >= of - sampleYear.waitingByMonth[month];
export const slips: readonly Slip[] = perMonth.flatMap((of, month) => Array.from({ length: of }, (_, place) => ({
  month, place, of,
  turn: (hash(month, place) - .5) * .09,
  tilt: (hash(place, month + 40) - .5) * .12,
  lift: (hash(month + 80, place) - .5) * .05,
  waiting: waits(month, place, of),
})));

/** Column-major 4x4, as GL takes it. */
type Mat = Float32Array;
const mul = (a: Mat, b: Mat, out: Mat = new Float32Array(16)) => {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
};
const translate = (x: number, y: number, z: number): Mat => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const scale = (x: number, y: number): Mat => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const rotX = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotY = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const rotZ = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };

const settle = (through: number) => ease((through - FLIGHT) / (1 - FLIGHT));

/** How far a month's leaf has turned away (0 lying in its fan, 1 turned up past the camera). */
const turned = (month: number, camera: number) => month === MONTHS - 1 ? 0 : ease((monthZ(month) + 2.6 - camera) / 2.2);

/** The view and projection for a stage of `aspect`, with the camera at `camera`. */
/** A camera at `eye` looking at `at`, the world's up kept up. */
const lookAt = (eye: readonly number[], at: readonly number[]): Mat => {
  const f = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], fl = Math.hypot(...f);
  const fz = f.map(v => v / fl), side = [-fz[2], 0, fz[0]], sl = Math.hypot(...side) || 1, x = side.map(v => v / sl);
  const y = [x[1] * fz[2] - x[2] * fz[1], x[2] * fz[0] - x[0] * fz[2], x[0] * fz[1] - x[1] * fz[0]];
  const dot = (a: number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new Float32Array([x[0], y[0], -fz[0], 0, x[1], y[1], -fz[1], 0, x[2], y[2], -fz[2], 0, -dot(x, eye), -dot(y, eye), dot(fz, eye), 1]);
};
/** The ledger book, open on the floor just past September's fan: the middle of its spine. Its pages are 1.5 wide and 2 deep, on a kraft board. */
const BOOK_AT = [.35, 0, monthZ(MONTHS - 1) - 4.2] as const, PAGE = { w: 1.5, d: 2 } as const;
/** Where the camera ends: risen above the book and a little before it, looking down on the pile on its right-hand page. */
const END_EYE = [BOOK_AT[0] + .9, 2.9, BOOK_AT[2] + 2.7] as const, END_AT = [BOOK_AT[0] + .25, .2, BOOK_AT[2] - .15] as const;

/**
 * The view and projection for a window of `aspect`, `through` the band. With `frame`, the window's place inside a larger canvas (x, y from its
 * top left, w, h, each a share of the canvas), the same picture is drawn into that place and runs on past it to the canvas's own edges.
 */
export function viewProjection(aspect: number, through: number, frame?: { x: number; y: number; w: number; h: number }): Mat {
  // A tall stage keeps the wide one's sideways view, so the fan is never cut at its sides on a phone.
  // The band opens close on October's fan, so the slips fill the window; the lens widens to the flight's own in its first tenth.
  const fov = FOV * (.46 + .54 * ease(through / .1));
  const f = Math.min(1, aspect / ASPECT.wide * 1.6) / Math.tan(fov / 2), near = .1, far = 120;
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
  // In flight: a little above the stack and looking a little down on it, as one looks into a drawer of cards.
  const camera = cameraZ(through), eye = [-.18, .95, camera], at = [-.18, .95 - 10 * Math.sin(.22), camera - 10 * Math.cos(.22)];
  // Over the book, the camera rises first, then comes round to look down on it, and is there before the last slips are set down.
  const back = ease(settle(through) / .6), rise = Math.sqrt(back);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const from = [lerp(eye[0], END_EYE[0], back), lerp(eye[1], END_EYE[1], rise), lerp(eye[2], END_EYE[2], back)];
  const to = at.map((v, k) => lerp(v, END_AT[k], back));
  const picture = mul(projection, lookAt(from, to));
  if (!frame) return picture;
  const place = new Float32Array([frame.w, 0, 0, 0, 0, frame.h, 0, 0, 0, 0, 1, 0, 2 * frame.x + frame.w - 1, 1 - 2 * frame.y - frame.h, 0, 1]);
  return mul(place, picture);
}

const HINGE = SLIP.h + .9;
/** Each slip's own pose in its month's fan, which never changes: splayed from a foot below the stack like a hand of cards, a little off true. */
const poses = slips.map(slip => {
  const centred = slip.place - (slip.of - 1) / 2, fan = -centred * .026 + slip.turn;
  return mul(mul(mul(translate(centred * .014, -.9 + slip.lift, -slip.place * DEPTH), rotZ(fan)), translate(0, .9, 0)), rotY(slip.tilt));
});
const leafTurn = new Float32Array(16), turnedPose = new Float32Array(16);

/** The book: two pages and the board under them, drawn after the slips as three more of the same quad. */
export const BOOK = 3, INSTANCES = SLIPS + BOOK;
/** What each instance is, for the shader and the poster: 0 a slip done, 1 a slip still waiting, 2 a page of the book, 3 its board. */
export const kinds = Float32Array.from({ length: INSTANCES }, (_, index) => index < SLIPS ? Number(slips[index].waiting) : index < INSTANCES - 1 ? 2 : 3);
/** A quad lying flat on the floor at y, its near edge at z, `w` by `d`, turned `spin` about the upright. */
const flat = (x: number, y: number, z: number, w: number, d: number, spin = 0) => mul(mul(mul(translate(x, y, z), rotY(spin)), rotX(-Math.PI / 2)), scale(w / SLIP.w, d / SLIP.h));
const book = [
  flat(BOOK_AT[0] - PAGE.w / 2 - .01, .012, BOOK_AT[2] + PAGE.d / 2, PAGE.w, PAGE.d),
  flat(BOOK_AT[0] + PAGE.w / 2 + .01, .012, BOOK_AT[2] + PAGE.d / 2, PAGE.w, PAGE.d),
  flat(BOOK_AT[0], 0, BOOK_AT[2] + PAGE.d / 2 + .06, PAGE.w * 2 + .14, PAGE.d + .12),
];
/** Each slip's place in the pile: squared on the right-hand page, a little off true, in the order the year asked them. */
const PILE_STEP = .0005;
const piled = slips.map((_, index) => flat(BOOK_AT[0] + PAGE.w / 2 + (hash(index, 61) - .5) * .025, .014 + index * PILE_STEP, BOOK_AT[2] + SLIP.h / 2 + (hash(index, 62) - .5) * .02, SLIP.w, SLIP.h, (hash(index, 63) - .5) * .07));

/** The flight's own poses: each month in its fan, its leaf turned up and away once the camera has reached it. */
function flightPoses(through: number, out: Float32Array) {
  const camera = cameraZ(through);
  let month = -1, leaf = 0;
  slips.forEach((slip, index) => {
    if (slip.month !== month) {
      month = slip.month; leaf = turned(month, camera);
      if (leaf > 0) mul(mul(translate(0, HINGE, monthZ(month)), rotX(-leaf * 1.9)), translate(0, -HINGE, 0), leafTurn);
    }
    const at = index * 16;
    if (leaf > 0) out.set(mul(leafTurn, poses[index], turnedPose), at);
    else { out.set(poses[index], at); out[at + 14] += monthZ(month); }
  });
  book.forEach((page, index) => out.set(page, (SLIPS + index) * 16));
  return out;
}
/** Where every slip is as the flight ends: the start of each one's way to the pile. */
const flown = flightPoses(FLIGHT, new Float32Array(INSTANCES * 16));

/**
 * Every instance's model matrix at `through`, written into `out` (16 floats each). Through the flight, the fans and their turning leaves; after it,
 * each slip in turn is carried from where the flight left it to its place in the pile, on a low arc, its turn eased between the two and kept true
 * (the blended axes made square again), so no slip is ever skewed. Nothing is allocated: it runs on every frame of the band.
 */
/** How many slips, from October's first, lie in the pile: the canvas draws a contact shade under the first of them only, not 370 under one another. */
export let landed = 0;
export function placeSlips(through: number, out: Float32Array = new Float32Array(INSTANCES * 16)): Float32Array {
  landed = 0;
  if (through <= FLIGHT) return flightPoses(through, out);
  const s = Math.min(1, (through - FLIGHT) / (1 - FLIGHT));
  out.set(flown);
  for (let index = 0; index < SLIPS; index++) {
    const k = ease((s - .05 - .46 * index / SLIPS) / .06);
    if (k <= 0) continue;
    if (k >= 1 && landed === index) landed = index + 1;
    const at = index * 16, to = piled[index], from = out[at + 13];
    for (let i = 0; i < 16; i++) out[at + i] += (to[i] - out[at + i]) * k;
    // Square the blended turn again: x kept to unit length, y made at right angles to it, z their cross.
    const x0 = out[at], x1 = out[at + 1], x2 = out[at + 2], xl = Math.hypot(x0, x1, x2) || 1, ax = x0 / xl, ay = x1 / xl, az = x2 / xl;
    let y0 = out[at + 4], y1 = out[at + 5], y2 = out[at + 6];
    const d = y0 * ax + y1 * ay + y2 * az; y0 -= d * ax; y1 -= d * ay; y2 -= d * az;
    const yl = Math.hypot(y0, y1, y2) || 1;
    y0 /= yl; y1 /= yl; y2 /= yl;
    out[at] = ax; out[at + 1] = ay; out[at + 2] = az; out[at + 4] = y0; out[at + 5] = y1; out[at + 6] = y2;
    out[at + 8] = ay * y2 - az * y1; out[at + 9] = az * y0 - ax * y2; out[at + 10] = ax * y1 - ay * y0;
    // Height comes down first, over the arc's first seven tenths: the slip then slides in at its own place in the pile, never hovering over it.
    const down = Math.min(1, k / .7);
    out[at + 13] = from + (to[13] - from) * ease(down) + Math.sin(Math.PI * down) * .9;
  }
  return out;
}

/** Each slip's contact shade on the sheet under it: thrown down and to the right, away from the light, and grown a little past the slip's edge. */
export const SHADE = { x: .022, y: -.03, z: -.006, grow: .05, ink: .2 } as const;
/** The hairline at a slip's edge: the pile's ink-warm colour, laid lightly over the paper. */
export const HAIRLINE = .45;
/** The light falls from the upper left, as on every relief on the page; a slip's shade from its facing alone. */
export const LIGHT = [-.45, .6, .66] as const;
export const PAPER = [0xf7 / 255, 0xf2 / 255, 0xe6 / 255] as const;
export const EDGE = [0xb0 / 255, 0xa0 / 255, 0x84 / 255] as const;
export const WAITING = [0xc8 / 255, 0x96 / 255, 0x2e / 255] as const;
export const SHADOW = [0x3b / 255, 0x2a / 255, 0x12 / 255] as const;
/** Slip material, the same family as the call's and the help's slips: some are kraft, the rest paper; each carries one line of ink, never letters. */
export const KRAFT = [0xd4 / 255, 0xbc / 255, 0x8f / 255] as const;
export const KRAFT_EDGE = [0xa8 / 255, 0x8c / 255, 0x5c / 255] as const;
export const INK = [0x3d / 255, 0x4f / 255, 0x43 / 255] as const;
/** Which slips are kraft (about one in four) and how far each one's line of ink runs, from the slip's own number: the canvas (by gl_InstanceID) and the poster read the same. */
export const isKraft = (slip: number) => hash(slip + 2000, 7) < .28;
export const lineEnd = (slip: number) => .46 + .3 * hash(slip + 3000, 3);
/** The deckle: each edge torn in by a little, from knots along it, joined straight; in the world's units. Edges: 0 left, 1 right, 2 foot, 3 head. */
export const DECKLE = { depth: .014, knots: 18 } as const;
export const deckle = (slip: number, edge: number, along: number) => {
  const k = Math.min(.99999, Math.max(0, along)) * DECKLE.knots, i = Math.floor(k), f = k - i, a = hash(slip * 4 + edge + 5000, i), b = hash(slip * 4 + edge + 5000, i + 1);
  return DECKLE.depth * (.3 + .7 * (a + (b - a) * f));
};
export const DONE = [0x36 / 255, 0x5c / 255, 0x46 / 255] as const;
export const shade = (m: Float32Array, at = 0) => {
  const nx = m[at + 8], ny = m[at + 9], nz = m[at + 10], length = Math.hypot(nx, ny, nz) || 1;
  return .8 + .2 * Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / length);
};
