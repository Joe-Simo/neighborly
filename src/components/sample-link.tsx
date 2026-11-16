"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, MouseEventHandler, PointerEvent } from "react";
import { askSampleTicket, warmSignIn } from "@/lib/sample-ticket";

/**
 * What every way into the sample does before the visitor arrives: pointing at it or reaching it by keyboard fetches
 * Clerk's scripts; pressing it asks for the ticket. The link's own click (a card that grows, say) still runs, after the ask.
 */
export function useSampleDoor(onClick?: MouseEventHandler<HTMLAnchorElement>) {
  return {
    onPointerEnter: warmSignIn,
    onFocus: warmSignIn,
    onPointerDown: (event: PointerEvent<HTMLAnchorElement>) => {
      if (event.button !== 0) return;
      warmSignIn();
      askSampleTicket();
    },
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) askSampleTicket();
      onClick?.(event);
    },
  };
}

/** The link into the sample conference. */
export function SampleLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  return <Link {...props} href="/app?intent=sample" {...useSampleDoor()} />;
}
