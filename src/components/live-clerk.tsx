"use client";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { clerkAppearance } from "@/lib/clerk-appearance";

/**
 * Clerk's provider as a client component. Imported from a server component, @clerk/nextjs gives its server provider, which is
 * async (it awaits its keyless check) and so suspends: the app's frame had to stand in a Suspense boundary, and React streams
 * such a boundary in afterwards and reveals and hydrates it only on an animation frame. A page that says it is visible but
 * draws nothing (a window behind another) never drew one, and stood on "Opening…" with Clerk never started. Imported here,
 * the provider is the client one: it needs nothing from the request, is in the first HTML, and hydrates with the page.
 *
 * The door's forms are our own (useSignIn, useSignUp), so Clerk's prebuilt screens are never drawn: their bundle is not
 * asked for. Clerk waits for it before it starts the session, which held a cold room for its whole download.
 */
export function LiveClerk({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider prefetchUI={false} appearance={clerkAppearance} signInUrl="/app" signUpUrl="/app?intent=start" afterSignOutUrl="/app">
      {children}
    </ClerkProvider>
  );
}
