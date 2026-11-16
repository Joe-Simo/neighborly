"use client";

import { createContext, useContext, useId, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const WIDE = "(min-width: 1280px)";
const watchWide = (changed: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
};

/** True from 1280px up, where a room has paper to spare beside its column. False on the server and below. */
export function useWideScreen() {
  return useSyncExternalStore(watchWide, () => window.matchMedia(WIDE).matches, () => false);
}

const Slot = createContext<HTMLElement | null>(null);
/** The shell gives the place; a room never draws it. */
export const AsideSlot = Slot.Provider;

/**
 * The room's one quiet side column, from 1280px up. It answers "what else do I need here" with what the
 * room already has: no new data, and nothing a phone lacks, because under 1280px it is not drawn at all.
 * One per room, shorter than the window, under a short title.
 */
export function RoomAside({ title, children }: { title: string; children: ReactNode }) {
  const slot = useContext(Slot);
  const heading = useId();
  if (!slot) return null;
  return createPortal(
    <aside className="live-aside-sheet" aria-labelledby={heading}>
      <h2 id={heading} className="live-kicker">{title}</h2>
      {children}
    </aside>,
    slot,
  );
}
