import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PublicLanguage } from "@/components/public-language";
import { ReaderLanguage } from "@/components/reader-language";
import { PublicEnding } from "@/components/public-ending";
import { edgeWords } from "@/lib/edge-words";
import { linkPreviewIn, linkCardIn } from "@/lib/link-preview";
import { privacyWords } from "@/lib/privacy-words";
import { languages, type Language } from "@/lib/words";
import "@/components/public-page.css";

/** The browser's own bar takes the colour of the desk the page opens on, so no lighter band stands over it. */
export const privacyViewport: Viewport = { colorScheme: "light", themeColor: "#e6decb", viewportFit: "cover" };

/** Each language's page has its own address and names the other, so it can be linked and found in the language it is read in. */
export function privacyMetadata(language: Language): Metadata {
  const said = privacyWords[language];
  return {
    title: said.tab,
    description: said.description,
    alternates: { canonical: said.path, languages: { ...Object.fromEntries(languages.map((other) => [other, privacyWords[other].path])), "x-default": privacyWords.en.path } },
    openGraph: { ...linkPreviewIn(language), url: said.path, title: said.tab, description: said.preview },
    twitter: { ...linkCardIn(language), title: said.tab, description: said.preview },
  };
}

export function PrivacyPage({ language }: { language: Language }) {
  const said = privacyWords[language];
  return <div className="public-page" lang={language}>
    {language !== "en" && <ReaderLanguage page={language} />}
    <header className="public-page-header">
      <Link className="public-page-brand" href="/" aria-label={edgeWords[language].home}><span lang="en">kind helps</span></Link>
      <PublicLanguage language={language} paths={{ en: privacyWords.en.path, es: privacyWords.es.path }} />
      <Link href="/app">{said.enter}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <main className="public-words paper-rise" data-address={`kindhelps.com${said.path}`}>
      <h1>{said.title}</h1>
      {said.translated && <p className="public-words-note">{said.translated[0]}<Link href={privacyWords.en.path} hrefLang="en">{said.translated[1]}</Link>{said.translated[2]}</p>}
      <div className="public-words-relief" aria-hidden="true" />
      {said.sections.map(({ title, blocks }) => <section key={title}>
        <h2>{title}</h2>
        <div>{blocks.map((block) => typeof block === "string"
          ? <p key={block}>{block}</p>
          : <ul key={block[0][0]}>{block.map(([lead, rest]) => <li key={lead}><strong>{lead}</strong> {rest}</li>)}</ul>)}</div>
      </section>)}
      <section>
        <h2>{said.questions.title}</h2>
        <div>
          <p>{said.questions.before}<a className="public-words-address" href="https://github.com/Joe-Simo/neighborly" target="_blank" rel="noopener noreferrer">github.com/Joe-Simo/neighborly<span className="sr-only"> {said.questions.newTab}</span></a>{said.questions.after}</p>
          <p className="public-words-last">{said.questions.independent}</p>
        </div>
      </section>
    </main>
    <PublicEnding language={language} />
  </div>;
}
