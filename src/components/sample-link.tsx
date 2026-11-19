"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, MouseEventHandler, PointerEvent } from "react";
import { askFirstRoom } from "@/lib/first-room";
import { whenIdle } from "@/lib/idle";
import { askSampleTicket, startSignIn, warmSignIn } from "@/lib/sample-ticket";

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
      askSampleTicket();
      askFirstRoom();
      warmSignIn();
      startSignIn();
    },
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        askSampleTicket();
        startSignIn();
      }
      onClick?.(event);
    },
  };
}

/** The link into the sample conference. */
export function SampleLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  return <Link {...props} href="/app?intent=sample" {...useSampleDoor()} />;
}

/** A phone has no pointing: as a ref, fetches Clerk's scripts once the way in comes near the window, before the tap. */
export function warmWhenNear(link: HTMLElement | null) {
  if (!link) return;
  let cancel = () => {};
  const near = new IntersectionObserver((seen) => {
    if (!seen.some((entry) => entry.isIntersecting)) return;
    near.disconnect();
    // Both lay tags and run code as they arrive, so they are asked for once the page is idle, never in a scroll's frame.
    cancel = whenIdle(() => {
      warmSignIn();
      askFirstRoom();
    }, 1000);
  }, { rootMargin: "600px 0px" });
  near.observe(link);
  return () => {
    near.disconnect();
    cancel();
  };
}
