import { clerkClient } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

/**
 * One-click entry to the sample conference. Hands back a sign-in ticket for the one made-up visitor
 * account, good for a minute and for one use. No password exists for that account anywhere.
 * The backend names the account and rations the tickets: 429 when asked too often or when it is switched off.
 */
export async function POST(request: Request) {
  // The address is only a key for counting tries, so it is hashed before it leaves this server.
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  const visitor = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const userId = await fetchMutation(api.demo.admit, { visitor });
  if (!userId) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  const client = await clerkClient();
  const { token } = await client.signInTokens.createSignInToken({ userId, expiresInSeconds: 60 });
  return Response.json({ ticket: token }, { headers: { "Cache-Control": "no-store" } });
}
