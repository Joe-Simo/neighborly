import { describe, expect, it } from "vitest";
import { Conflict, type KV, ledger, memoryKV } from "@/lib/ledger";

const T0 = Date.UTC(2026, 10, 3, 15);

describe("shared daily cap", () => {
  it("counts reservations across ledgers that share one store", async () => {
    const kv = memoryKV();
    const a = ledger(kv, 6, () => T0);
    const b = ledger(kv, 6, () => T0);
    expect((await a.reserve(2)).ok).toBe(true);
    expect((await b.reserve(2)).ok).toBe(true);
    expect(await a.usage()).toMatchObject({ calls: 4, cap: 6, resting: false });
    expect((await b.reserve(2)).usage).toMatchObject({ calls: 6, resting: true });
    expect((await a.reserve(1)).ok).toBe(false);
  });

  it("never reserves past the cap", async () => {
    const l = ledger(memoryKV(), 3, () => T0);
    expect((await l.reserve(2)).ok).toBe(true);
    const r = await l.reserve(2);
    expect(r.ok).toBe(false);
    expect((await l.usage()).calls).toBe(2);
  });

  it("starts a new count on a new UTC day", async () => {
    const kv = memoryKV();
    let now = T0;
    const l = ledger(kv, 2, () => now);
    await l.reserve(2);
    expect((await l.usage()).resting).toBe(true);
    now = T0 + 24 * 3600 * 1000;
    expect(await l.usage()).toMatchObject({ calls: 0, resting: false });
  });

  it("retries when another server wrote first, and never loses a count", async () => {
    const inner = memoryKV();
    let raced = false;
    const racy: KV = {
      read: (p, f) => inner.read(p, f),
      async write(p, v, etag) {
        if (!raced) {
          raced = true;
          // Another instance takes 1 call between our read and our write.
          const cur = await inner.read<{ calls: number; exhaustedUntil: number }>(p, true);
          await inner.write(p, { calls: (cur?.value.calls ?? 0) + 1, exhaustedUntil: 0 }, cur?.etag ?? null);
        }
        return inner.write(p, v, etag);
      },
    };
    const l = ledger(racy, 10, () => T0);
    expect((await l.reserve(2)).ok).toBe(true);
    expect((await l.usage()).calls).toBe(3);
  });

  it("gives up after repeated conflicts instead of over-spending", async () => {
    const kv: KV = { read: async () => null, write: async () => Promise.reject(new Conflict("x")) };
    expect((await ledger(kv, 10, () => T0).reserve(1)).ok).toBe(false);
  });

  it("rests every server after the provider reports the day is used up", async () => {
    const kv = memoryKV();
    const a = ledger(kv, 30, () => T0);
    await a.exhausted(T0 + 3600 * 1000);
    expect((await ledger(kv, 30, () => T0).reserve(1)).ok).toBe(false);
    expect((await ledger(kv, 30, () => T0 + 7200 * 1000).reserve(1)).ok).toBe(true);
  });
});

describe("shared cache", () => {
  it("returns what another server stored and keeps the first write", async () => {
    const kv = memoryKV();
    await ledger(kv, 1).cacheSet("k", { text: "uno" });
    await ledger(kv, 1).cacheSet("k", { text: "dos" });
    expect(await ledger(kv, 1).cacheGet("k")).toEqual({ text: "uno" });
    expect(await ledger(kv, 1).cacheGet("missing")).toBeNull();
  });
});
