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

/** The word lettered before the name ("For", or "Para" on a Spanish page). It is written as the card is pressed and read by the door, so the lettering is the same word all the way through. */
const WORD = "kh-card-word";
export function writeCardWord(word: string) {
  try { sessionStorage.setItem(WORD, word); } catch { /* storage is closed: the door letters "For" */ }
}
/** Only a word the card can be lettered with is ever read back; anything else in storage is "For". */
export function readCardWord() {
  try { return sessionStorage.getItem(WORD) === "Para" ? "Para" : "For"; } catch { return "For"; }
}
