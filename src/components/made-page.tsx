import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ReaderLanguage } from "@/components/reader-language";
import { PublicEnding } from "@/components/public-ending";
import { edgeWords } from "@/lib/edge-words";
import { linkPreviewIn } from "@/lib/link-preview";
import { madeWords } from "@/lib/made-words";
import { languages, type Language } from "@/lib/words";
import "@/components/public-page.css";

export { privacyViewport as madeViewport } from "@/components/privacy-page";

export function madeMetadata(language: Language): Metadata {
  const said = madeWords[language];
  return {
    title: said.tab,
    description: said.description,
    alternates: { canonical: said.path, languages: Object.fromEntries(languages.map((other) => [other, madeWords[other].path])) },
    openGraph: { ...linkPreviewIn(language), url: said.path, title: said.tab, description: said.preview },
  };
}

/** How Kind Helps was made: the same laid sheets as the privacy page, with the help's own piece of the painting on the title's sheet. */
export function MadePage({ language }: { language: Language }) {
  const said = madeWords[language];
  return <div className="public-page" lang={language}>
    {language !== "en" && <ReaderLanguage page={language} />}
    <header className="public-page-header">
      <Link className="public-page-brand" href="/" aria-label={edgeWords[language].home}><span lang="en">kind helps</span></Link>
      <Link href="/app">{said.enter}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <main className="public-words public-made paper-rise" data-address={`kindhelps.com${said.path}`}>
      <h1>{said.title}</h1>
      {said.translated && <p className="public-words-note">{said.translated[0]}<Link href={madeWords.en.path} hrefLang="en">{said.translated[1]}</Link>{said.translated[2]}</p>}
      <div className="public-words-relief" aria-hidden="true" />
      {said.sections.map(({ title, blocks }) => <section key={title}>
        <h2>{title}</h2>
        <div>{blocks.map((block) => typeof block === "string"
          ? <p key={block}>{block}</p>
          : <ul key={block[0].lead} className="public-made-tones">{block.map(({ lead, rest, tone }) => <li key={lead} data-tone={tone}><strong>{lead}</strong> {rest}</li>)}</ul>)}</div>
      </section>)}
      <section>
        <div><p className="public-words-last">{said.last}</p></div>
      </section>
    </main>
    <PublicEnding language={language} />
  </div>;
}
