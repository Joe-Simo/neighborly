"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { LiveApp } from "@/components/live-app";
import { liveAreas } from "@/components/workspace/areas";

/**
 * The workspace's frame lives here, in the layout, so it stays in place from room to room:
 * the wordmark, the menu or tabs and the head never blank while the next room is fetched.
 * A room's own page adds nothing but its title; the frame reads which room from the address.
 */
export function LiveFrame({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const area = liveAreas.find((candidate) => candidate === segment);
  return (
    <>
      {area && <LiveApp area={area} />}
      {children}
    </>
  );
}
