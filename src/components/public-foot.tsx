import Link from "next/link";
import { SampleLink } from "./sample-link";
import { endingWords } from "./public-ending-words";
import "./neighborly-continuation.css";
import "./public-touch.css";
import type { Language } from "@/lib/words";

/**
 * The foot of every public page, one and the same on the home page, the pages of words, the 404 and (as plain HTML) /help and /ayuda:
 * the promise, the four ways on, and the name set across the paper. Nothing else.
 */
export function Colophon({ home = "/", language = "en" }: { home?: string; language?: Language }) {
  const said = endingWords[language];
  return <footer className="neighborly-colophon">
    <span><em>{said.free[0]}</em>{said.free[1]}</span>
    <nav aria-label={said.about}>
      <SampleLink className="neighborly-give">{said.sample}</SampleLink>
      <Link className="neighborly-give" href={said.howMadePath}>{said.howMade}</Link>
      <Link className="neighborly-give" href={said.accessPath}>{said.access}</Link>
      <Link className="neighborly-give" href={said.privacyPath}>{said.privacy}</Link>
    </nav>
    {/* Last, as it is set: the name is the page's final line for the eye, the keyboard and a screen reader alike. */}
    <a href={home} lang="en">kind helps</a>
  </footer>;
}

