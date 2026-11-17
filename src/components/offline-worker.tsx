"use client";

import { useEffect, useRef } from "react";
import { useSerwist } from "@serwist/turbopack/react";

/**
 * Registers the offline worker once the page has loaded. A browser that refuses service workers for this site (site
 * data blocked) answers with a SecurityError, and the site simply works without one; any other failure still surfaces.
 */
export function OfflineWorker() {
  const { serwist } = useSerwist();
  const started = useRef(false);
  useEffect(() => {
    if (!serwist || started.current) return;
    started.current = true;
    serwist.register().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
    });
  }, [serwist]);
  return null;
}
