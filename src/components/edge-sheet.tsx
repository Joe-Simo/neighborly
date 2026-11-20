import type { ReactNode } from "react";
import { languages, type Language } from "@/lib/words/sets";
import "@/components/not-found.css";
import "@/components/public-touch.css";

/**
 * The pieces an edge page stands on, each cut whole from the painting already on the site. Nothing is drawn for them:
 * the arch is the courtyard's own, the kept page is the home page's year and the bowl is the shared meal's, shown as cut.
 * `box` is the piece's own outline inside its file, so the bare paper around it is left out.
 */
const pieces = {
  arch: { src: "/assets/made/arch-691.webp", srcSet: "/assets/made/arch-360.webp 360w, /assets/made/arch-691.webp 691w", width: 691, height: 621, box: null },
  bowl: { src: "/assets/painted-world/bowl.webp", srcSet: undefined, width: 640, height: 427, box: [43, 60, 590, 373] },
  page: { src: "/assets/home/relief-year-piece-1600.webp", srcSet: "/assets/home/relief-year-piece-800.webp 800w, /assets/home/relief-year-piece-1600.webp 1600w", width: 1600, height: 1088, box: [684, 291, 1212, 839] },
} as const;

/**
 * A page outside every other page (not found, a page that did not open, no connection), as one sheet of paper:
 * a piece of the painting, one plain line and one way back. It carries both languages and shows the reader's own
 * (not-found.css), which the root says before the first paint.
 */
export function EdgeSheet({ piece, lines, abouts, ways, children }: {
  piece: keyof typeof pieces;
  lines: Record<Language, string>;
  /** One plain line under the title: what happened and what to do. */
  abouts?: Record<Language, string>;
  ways: Record<Language, ReactNode>;
  children?: ReactNode;
}) {
  const { src, srcSet, width, height, box } = pieces[piece];
  // The piece stands in a <picture> (which draws no box, not-found.css) so React does not lift it into a preload in the
  // head: the not-found and error sheets are drawn with every page's shell, and a lifted preload made every page, the
  // rooms included, fetch the arch first and at high priority. On an edge page itself it is still asked for at high priority.
  const image = (
    <picture>
      <img src={src} srcSet={srcSet} sizes="min(78vw, 640px)" width={width} height={height} alt="" fetchPriority="high" />
    </picture>
  );
  return <main className="lost-door" data-piece={piece}>
    {children}
    <LostDoorBrand />
    {box
      ? <span className="lost-door-piece" aria-hidden="true" style={{
        aspectRatio: `${box[2] - box[0]} / ${box[3] - box[1]}`,
        "--piece-w": `${(width / (box[2] - box[0])) * 100}%`,
        "--piece-x": `${(-box[0] / (box[2] - box[0])) * 100}%`,
        "--piece-y": `${(-box[1] / (box[3] - box[1])) * 100}%`,
      } as React.CSSProperties}>{image}</span>
      : <span className="lost-door-arch" aria-hidden="true">{image}</span>}
    {languages.map((language) => <div key={language} lang={language} className="lost-door-words" suppressHydrationWarning>
      <h1>{lines[language]}</h1>
      {abouts && <p>{abouts[language]}</p>}
      {ways[language]}
    </div>)}
  </main>;
}

/** The wordmark at the sheet's top corner, as on every public page: the site is named, and home is one press away. */
export function LostDoorBrand() {
  // A plain link, not next/link: this sheet is drawn in every page's shell, and the router's link would add to every page's first load.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <a className="lost-door-brand" href="/">kind helps</a>;
}
