import type { Metadata } from "next";

export const metadata: Metadata = {
  // The same words as `workspaceTab` in live-auth-words.ts, which says them in Spanish once the page wakes.
  title: "Your workspace · Kind Helps",
  robots: { index: false, follow: false },
};

/** Sign-in, the welcome and the first room are drawn by the frame in the layout (LiveFrame), which reads the address itself. */
export default function Page() {
  return null;
}
