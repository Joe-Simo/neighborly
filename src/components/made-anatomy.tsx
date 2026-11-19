import type { madeWords } from "@/lib/made-words";
import type { Language } from "@/lib/words";

type Said = (typeof madeWords)[Language]["anatomy"];
const tokens = ["sheet", "card", "slip"] as const;

/**
 * The paper's three heights, drawn apart in a still three-quarter view over the page they rest on. Each plate wears the relief
 * token the app gives that surface (the slip in its kraft), so the figure cannot drift from the screens it describes; only the
 * spacing between them is enlarged, and the note says so. Nothing moves.
 */
export function MadeAnatomy({ said }: { said: Said }) {
  return <figure className="public-made-anatomy">
    <figcaption className="public-made-anatomy-title">{said.caption}</figcaption>
    <div className="public-made-anatomy-stage" aria-hidden="true">
      <div className="public-made-anatomy-space">
        <span className="public-made-anatomy-ground" />
        {tokens.map((token) => <span key={token} className="public-made-anatomy-plate" data-relief={token} />)}
      </div>
    </div>
    <ol className="public-made-anatomy-labels">
      {said.layers.map(({ name, rest }, index) => <li key={name} data-relief={tokens[index]}><strong>{name}</strong> <span>{rest}</span></li>)}
      <li data-relief="page"><strong>{said.page}</strong></li>
    </ol>
    <p className="public-made-anatomy-source">{said.note}</p>
  </figure>;
}
