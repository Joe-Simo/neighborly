import type { Metadata } from "next";
import Link from "next/link";
import "@/components/not-found.css";

export const metadata: Metadata = {
  title: "Page not found — Kind Helps",
  description: "The address may be old or mistyped. Kind Helps is at kindhelps.com.",
  robots: { index: false, follow: false },
};

/** The courtyard's doors, closed: the one place on the site they do not open onto anything. */
export default function NotFound() {
  return <main className="lost-door">
    <Link className="lost-door-brand" href="/" aria-label="Kind Helps home">kind helps</Link>
    <div className="lost-door-words">
      <h1>This door doesn’t lead anywhere.</h1>
      <Link href="/">Back to kind helps</Link>
    </div>
    <div className="lost-door-frame" aria-hidden="true">
      <div className="lost-door-light" />
      <div className="lost-door-leaves"><i /><i /></div>
    </div>
  </main>;
}
