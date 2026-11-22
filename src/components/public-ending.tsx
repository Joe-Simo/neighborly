"use client";

import { useEffect, useRef, useState } from "react";
import { useCutHold } from "./cut-hold";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CardOfferGrow } from "./card-offer-grow";
import { Colophon } from "./public-foot";
import { SampleLink } from "./sample-link";
import "./neighborly-continuation.css";
import "./thread-card.css";
import "./public-touch.css";
import "./cut-edges.css";
import type { Language } from "@/lib/words";
import { endingWords } from "./public-ending-words";
import { CutHead } from "@/components/cut-heads";

export type { CardWords } from "./public-ending-words";

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
        <img src="/assets/home/hand-empty.webp" srcSet="/assets/home/hand-empty.webp 360w, /assets/home/hand-empty-2x.webp 720w" sizes="28vw" width={360} height={295} alt="" loading="lazy" decoding="async" />
      </picture>
    </span>
    <div className="neighborly-close-words">
      <CutHead id="together-title">{said.bring[0]}<br /><em>{said.bring[1]}</em></CutHead>
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

/** How a public page other than the home page ends: the closing band, then the foot. */
export function PublicEnding({ language = "en" }: { language?: Language }) {
  // The paper is fetched as the reader nears it, a screen and more ahead, so the first screen loads alone.
  const paper = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = paper.current;
    if (!node) return;
    const watch = new IntersectionObserver(([seen]) => { if (seen?.isIntersecting) { setNear(true); watch.disconnect(); } }, { rootMargin: "150% 0px" });
    watch.observe(node);
    return () => watch.disconnect();
  }, []);
  return <div className="neighborly-continuation">
    <section className="neighborly-together" aria-labelledby="together-title">
      <div ref={paper} className="neighborly-together-paper" data-settled={near} aria-hidden="true" />
      <ClosingBand language={language} />
      <Colophon language={language} Sample={SampleLink} />
    </section>
  </div>;
}
