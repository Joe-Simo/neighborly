import type { madeWords } from "@/lib/made-words";
import type { Language } from "@/lib/words";
import { madeSaid } from "@/lib/made-said";

type Said = (typeof madeWords)[Language]["process"];
const sizes = { end: [780, 664], words: [880, 160], relief: [908, 934], slip: [390, 108] } as const;

/** Real before-and-after stills from the design reviews, side by side, each with the one reason it changed. Nothing moves. */
export function MadeProcess({ said, language }: { said: Said; language: Language }) {
  return <div className="public-made-process">
    {said.pairs.map(({ key, why, alt }) => {
      const [width, height] = sizes[key as keyof typeof sizes];
      return <figure key={key}>
        <div>{(["before", "after"] as const).map((when, index) => <div key={when}>
          <span>{said[when]}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- a still from the review, shown as it was taken */}
          <img src={`/assets/made/process/${key}-${when}.webp`} alt={alt[index]} width={width} height={height} loading="lazy" decoding="async" />
        </div>)}</div>
        <figcaption>{madeSaid(why, language)}</figcaption>
      </figure>;
    })}
    <p className="public-made-process-source">{said.source}</p>
  </div>;
}
