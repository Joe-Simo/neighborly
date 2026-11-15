"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientSound } from "@/components/ambient-sound";
import type { createSanctuaryScene } from "@/lib/sanctuary-scene";
import "./sanctuary-experience.css";

type Scene = ReturnType<typeof createSanctuaryScene>;
type Act = "threshold" | "invitation" | "offering" | "together";

export function SanctuaryExperience() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const [act, setAct] = useState<Act>("threshold");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let disposed = false;
    let active: Scene | undefined;
    void import("@/lib/sanctuary-scene").then(({ createSanctuaryScene }) => {
      if (disposed || !host.current) return;
      active = createSanctuaryScene(host.current, {
        onReady: () => { if (!disposed) setReady(true); },
        onOffer: () => { if (!disposed) setAct("offering"); },
        onError: () => { if (!disposed) setFailed(true); },
      });
      scene.current = active;
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; active?.dispose(); scene.current = null; };
  }, []);

  useEffect(() => {
    scene.current?.setProgress(act === "threshold" ? 0 : act === "invitation" ? 0.56 : 1);
    scene.current?.setCare(act === "offering" || act === "together" ? 1 : 0);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (act === "offering") setAct("together");
    }, reduced ? 0 : act === "offering" ? 3400 : 1800);
    return () => window.clearTimeout(timer);
  }, [act, ready]);

  const advance = () => {
    setAct(act === "threshold" ? "invitation" : "offering");
  };
  const restart = () => { setAct("threshold"); };

  return <main className="sanctuary-experience" data-act={act} data-ready={ready} data-failed={failed}>
    <div ref={host} className="sanctuary-canvas" aria-hidden="true" />
    <div className="sanctuary-painting" aria-hidden="true" />
    <div className="sanctuary-shade" aria-hidden="true" />
    <header className="sanctuary-header">
      <Link href="/" className="sanctuary-brand" aria-label="Neighborly home">neighborly</Link>
      <Link href="/app" className="sanctuary-skip">Open Neighborly <ArrowRight size={14} aria-hidden="true" /></Link>
    </header>
    <div className="sanctuary-caption" aria-hidden="true">For churches &amp; communities</div>
    <section className="sanctuary-story" aria-live="polite" aria-atomic="true">
      <div className="sanctuary-copy" key={act}>
        <p className="sanctuary-eyebrow">{act === "threshold" ? "A place for willing hands" : act === "invitation" ? "It begins with one person" : act === "offering" ? "A little time, freely given" : "Good work, together"}</p>
        <h1 ref={heading}>{act === "threshold" ? <>Good things begin<br />with <em>an open hand.</em></> : act === "invitation" ? <>What could grow<br />from <em>a little time?</em></> : act === "offering" ? <>One small yes.<br /><em>A little more light.</em></> : <>A place for you.<br /><em>And what you give.</em></>}</h1>
        <p className="sanctuary-description">{act === "threshold" ? "A story about the space we make for one another." : act === "invitation" ? "A welcome. A meal. A lift home. A little time can mean a great deal." : act === "offering" ? "What one person offers can reach further when others join them." : "Bring your church or community together around the things that matter to you."}</p>
      </div>
      <div className="sanctuary-actions">
        {act === "invitation" && <p className="sanctuary-gesture">Move the invitation into the circle.</p>}
        {act === "threshold" || act === "invitation" ? <Button variant="ghost" className="sanctuary-action" onClick={advance} disabled={!ready}>
          <span>{failed ? "The scene could not load" : !ready ? "Opening the scene" : act === "threshold" ? "Step inside" : "Offer a little time"}</span><span className="sanctuary-action-arrow"><ArrowRight aria-hidden="true" /></span>
        </Button> : act === "together" ? <><Button asChild variant="ghost" className="sanctuary-action"><Link href="/app?intent=start"><span>Bring your people together</span><span className="sanctuary-action-arrow"><ArrowRight aria-hidden="true" /></span></Link></Button><Link href="/app?intent=join" className="sanctuary-join">Join your people</Link></> : <p className="sanctuary-breath">One offer. Many possibilities.</p>}
        {failed && <Link href="/app" className="sanctuary-join">Continue to Neighborly</Link>}
      </div>
    </section>
    <footer className="sanctuary-footer">
      <AmbientSound active />
      <p>The Neighborly story <span aria-hidden="true">/</span> {act === "threshold" ? "01" : act === "invitation" ? "02" : "03"}</p>
      {act !== "threshold" ? <Button variant="ghost" className="sanctuary-restart" onClick={restart} aria-label="Return to the beginning"><RotateCcw size={15} aria-hidden="true" /><span>Begin again</span></Button> : <span className="sanctuary-footer-note">Move gently. Explore the light.</span>}
    </footer>
  </main>;
}
