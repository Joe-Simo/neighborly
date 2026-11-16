import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** The open hand holds the card out: it is the way into the sample. */
import type { MouseEventHandler } from "react";

export function CardOffer({ onOpen }: { onOpen?: MouseEventHandler<HTMLAnchorElement> }) {
  return <span className="neighborly-close-offer">
    <Link href="/app?intent=sample" className="card-offer" data-station="end" data-turn={-4} onClick={onOpen}>
      <i aria-hidden="true" />
      <ArrowUpRight aria-hidden="true" />
      <span className="card-offer-words"><strong>Look around a sample conference</strong><small>Every person in the sample is made up.</small></span>
    </Link>
  </span>;
}
