import type { CSSProperties } from "react";
import { late, lateMs, madeFrames } from "@/lib/made-frames";
import type { madeWords } from "@/lib/made-words";
import type { Language } from "@/lib/words";

type Said = (typeof madeWords)[Language]["frameStrip"];

// The strip's height stands for 40 ms, so the 33 ms line sits near its top and the room under it shows; a longer frame is drawn to the top and is still counted as it was.
const ceiling = 40;
// Each frame is a mark at the height of its own time, not a bar from the floor, so a run of even frames reads as one fine line well under the 33 ms line.
const mark = 1.6;
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const days = { en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }), es: new Intl.DateTimeFormat("es-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) };
/** Each frame's mark, as one subpath of a single path: a 1-wide box at the height of its own time. */
const marks = (all: readonly number[], isLate: boolean) =>
  all.map((ms, frame) => late(ms) === isLate ? `M${frame} ${ceiling - Math.min(ms, ceiling)}h1v${mark}h-1z` : "").join("");
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/**
 * The page's own scroll on the Mac, one bar for each frame, with the 33 ms line every change is held to. It is drawn once on the server
 * from the recorder's file and never moves. A late frame is plum, the colour for wrong; the rest are ink.
 */
export function MadeFrames({ said, language }: { said: Said; language: Language }) {
  // Both widths share one x-axis: a frame is the same width in each strip, so the longer run is the longer strip.
  const span = Math.max(...madeFrames.widths.map(({ all }) => all.length));
  return <figure className="public-made-frames">
    <figcaption className="public-made-frames-title">{said.caption}</figcaption>
    {madeFrames.widths.map(({ width, all, frames, over, worst }, row) => {
      const summary = fill(said.summary[over ? 1 : 0], { n: whole.format(frames), over: whole.format(over), worst: whole.format(worst) });
      return <div key={width} className="public-made-frames-row">
        <p><strong>{said.widths[width]}</strong> {summary}</p>
        <div className="public-made-frames-plot" style={{ "--line": `${((ceiling - lateMs) / ceiling) * 100}%` } as CSSProperties}>
        <svg shapeRendering="crispEdges" viewBox={`0 0 ${span} ${ceiling}`} preserveAspectRatio="none" role="img" aria-label={`${said.widths[width]}. ${summary}`}>
          {/* One path for the frames in time and one for the late ones: the same marks as a rect each, in two elements instead of thousands. */}
          {([false, true] as const).map((isLate) => <path key={String(isLate)} data-late={isLate || undefined} d={marks(all, isLate)} />)}
          <line x1={0} x2={span} y1={ceiling - lateMs} y2={ceiling - lateMs} />
        </svg>
        {/* The 33 ms line is labelled once, on the first strip; the second shares its height. */}
        {row === 0 && <span aria-hidden="true">{said.line}</span>}
        </div>
      </div>;
    })}
    <p className="public-made-frames-source">{fill(said.source, { day: days[language].format(new Date(madeFrames.day)), commit: madeFrames.commit, machine: madeFrames.machine })}</p>
  </figure>;
}
