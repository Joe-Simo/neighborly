"use client";
import { CodeReload } from "@/components/code-reload";
import { EdgeSheet } from "@/components/edge-sheet";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";

const tabs = { en: edgeWords.en.failedTab, es: edgeWords.es.failedTab };

/** A public page that failed: the home page's kept page, its ribbon in place, one line, and the one way back, to try again. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CodeReload error={error}><EdgeSheet
    piece="page"
    lines={{ en: edgeWords.en.failed, es: edgeWords.es.failed }}
    ways={{ en: <button type="button" onClick={reset}>{edgeWords.en.tryAgain}</button>, es: <button type="button" onClick={reset}>{edgeWords.es.tryAgain}</button> }}>
    <ReaderLanguage tabs={tabs} />
  </EdgeSheet></CodeReload>;
}
