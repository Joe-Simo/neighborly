"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { PaintedScoreScene } from "@/lib/painted-score";

const SoundContext = createContext<{ scene: PaintedScoreScene; setScene: (scene: PaintedScoreScene) => void; cue: (scene: PaintedScoreScene) => void; onCue: (listener: (scene: PaintedScoreScene) => void) => () => void } | null>(null);
export function ExperienceSoundProvider({ children }: { children: ReactNode }) {
  const [scene, setScene] = useState<PaintedScoreScene>("opening");
  const listeners = useRef(new Set<(scene: PaintedScoreScene) => void>());
  const value = useMemo(() => ({ scene, setScene, cue: (next: PaintedScoreScene) => listeners.current.forEach(listener => listener(next)), onCue: (listener: (scene: PaintedScoreScene) => void) => { listeners.current.add(listener); return () => { listeners.current.delete(listener); }; } }), [scene]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
export function useExperienceSound() { return useContext(SoundContext); }
