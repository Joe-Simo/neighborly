import "@/components/live-workspace.css";
import "@/components/workspace/help.css";
import "@/components/workspace/paper.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { LiveFrame } from "@/components/live-frame";
import { AuthOnTheClient } from "@/components/auth-on-the-client";
import { protect } from "@/lib/sample-ticket";
import { LiveProviders } from "@/components/live-providers";
import Loading from "./loading";
import { PaperArrival } from "@/components/paper-arrival";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const firstLanguage = `(function(){try{var k=["en","es"],c=null;try{c=localStorage.getItem("kind-helps:language")}catch(e){}var l=k.indexOf(c)>-1?c:null;if(!l){var n=navigator.languages||[];for(var i=0;i<n.length&&!l;i++){for(var j=0;j<k.length;j++){if(n[i].toLowerCase().indexOf(k[j])===0){l=k[j];break}}}}document.documentElement.lang=l||"en"}catch(e){}})()`;

export default function LiveAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="live-app">
      {/* Before anything is drawn the page already says its language: the one chosen at the door, else the device's
          (the same answer as deviceLanguage in live-auth-words.ts). The app corrects it once it knows the member's own. */}
      <script dangerouslySetInnerHTML={{ __html: firstLanguage }} />
      {/* The menu's words are set in these faces from the first frame, so no label wraps and then jumps. */}
      {/* Clerk's bot check, which every sign-in waits on, loads from here; the connection is opened with the page. */}
      <link rel="preconnect" href={protect} />
      {["source-sans-3-latin-variable", "newsreader-display-regular"].map((face) => (
        <link key={face} rel="preload" href={`/fonts/${face}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      <Suspense fallback={<Loading />}>
        <ClerkProvider signInUrl="/app" signUpUrl="/app?intent=start" afterSignOutUrl="/app">
          <AuthOnTheClient />
          <LiveProviders>
            <LiveFrame sampleEntry={Boolean(process.env.DEMO_CLERK_USER_ID)}>{children}</LiveFrame>
          </LiveProviders>
        </ClerkProvider>
      </Suspense>
      <PaperArrival />
    </div>
  );
}
