import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PublicLanguage } from "@/components/public-language";
import { ReaderLanguage } from "@/components/reader-language";
import { MadeCourtyard } from "@/components/made-courtyard";
import { PublicEnding } from "@/components/public-ending";
import { edgeWords } from "@/lib/edge-words";
import { linkPreviewIn, linkCardIn } from "@/lib/link-preview";
import { madeWords } from "@/lib/made-words";
import { languages, type Language } from "@/lib/words";
import "@/components/public-page.css";

export { privacyViewport as madeViewport } from "@/components/privacy-page";

export function madeMetadata(language: Language): Metadata {
  const said = madeWords[language];
  return {
    title: said.tab,
    description: said.description,
    alternates: { canonical: said.path, languages: { ...Object.fromEntries(languages.map((other) => [other, madeWords[other].path])), "x-default": madeWords.en.path } },
    openGraph: { ...linkPreviewIn(language), url: said.path, title: said.tab, description: said.preview },
    twitter: { ...linkCardIn(language), title: said.tab, description: said.preview },
  };
}

/** How Kind Helps was made: the same laid sheets as the privacy page, with the help's own piece of the painting on the title's sheet. */
export function MadePage({ language }: { language: Language }) {
  const said = madeWords[language];
  /* The code's address is kept whole on one line, never broken at its slash or hyphen. */
  const address = "github.com/Joe-Simo/neighborly";
  const [lastLead, lastTail] = said.last.split(address);
  return <div className="public-page" lang={language}>
    {language !== "en" && <ReaderLanguage page={language} />}
    <header className="public-page-header">
      <Link className="public-page-brand" href="/" aria-label={edgeWords[language].home}><span lang="en">kind helps</span></Link>
      <PublicLanguage language={language} paths={{ en: madeWords.en.path, es: madeWords.es.path }} />
      <Link href="/app">{said.enter}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <main className="public-words public-made paper-rise" data-address={`kindhelps.com${said.path}`}>
      <h1>{said.title}</h1>
      {said.translated && <p className="public-words-note">{said.translated[0]}<Link href={madeWords.en.path} hrefLang="en">{said.translated[1]}</Link>{said.translated[2]}</p>}
      <div className="public-words-relief" aria-hidden="true" />
      {said.sections.map(({ title, blocks, figure }, index) => <Fragment key={title}>
        {/* After the first sheet, the painting it speaks of is drawn apart into its paper and laid back together. */}
        {index === 1 && <MadeCourtyard {...said.courtyard} />}
        <section>
          <h2>{title.replace(/ (\S+)$/, "\u00a0$1")}</h2>
          <div>{blocks.map((block) => typeof block === "string"
            ? <p key={block}>{block}</p>
            : <ul key={block[0].lead} className="public-made-tones">{block.map(({ lead, rest, tone }) => <li key={lead} data-tone={tone}><strong>{lead}</strong> {rest}</li>)}</ul>)}
</div>
          {/* eslint-disable-next-line @next/next/no-img-element -- a 960px working file shown as it is */}
          {figure && <figure className="public-made-figure"><img src={figure.src} alt={figure.alt} width={960} height={480} loading="lazy" decoding="async" /><figcaption>{figure.caption}</figcaption></figure>}
        </section>
      </Fragment>)}
      <section>
        <div><p className="public-words-last">{lastLead}<span className="public-words-address">{address}</span>{lastTail}</p></div>
      </section>
    </main>
    <PublicEnding language={language} />
  </div>;
}
