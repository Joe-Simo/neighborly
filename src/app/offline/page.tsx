import type { Metadata } from "next";
import { EdgeSheet } from "@/components/edge-sheet";
import { ReaderLanguage } from "@/components/reader-language";
import { words } from "@/lib/words";
import { TryAgain } from "./try-again";

export const metadata: Metadata = {
  title: words("en").states.offlinePageTab,
  description: "This device is offline. What is on screen is kept, and Kind Helps opens again when the connection returns.",
  robots: { index: false, follow: false },
};

const en = words("en").states, es = words("es").states;

/**
 * Shown in place of a page that could not be fetched, from the copy the service worker keeps: the shared meal's bowl, still warm,
 * one line, and the one way back, to try again. It may run with none of the app's scripts, so both languages are on
 * the page and the reader's own is the one shown, chosen before the first paint (first-language.ts).
 */
export default function Offline() {
  return <EdgeSheet
    piece="bowl"
    lines={{ en: en.offlineTitle, es: es.offlineTitle }}
    ways={{ en: <TryAgain label={en.tryAgain} />, es: <TryAgain label={es.tryAgain} /> }}>
    <ReaderLanguage tabs={{ en: en.offlinePageTab, es: es.offlinePageTab }} />
  </EdgeSheet>;
}
