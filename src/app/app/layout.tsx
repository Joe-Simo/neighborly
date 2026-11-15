import "@/components/live-workspace.css";
import "@/components/workspace/help.css";
import "@/components/workspace/paper.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { LiveFrame } from "@/components/live-frame";
import { LiveProviders } from "@/components/live-providers";
import Loading from "./loading";
import { PaperArrival } from "@/components/paper-arrival";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LiveAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="live-app">
      {/* The menu's words are set in these faces from the first frame, so no label wraps and then jumps. */}
      {["source-sans-3-latin-variable", "newsreader-display-regular"].map((face) => (
        <link key={face} rel="preload" href={`/fonts/${face}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      <Suspense fallback={<Loading />}>
        <ClerkProvider signInUrl="/app" signUpUrl="/app?intent=start" afterSignOutUrl="/app">
          <LiveProviders>
            <LiveFrame>{children}</LiveFrame>
          </LiveProviders>
        </ClerkProvider>
      </Suspense>
      <PaperArrival />
    </div>
  );
}
