/**
 * The page turn between rooms. The room just left is a still sheet lying over the next one (room-sheet.tsx); once the
 * next room is whole, that sheet is turned from its lower right corner, as home's The help is turned to find The year:
 * the corner lifts and folds back over the sheet, its underside a step warmer and darker than its face, the fold runs
 * up and to the left, and the next room is found lying beneath, shaded close under the lifted crease.
 *
 * It is paper, never a fade: every piece is cut along one moving line by boxes that are only moved and turned, so the
 * sheet is painted once and the turn itself is the compositor's alone.
 *   - The part still lying down: the sheet inside a box whose edge is the fold, the sheet held still within it.
 *   - The turned-over part: a blank sheet of the underside's paper, mirrored across the fold and cut at it; its own
 *     edges throw a close shade on the sheet it lies over, and the paper curving over at the fold catches the light.
 *   - The crease's shade on the room beneath.
 * `drive(progress)` lays every piece for one point of the turn, so a finger can hold it anywhere; `play()` runs it,
 * and `glide()` carries it on from where a finger let go.
 */

/** The whole turn, corner down to sheet gone. */
const TURN_MS = 280;

/** The turn's ease: the corner lifts gently, the fold runs, and the sheet leaves the far edge without a stop. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export type RoomTurn = {
  drive: (progress: number) => void;
  play: () => Promise<void>;
  /** From where a finger let go of it, on to the end (1) or back down (0), at the turn's own pace. */
  glide: (from: number, to: 0 | 1) => Promise<void>;
  end: () => void;
};

const piece = (className: string, style: Partial<CSSStyleDeclaration>) => {
  const element = document.createElement("div");
  element.className = className;
  Object.assign(element.style, style);
  return element;
};

/**
 * Makes the turn for the still sheet `sheet` (the copy, fixed over the column) held in `frame` (its frame of twins,
 * removed at the end). The sheet's own box is the page that turns.
 */
/** The sheet's box on the screen. */
type Box = { top: number; left: number; width: number; height: number };

export function roomTurn(sheet: HTMLElement, frame: HTMLElement, laid?: Box): RoomTurn {
  // Where the sheet was just laid, when the caller knows it: asking the page would lay it out inside the frame that turns it.
  const place = laid ?? sheet.getBoundingClientRect();
  const width = place.width;
  const height = place.height;
  // The fold runs up and to the left, a little flatter than the diagonal, so the corner leads.
  const length = Math.hypot(width, height * 0.62);
  const d = { x: -width / length, y: (-height * 0.62) / length };
  const angle = Math.atan2(d.y, d.x);
  const degrees = (angle * 180) / Math.PI;
  // The fold has run its course once it has passed the far corner (the top left).
  const far = width * -d.x + height * -d.y;
  // Boxes long enough to reach across the page at any turn: as long as its diagonal beyond the fold, twice along it.
  const reach = Math.ceil(Math.hypot(width, height));
  const big = reach * 2;

  // The whole turn lies over the column and nowhere else.
  const turn = piece("room-turn", { top: `${place.top}px`, left: `${place.left}px`, width: `${width}px`, height: `${height}px` });
  turn.setAttribute("aria-hidden", "true");
  turn.setAttribute("inert", "");
  const shade = piece("room-turn-shade", { height: `${big}px` });
  const lying = piece("room-turn-cut", { inset: "0" });
  const held = piece("room-turn-held", {});
  const over = piece("room-turn-cut", { inset: "0" });
  const back = piece("room-turn-back", { width: `${width}px`, height: `${height}px` });
  const roll = piece("room-turn-roll", { height: `${big}px` });
  back.append(roll);
  over.append(back);
  // The sheet keeps its place inside the held box: laid at the box's corner, which is held at the column's corner.
  sheet.style.top = "0";
  sheet.style.left = "0";
  sheet.style.background = "var(--live-paper, #f7f4ed)";
  held.append(frame);
  lying.append(held);
  turn.append(shade, lying, over);
  document.body.append(turn);

  // Paper that stands up in the room beneath (`data-stands`) holds at 60° until the crease passes its near corner
  // (its lower right, the first the fold uncovers), then stands as the rest of the turn runs.
  const run = far * 1.04;
  // Found as the turn starts: the room beneath is drawn only after the sheet was laid over it.
  let standing: { element: HTMLElement; uncovered: number }[] = [];
  const findStanding = () => [...document.querySelectorAll<HTMLElement>("[data-stands]")]
    .filter((element) => !element.closest(".room-turn") && !frame.contains(element))
    .map((element) => {
      const box = element.getBoundingClientRect();
      const uncovered = (box.right - place.left - width) * d.x + (box.bottom - place.top - height) * d.y;
      return { element, uncovered: Math.max(0, Math.min(run * 0.95, uncovered)) };
    });
  const drive = (progress: number) => {
    const s = ease(Math.min(1, Math.max(0, progress))) * run;
    for (const { element, uncovered } of standing) {
      const up = Math.min(1, Math.max(0, (s - uncovered) / (run - uncovered)));
      element.style.animation = "none";
      element.style.transform = up >= 1 ? "" : `perspective(600px) rotateX(${(60 * (1 - up)).toFixed(2)}deg)`;
    }
    const fx = width + d.x * s;
    const fy = height + d.y * s;
    // Everything of the column beyond the fold: a cut along it, reaching past every edge.
    const along = { x: -d.y * big, y: d.x * big };
    const ahead = { x: d.x * big, y: d.y * big };
    const beyond = `polygon(${fx + along.x}px ${fy + along.y}px, ${fx - along.x}px ${fy - along.y}px, ${fx - along.x + ahead.x}px ${fy - along.y + ahead.y}px, ${fx + along.x + ahead.x}px ${fy + along.y + ahead.y}px)`;
    lying.style.clipPath = beyond;
    over.style.clipPath = beyond;
    // The corner turned over is the column mirrored across the fold.
    const k = 2 * (width * d.x + height * d.y + s);
    const mirror = `matrix(${1 - 2 * d.x * d.x}, ${-2 * d.x * d.y}, ${-2 * d.x * d.y}, ${1 - 2 * d.y * d.y}, ${k * d.x}, ${k * d.y})`;
    back.style.transform = mirror;
    // A strip laid along the fold, its left edge on it, running the fold's length.
    const strip = `translate(${fx}px, ${fy}px) rotate(${degrees}deg) translate(0, ${-big / 2}px)`;
    // The light along the fold, on the turned paper (in its mirrored terms, which mirror it back).
    roll.style.transform = `${mirror} ${strip}`;
    shade.style.transform = `${strip} translate(-100%, 0)`;
  };

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    turn.remove();
    for (const { element } of standing) element.style.removeProperty("transform");
  };

  const glide = (from: number, to: 0 | 1) =>
    new Promise<void>((resolve) => {
      const began = performance.now();
      turn.setAttribute("data-turning", "");
      // The rest of the way takes its share of the whole turn's time.
      const span = Math.max(1, Math.abs(to - from) * TURN_MS);
      if (!standing.length) standing = findStanding();
      drive(from);
      const step = (now: number) => {
        if (ended) return resolve();
        const done = (now - began) / span;
        if (done >= 1) {
          // Turned away, the sheet is gone; laid back down, it lies flat where it was.
          if (to === 1) end();
          else drive(0);
          return resolve();
        }
        drive(from + (to - from) * done);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  const play = () => glide(0, 1);

  drive(0);
  return { drive, play, glide, end };
}

/**
 * The page turned back by the finger (the swipe in from the left edge, room-sheet.tsx): the room before comes back
 * over from the left as a book's page turned back. The crease stands upright where the finger is, so the page's edge
 * stays under the thumb: to its right the room being left still lies flat, to its left the room before has come
 * back, and just left of the crease the page's underside shows as it curves over, throwing a close shade on the
 * sheet it is about to cover. `drive(progress)` is the finger's place across the column, as it is, with no ease.
 */
export function edgeTurn(sheet: HTMLElement, frame: HTMLElement, laid?: Box): RoomTurn {
  // Where the sheet was just laid, when the caller knows it: asking the page would lay it out inside the frame that turns it.
  const place = laid ?? sheet.getBoundingClientRect();
  const width = place.width;
  const height = place.height;
  const turn = piece("room-turn", { top: `${place.top}px`, left: `${place.left}px`, width: `${width}px`, height: `${height}px` });
  turn.setAttribute("aria-hidden", "true");
  turn.setAttribute("inert", "");
  const lying = piece("room-turn-cut", { inset: "0" });
  const held = piece("room-turn-held", {});
  // The underside as the page curves over at the crease: the turned paper's own colour, lit along the bend.
  const under = piece("room-turn-back", { height: `${height}px`, width: "0px", boxShadow: "none" });
  const bend = piece("room-turn-roll", { height: `${height}px`, width: "100%", transform: "scaleX(-1)", transformOrigin: "50% 0" });
  under.append(bend);
  // The close shade the coming page throws on the sheet still lying, just right of the crease.
  const shade = piece("room-turn-shade", { height: `${height}px`, transform: "scaleX(-1)", transformOrigin: "50% 0" });
  sheet.style.top = "0";
  sheet.style.left = "0";
  sheet.style.background = "var(--live-paper, #f7f4ed)";
  held.append(frame);
  lying.append(held);
  turn.append(lying, shade, under);
  document.body.append(turn);

  const drive = (progress: number) => {
    const x = Math.min(1, Math.max(0, progress)) * width;
    lying.style.clipPath = `inset(0 0 0 ${x}px)`;
    // The bend is as wide as the page has room to curve, up to a finger's breadth, and ends at the crease.
    const curve = Math.min(x, 44);
    under.style.width = `${curve}px`;
    under.style.transform = `translateX(${x - curve}px)`;
    shade.style.transform = `translateX(${x}px) scaleX(-1)`;
  };

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    turn.remove();
  };
  const glide = (from: number, to: 0 | 1) =>
    new Promise<void>((resolve) => {
      const began = performance.now();
      const span = Math.max(1, Math.abs(to - from) * TURN_MS);
      drive(from);
      const step = (now: number) => {
        if (ended) return resolve();
        const done = (now - began) / span;
        if (done >= 1) {
          if (to === 1) end();
          else drive(0);
          return resolve();
        }
        drive(from + (to - from) * ease(done));
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  drive(0);
  return { drive, play: () => glide(0, 1), glide, end };
}
