import type { Metadata } from "next";

export const metadata: Metadata = {
  // No title: the head names the tab (first-tab.ts) in the reader's language, as `workspaceTab` in live-auth-words.ts.
  robots: { index: false, follow: false },
};

/** Sign-in, the welcome and the first room are drawn by the frame in the layout (LiveFrame), which reads the address itself. */
export default function Page() {
  return null;
}
