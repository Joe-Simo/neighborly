import "@/components/live-workspace.css";
import "@/components/workspace/help.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ConvexAuthNextjsServerProvider } from "@/lib/convexAuth";
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
        <ConvexAuthNextjsServerProvider>{children}</ConvexAuthNextjsServerProvider>
      </Suspense>
      <PaperArrival />
    </div>
  );
}
