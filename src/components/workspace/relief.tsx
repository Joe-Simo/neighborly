import { useId, type CSSProperties } from "react";
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

const widths = [640, 1024, 1536] as const;
const sources = (name: ReliefName, type: "avif" | "webp") =>
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
  className,
}: {
  name: ReliefName;
  focus?: string;
  sizes?: string;
  /** A small round crop, close on the subject. */
  vignette?: boolean;
  className?: string;
}) {
  if (!reliefReady.includes(name))
    return <ReliefPlaceholder name={name} vignette={vignette} className={className} />;
  return (
    <picture className={cn("relief", className)}>
      <source type="image/avif" srcSet={sources(name, "avif")} sizes={vignette ? "96px" : sizes} />
      <source type="image/webp" srcSet={sources(name, "webp")} sizes={vignette ? "96px" : sizes} />
      <img
        src={`/assets/relief/relief-${name}-1024.webp`}
        alt=""
        width={1536}
        height={1024}
        decoding="async"
        style={{ objectPosition: focus }}
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
