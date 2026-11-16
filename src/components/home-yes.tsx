"use client";

import dynamic from "next/dynamic";
import { useSettled } from "@/lib/use-settled";
import "./home-yes.css";

// The sheet is the workspace's own, with the workspace's own styles. They are fetched once the first screen has
// settled, long before anyone has scrolled this far, so the opening pays nothing for them.
const HomeYesCard = dynamic(() => import("./home-yes-card").then(module => module.HomeYesCard), { ssr: false });

/** The one place on the page where the visitor does a volunteer's work: a drafted request waits for their yes. */
export function HomeYes({ place = "own" }: { place?: "own" | "column" }) {
  const settled = useSettled();
  if (place === "column") return <div className="home-yes-column"><p className="home-yes-kicker">The help line · Sample</p><div className="home-yes-desk">{settled && <HomeYesCard />}</div></div>;
  return <section className="home-yes" aria-labelledby="home-yes-title">
    <div className="relief-words home-yes-words">
      <p className="home-yes-kicker">The help line · Sample</p>
      <h2 id="home-yes-title">Your turn.</h2>
      <p>The assistant drafted this request from a call note. Nothing is saved until a person says yes. Here, that person is you.</p>
    </div>
    <div className="home-yes-desk">{settled && <HomeYesCard />}</div>
  </section>;
}
