"use client";
import "@/components/live-workspace.css";
import "@/components/public-state.css";
import Link from "next/link";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";
import { languages } from "@/lib/words";
import { errorButton } from "./error-button";

const tabs = { en: edgeWords.en.failedTab, es: edgeWords.es.failedTab };

/** A public page that failed. It carries both languages and shows the reader's own (public-state.css), set before its first paint. */
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="live-app public-state">
      <ReaderLanguage tabs={tabs} />
      <main className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        {languages.map((language) => (
          <div key={language} lang={language}>
            <p className="public-state-mark"><Link href="/" aria-label={edgeWords[language].home}>kind helps</Link></p>
            <h1>{edgeWords[language].failed}</h1>
            <p className="live-deck">{edgeWords[language].failedDeck}</p>
            <div className="public-state-ways">
              <button {...errorButton} onClick={reset}>{edgeWords[language].tryAgain}</button>
              <Link href="/">{edgeWords[language].back}</Link>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
