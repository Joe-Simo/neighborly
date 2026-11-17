"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { CardFor } from "./card-for";
import { useCardFor } from "@/lib/card-for";
import { warmWhenNear, type useSampleDoor } from "./sample-link";

/** The open hand holds the card out: it is the way into the sample. */
export function CardOffer({ door }: { door: ReturnType<typeof useSampleDoor> }) {
  const name = useCardFor().trim();
  return <span className="neighborly-close-offer">
    <Link href="/app?intent=sample" className="card-offer" data-station="end" data-turn={-4} ref={warmWhenNear} {...door}>
      <i aria-hidden="true" />
      <ArrowUpRight aria-hidden="true" />
      {/* The line as lettered on the card: what is written here goes with the card through the grow. */}
      <em className="card-offer-for" aria-hidden="true">For <span data-blank={name ? undefined : ""}>{name}</span></em>
      <span className="card-offer-words"><strong>Look around a sample conference</strong><small>Every person in the sample is made up.</small></span>
    </Link>
    <CardFor />
  </span>;
}
