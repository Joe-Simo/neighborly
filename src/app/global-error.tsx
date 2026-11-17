"use client";
/* The frame that failed here is the one links travel through, so the ways back are plain links that load the home page fresh. */
/* eslint-disable @next/next/no-html-link-for-pages */
import "./globals.css";
import "../../public/fonts/fonts.css";
import "@/components/live-workspace.css";
import "@/components/public-state.css";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";
import { languages } from "@/lib/words";
import { errorButton } from "./error-button";

const tabs = { en: edgeWords.en.failedTab, es: edgeWords.es.failedTab };

/** The last page there is: shown when the frame around every page fails, so it brings its own frame and never the browser's. Both languages are on it, and the reader's own is shown. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <title>{edgeWords.en.failedTab}</title>
          <ReaderLanguage tabs={tabs} />
        <div className="live-app public-state">
          <main className="live-auth">
            <div className="live-auth-art" aria-hidden="true" />
            {languages.map((language) => (
              <div key={language} lang={language}>
                <p className="public-state-mark"><a href="/" aria-label={edgeWords[language].home}>kind helps</a></p>
                <h1>{edgeWords[language].failed}</h1>
                <p className="live-deck">{edgeWords[language].failedDeck}</p>
                <div className="public-state-ways">
                  <button {...errorButton} onClick={reset}>{edgeWords[language].tryAgain}</button>
                  <a href="/">{edgeWords[language].back}</a>
                </div>
              </div>
            ))}
          </main>
        </div>
      </body>
    </html>
  );
}
