import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./neighborly-continuation.css";

/** The picture every public page closes on: the same two people, the card now resting in the open hand. */
export function ClosingBand() {
  return <div className="neighborly-close">
    <picture className="neighborly-close-art">
      <source media="(max-width:700px) and (orientation:portrait)" srcSet="/assets/living-relief-mobile-accepted.webp" width={780} height={1688} />
      <img src="/assets/living-relief-accepted.webp" width={1440} height={1024} alt="" loading="lazy" decoding="async" />
    </picture>
    <div className="neighborly-close-words">
      <h2 id="together-title">Bring this to<br /><em>your people.</em></h2>
      <div className="neighborly-final-actions">
        <Button asChild className="neighborly-begin"><Link href="/app?intent=sample">Look around a sample conference<ArrowUpRight aria-hidden="true" /></Link></Button>
        <nav className="neighborly-final-links" aria-label="Your own conference">
          <Link href="/app?intent=start">Start your conference<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link href="/app?intent=signin">Sign in<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </nav>
        <small>Every person in the sample is made up.</small>
      </div>
    </div>
  </div>;
}

/** The foot of every public page: the name set across the paper, and the two quiet links. */
export function Colophon({ home = "/" }: { home?: string }) {
  return <footer className="neighborly-colophon">
    <a href={home}>kind helps</a>
    <span>Made for the good we can do.</span>
    <nav aria-label="About Kind Helps">
      <Link className="neighborly-give" href="/privacy">Privacy</Link>
      <a className="neighborly-give" href="https://github.com/sponsors/Joe-Simo" target="_blank" rel="noopener noreferrer">Give a gift</a>
    </nav>
  </footer>;
}

/** How a public page other than the home page ends: the closing band, then the foot. */
export function PublicEnding() {
  return <div className="neighborly-continuation">
    <section className="neighborly-together" aria-labelledby="together-title">
      <div className="neighborly-together-paper" data-settled="true" aria-hidden="true" />
      <ClosingBand />
      <Colophon />
    </section>
  </div>;
}
