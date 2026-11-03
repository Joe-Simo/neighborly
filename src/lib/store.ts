import "server-only";
import { BlobError, BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { Conflict, type KV, ledger, memoryKV } from "./ledger";

/**
 * Production uses a private Vercel Blob store (free on the Hobby plan, hard limits, no card), so every server
 * instance shares one cache and one daily cap. Without a token, or if Blob fails, it falls back to memory and says so.
 */

function blobKV(): KV {
  return {
    async read<T>(path: string, fresh: boolean) {
      const r = await get(path, { access: "private", useCache: !fresh });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      const text = await new Response(r.stream).text();
      return { value: JSON.parse(text) as T, etag: r.blob.etag };
    },
    async write<T>(path: string, value: T, etag: string | null) {
      try {
        await put(path, JSON.stringify(value), {
          access: "private",
          addRandomSuffix: false,
          contentType: "application/json",
          cacheControlMaxAge: 60,
          ...(etag === null ? { allowOverwrite: false } : { allowOverwrite: true, ifMatch: etag }),
        });
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) throw new Conflict(path);
        if (etag === null && e instanceof BlobError && /exist/i.test(e.message)) throw new Conflict(path);
        throw e;
      }
    },
  };
}

export const DAILY_CAP = Number(process.env.NEIGHBORLY_LLM_CALLS_PER_DAY ?? 36);

const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
const memory = ledger(memoryKV(), DAILY_CAP);
const shared = hasBlob ? ledger(blobKV(), DAILY_CAP) : null;
let blobFailedAt = 0;

export type StoreMode = "global" | "instance";

/** Run on the shared store, or on this instance's memory if Blob is missing or failing (retry after 5 minutes). */
export async function withStore<T>(fn: (l: typeof memory) => Promise<T>): Promise<{ value: T; mode: StoreMode }> {
  if (shared && Date.now() - blobFailedAt > 5 * 60_000) {
    try {
      return { value: await fn(shared), mode: "global" };
    } catch (e) {
      if (e instanceof Conflict) throw e;
      blobFailedAt = Date.now();
      console.error("neighborly: shared store failed, using this instance's memory", e instanceof Error ? e.name : "error");
    }
  }
  return { value: await fn(memory), mode: "instance" };
}
