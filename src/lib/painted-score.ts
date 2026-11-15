export type PaintedScoreScene = "opening" | "meal" | "visit" | "welcome" | "complete";

type Voice = { source: AudioScheduledSourceNode; end: number };
const beatSeconds = 0.75;
const sceneOrder: Record<PaintedScoreScene, number> = {
  opening: 0, meal: 1, visit: 2, welcome: 3, complete: 4,
};
// Let the longest scene accent decay before another can begin.
const cueCooldownSeconds = 4;
// An original eight-bar phrase. Each scene changes orchestration, never restarts the bar.
const roots = [50, 46, 53, 48, 50, 46, 55, 57] as const;
const melody = [0, 7, 12, 16, 14, 12, 7, 4, 0, 7, 9, 12, 7, 4, 2, 7] as const;
const palettes: Record<PaintedScoreScene, { piano: number; strings: number; cutoff: number; octave: number }> = {
  opening: { piano: 0.7, strings: 0.4, cutoff: 1250, octave: 0 },
  meal: { piano: 0.95, strings: 0.48, cutoff: 1600, octave: 0 },
  visit: { piano: 0.72, strings: 0.62, cutoff: 1350, octave: 0 },
  welcome: { piano: 0.9, strings: 0.83, cutoff: 2100, octave: 12 },
  complete: { piano: 0.78, strings: 0.7, cutoff: 1800, octave: 0 },
};
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Original restrained score; all sound is synthesized locally after listener activation. */
export function createPaintedScore(initialScene: PaintedScoreScene = "opening") {
  if (typeof AudioContext === "undefined") throw new Error("Audio is unavailable in this browser.");
  const context = new AudioContext();
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  const pianoBus = context.createGain();
  const stringBus = context.createGain();
  const room = context.createConvolver();
  const wet = context.createGain();
  const compressor = context.createDynamicsCompressor();
  master.gain.value = 0;
  filter.type = "lowpass";
  filter.frequency.value = palettes[initialScene].cutoff;
  filter.Q.value = 0.25;
  pianoBus.gain.value = palettes[initialScene].piano;
  stringBus.gain.value = palettes[initialScene].strings;
  wet.gain.value = 0.27;
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 2;
  compressor.attack.value = 0.025;
  compressor.release.value = 0.45;
  pianoBus.connect(filter); stringBus.connect(filter);
  filter.connect(master); filter.connect(room); room.connect(wet); wet.connect(master);
  master.connect(compressor).connect(context.destination);
  const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 2.8), context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel);
    let seed = 1439 + channel * 887;
    for (let index = 0; index < samples.length; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const seconds = index / context.sampleRate;
      samples[index] = (seed / 2147483648 - 1) * Math.exp(-seconds * 2.5) * (seconds < 0.028 ? 0 : 0.3);
    }
  }
  room.buffer = impulse;
  // Courtyard air: a low breeze that rises under the music once the visitor is inside.
  const air = context.createBufferSource();
  const airTone = context.createBiquadFilter();
  const airBus = context.createGain();
  const airBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 3), context.sampleRate);
  const airSamples = airBuffer.getChannelData(0);
  let airSeed = 2203;
  for (let index = 0; index < airSamples.length; index++) {
    airSeed = (airSeed * 1664525 + 1013904223) >>> 0;
    airSamples[index] = airSeed / 2147483648 - 1;
  }
  air.buffer = airBuffer; air.loop = true;
  airTone.type = "lowpass"; airTone.frequency.value = 420; airTone.Q.value = 0.2;
  airBus.gain.value = 0;
  air.connect(airTone).connect(airBus).connect(master);
  air.start();
  let scene = initialScene;
  let disposed = false;
  let playing = false;
  let lastCueAt = -Infinity;
  let step = 0;
  let nextNote = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  let settleSuspend: (() => void) | undefined;
  let lifecycle = 0;
  let contextOperation: Promise<void> = Promise.resolve();
  function cancelSuspend() {
    clearTimeout(suspendTimer); suspendTimer = undefined;
    settleSuspend?.(); settleSuspend = undefined;
  }
  const voices = new Set<Voice>([{ source: air, end: Infinity }]);
  const nodes = new Set<AudioNode>([master, filter, pianoBus, stringBus, room, wet, compressor, air, airTone, airBus]);

  const tone = (midi: number, start: number, length: number, level: number, bus: AudioNode, pan: number, instrument: "piano" | "string") => {
    if (disposed) return;
    const envelope = context.createGain();
    const stereo = context.createStereoPanner();
    nodes.add(envelope); nodes.add(stereo);
    stereo.pan.value = pan;
    envelope.connect(stereo).connect(bus);
    envelope.gain.setValueAtTime(0.0001, start);
    if (instrument === "piano") {
      envelope.gain.exponentialRampToValueAtTime(level, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(level * 0.3, start + 0.48);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    } else {
      envelope.gain.linearRampToValueAtTime(level, start + 1.2);
      envelope.gain.setValueAtTime(level, start + Math.max(1.3, length - 1.8));
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    }
    const partials = instrument === "piano" ? [1, 2.002, 3.005, 4.013] : [0.999, 1.0015, 2, 3];
    let remaining = partials.length;
    partials.forEach((partial, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      nodes.add(oscillator); nodes.add(gain);
      oscillator.type = "sine";
      oscillator.frequency.value = frequency(midi) * partial;
      gain.gain.value = instrument === "piano" ? [0.75, 0.14, 0.055, 0.018][index] : [0.35, 0.35, 0.09, 0.035][index];
      oscillator.connect(gain).connect(envelope);
      const voice = { source: oscillator, end: start + length + 0.03 };
      voices.add(voice);
      oscillator.onended = () => {
        voices.delete(voice); oscillator.disconnect(); gain.disconnect();
        nodes.delete(oscillator); nodes.delete(gain);
        if (--remaining === 0) { envelope.disconnect(); stereo.disconnect(); nodes.delete(envelope); nodes.delete(stereo); }
      };
      oscillator.start(start); oscillator.stop(voice.end);
    });
  };

  const texture = (start: number, length: number, level: number, cutoff: number, pan: number) => {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 379;
    for (let index = 0; index < samples.length; index++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      samples[index] = seed / 2147483648 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const toneFilter = context.createBiquadFilter();
    toneFilter.type = "lowpass"; toneFilter.frequency.value = cutoff;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + Math.min(0.05, length / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    const stereo = context.createStereoPanner(); stereo.pan.value = pan;
    source.connect(toneFilter).connect(envelope).connect(stereo).connect(filter);
    [source, toneFilter, envelope, stereo].forEach((node) => nodes.add(node));
    const voice = { source, end: start + length };
    voices.add(voice);
    source.onended = () => {
      voices.delete(voice);
      [source, toneFilter, envelope, stereo].forEach((node) => { node.disconnect(); nodes.delete(node); });
    };
    source.start(start); source.stop(voice.end);
  };

  const foley = (kind: PaintedScoreScene) => {
    if (!playing || disposed) return;
    const now = context.currentTime + 0.04;
    if (kind === "meal") {
      // A quiet ceramic resonance, not a notification chime.
      texture(now + 0.13, 0.62, 0.012, 850, -0.2);
      tone(81, now, 0.65, 0.018, pianoBus, 0.35, "piano");
      tone(88, now + 0.045, 0.42, 0.006, pianoBus, 0.32, "piano");
    } else if (kind === "visit") {
      // Muted low wooden resonance accompanying the doorway.
      [0, 0.42, 0.83].forEach((offset, index) => texture(now + offset, 0.15, 0.018, 220, index % 2 ? 0.15 : -0.15));
      tone(38, now, 0.35, 0.035, pianoBus, -0.2, "piano");
      tone(45, now + 0.32, 0.38, 0.023, pianoBus, -0.1, "piano");
    } else if (kind === "welcome") {
      texture(now, 1.8, 0.006, 700, 0);
      tone(74, now, 3.4, 0.022, pianoBus, -0.35, "piano");
      tone(81, now + 0.13, 3.8, 0.012, pianoBus, 0.35, "piano");
    }
  };
  const door = () => {
    // Two leaves of old wood giving way, then the latch settling.
    // It shares the cue cooldown so scrolling back and forth never stacks accents.
    if (!playing || disposed || context.currentTime - lastCueAt < cueCooldownSeconds) return;
    lastCueAt = context.currentTime;
    const now = context.currentTime + 0.04;
    texture(now, 0.9, 0.02, 180, -0.25);
    texture(now + 0.12, 1, 0.018, 160, 0.25);
    tone(36, now, 0.9, 0.03, pianoBus, 0, "piano");
    texture(now + 1.05, 0.12, 0.014, 900, 0.1);
  };
  const cue = (kind: PaintedScoreScene) => {
    if (disposed || !playing || (kind !== "meal" && kind !== "visit" && kind !== "welcome")) return;
    const now = context.currentTime;
    if (now - lastCueAt < cueCooldownSeconds) return;
    lastCueAt = now;
    foley(kind);
  };
  const schedule = () => {
    if (!playing || disposed) return;
    const now = context.currentTime;
    while (nextNote < now + 0.18) {
      const bar = Math.floor(step / 8) % roots.length;
      const root = roots[bar];
      if (step % 8 === 0) {
        airBus.gain.setTargetAtTime(scene === "opening" ? 0 : 0.017 + 0.009 * Math.sin(step * 0.21), nextNote, 2.4);
        tone(root - 12, nextNote, 6.3, 0.045, stringBus, 0, "string");
        tone(root + 7, nextNote, 6.6, 0.02, stringBus, -0.4, "string");
        tone(root + 12, nextNote + 0.06, 6.7, 0.017, stringBus, 0.4, "string");
      }
      // Spaces in the melody keep room for the story and its gestures.
      if (step % 8 !== 5 && step % 8 !== 7) {
        const note = root + 12 + melody[step % melody.length] + palettes[scene].octave;
        tone(note, nextNote, 2.7, step % 4 === 0 ? 0.075 : 0.04, pianoBus, Math.sin(step * 0.7) * 0.3, "piano");
      }
      nextNote += beatSeconds;
      step++;
    }
    timer = setTimeout(schedule, 90);
  };
  return {
    async start() {
      if (disposed) throw new Error("This score has been disposed.");
      const revision = ++lifecycle;
      cancelSuspend();
      contextOperation = contextOperation.catch(() => {}).then(async () => {
        if (!disposed && revision === lifecycle) await context.resume();
      });
      await contextOperation;
      if (disposed || revision !== lifecycle) return;
      master.gain.cancelScheduledValues(context.currentTime);
      // Measured at the output, 0.48 left the whole score near -44 dBFS RMS, too quiet to hear at an ordinary volume.
      master.gain.setTargetAtTime(1.9, context.currentTime, 0.6);
      if (playing) return;
      playing = true;
      nextNote = context.currentTime + 0.06;
      schedule();
    },
    cue,
    setScene(next: PaintedScoreScene, options: { cue?: boolean } = {}) {
      if (disposed || scene === next) return;
      const movingForward = sceneOrder[next] > sceneOrder[scene];
      const entering = scene === "opening";
      scene = next;
      if (entering) door();
      const palette = palettes[next];
      const now = context.currentTime;
      pianoBus.gain.setTargetAtTime(palette.piano, now, 1.4);
      stringBus.gain.setTargetAtTime(palette.strings, now, 1.8);
      filter.frequency.setTargetAtTime(palette.cutoff, now, 1.6);
      if (movingForward && options.cue !== false) cue(next);
    },
    async suspend() {
      if (disposed) return;
      const revision = ++lifecycle;
      cancelSuspend();
      playing = false;
      clearTimeout(timer);
      master.gain.setTargetAtTime(0.0001, context.currentTime, 0.055);
      await new Promise<void>((resolve) => {
        const settle = () => { if (settleSuspend === settle) settleSuspend = undefined; resolve(); };
        settleSuspend = settle;
        suspendTimer = setTimeout(() => {
          suspendTimer = undefined;
          contextOperation = contextOperation.catch(() => {}).then(async () => {
            if (!disposed && revision === lifecycle) await context.suspend();
          });
          void contextOperation.then(settle, settle);
        }, 180);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true; playing = false; ++lifecycle;
      clearTimeout(timer); cancelSuspend();
      voices.forEach(({ source }) => { try { source.stop(); } catch { /* Already ended. */ } });
      voices.clear();
      nodes.forEach((node) => node.disconnect()); nodes.clear();
      void context.close();
    },
  };
}
