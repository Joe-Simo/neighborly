"use client";

import type { CardWords } from "./public-ending";
import { CARD_FOR_LONGEST, useCardFor, writeCardFor } from "@/lib/card-for";

/** "For ____" on the card: a blank the visitor may fill with a name. It is kept in this tab only and goes with the card when it is passed. */
export function CardFor({ said }: { said: CardWords }) {
  const name = useCardFor();
  return <span className="card-for">
    <label className="card-for-line">
      <span aria-hidden="true">For</span>
      <input value={name} onChange={event => writeCardFor(event.target.value)} maxLength={CARD_FOR_LONGEST} autoComplete="off" spellCheck={false} enterKeyHint="done" aria-label={said.who} aria-describedby="card-for-note" placeholder=" " />
    </label>
    <small id="card-for-note" className="card-for-note">{said.stays}</small>
  </span>;
}
