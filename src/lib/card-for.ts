import { useSyncExternalStore } from "react";

/** The name a visitor writes on the home page's card. It stays in this tab only: sessionStorage, never a cookie, never sent anywhere. */
const KEY = "kh-card-for";
export const CARD_FOR_LONGEST = 24;
const listeners = new Set<() => void>();

const read = () => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export function writeCardFor(name: string) {
  const kept = name.replace(/\s+/g, " ").trimStart().slice(0, CARD_FOR_LONGEST);
  try { if (kept.trim()) sessionStorage.setItem(KEY, kept); else sessionStorage.removeItem(KEY); } catch { /* storage is closed: the card is only written on, not kept */ }
  listeners.forEach(tell => tell());
}

const subscribe = (tell: () => void) => { listeners.add(tell); return () => void listeners.delete(tell); };

/** The name on the card, as written; empty on the server and when nothing was written. */
export const useCardFor = () => useSyncExternalStore(subscribe, read, () => "");
