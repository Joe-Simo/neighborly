"use client";
import { CodeReload } from "@/components/code-reload";
import { EdgeSheet } from "@/components/edge-sheet";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";

const tabs = { en: edgeWords.en.failedTab, es: edgeWords.es.failedTab };

/**
 * A room that failed to open: the same sheet as a public page that failed (the home page's kept page, one line, and the one way back,
 * to try again), with the line that matters inside the app, that what was saved is safe. The root already says the reader's language.
 */
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CodeReload error={error}><EdgeSheet
    piece="page"
    lines={{ en: edgeWords.en.failed, es: edgeWords.es.failed }}
    abouts={{ en: edgeWords.en.failedDeck, es: edgeWords.es.failedDeck }}
    ways={{ en: <button type="button" onClick={reset}>{edgeWords.en.tryAgain}</button>, es: <button type="button" onClick={reset}>{edgeWords.es.tryAgain}</button> }}>
    <ReaderLanguage tabs={tabs} />
  </EdgeSheet></CodeReload>;
}
