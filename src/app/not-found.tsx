import type { Metadata } from "next";
import Link from "next/link";
import { LostDoorBrand } from "@/components/edge-sheet";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";
import { readersLanguage } from "@/lib/first-language";
import { linkCardIn, linkPreview } from "@/lib/link-preview";
import { languages } from "@/lib/words";
import "@/components/not-found.css";
import "@/components/public-touch.css";

const lost = edgeWords.en.lostAbout;
export const metadata: Metadata = {
  title: edgeWords.en.lostTab,
  description: lost,
  // A dead link pasted into a chat says so, with the site's picture and name, and does not pass as the home page.
  openGraph: { ...linkPreview, title: edgeWords.en.lostTab, description: lost },
  twitter: { ...linkCardIn("en"), title: edgeWords.en.lostTab, description: lost },
  robots: { index: false, follow: false },
};

/**
 * The one address on the site with no one at it: a call slip that found nobody, lying alone and straight on bare paper,
 * its ochre corner still waiting. Flat and still: it was never filed, so it never folds. One line on it, and the way back.
 */
export default function NotFound() {
  return <main className="lost-door" data-piece="slip">
    <script dangerouslySetInnerHTML={{ __html: readersLanguage }} />
    <LostDoorBrand />
    <ReaderLanguage tabs={{ en: edgeWords.en.lostTab, es: edgeWords.es.lostTab }} abouts={{ en: edgeWords.en.lostAbout, es: edgeWords.es.lostAbout }} />
    {languages.map((language) => <div key={language} lang={language} className="lost-door-words" suppressHydrationWarning>
      <div className="lost-slip">
        <h1>{edgeWords[language].lostSlip}</h1>
        <p>{edgeWords[language].lostAbout}</p>
        <span className="lost-slip-corner" aria-hidden="true" />
      </div>
      <Link href="/#your-community">{edgeWords[language].courtyard}</Link>
    </div>)}
  </main>;
}
