import { expect, test } from "bun:test";
import { createPaintedScore } from "./painted-score";

class Param {
  value = 0;
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
  setTargetAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param(); pan = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  type = ""; buffer: unknown; onended: (() => void) | null = null; disconnected = false; stopped = false;
  connect(node: Node) { return node; }
  disconnect() { this.disconnected = true; }
  start() {}
  stop() { this.stopped = true; }
}
class Context {
  static latest: Context;
  sampleRate = 16; currentTime = 0; destination = new Node(); resumed = false; closed = false;
  nodes: Node[] = [];
  bufferSources = 0;
  constructor() { Context.latest = this; }
  node() { const node = new Node(); this.nodes.push(node); return node; }
  createGain() { return this.node(); }
  createBiquadFilter() { return this.node(); }
  createConvolver() { return this.node(); }
  createDynamicsCompressor() { return this.node(); }
  createStereoPanner() { return this.node(); }
  createOscillator() { return this.node(); }
  createBufferSource() { this.bufferSources++; return this.node(); }
  createBuffer(channels: number, length: number) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: (channel: number) => data[channel] }; }
  async resume() { this.resumed = true; }
  async suspend() {}
  async close() { this.closed = true; }
}

test("score stays silent until started and fully releases its audio graph", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Context });
  try {
    const score = createPaintedScore();
    const context = Context.latest;
    expect(context.resumed).toBe(false);
    score.setScene("meal");
    expect(context.nodes.some((node) => node.stopped)).toBe(false);
    await score.start();
    expect(context.resumed).toBe(true);
    score.setScene("visit");
    score.setScene("welcome");
    score.dispose();
    expect(context.closed).toBe(true);
    expect(context.nodes.every((node) => node.disconnected)).toBe(true);
    score.dispose();
    await expect(score.start()).rejects.toThrow("disposed");
  } finally {
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("unsupported audio fails explicitly without starting a scheduler", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Reflect.deleteProperty(globalThis, "AudioContext");
  try { expect(() => createPaintedScore()).toThrow("unavailable"); }
  finally { if (original) Object.defineProperty(globalThis, "AudioContext", original); }
});


test("scene effects follow forward travel without stacking on scroll reversals", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Context });
  const score = createPaintedScore();
  try {
    const context = Context.latest;
    await score.start();
    score.setScene("meal");
    expect(context.bufferSources).toBe(4);
    context.currentTime = 1;
    score.setScene("opening");
    score.setScene("meal");
    score.setScene("visit");
    score.setScene("welcome");
    expect(context.bufferSources).toBe(4);
    context.currentTime = 5;
    score.setScene("visit");
    expect(context.bufferSources).toBe(4);
    score.setScene("welcome");
    expect(context.bufferSources).toBe(5);
    context.currentTime = 10;
    score.setScene("complete");
    score.setScene("opening");
    score.setScene("visit");
    expect(context.bufferSources).toBe(8);
  } finally {
    score.dispose();
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});


test("explicit care cues stay silent before activation and share a bounded cooldown", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Context });
  const score = createPaintedScore();
  try {
    const context = Context.latest;
    score.cue("meal");
    score.setScene("visit", { cue: false });
    expect(context.bufferSources).toBe(1);
    await score.start();
    score.setScene("welcome", { cue: false });
    expect(context.bufferSources).toBe(1);
    score.cue("meal");
    expect(context.bufferSources).toBe(2);
    context.currentTime = 3.99;
    score.cue("visit");
    expect(context.bufferSources).toBe(2);
    context.currentTime = 4;
    score.cue("visit");
    expect(context.bufferSources).toBe(5);
    score.cue("welcome");
    expect(context.bufferSources).toBe(5);
    context.currentTime = 8;
    score.setScene("opening");
    score.setScene("welcome");
    expect(context.bufferSources).toBe(8);
    score.dispose();
    context.currentTime = 12;
    score.cue("meal");
    expect(context.bufferSources).toBe(8);
  } finally {
    score.dispose();
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});


test("restart and disposal settle cancelled suspension promises", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Context });
  const score = createPaintedScore();
  try {
    await score.start();
    const suspension = score.suspend();
    await score.start();
    await suspension;
    const secondSuspension = score.suspend();
    score.dispose();
    await secondSuspension;
    expect(Context.latest.closed).toBe(true);
  } finally {
    score.dispose();
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("a late suspension finishes before a newer resume and cannot mute it afterward", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  let finishSuspend: (() => void) | undefined;
  const operations: string[] = [];
  class DelayedContext extends Context {
    async resume() { operations.push("resume"); }
    async suspend() { operations.push("suspend"); await new Promise<void>(resolve => { finishSuspend = resolve; }); operations.push("suspended"); }
  }
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: DelayedContext });
  const score = createPaintedScore();
  try {
    await score.start();
    const suspension = score.suspend();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(operations).toEqual(["resume", "suspend"]);
    const restart = score.start();
    await suspension;
    expect(operations).toEqual(["resume", "suspend"]);
    finishSuspend?.();
    await restart;
    expect(operations).toEqual(["resume", "suspend", "suspended", "resume"]);
  } finally {
    finishSuspend?.(); score.dispose();
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});
