"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { SAMPLE_DOOR } from "./sample-link";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettled } from "@/lib/use-settled";
import "./home-yes.css";
import { CutHead } from "@/components/cut-heads";

// The sheet is the workspace's own, with the workspace's own styles. They are fetched well clear of the first screen:
// two seconds after it has settled, or as soon as the visitor comes within two windows of this place, whichever is
// first. The page above is many windows long, so the sheet is on the desk before anyone reaches it.
const HomeYesCard = dynamic(() => import("./home-yes-card").then(module => module.HomeYesCard), { ssr: false });

/** The one place on the page where the visitor does a volunteer's work: a drafted request waits for their yes. */
export function HomeYes() {
  const settled = useSettled();
  const [due, setDue] = useState(false);
  const desk = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!desk.current || !("IntersectionObserver" in window)) return setDue(true);
    const near = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setDue(true); }, { rootMargin: "300% 0px" });
    near.observe(desk.current);
    return () => near.disconnect();
  }, []);
  useEffect(() => {
    if (!settled) return;
    // The sheet's code is fetched as soon as the page is still, so that wherever it is called it is set down in the same frame:
    // it takes more room than the desk holds for it at most widths, and set down late, it moved the year (and the card bound for it) mid-flight.
    void import("./home-yes-card");
    const wait = setTimeout(() => setDue(true), 2000);
    return () => clearTimeout(wait);
  }, [settled]);
  return <section className="home-yes" aria-labelledby="home-yes-title">
    <div className="relief-words home-yes-words">
      <p className="home-yes-kicker">The help line · Sample</p>
      <CutHead id="home-yes-title">Your turn.</CutHead>
      <p>On the help line, a request waits for a person. Here, that person is you.</p>
    </div>
    <div className="home-yes-desk" ref={desk}>
      {/* The call note this draft was made from: the card that has come down the page, tucked behind the sheet's corner. */}
      <span className="card-station" data-station="sheet" data-turn={-7} data-tuck="-.2,-.5" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/home/card-light-480.webp" width={480} height={320} alt="" loading="lazy" decoding="async" />
      </span>
      {due && <HomeYesCard />}
      {/* Without script the sheet cannot be fetched or answered. It lies here at rest, whole, in the same words, and its one way on is a plain link. */}
      <noscript>
        <div className="home-yes-still">
          <p className="home-yes-still-label">Waiting for your yes</p>
          <p className="home-yes-still-from"><strong>Rosa Fontaine</strong> called yesterday</p>
          <h3>Rent, $450 to Mill&nbsp;Road&nbsp;Rentals</h3>
          <p className="home-yes-still-quote">“Behind on November rent, $450. The landlord is Mill&nbsp;Road&nbsp;Rentals.”</p>
          <p>From the message taken at 10:20 AM. Not yet on file as a neighbor.</p>
          <Button asChild className="home-yes-still-in"><Link href={SAMPLE_DOOR} prefetch={false}>Look around a sample conference</Link></Button>
          <p className="home-yes-still-foot"><Sparkles size={16} aria-hidden="true" />Filled in from the call note; the assistant checked the kind of help and what kind of payee it is.</p>
        </div>
      </noscript>
    </div>
  </section>;
}
