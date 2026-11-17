"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { noSessionKept } from "@/lib/no-session-kept";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Clerk signs the person in; Convex checks Clerk's token on every call. */
export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {/* What a room last showed is kept for five minutes after it is left, so going back shows it at once while it refreshes. */}
      <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
    </ConvexProviderWithClerk>
  );
}

const cannotBeSignedInYet = () => noSessionKept(document.cookie);
const never = () => () => {};

let enteredSession: string | null = null;

/**
 * Signed in, and the backend has found or made this person's account.
 * Nothing else is asked of the backend until `ready`, because every other function looks that account up.
 */
export function useAccount() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { sessionId, isLoaded, isSignedIn } = useAuth();
  const enter = useMutation(api.users.enter);
  // Remembered beyond this component, so a frame that is ever mounted again does not ask a second time.
  const [entered, setEntered] = useState<string | null>(enteredSession);
  const [failure, setFailure] = useState<Error | null>(null);
  // The server cannot read the browser, so the page it sends says "not known"; the browser's own answer takes over as it wakes.
  const cannotBeSignedIn = useSyncExternalStore(never, cannotBeSignedInYet, () => false);
  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;
    let current = true;
    enter({}).then(
      () => {
        enteredSession = sessionId;
        if (current) setEntered(sessionId);
      },
      (error: unknown) => current && setFailure(error instanceof Error ? error : new Error("Account unavailable.")),
    );
    return () => {
      current = false;
    };
  }, [isAuthenticated, sessionId, enter]);
  if (failure) throw failure;
  return {
    isLoading,
    isAuthenticated,
    ready: isAuthenticated && entered === sessionId,
    // Only once Clerk itself has answered "nobody is signed in". While Clerk knows a session and the
    // backend is still confirming it, the answer is "not yet", never "signed out".
    // Before Clerk has answered, a browser that holds no session (lib/no-session-kept.ts) is already known to be signed out, so the
    // door's sheet is drawn at once instead of after Clerk's script has loaded. Once Clerk answers, its answer rules.
    signedOut: isLoaded ? !isSignedIn && !isLoading && !isAuthenticated : cannotBeSignedIn,
    /** Clerk itself has said who is here. Asked for by what must not run on the early answer alone. */
    clerkAnswered: isLoaded,
  };
}
