import "@/components/live-workspace.css";
import "@/components/public-state.css";
import "@/components/public-page.css";
import type { Metadata } from "next";
import { languages, words } from "@/lib/words";
import { TryAgain } from "./try-again";

export const metadata: Metadata = {
  title: words("en").states.offlinePageTab,
  description: "This device is offline. What is on screen is kept, and Kind Helps opens again when the connection returns.",
  robots: { index: false, follow: false },
};

/**
 * Shown in place of a page that could not be fetched, from the copy the service worker keeps. It may run with none
 * of the app's scripts, so both languages are on the page and the reader's own is the one shown (public-state.css),
 * chosen before the first paint (first-language.ts).
 */
export default function Offline() {
  const said = languages.map((language) => ({ language, ...words(language).states }));
  return (
    <div className="live-app public-state">
      <main className="live-auth paper-rise">
        <div className="live-auth-art" aria-hidden="true" />
        <p className="public-state-mark">kind helps</p>
        {said.map(({ language, offlineTitle, offlinePageDeck }) => (
          <div key={language} lang={language}>
            <h1>{offlineTitle}</h1>
            <p className="live-deck">{offlinePageDeck}</p>
          </div>
        ))}
        <TryAgain said={said.map(({ language, tryAgain, offlinePageTab }) => ({ language, tryAgain, tab: offlinePageTab }))} />
      </main>
    </div>
  );
}
