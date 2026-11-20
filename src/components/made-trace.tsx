import type { madeWords } from "@/lib/made-words";
import type { Language } from "@/lib/words";

type Said = (typeof madeWords)[Language]["trace"];
const sizes = { picture: [780, 520], slip: [560, 440], room: [920, 680] } as const;

/** One call followed from the chosen picture, to its slip, to its room: real stills, in order. Nothing moves. */
export function MadeTrace({ said }: { said: Said }) {
  return <div className="public-made-trace">
    <ol>{said.steps.map(({ key, name, why, alt }) => {
      const [width, height] = sizes[key as keyof typeof sizes];
      return <li key={key}><figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- a still from the running site, shown as it was taken */}
        <img src={`/assets/made/trace/${key}.webp`} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
        <figcaption><strong>{name}</strong> {why}</figcaption>
      </figure></li>;
    })}</ol>
    <p className="public-made-process-source">{said.credit}</p>
  </div>;
}
