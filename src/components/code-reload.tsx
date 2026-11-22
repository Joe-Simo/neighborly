"use client";

import { useEffect, useState, type ReactNode } from "react";
import { reloadOnceForCode, willReloadForCode } from "@/lib/chunk-recovery";

/**
 * An error page's first answer to a failed load of the site's own code (a tab left open across a deploy): the tab is
 * reloaded once, in place, and nothing is drawn meanwhile, so the page that did not open is never shown for a moment
 * before the room comes back. A second failure on the same deploy shows the error page, as any other failure does.
 */
export function CodeReload({ error, children }: { error: unknown; children: ReactNode }) {
  const [reloading] = useState(() => willReloadForCode(error));
  useEffect(() => {
    if (reloading) reloadOnceForCode(error);
  }, [reloading, error]);
  return reloading ? null : children;
}
