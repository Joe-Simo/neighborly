"use client";

import { useCardFor } from "@/lib/card-for";
import { useWorkspace } from "@/components/workspace/context";

/** If the visitor wrote a name on the home page's card, the sample's week opens addressed to them, as the card was. */
export function CardGreeting() {
  const { words, data } = useWorkspace();
  const name = useCardFor().trim();
  if (!name || !data.church.sample) return null;
  return <p className="card-greeting"><em>{words.week.cardFor} {name}:</em> {words.week.cardForRest}</p>;
}
