"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

// An original, quiet harmonic bed. It has no network assets and starts only
// from the listener's button press; the browser owns its audio clock.
const harmonies = [
  [146.83, 220, 277.18, 329.63],
  [123.47, 185, 246.94, 293.66],
  [98, 196, 246.94, 293.66],
  [110, 220, 293.66, 369.99],
];

function createSoundscape() {
  const context = new AudioContext();
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 720;
  filter.Q.value = 0.35;
  master.gain.value = 0;
  filter.connect(master).connect(context.destination);
  const voices = harmonies[0].map((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index % 2 ? 3 : -3;
    gain.gain.value = index === 0 ? 0.42 : 0.23;
    oscillator.connect(gain).connect(filter);
    oscillator.start();
    return oscillator;
  });
  let chord = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const schedule = () => {
    timer = setTimeout(() => {
      if (closed || document.hidden) return;
      chord = (chord + 1) % harmonies.length;
      voices.forEach((voice, index) => {
        voice.frequency.setTargetAtTime(harmonies[chord][index], context.currentTime, 2.8);
      });
      schedule();
    }, 16000);
  };
  return {
    async resume() {
      if (closed) return;
      await context.resume();
      if (closed) return;
      master.gain.setTargetAtTime(0.055, context.currentTime, 1.4);
      clearTimeout(timer);
      schedule();
    },
    suspend() {
      clearTimeout(timer);
      if (!closed) void context.suspend();
    },
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0, now, 0.08);
      voices.forEach((voice) => voice.stop(now + 0.4));
      timer = setTimeout(() => void context.close(), 450);
    },
  };
}

export function AmbientSound({ active }: { active: boolean }) {
  const sound = useRef<ReturnType<typeof createSoundscape> | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden || !active) sound.current?.suspend();
      else void sound.current?.resume().catch(() => {
        sound.current?.close();
        sound.current = null;
        setEnabled(false);
        setUnavailable(true);
      });
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active]);
  useEffect(() => () => {
    sound.current?.close();
    sound.current = null;
  }, []);
  const toggle = async () => {
    if (sound.current) {
      sound.current.close();
      sound.current = null;
      setEnabled(false);
      return;
    }
    setStarting(true);
    try {
      const next = createSoundscape();
      sound.current = next;
      await next.resume();
      if (sound.current === next) setEnabled(true);
    } catch {
      sound.current?.close();
      sound.current = null;
      setUnavailable(true);
    } finally {
      setStarting(false);
    }
  };
  return <Button className="ambient-sound" data-on={enabled} variant="ghost" onClick={() => void toggle()} disabled={starting || unavailable} aria-pressed={enabled} aria-label={unavailable ? "Sound unavailable" : enabled ? "Sound on — turn ambient sound off" : "Sound off — turn ambient sound on"}>
    {enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
    {unavailable ? "Sound unavailable" : enabled ? "Sound on" : "Sound off"}
  </Button>;
}
