import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { ArrowUpRight } from "lucide-react";
import { PublicLanguage } from "@/components/public-language";
import { ReaderLanguage } from "@/components/reader-language";
import { PublicEnding } from "@/components/public-ending";
import { edgeWords } from "@/lib/edge-words";
import { ownCardIn, ownTwitterCard } from "@/lib/link-preview";
import { weekWords } from "@/lib/week-words";
import { languages, type Language } from "@/lib/words";
import "@/components/public-page.css";
import "@/components/week-page.css";
import { CutHead } from "@/components/cut-heads";
import { BookLeaves } from "@/components/book-leaves";

export { privacyViewport as weekViewport } from "@/components/privacy-page";

export function weekMetadata(language: Language): Metadata {
  const said = weekWords[language];
  return {
    title: said.tab,
    description: said.description,
    alternates: { canonical: said.path, languages: { ...Object.fromEntries(languages.map((other) => [other, weekWords[other].path])), "x-default": weekWords.en.path } },
    openGraph: { ...ownCardIn(language), url: said.path, title: said.tab, description: said.preview },
    twitter: { ...ownTwitterCard, title: said.tab, description: said.preview },
  };
}

/** One made-up week, told in four days. Each day is a sheet laid on the last, with its room's own piece of the relief lying on it. */
export function WeekPage({ language }: { language: Language }) {
  // The relief beside the heading is the page's largest paint, drawn from the stylesheet: asked for with the page, not once the styles are read.
  preload("/assets/relief/relief-week-640.webp", { as: "image", fetchPriority: "high" });
  const said = weekWords[language];
  return <div className="public-page" lang={language}>
    {language !== "en" && <ReaderLanguage page={language} />}
    <header className="public-page-header">
      <Link className="public-page-brand" href="/" aria-label={edgeWords[language].home}><span lang="en">kind helps</span></Link>
      <PublicLanguage language={language} paths={{ en: weekWords.en.path, es: weekWords.es.path }} />
      <Link href="/app">{said.enter}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <main className="public-words public-week" data-address={`kindhelps.com${said.path}`}>
      <h1>{said.title}</h1>
      {said.translated && <p className="public-words-note">{said.translated[0]}<Link href={weekWords.en.path} hrefLang="en">{said.translated[1]}</Link>{said.translated[2]}</p>}
      <div className="public-words-relief" aria-hidden="true" />
      <section className="public-week-lede"><div><p>{said.lede}</p></div></section>
      {said.days.map(({ day, title, copy, room, picture, alt }, index) =>
          <section key={picture} className="public-week-day" aria-labelledby={`week-${picture}`}>
            <div className="public-week-head">
              <p className="public-week-when"><span aria-hidden="true">{index + 1}</span>{day}</p>
              {/* A hyphened word ("write-up") is kept whole: a head never breaks inside a word. */}
              <CutHead id={`week-${picture}`}>{title.split(/(\S+-\S+)/).map((part, at) => at % 2 ? <span key={at} className="whitespace-nowrap">{part}</span> : part)}</CutHead>
              <p className="public-week-room">{room}</p>
            </div>
            <div>
              {/* The room's piece of the relief, cut from its sheet and laid on this day's paper. */}
              <picture className="public-week-piece">
                <source type="image/avif" srcSet={`/assets/relief/relief-${picture}-640.avif 640w, /assets/relief/relief-${picture}-1024.avif 1024w`} sizes="(max-width: 1023px) 92vw, (min-width: 2000px) 960px, 34vw" />
                <img src={`/assets/relief/relief-${picture}-1024.webp`} srcSet={`/assets/relief/relief-${picture}-640.webp 640w, /assets/relief/relief-${picture}-1024.webp 1024w`} sizes="(max-width: 1023px) 92vw, (min-width: 2000px) 960px, 34vw" alt={alt} width={1024} height={683} loading="lazy" decoding="async" />
              </picture>
              {copy.map((line) => <p key={line}>{line}</p>)}
            </div>
          </section>)}
      <section className="public-week-close">
        <div>
          <p><Link className="public-week-open" href="/app?intent=sample">{said.open}<ArrowUpRight size={16} aria-hidden="true" /></Link></p>
          <p className="public-words-last">{said.last}</p>
        </div>
      </section>
    </main>
    <BookLeaves sheets=".public-week > section" />
    <PublicEnding language={language} />
  </div>;
}
