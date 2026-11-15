"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Clerk signs the person in; Convex checks Clerk's token on every call. */
export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

/**
 * Signed in, and the backend has found or made this person's account.
 * Nothing else is asked of the backend until `ready`, because every other function looks that account up.
 */
export function useAccount() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { sessionId } = useAuth();
  const enter = useMutation(api.users.enter);
  const [entered, setEntered] = useState<string | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;
    let current = true;
    enter({}).then(
      () => current && setEntered(sessionId),
      (error: unknown) => current && setFailure(error instanceof Error ? error : new Error("Account unavailable.")),
    );
    return () => {
      current = false;
    };
  }, [isAuthenticated, sessionId, enter]);
  if (failure) throw failure;
  return { isLoading, isAuthenticated, ready: isAuthenticated && entered === sessionId };
}
