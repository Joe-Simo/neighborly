import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { isCodeLoadFailure, reloadOnceForCode, willReloadForCode } from "./chunk-recovery";

describe("a failed code load after a deploy", () => {
  let reloads = 0;
  const store = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  const before = { sessionStorage: g.sessionStorage, window: g.window };
  beforeEach(() => {
    reloads = 0;
    store.clear();
    Object.assign(globalThis, {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
      window: { location: { reload: () => { reloads += 1; } } },
    });
  });
  afterEach(() => {
    Object.assign(globalThis, before);
  });

  test("is told from other failures", () => {
    expect(isCodeLoadFailure(Object.assign(new Error("Loading chunk 123 failed."), { name: "ChunkLoadError" }))).toBe(true);
    expect(isCodeLoadFailure(new Error("Failed to load chunk /_next/static/chunks/abc.js from module 1"))).toBe(true);
    expect(isCodeLoadFailure(new TypeError("Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js"))).toBe(true);
    expect(isCodeLoadFailure(new Error("Convex is down"))).toBe(false);
    expect(isCodeLoadFailure(undefined)).toBe(false);
  });

  test("reloads the tab once, never twice", () => {
    const error = Object.assign(new Error("x"), { name: "ChunkLoadError" });
    expect(willReloadForCode(error)).toBe(true);
    reloadOnceForCode(new Error("Convex is down"));
    expect(reloads).toBe(0);
    reloadOnceForCode(error);
    expect(willReloadForCode(error)).toBe(false);
    reloadOnceForCode(error);
    expect(reloads).toBe(1);
  });

  test("never reloads when the once cannot be kept", () => {
    Object.assign(globalThis, { sessionStorage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } });
    const error = Object.assign(new Error("x"), { name: "ChunkLoadError" });
    expect(willReloadForCode(error)).toBe(false);
    reloadOnceForCode(error);
    expect(reloads).toBe(0);
  });
});
