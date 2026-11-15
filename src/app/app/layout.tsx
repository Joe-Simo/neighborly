import "@/components/live-workspace.css";
import "@/components/workspace/help.css";
import "@/components/workspace/paper.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
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
      <Suspense fallback={<Loading />}>
        <ClerkProvider signInUrl="/app" signUpUrl="/app?intent=start" afterSignOutUrl="/app">
          <LiveProviders>{children}</LiveProviders>
        </ClerkProvider>
      </Suspense>
      <PaperArrival />
    </div>
  );
}
