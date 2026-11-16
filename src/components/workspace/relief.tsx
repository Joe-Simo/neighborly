import { useId, type AnimationEventHandler, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** The paper relief pictures, by the name of their file: `public/assets/relief/relief-<name>-<width>.avif` and `.webp`. */
export const reliefNames = [
  "call",
  "visit",
  "help",
  "year",
  "week",
  "neighbors",
  "people",
  "commitment",
  "rest",
  "tasks",
  "files",
  "mine",
  "teams",
] as const;
export type ReliefName = (typeof reliefNames)[number];

/**
 * The pictures that have arrived, at 1536, 1024 and 640 wide in AVIF and WebP.
 * Add a name here when its six files are in `public/assets/relief/`; until then
 * every place that asks for it draws the paper placeholder at the same size.
 */
export const reliefReady: readonly ReliefName[] = ["call", "help", "year", "week", "visit", "people", "commitment", "tasks", "files", "rest", "neighbors", "mine", "teams"];

/**
 * The one small move a room's picture makes on the first arrival in a visit: where its moving piece starts,
 * in screen pixels and degrees from where it rests (6 to 10px); `about` is the point it turns about, as a CSS position on the picture. A picture is listed here only when its two
 * layers are in `public/assets/relief/`, cut on the same canvas as the flat picture and levelled the same way:
 * `relief-<name>-base-<width>` (the picture without the piece, the paper behind it painted in) and
 * `relief-<name>-piece-<width>` (the piece alone on a clear ground), each at 640, 1024 and 1536 in AVIF and WebP.
 * A cut in three has a third, still layer over the piece, `relief-<name>-front-<width>` (a hand that stays while the
 * door moves under it): say `front: true`.
 * All layers together, at rest, must be the flat picture. `relief-arrival.tsx` plays it.
 */
export const reliefMoves: Partial<Record<ReliefName, { x?: number; y?: number; turn?: number; about?: string; front?: true }>> = {
  // The cup is set down.
  week: { y: -6 },
  // The key is hung on its hook and swings to rest; it turns about the hook. Short, so the paper under the hand stays clean.
  commitment: { y: -2, turn: 1.5, about: "46% 39%" },
  // The receiver is lifted. The cord runs on under the earpiece, so it stays joined to it.
  call: { y: 7 },
  // The door comes to rest. Short: past 3px the edge of the cut shows at the sleeves.
  visit: { x: -3, front: true },
  // The ribbon is laid on the page.
  year: { y: -4 },
  // The door is drawn to.
  neighbors: { x: 5 },
  // The hand presses the fold flat.
  tasks: { y: -4 },
  // The hand reaches in to join the others.
  people: { x: 4 },
  // The envelope is laid in the open hand. Short: the palm is not painted far under it.
  help: { y: -3 },
  // Still on purpose, until a cut holds at rest and at every start: mine, teams, rest, files.
};

/** A picture that has loaded is not yet one that can be painted: this waits for its decode as well. */
export const whenDecoded = (image: HTMLImageElement, then: () => void) => void image.decode().then(then, then);

const usual: readonly number[] = [640, 1024, 1536];
export const reliefSources = (name: string, type: "avif" | "webp", widths: readonly number[] = usual) =>
  widths.map((width) => `/assets/relief/relief-${name}-${width}.${type} ${width}w`).join(", ");

/**
 * One relief picture, filling whatever box its class gives it. It is decoration: the words beside it say everything.
 * `focus` is the point of the picture kept in view when the box crops it, as a CSS position.
 */
export function ReliefPicture({
  name,
  focus = "70% 50%",
  sizes = "(min-width: 900px) 46vw, 100vw",
  vignette = false,
  widths = usual,
  onReady,
  className,
  style,
  onAnimationEnd,
}: {
  style?: CSSProperties;
  onAnimationEnd?: AnimationEventHandler<HTMLElement>;
  /** Called once the picture can be painted (or cannot be had), so whoever lays it can wait for it. */
  onReady?: () => void;
  name: ReliefName;
  focus?: string;
  sizes?: string;
  /** A small round crop, close on the subject. */
  vignette?: boolean;
  /** The widths cut for this picture, when it has more than the usual three (the visit also has 2400). */
  widths?: readonly number[];
  className?: string;
}) {
  if (!reliefReady.includes(name))
    return <ReliefPlaceholder name={name} vignette={vignette} className={className} />;
  return (
    <picture className={cn("relief", className)} style={style} onAnimationEnd={onAnimationEnd}>
      <source type="image/avif" srcSet={reliefSources(name, "avif", widths)} sizes={vignette ? "96px" : sizes} />
      <source type="image/webp" srcSet={reliefSources(name, "webp", widths)} sizes={vignette ? "96px" : sizes} />
      <img
        src={`/assets/relief/relief-${name}-1024.webp`}
        alt=""
        width={1536}
        height={1024}
        decoding="async"
        style={{ objectPosition: focus }}
        ref={onReady && ((image) => void (image?.complete && whenDecoded(image, onReady)))}
        onLoad={onReady && (({ currentTarget }) => whenDecoded(currentTarget, onReady))}
        onError={onReady}
      />
    </picture>
  );
}

/**
 * Until a picture exists: paper of the same size with one plum wave and one green wave,
 * the shapes of the doors' panels, cut and laid like the real thing. Each room's waves
 * sit a little differently, so no two heads are the same sheet.
 */
function ReliefPlaceholder({
  name,
  vignette,
  className,
}: {
  name: ReliefName;
  vignette: boolean;
  className?: string;
}) {
  const id = useId();
  const plum = "M1700 150C1420 190 1310 410 1090 520 900 615 760 590 610 720 500 815 450 940 430 1200H1700Z";
  const turn = reliefNames.indexOf(name);
  const lay = (depth: number): CSSProperties => ({
    transform: `translate(${((turn * 53) % 140) - 70 + depth * 18}px, ${((turn * 37) % 90) - 30}px)`,
  });
  return (
    <svg
      className={cn("relief", className)}
      data-placeholder={name}
      aria-hidden="true"
      viewBox={vignette ? "820 430 560 560" : "0 0 1536 1024"}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <filter id={`${id}lift`} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="-5" dy="-9" stdDeviation="11" floodColor="#283c32" floodOpacity="0.22" />
        </filter>
        <filter id={`${id}grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={turn + 3} />
          <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.24  0 0 0 0 0.2  0 0 0 0.07 0" />
        </filter>
        <clipPath id={`${id}cut`}>
          <path style={lay(0)} d={plum} />
        </clipPath>
      </defs>
      <g filter={`url(#${id}lift)`}>
        <path
          style={lay(0)}
          fill="#6f5f93"
          d={plum}
        />
      </g>
      <g filter={`url(#${id}lift)`}>
        <path
          style={lay(1)}
          fill="#365c46"
          d="M1700 470C1500 480 1380 640 1180 720 1010 788 880 770 770 860 690 925 650 1010 640 1200H1700Z"
        />
      </g>
      <g filter={`url(#${id}lift)`}>
        <path
          style={lay(2)}
          fill="#f7f4ed"
          d="M1700 790C1540 780 1440 880 1290 925 1170 961 1080 965 1010 1200H1700Z"
        />
      </g>
      <g clipPath={`url(#${id}cut)`}>
        <rect width="1536" height="1024" filter={`url(#${id}grain)`} />
      </g>
    </svg>
  );
}
