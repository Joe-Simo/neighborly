import type { Metadata } from "next";
import Link from "next/link";
import { ReaderLanguage } from "@/components/reader-language";
import { edgeWords } from "@/lib/edge-words";
import { readersLanguage } from "@/lib/first-language";
import { linkPreview } from "@/lib/link-preview";
import { languages } from "@/lib/words";
import "@/components/not-found.css";
import "@/components/public-touch.css";

const lost = "The address may be old or mistyped. Kind Helps is at kindhelps.com.";
export const metadata: Metadata = {
  title: edgeWords.en.lostTab,
  description: lost,
  // A dead link pasted into a chat says so, with the site's picture and name, and does not pass as the home page.
  openGraph: { ...linkPreview, title: edgeWords.en.lostTab, description: lost },
  robots: { index: false, follow: false },
};

/**
 * The courtyard's doors, closed: the one place on the site they do not open onto anything. It can stand at any
 * address, so it carries both languages and shows the reader's own (not-found.css), chosen before its words are drawn.
 */
export default function NotFound() {
  return <main className="lost-door">
    <script dangerouslySetInnerHTML={{ __html: readersLanguage }} />
    <ReaderLanguage tabs={{ en: edgeWords.en.lostTab, es: edgeWords.es.lostTab }} />
    {languages.map((language) => <Link key={language} lang={language} className="lost-door-brand" href="/" aria-label={edgeWords[language].home}>kind helps</Link>)}
    {languages.map((language) => <div key={language} lang={language} className="lost-door-words">
      <h1>{edgeWords[language].lost}</h1>
      <Link href="/">{edgeWords[language].back}</Link>
    </div>)}
    <div className="lost-door-frame" aria-hidden="true">
      <div className="lost-door-light" />
      <div className="lost-door-leaves"><i /><i /></div>
    </div>
  </main>;
}
