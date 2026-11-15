"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExperienceSound } from "./experience-sound-context";
import { createPaintedScore, type PaintedScoreScene } from "@/lib/painted-score";

export function PaintedScoreControl({ scene, active = true, className = "" }: {
  scene: PaintedScoreScene;
  active?: boolean;
  className?: string;
}) {
  const sound = useExperienceSound();
  const score = useRef<ReturnType<typeof createPaintedScore> | null>(null);
  const currentScene = useRef(scene);
  const enabledRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { currentScene.current = scene; score.current?.setScene(scene, { cue: !sound }); }, [scene, sound]);
  useEffect(() => sound?.onCue(next => score.current?.cue(next)), [sound]);
  useEffect(() => {
    const visibility = () => {
      if (!enabledRef.current || !score.current) return;
      if (document.hidden || !active) void score.current.suspend();
      else void score.current.start().catch(() => {
        score.current?.dispose(); score.current = null; enabledRef.current = false;
        setEnabled(false); setUnavailable(true);
      });
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [active]);
  useEffect(() => () => { enabledRef.current = false; score.current?.dispose(); score.current = null; }, []);
  const toggle = async () => {
    if (score.current) {
      enabledRef.current = false; score.current.dispose(); score.current = null; setEnabled(false);
      return;
    }
    setStarting(true);
    try {
      const next = createPaintedScore(currentScene.current);
      score.current = next;
      await next.start();
      if (score.current === next) { enabledRef.current = true; setEnabled(true); }
    } catch {
      score.current?.dispose(); score.current = null;
      enabledRef.current = false; setUnavailable(true);
    } finally { setStarting(false); }
  };
  return <Button variant="ghost" className={className} style={{ minWidth: 44, minHeight: 44 }} onClick={() => void toggle()} disabled={starting || unavailable} aria-pressed={enabled} aria-label={unavailable ? "Sound unavailable" : enabled ? "Sound on — turn music off" : "Sound off — turn music on"}>
    {enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
    <span>{unavailable ? "Sound unavailable" : starting ? "Starting sound" : enabled ? "Sound on" : "Sound off"}</span>
  </Button>;
}
