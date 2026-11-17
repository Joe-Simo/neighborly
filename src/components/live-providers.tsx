"use client";

import { useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { api } from "../../convex/_generated/api";
import { AskedTooSoon, NoteTrusted } from "./asked-too-soon";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Clerk signs the person in; Convex checks Clerk's token on every call. */
export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {/* What a room last showed is kept for five minutes after it is left, so going back shows it at once while it refreshes. */}
      <ConvexQueryCacheProvider>
        <AskedTooSoon>{children}</AskedTooSoon>
      </ConvexQueryCacheProvider>
    </ConvexProviderWithClerk>
  );
}

/**
 * Clerk keeps a signed-in browser's session in cookies the page can read (`__session`, `__client_uat`, and on a
 * development instance `__clerk_db_jwt`). A browser that holds none of them cannot be signed in, and that is known
 * before Clerk's script has loaded. Any one of them, whatever it says, and the question is left to Clerk.
 */
const noSessionKept = () => !/(?:^|;\s*)__(?:session|client_uat|clerk)/.test(document.cookie);
const never = () => () => {};

let enteredSession: string | null = null;

/**
 * The Clerk account this browser last saw the backend find. A returning person's row is already there, so their
 * rooms can be asked for beside the account check instead of after it. It is a hint and nothing more: the backend
 * checks the token and looks the row up on every call, whatever this says. Sign-out removes it (lib/forget-browser.ts).
 */
const enteredKey = "kind-helps-entered";
let asked: { userId: string; before: boolean } | null = null;
/** Read once for each account, so the answer stays the same after the check below takes the note back. */
const hasEnteredBefore = (userId: string) => {
  if (asked?.userId !== userId) {
    let before = false;
    try {
      before = window.localStorage.getItem(enteredKey) === userId;
    } catch {
      // Not known: the rooms wait for the account check.
    }
    asked = { userId, before };
  }
  return asked.before;
};
function noteEntered(userId: string | null) {
  try {
    if (userId) window.localStorage.setItem(enteredKey, userId);
    else window.localStorage.removeItem(enteredKey);
  } catch {
    // Without it the rooms are asked for after the account check, as on a first visit.
  }
}

/**
 * Signed in, and the backend has found or made this person's account.
 * Nothing else is asked of the backend until `ready`, because every other function looks that account up.
 */
export function useAccount() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { sessionId, userId, isLoaded, isSignedIn } = useAuth();
  const enter = useMutation(api.users.enter);
  const noteTrusted = useContext(NoteTrusted);
  // Remembered beyond this component, so a frame that is ever mounted again does not ask a second time.
  const [entered, setEntered] = useState<string | null>(enteredSession);
  const [failure, setFailure] = useState<Error | null>(null);
  // The server cannot read the browser, so the page it sends says "not known"; the browser's own answer takes over as it wakes.
  const cannotBeSignedIn = useSyncExternalStore(never, noSessionKept, () => false);
  useEffect(() => {
    if (!isAuthenticated || !sessionId || !userId) return;
    let current = true;
    hasEnteredBefore(userId);
    // The note is taken back while the check is out and written again when it returns. Should the row be gone after
    // all (the rooms then fail), the next load finds no note and waits for the check, as on a first visit.
    noteEntered(null);
    enter({}).then(
      () => {
        enteredSession = sessionId;
        noteEntered(userId);
        if (current) setEntered(sessionId);
      },
      (error: unknown) => current && setFailure(error instanceof Error ? error : new Error("Account unavailable.")),
    );
    return () => {
      current = false;
    };
  }, [isAuthenticated, sessionId, userId, enter]);
  if (failure) throw failure;
  return {
    isLoading,
    isAuthenticated,
    ready: isAuthenticated && entered === sessionId,
    /** Signed in as someone whose account the backend has found before: their rooms need not wait for `ready`. */
    returning: noteTrusted && isAuthenticated && !!userId && hasEnteredBefore(userId),
    // Only once Clerk itself has answered "nobody is signed in". While Clerk knows a session and the
    // backend is still confirming it, the answer is "not yet", never "signed out".
    // Before Clerk has answered, a browser with no session cookie at all is already known to be signed out, so the
    // door's sheet is drawn at once instead of after Clerk's script has loaded. Once Clerk answers, its answer rules.
    signedOut: isLoaded ? !isSignedIn && !isLoading && !isAuthenticated : cannotBeSignedIn,
    /** Clerk itself has said who is here. Asked for by what must not run on the early answer alone. */
    clerkAnswered: isLoaded,
  };
}
