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
  // The backend's yes and Clerk's ticket are asked for together, not one after the other (about 1.1 s in a row, live).
  // The ticket is made for the account this server already knows, and handed out only if the backend names that same
  // account; a refused ticket never leaves this server and lapses within the minute.
  const account = process.env.DEMO_CLERK_USER_ID;
  const ticket = account
    ? clerkClient().then((client) => client.signInTokens.createSignInToken({ userId: account, expiresInSeconds: 60 }))
    : undefined;
  ticket?.catch(() => undefined);
  const userId = await fetchMutation(api.demo.admit, { visitor });
  if (!userId) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  // Only ever the account this server was given: a backend that names any other (a wrong setting, the wrong
  // deployment) gets no ticket, so no visitor can be signed in as a real person.
  if (!account || !ticket || userId !== account) return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  const { token } = await ticket;
  return Response.json({ ticket: token }, { headers: { "Cache-Control": "no-store" } });
}
