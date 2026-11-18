"use client";
import "./globals.css";
import "../../public/fonts/fonts.css";
import { EdgeSheet } from "@/components/edge-sheet";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";
import { readersLanguage } from "@/lib/first-language";

const tabs = { en: edgeWords.en.failedTab, es: edgeWords.es.failedTab };

/** The last page there is: shown when the frame around every page fails, so it brings its own frame and never the browser's. The same sheet as a page that failed. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: readersLanguage }} /></head>
      <body>
        <title>{edgeWords.en.failedTab}</title>
        <EdgeSheet
          piece="page"
          lines={{ en: edgeWords.en.failed, es: edgeWords.es.failed }}
          ways={{ en: <button type="button" onClick={reset}>{edgeWords.en.tryAgain}</button>, es: <button type="button" onClick={reset}>{edgeWords.es.tryAgain}</button> }}>
          <ReaderLanguage tabs={tabs} />
        </EdgeSheet>
      </body>
    </html>
  );
}
