"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useSettled } from "@/lib/use-settled";
import "./home-yes.css";

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
    const near = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setDue(true); }, { rootMargin: "200% 0px" });
    near.observe(desk.current);
    return () => near.disconnect();
  }, []);
  useEffect(() => {
    if (!settled) return;
    const wait = setTimeout(() => setDue(true), 2000);
    return () => clearTimeout(wait);
  }, [settled]);
  return <section className="home-yes" aria-labelledby="home-yes-title">
    <div className="relief-words home-yes-words">
      <p className="home-yes-kicker">The help line · Sample</p>
      <h2 id="home-yes-title">Your turn.</h2>
      <p>The assistant drafted this request from a call note. Nothing is saved until a person says yes. Here, that person is you.</p>
    </div>
    <div className="home-yes-desk" ref={desk}>
      {/* The call note this draft was made from: the card that has come down the page, tucked behind the sheet's corner. */}
      <span className="card-station" data-station="sheet" data-turn={-7} data-tuck="-.2,-.5" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/home/card-light-480.webp" width={480} height={320} alt="" loading="lazy" decoding="async" />
      </span>
      {due && <HomeYesCard />}
    </div>
  </section>;
}
