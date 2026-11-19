import { sampleYear } from "@/lib/sample-year";

/**
 * "The year in paper": the sample conference's year as one slip for every request it was asked, fanned in depth a month at a time,
 * October to September. The flight is a pure function of how far through the band the reader is, so the poster (scripts/year-paper-posters.mts)
 * and the live canvas (year-paper-gl.ts) draw the same slips from the same numbers, and the canvas's first frame is the poster.
 * Synthetic: the sample conference's own requests, month by month, and which are still waiting, all as its Reports room adds them up.
 */
export const SLIPS = sampleYear.requests;
export const MONTHS = 12;
/** The first month of the sample's year (October 2025), as a UTC date; the year runs twelve months from it. */
export const FIRST_MONTH = Date.UTC(sampleYear.year - 1, 9, 1);
/** The two shapes the stage is cut to: wide from 768px, tall below it (year-paper.css). Width over height. */
export const ASPECT = { wide: 16 / 10, tall: 3 / 4 } as const;
export type Shape = keyof typeof ASPECT;

const GAP = 3.4, DEPTH = .11, FOV = 38 * Math.PI / 180, START = 3.6;
/** A slip: one by .62, in the world's units. */
export const SLIP = { w: 1, h: .62 } as const;

const hash = (a: number, b: number) => {
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
export type Mat = Float32Array;
const mul = (a: Mat, b: Mat, out: Mat = new Float32Array(16)) => {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
};
const translate = (x: number, y: number, z: number): Mat => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const rotX = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotY = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const rotZ = (a: number): Mat => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };

const ease = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const monthZ = (month: number) => -month * GAP;

/** Where the camera stands at `through` (0 to 1): from in front of October to just before September's fan, where it rests. */
/** The flight takes the band's first 80%; in the last 20% the camera draws back and every leaf settles into its fan, so the band ends on the whole year. */
const FLIGHT = .8;
const settle = (through: number) => ease((through - FLIGHT) / (1 - FLIGHT));
export const cameraZ = (through: number) => START + (monthZ(MONTHS - 1) + 2.4 - START) * ease(Math.min(1, through / FLIGHT));

/** Which month is nearest in front of the camera: its leaf is the one being read. */
export const monthAt = (through: number) => through > FLIGHT ? MONTHS - 1 : Math.max(0, Math.min(MONTHS - 1, Math.round((START - 2.4 - cameraZ(through)) / GAP)));

/** How far a month's leaf has turned away (0 lying in its fan, 1 turned up past the camera). */
const turned = (month: number, camera: number, through: number) => month === MONTHS - 1 ? 0 : through > FLIGHT ? 1 - settle(through) : ease((monthZ(month) + 2.6 - camera) / 2.2);

/** The view and projection for a stage of `aspect`, with the camera at `camera`. */
/** A camera at `eye` looking at `at`, the world's up kept up. */
const lookAt = (eye: readonly number[], at: readonly number[]): Mat => {
  const f = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], fl = Math.hypot(...f);
  const fz = f.map(v => v / fl), side = [-fz[2], 0, fz[0]], sl = Math.hypot(...side) || 1, x = side.map(v => v / sl);
  const y = [x[1] * fz[2] - x[2] * fz[1], x[2] * fz[0] - x[0] * fz[2], x[0] * fz[1] - x[1] * fz[0]];
  const dot = (a: number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new Float32Array([x[0], y[0], -fz[0], 0, x[1], y[1], -fz[1], 0, x[2], y[2], -fz[2], 0, -dot(x, eye), -dot(y, eye), dot(fz, eye), 1]);
};
/** Where the camera ends: drawn back in front of October and a little above and aside, so all twelve fans stand in the window, receding to September. */
const END_EYE = [2.2, 3.4, START + 2.5] as const, END_AT = [-1.7, -.2, monthZ(MONTHS - 1) * .4] as const;

/** The view and projection for a stage of `aspect`, `through` the band. */
export function viewProjection(aspect: number, through: number): Mat {
  // A tall stage keeps the wide one's sideways view, so the fan is never cut at its sides on a phone.
  const f = Math.min(1, aspect / ASPECT.wide * 1.6) / Math.tan(FOV / 2), near = .1, far = 120;
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
  // In flight: a little above the stack and looking a little down on it, as one looks into a drawer of cards.
  const camera = cameraZ(through), eye = [-.18, .95, camera], at = [-.18, .95 - 10 * Math.sin(.22), camera - 10 * Math.cos(.22)];
  // Drawing back, the camera rises clear of the fans first, then turns to take in the whole year.
  const back = settle(through), rise = Math.sqrt(back);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const from = [lerp(eye[0], END_EYE[0], back), lerp(eye[1], END_EYE[1], rise), lerp(eye[2], END_EYE[2], back)];
  const to = at.map((v, k) => lerp(v, END_AT[k], back));
  return mul(projection, lookAt(from, to));
}

const HINGE = SLIP.h + .9;
/** Each slip's own pose in its month's fan, which never changes: splayed from a foot below the stack like a hand of cards, a little off true. */
const poses = slips.map(slip => {
  const centred = slip.place - (slip.of - 1) / 2, fan = -centred * .026 + slip.turn;
  return mul(mul(mul(translate(centred * .014, -.9 + slip.lift, -slip.place * DEPTH), rotZ(fan)), translate(0, .9, 0)), rotY(slip.tilt));
});
const leafTurn = new Float32Array(16), turnedPose = new Float32Array(16);

/**
 * Every slip's model matrix at `through`, written into `out` (16 floats a slip). A month's slips stand in a fan, each a sheet behind the last;
 * as the camera reaches a month, its leaf turns up from its top edge and away overhead. Nothing is allocated: it runs on every frame of the flight.
 */
export function placeSlips(through: number, out: Float32Array = new Float32Array(SLIPS * 16)): Float32Array {
  const camera = cameraZ(through);
  let month = -1, leaf = 0;
  slips.forEach((slip, index) => {
    if (slip.month !== month) {
      month = slip.month; leaf = turned(month, camera, through);
      if (leaf > 0) mul(mul(translate(0, HINGE, monthZ(month)), rotX(-leaf * 1.9)), translate(0, -HINGE, 0), leafTurn);
    }
    const at = index * 16;
    if (leaf > 0) out.set(mul(leafTurn, poses[index], turnedPose), at);
    else { out.set(poses[index], at); out[at + 14] += monthZ(month); }
  });
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
export const DONE = [0x36 / 255, 0x5c / 255, 0x46 / 255] as const;
export const shade = (m: Float32Array, at = 0) => {
  const nx = m[at + 8], ny = m[at + 9], nz = m[at + 10], length = Math.hypot(nx, ny, nz) || 1;
  return .8 + .2 * Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / length);
};
