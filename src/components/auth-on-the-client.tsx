"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __internal_onBeforeSetActive?: (intent?: string) => Promise<void> | void;
    __internal_onAfterSetActive?: () => Promise<void> | void;
  }
}

/**
 * Nothing the server draws under /app depends on who is signed in: every room reads the person from the backend, on
 * the client. So when Clerk switches session, the server round trip it makes to clear Next's page cache, and the page
 * refresh after it, change nothing on screen and only stand between the sign-in and the room (0.53 s and 0.25 s on a
 * phone, measured). Set after Clerk's provider sets its own (effects run after layout effects), on these pages only.
 * Should Clerk stop reading these hooks, its default simply runs again: slower, never wrong.
 */
export function AuthOnTheClient() {
  useEffect(() => {
    window.__internal_onBeforeSetActive = () => Promise.resolve();
    window.__internal_onAfterSetActive = () => undefined;
  }, []);
  return null;
}
