"use client";

import { useEffect, useRef } from "react";
import { getDepthEntryFrame } from "@/lib/depth-entry";
import { PaintedWorld } from "./painted-world";
import { DoorwayDepthStudy } from "./doorway-depth-study";
import { NeighborlyContinuation } from "./neighborly-continuation";
import { ExperienceSoundProvider } from "./experience-sound-context";

export function DepthExperienceCandidate({ architecture = false, spatialChair = false }: { architecture?: boolean; spatialChair?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const track = container.querySelector<HTMLElement>(".threshold-journey");
    const stage = container.querySelector<HTMLElement>(".doorway-depth-stage");
    const courtyard = container.querySelector<HTMLElement>(".threshold-experience");
    if (!track || !stage) return;
    let frame = 0;
    const initialValue = track.style.getPropertyValue("--depth-handoff");
    let lastValue = "";
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (frame || document.hidden) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // Match the actual stable-height sticky stage, not Safari's moving address bar.
        const stageHeight = stage.getBoundingClientRect().height;
        if (!stageHeight) return;
        const entry = getDepthEntryFrame(-track.getBoundingClientRect().top / stageHeight, media.matches);
        if (courtyard) courtyard.inert = entry.handoff === 0;
        const value = String(entry.handoff);
        if (value !== lastValue) { lastValue = value; track.style.setProperty("--depth-handoff", value); }
      });
    };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else update();
    };
    const observer = new ResizeObserver(update); observer.observe(track); observer.observe(stage);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    update();
    return () => {
      observer.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", update);
      media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility);
      cancelAnimationFrame(frame);
      if (courtyard) courtyard.inert = false;
      if (initialValue) track.style.setProperty("--depth-handoff", initialValue);
      else track.style.removeProperty("--depth-handoff");
    };
  }, []);
  return <div ref={root} className="depth-experience-candidate">
    <noscript><style>{`
      .depth-experience-candidate .doorway-depth-study { display: none !important; }
      .depth-experience-candidate .neighborly-continuation { margin-top: 0 !important; }
      .depth-experience-candidate .threshold-experience { opacity: 1 !important; }
    `}</style></noscript>
    <ExperienceSoundProvider><PaintedWorld heroOnly suspendOffscreen><DoorwayDepthStudy embedded architecture={architecture} /><NeighborlyContinuation courtyardOnly spatialChair={spatialChair} interior={architecture} /></PaintedWorld></ExperienceSoundProvider></div>;
}
