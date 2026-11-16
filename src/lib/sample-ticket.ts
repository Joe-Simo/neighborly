import { preload } from "react-dom";
import { clerkJSScriptUrl, clerkUIScriptUrl } from "@clerk/shared/loadClerkJsScript";

/**
 * The way into the sample conference starts before the visitor arrives at it.
 * The ticket is asked for the moment the sample link is pressed, so the request runs while the
 * workspace and Clerk's scripts load, instead of after them. A ticket is good for a minute on the
 * server; one older than 40 s here is left for a fresh one, so Clerk always has time to trade it.
 */
const fresh = 40_000;
let asked: { at: number; reply: Promise<Response> } | null = null;

/** Clerk's own cookie says whether someone is signed in before its script has loaded. */
const signedIn = () => /(?:^|;\s*)__client_uat(?:_[\w-]+)?=[1-9]/.test(document.cookie);

/** Starts the ticket request, once. A person signed in as themselves is signed out first, so nothing is asked for them. */
export function askSampleTicket() {
  if ((asked && Date.now() - asked.at < fresh) || signedIn()) return;
  const reply = fetch("/app/look-around", { method: "POST" });
  reply.catch(() => undefined);
  asked = { at: Date.now(), reply };
}

/** The answer already on its way, or a new request. Each answer is used once. */
export function takeSampleTicket() {
  const early = asked && Date.now() - asked.at < fresh ? asked.reply : null;
  asked = null;
  return early ?? fetch("/app/look-around", { method: "POST" });
}

/** Fetches Clerk's two scripts, at the same addresses and in the same mode the workspace asks for them, so they come from the cache. */
export function warmSignIn() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return;
  preload(clerkJSScriptUrl({ publishableKey }), { as: "script", crossOrigin: "anonymous" });
  preload(clerkUIScriptUrl({ publishableKey }), { as: "script", crossOrigin: "anonymous" });
}
