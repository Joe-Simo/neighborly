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
 * The courtyard's arch, cut from its sheet, standing alone on bare paper: the one door on the site with nothing behind it.
 * It can stand at any address, so it carries both languages and shows the reader's own (not-found.css), chosen before its
 * words are drawn; without the script it reads in English. One line and one way back, to the courtyard.
 */
export default function NotFound() {
  return <main className="lost-door">
    <script dangerouslySetInnerHTML={{ __html: readersLanguage }} />
    <ReaderLanguage tabs={{ en: edgeWords.en.lostTab, es: edgeWords.es.lostTab }} />
    {/* eslint-disable-next-line @next/next/no-img-element -- one cut sheet at two widths, shown as it was cut */}
    <img className="lost-door-arch" src="/assets/made/arch-691.webp" srcSet="/assets/made/arch-360.webp 360w, /assets/made/arch-691.webp 691w" sizes="min(78vw, 560px)" width={691} height={621} alt="" fetchPriority="high" />
    {languages.map((language) => <div key={language} lang={language} className="lost-door-words" suppressHydrationWarning>
      <h1>{edgeWords[language].lost}</h1>
      <Link href="/#your-community">{edgeWords[language].courtyard}</Link>
    </div>)}
    {/* The copy in the other language leaves the document's reading too, so a screen reader or a search for the page's heading only ever meets the one shown. */}
    <script dangerouslySetInnerHTML={{ __html: `(function(){var l=document.documentElement.lang==="es"?"es":"en";document.querySelectorAll(".lost-door-words").forEach(function(e){if(e.lang!==l)e.hidden=true})})()` }} />
  </main>;
}
