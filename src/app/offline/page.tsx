import type { Metadata } from "next";
import { EdgeSheet } from "@/components/edge-sheet";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";
import { linkCardIn, linkPreview } from "@/lib/link-preview";
import { words } from "@/lib/words";
import { TryAgain } from "./try-again";

export const metadata: Metadata = {
  // No title from React: the head names the tab in the reader's language (first-tab.ts), and without scripts the
  // page's own <noscript> does, in English.
  title: null,
  description: edgeWords.en.offlineAbout,
  // A link to this page, pasted into a chat, says what it is and does not pass as the home page.
  openGraph: { ...linkPreview, title: words("en").states.offlinePageTab, description: edgeWords.en.offlineAbout },
  twitter: { ...linkCardIn("en"), title: words("en").states.offlinePageTab, description: edgeWords.en.offlineAbout },
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
    abouts={{ en: edgeWords.en.offlineAbout, es: edgeWords.es.offlineAbout }}
    ways={{ en: <TryAgain label={en.tryAgain} />, es: <TryAgain label={es.tryAgain} /> }}>
    {/* Out of React's hands (a <title> it rendered it would write back as the page wakes): read only without scripts. */}
    <noscript dangerouslySetInnerHTML={{ __html: `<title>${en.offlinePageTab}</title>` }} />
    <ReaderLanguage tabs={{ en: en.offlinePageTab, es: es.offlinePageTab }} abouts={{ en: edgeWords.en.offlineAbout, es: edgeWords.es.offlineAbout }} />
  </EdgeSheet>;
}
