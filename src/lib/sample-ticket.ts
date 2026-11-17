import { preconnect, prefetchDNS, preload } from "react-dom";
import { clerkJSScriptUrl, clerkUIScriptUrl, loadClerkJSScript, loadClerkUIScript } from "@clerk/shared/loadClerkJsScript";

/**
 * The way into the sample conference starts before the visitor arrives at it.
 * The ticket is asked for the moment the sample link is pressed, so the request runs while the
 * workspace and Clerk's scripts load, instead of after them. A ticket is good for a minute on the
 * server; one older than 40 s here is left for a fresh one, so Clerk always has time to trade it.
 */
const fresh = 40_000;
/** Where Clerk Protect, the bot check that every sign-in waits on, is served from. */
export const protect = "https://cdn.protect.clerk.com";
let asked: { at: number; reply: Promise<Response> } | null = null;
/**
 * A request that has had no answer in ten seconds is given up, so a hung one ends as any refusal does (the sheet
 * says the sample did not open) instead of leaving the visitor waiting on nothing. Ten, because the home page's card
 * lets go of the screen twelve seconds after the press (card-offer-grow.tsx): the refusal comes first, so the sheet
 * is seen once, with its sentence already in it.
 */
const ask = () => fetch("/app/look-around", { method: "POST", signal: AbortSignal.timeout(10_000) });

/** Clerk's own cookie says whether someone is signed in before its script has loaded. */
const signedIn = () => /(?:^|;\s*)__client_uat(?:_[\w-]+)?=[1-9]/.test(document.cookie);

/** Starts the ticket request, once. A person signed in as themselves is signed out first, so nothing is asked for them. */
export function askSampleTicket() {
  if ((asked && Date.now() - asked.at < fresh) || signedIn()) return;
  const reply = ask();
  reply.catch(() => undefined);
  asked = { at: Date.now(), reply };
}

/** The answer already on its way, or a new request. Each answer is used once. */
export function takeSampleTicket() {
  const early = asked && Date.now() - asked.at < fresh ? asked.reply : null;
  asked = null;
  return early ?? ask();
}

/** Fetches Clerk's two scripts, at the same addresses and in the same mode the workspace asks for them, so they come from the cache. */
export function warmSignIn() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return;
  preload(clerkJSScriptUrl({ publishableKey }), { as: "script", crossOrigin: "anonymous" });
  preload(clerkUIScriptUrl({ publishableKey }), { as: "script", crossOrigin: "anonymous" });
  // Clerk's bot check loads its script from here before any sign-in is sent. Only its address is looked up now (0.65 s on a
  // phone): an opened connection left unused is closed by the browser after about ten seconds, so that waits for the press.
  prefetchDNS(protect);
}

/**
 * Pressed: Clerk's scripts are not only fetched but run now, in the tags Clerk's own loader looks for, so the workspace
 * finds Clerk ready and only has to start it. Clerk asks nothing of its servers until the workspace starts it.
 */
export function startSignIn() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return;
  // The bot check's script is fetched in CORS mode, so only an anonymous connection is one it can use; it is asked for
  // about 1.3 s after the press, time enough for the connection (0.9 s on a phone, measured live).
  preconnect(protect, { crossOrigin: "anonymous" });
  void loadClerkJSScript({ publishableKey }).catch(() => undefined);
  void loadClerkUIScript({ publishableKey }).catch(() => undefined);
}

let woken = false;
/** Wakes the ticket's server function once per page view, without asking for a ticket (see GET in look-around). */
export function wakeTheDoor() {
  if (woken) return;
  woken = true;
  void fetch("/app/look-around", { cache: "no-store" }).catch(() => undefined);
}
