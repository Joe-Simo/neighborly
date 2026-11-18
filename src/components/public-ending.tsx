"use client";

import { useRef } from "react";
import { useCutHold } from "./cut-hold";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CardOfferGrow } from "./card-offer-grow";
import "./neighborly-continuation.css";
import "./thread-card.css";
import "./public-touch.css";
import "./cut-edges.css";
import type { Language } from "@/lib/words";

/** The closing band and the foot, in each language. The home page is English; a public page of words closes in its own. */
export const endingWords = {
  en: {
    bring: ["Bring this to", "your people."], own: "Your own conference", start: "Start your conference", signIn: "Sign in",
    made: "Made for the good we can do.", about: "About Kind Helps", privacy: "Privacy", privacyPath: "/privacy", week: "A week at St. Example", weekPath: "/about/a-week", howMade: "How we made it", howMadePath: "/about/how-we-made-it", give: "Give a gift", newTab: "(opens in a new tab)",
    card: { for: "For", opening: "Opening…", look: "Look around a sample conference", madeUp: "Every person in the sample is made up.", who: "Who this card is for (optional)", stays: "Stays on this device." },
  },
  es: {
    bring: ["Lleva esto a", "tu gente."], own: "Tu propia conferencia", start: "Empieza tu conferencia", signIn: "Iniciar sesión",
    made: "Hecho por el bien que podemos hacer.", about: "Acerca de Kind Helps", privacy: "Privacidad", privacyPath: "/privacidad", week: "Una semana en San Ejemplo", weekPath: "/sobre/una-semana", howMade: "Cómo lo hicimos", howMadePath: "/sobre/como-lo-hicimos", give: "Hacer un donativo", newTab: "(se abre en una pestaña nueva)",
    card: { for: "Para", opening: "Abriendo…", look: "Recorrer una conferencia de muestra", madeUp: "Todos en la muestra son inventados.", who: "Para quién es esta tarjeta (opcional)", stays: "Se queda en este dispositivo." },
  },
} satisfies Record<Language, unknown>;
export type CardWords = (typeof endingWords)[Language]["card"];

/** The picture every public page closes on: the same two people, the open hand holding the card out as the way in. */
export function ClosingBand({ language = "en" }: { language?: Language }) {
  const said = endingWords[language];
  const band = useRef<HTMLDivElement>(null);
  // Where the words lie over the picture, a sheet of the page's paper holds them, as on the first screen.
  useCutHold(band, true, { art: ".neighborly-close-art", words: ".neighborly-close-words", pieces: "h2, nav a", when: "(min-width:1280px) and (min-height:445px)" });
  return <div className="neighborly-close" ref={band}>
    <picture className="neighborly-close-art">
      <source media="(max-width:700px) and (orientation:portrait), (max-width:480px)" srcSet="/assets/living-relief-mobile-accepted.webp" width={780} height={1688} />
      <source type="image/avif" srcSet="/assets/living-relief-accepted-1440.avif 1440w, /assets/living-relief-accepted-2880.avif 2880w" sizes="100vw" width={1440} height={1024} />
      <img src="/assets/living-relief-accepted.webp" width={1440} height={1024} alt="" loading="lazy" decoding="async" />
    </picture>
    {/* The open hand before the card comes back to it, cut from the opening picture, and the place the card lands. */}
    <span className="neighborly-close-hand" aria-hidden="true">
      <picture className="thread-empty">
        <source media="(max-width:700px) and (orientation:portrait), (max-width:480px)" srcSet="/assets/home/hand-empty-mobile.webp" width={170} height={165} />
        <img src="/assets/home/hand-empty.webp" width={360} height={295} alt="" loading="lazy" decoding="async" />
      </picture>
    </span>
    <div className="neighborly-close-words">
      <h2 id="together-title">{said.bring[0]}<br /><em>{said.bring[1]}</em></h2>
      <div className="neighborly-final-actions">
        <nav className="neighborly-final-links" aria-label={said.own}>
          <Link href="/app?intent=start">{said.start}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link href="/app?intent=signin">{said.signIn}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </nav>
      </div>
    </div>
    {/* After the words, as the eye and the keyboard meet them: the invitation, then the card that answers it. */}
    <CardOfferGrow said={said.card} />
  </div>;
}

/** The foot of every public page: the name set across the paper, and its quiet links. */
export function Colophon({ home = "/", language = "en" }: { home?: string; language?: Language }) {
  const said = endingWords[language];
  return <footer className="neighborly-colophon" role="contentinfo">
    <span>{said.made}</span>
    <nav aria-label={said.about}>
      <Link className="neighborly-give" href={said.weekPath}>{said.week}</Link>
      <Link className="neighborly-give" href={said.howMadePath}>{said.howMade}</Link>
      <Link className="neighborly-give" href={said.privacyPath}>{said.privacy}</Link>
      <a className="neighborly-give" href="https://github.com/sponsors/Joe-Simo" target="_blank" rel="noopener noreferrer">{said.give}<span className="sr-only"> {said.newTab}</span></a>
    </nav>
    {/* Last, as it is set: the name is the page's final line for the eye, the keyboard and a screen reader alike. */}
    <a href={home} lang="en">kind helps</a>
  </footer>;
}

/** How a public page other than the home page ends: the closing band, then the foot. */
export function PublicEnding({ language = "en" }: { language?: Language }) {
  return <div className="neighborly-continuation">
    <section className="neighborly-together" aria-labelledby="together-title">
      <div className="neighborly-together-paper" data-settled="true" aria-hidden="true" />
      <ClosingBand language={language} />
      <Colophon language={language} />
    </section>
  </div>;
}
