"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";

const WIDE = "(min-width: 1280px)";
/** In the iPad app every tablet keeps the column: beside the room in landscape, slid over it upright. */
const TABLET = "(min-width: 700px) and (min-height: 700px)";
const wideQuery = () =>
  window.matchMedia(document.documentElement.dataset.shell === "ios" ? `${WIDE}, ${TABLET}` : WIDE);
const watchWide = (changed: () => void) => {
  const query = wideQuery();
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
};

/** True from 1280px up, and on an iPad in the app, where a room has a side column. False on the server and below. */
export function useWideScreen() {
  return useSyncExternalStore(watchWide, () => wideQuery().matches, () => false);
}

type Place = { slot: HTMLElement | null; name: Dispatch<SetStateAction<string>> };
const Slot = createContext<Place | null>(null);

/**
 * Where a room's side column is drawn; the shell gives the place, a room never draws it. On a desk, and on an
 * iPad in landscape, it stands beside the room. On an iPad held upright it waits at the right edge under its own
 * title and slides over the room when that is tapped; a tap on the room behind, or Escape, puts it back.
 */
export function AsidePlace({ on, children }: { on: boolean; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const panel = useId();
  useEffect(() => {
    if (!open) return;
    const away = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", away);
    return () => window.removeEventListener("keydown", away);
  }, [open]);
  return (
    <>
      {on && name && (
        <button type="button" className="live-aside-pull" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
          {name}
        </button>
      )}
      {on && open && <div className="live-aside-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}
      {on && <div className="live-aside" id={panel} ref={setSlot} data-open={open ? "" : undefined} />}
      <Slot.Provider value={{ slot: on ? slot : null, name: setName }}>{children}</Slot.Provider>
    </>
  );
}

/**
 * The room's one quiet side column, from 1280px up and on an iPad in the app. It answers "what else do I need
 * here" with what the room already has: no new data, and nothing a phone lacks, because on a phone it is not
 * drawn at all. One per room, shorter than the window, under a short title.
 */
export function RoomAside({ title, children }: { title: string; children: ReactNode }) {
  const place = useContext(Slot);
  const heading = useId();
  const name = place?.name;
  useEffect(() => {
    if (!name) return;
    name(title);
    return () => name("");
  }, [name, title]);
  if (!place?.slot) return null;
  return createPortal(
    <aside className="live-aside-sheet" aria-labelledby={heading}>
      <h2 id={heading} className="live-kicker">{title}</h2>
      {children}
    </aside>,
    place.slot,
  );
}
