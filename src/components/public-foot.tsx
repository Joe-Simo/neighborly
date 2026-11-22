import Link from "next/link";
import { SAMPLE_DOOR } from "@/lib/sample-door";
import { endingWords } from "./public-ending-words";
import "./neighborly-continuation.css";
import "./public-touch.css";
import type { ComponentType, ReactNode } from "react";
import type { Language } from "@/lib/words";

/**
 * The foot of every public page, one and the same on the home page, the pages of words, the 404 and (as plain HTML) /help and /ayuda:
 * the promise, the five ways on, and the name set across the paper. Nothing else.
 */
type SampleWay = ComponentType<{ className: string; children: ReactNode }>;
const PlainSample: SampleWay = (props) => <Link {...props} href={SAMPLE_DOOR} />;

/**
 * `Sample` is the link into the sample: an ordinary one unless the page hands in SampleLink. The 404 is in every route's
 * first load, so it keeps the plain link and does not carry the sign-in warming and the backend's client with it.
 */
export function Colophon({ home = "/", language = "en", Sample = PlainSample }: { home?: string; language?: Language; Sample?: SampleWay }) {
  const said = endingWords[language];
  return <footer className="neighborly-colophon">
    <span><em>{said.free[0]}</em>{said.free[1]}</span>
    <nav aria-label={said.about}>
      <Sample className="neighborly-give">{said.sample}</Sample>
      <Link className="neighborly-give" href={said.howMadePath}>{said.howMade}</Link>
      <Link className="neighborly-give" href={said.accessPath}>{said.access}</Link>
      <Link className="neighborly-give" href={said.privacyPath}>{said.privacy}</Link>
      <a className="neighborly-give" href="https://github.com/sponsors/Joe-Simo" target="_blank" rel="noopener noreferrer">{said.give}<span className="sr-only"> {said.newTab}</span></a>
    </nav>
    {/* Last, as it is set: the name is the page's final line for the eye, the keyboard and a screen reader alike. */}
    <a href={home} lang="en">kind helps</a>
  </footer>;
}

