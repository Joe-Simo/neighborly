import type { Metadata } from "next";
import Link from "next/link";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";
import { readersLanguage } from "@/lib/first-language";
import { linkPreview } from "@/lib/link-preview";
import { EdgeSheet } from "@/components/edge-sheet";

const lost = "The address may be old or mistyped. Kind Helps is at kindhelps.com.";
export const metadata: Metadata = {
  title: edgeWords.en.lostTab,
  description: lost,
  // A dead link pasted into a chat says so, with the site's picture and name, and does not pass as the home page.
  openGraph: { ...linkPreview, title: edgeWords.en.lostTab, description: lost },
  robots: { index: false, follow: false },
};

/** The one door on the site with nothing behind it: the courtyard's arch on bare paper, one line, and the way back to the courtyard. */
export default function NotFound() {
  return <EdgeSheet
    piece="arch"
    lines={{ en: edgeWords.en.lost, es: edgeWords.es.lost }}
    ways={{ en: <Link href="/#your-community">{edgeWords.en.courtyard}</Link>, es: <Link href="/#your-community">{edgeWords.es.courtyard}</Link> }}>
    <script dangerouslySetInnerHTML={{ __html: readersLanguage }} />
    <ReaderLanguage tabs={{ en: edgeWords.en.lostTab, es: edgeWords.es.lostTab }} />
  </EdgeSheet>;
}
