/**
 * The shared translation cache and daily AI-call cap, written against a tiny key-value interface so the
 * same logic runs on Vercel Blob in production and in memory in tests or local dev.
 */

export class Conflict extends Error {}

export type Stored<T> = { value: T; etag: string };

export interface KV {
  /** fresh=true must skip any CDN cache, because the cap needs the latest count. */
  read<T>(path: string, fresh: boolean): Promise<Stored<T> | null>;
  /** etag=null means create; it throws Conflict if the path exists. Otherwise it throws Conflict if the etag moved. */
  write<T>(path: string, value: T, etag: string | null): Promise<void>;
}

export function memoryKV(): KV {
  const data = new Map<string, { json: string; etag: number }>();
  let n = 0;
  return {
    async read<T>(path: string) {
      const hit = data.get(path);
      return hit ? { value: JSON.parse(hit.json) as T, etag: String(hit.etag) } : null;
    },
    async write<T>(path: string, value: T, etag: string | null) {
      const hit = data.get(path);
      if (etag === null ? hit : !hit || String(hit.etag) !== etag) throw new Conflict(path);
      data.set(path, { json: JSON.stringify(value), etag: ++n });
    },
  };
}

export type CapDay = { calls: number; exhaustedUntil: number };
export type Usage = { day: string; calls: number; cap: number; resting: boolean };

export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const capPath = (day: string) => `cap/${day}.json`;
const cachePath = (key: string) => `cache/${key}.json`;

export function ledger(kv: KV, cap: number, now: () => number = Date.now) {
  async function usage(): Promise<Usage> {
    const day = utcDay(now());
    const cur = (await kv.read<CapDay>(capPath(day), true))?.value ?? { calls: 0, exhaustedUntil: 0 };
    return { day, calls: cur.calls, cap, resting: cur.calls >= cap || now() < cur.exhaustedUntil };
  }

  /** Reserve n calls at once, so a translation and its back-translation cost one write, not two. */
  async function reserve(n: number): Promise<{ ok: boolean; usage: Usage }> {
    const day = utcDay(now());
    for (let attempt = 0; attempt < 5; attempt++) {
      const cur = await kv.read<CapDay>(capPath(day), true);
      const v = cur?.value ?? { calls: 0, exhaustedUntil: 0 };
      if (v.calls + n > cap || now() < v.exhaustedUntil) return { ok: false, usage: { day, calls: v.calls, cap, resting: true } };
      try {
        await kv.write<CapDay>(capPath(day), { ...v, calls: v.calls + n }, cur?.etag ?? null);
        return { ok: true, usage: { day, calls: v.calls + n, cap, resting: v.calls + n >= cap } };
      } catch (e) {
        if (!(e instanceof Conflict)) throw e;
      }
    }
    return { ok: false, usage: { day, calls: cap, cap, resting: true } };
  }

  /** The provider said the free tier is used up for the day: stop everyone until the given time. */
  async function exhausted(until: number) {
    const day = utcDay(now());
    for (let attempt = 0; attempt < 5; attempt++) {
      const cur = await kv.read<CapDay>(capPath(day), true);
      const v = cur?.value ?? { calls: 0, exhaustedUntil: 0 };
      try {
        await kv.write<CapDay>(capPath(day), { ...v, exhaustedUntil: until }, cur?.etag ?? null);
        return;
      } catch (e) {
        if (!(e instanceof Conflict)) throw e;
      }
    }
  }

  async function cacheGet<T>(key: string): Promise<T | null> {
    return (await kv.read<T>(cachePath(key), false))?.value ?? null;
  }

  async function cacheSet<T>(key: string, value: T) {
    try {
      await kv.write(cachePath(key), value, null);
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }

  return { usage, reserve, exhausted, cacheGet, cacheSet };
}

export type Ledger = ReturnType<typeof ledger>;
