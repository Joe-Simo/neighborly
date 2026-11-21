import { v } from "convex/values";
import { internalQuery, type ActionCtx } from "./_generated/server";
import { internalMutation } from "./functions";
import { internal } from "./_generated/api";
import type { Point } from "./area";

/**
 * A street address to a point, with the US Census Bureau's free geocoder (no key). Only the address is sent: never a
 * name, contact or need. Each address is looked up once and kept by a hash of its normalized words (a miss too, for a
 * day), with a short timeout, so a slow or absent service only means the zip's centre is used instead.
 */
const URL_BASE = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const KEEP_MISS = 24 * 3_600_000;

const normalized = (address: string) => address.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 200);
async function keyOf(address: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`geocode:${normalized(address)}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const kept = internalQuery({
  args: { key: v.string() },
  returns: v.union(v.null(), v.object({ lat: v.optional(v.number()), lng: v.optional(v.number()), at: v.number() })),
  handler: async (ctx, { key }) => {
    const row = await ctx.db.query("geocodes").withIndex("by_key", (q) => q.eq("key", key)).unique();
    return row ? { lat: row.lat, lng: row.lng, at: row.at } : null;
  },
});
export const keep = internalMutation({
  args: { key: v.string(), lat: v.optional(v.number()), lng: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { key, lat, lng }) => {
    const row = await ctx.db.query("geocodes").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (row) await ctx.db.patch("geocodes", row._id, { lat, lng, at: Date.now() });
    else await ctx.db.insert("geocodes", { key, lat, lng, at: Date.now() });
    return null;
  },
});

/** Reads the Census answer: the first match's point, or null. */
export function firstMatch(body: unknown): Point | null {
  const matches = (body as { result?: { addressMatches?: { coordinates?: { x?: unknown; y?: unknown } }[] } } | null)?.result?.addressMatches;
  const point = matches?.[0]?.coordinates;
  return typeof point?.x === "number" && typeof point.y === "number" && Math.abs(point.y) <= 90 && Math.abs(point.x) <= 180 ? { lat: point.y, lng: point.x } : null;
}

export async function placeAddress(ctx: ActionCtx, address: string): Promise<Point | null> {
  const words = normalized(address);
  if (words.length < 6 || !/\d/.test(words)) return null;
  const key = await keyOf(address);
  const known = await ctx.runQuery(internal.geocode.kept, { key });
  if (known && known.lat !== undefined && known.lng !== undefined) return { lat: known.lat, lng: known.lng };
  if (known && Date.now() - known.at < KEEP_MISS) return null;
  let point: Point | null = null;
  try {
    const url = `${URL_BASE}?${new URLSearchParams({ address: address.slice(0, 200), benchmark: "Public_AR_Current", format: "json" })}`;
    const answer = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (answer.ok) point = firstMatch(await answer.json());
  } catch { point = null; }
  await ctx.runMutation(internal.geocode.keep, { key, ...(point ? { lat: point.lat, lng: point.lng } : {}) });
  return point;
}
