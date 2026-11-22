import "@/components/live-workspace.css";
import "@/components/workspace/help.css";
import "@/components/workspace/paper.css";
import "@/components/workspace/shell-ios.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { LiveFrame } from "@/components/live-frame";
import { protect } from "@/lib/sample-ticket";
import { LiveProviders } from "@/components/live-providers";
import Loading from "./loading";
import { doorEarly } from "@/lib/door-early";
import { PaperArrival } from "@/components/paper-arrival";
import { PageLanguage } from "@/components/page-language";

const convexOrigin = process.env.NEXT_PUBLIC_CONVEX_URL && new URL(process.env.NEXT_PUBLIC_CONVEX_URL).origin;

// No <title> from React here: the head names the tab in the reader's language before the first paint (first-tab.ts),
// and the app names it after. A title React rendered it would write back, in English, as the page wakes.
export const metadata: Metadata = { title: null, robots: { index: false, follow: false } };

export default function LiveAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="live-app">
      {/* The page says its language before the first paint: on a fresh load the root layout's script has, and on
          arriving from the home page this does. The app corrects it once it knows the member's own. */}
      <PageLanguage />
      {/* The menu's words are set in these faces from the first frame, so no label wraps and then jumps. */}
      {/* Clerk's bot check, which every sign-in waits on, loads from here; the connection is opened with the page. */}
      <link rel="preconnect" href={protect} crossOrigin="anonymous" />
      {/* The backend's socket is opened only once the app's scripts have run; its name is looked up and its connection
          warmed with the page, so that wait is not added to the first room's. */}
      {convexOrigin && <link rel="preconnect" href={convexOrigin} />}
      {["source-sans-3-latin-variable", "newsreader-display-regular"].map((face) => (
        <link key={face} rel="preload" href={`/fonts/${face}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      {/* The launch mark is asked for with the page itself, ahead of the styles, so the first paint already holds it. */}
      <link rel="preload" as="image" href="/launch/mark-240.png" imageSrcSet="/launch/mark-240.png 1x, /launch/mark-480.png 2x, /launch/mark-720.png 3x" fetchPriority="high" />
      {/* Before the first paint: may the server's sign-in sheet show at once (lib/door-early.ts)? */}
      <script dangerouslySetInnerHTML={{ __html: `var l=(${doorEarly})();if(l)document.documentElement.dataset.doorEarly=l` }} />
      <Suspense fallback={<Loading />}>
        {/* The door's forms are our own (useSignIn, useSignUp), so Clerk's prebuilt screens are never drawn: their
            bundle is not asked for. Clerk waits for it before it starts the session, which held a cold room for its whole download. */}
        <ClerkProvider prefetchUI={false} appearance={clerkAppearance} signInUrl="/app" signUpUrl="/app?intent=start" afterSignOutUrl="/app">
          <LiveProviders>
            <LiveFrame sampleEntry={Boolean(process.env.DEMO_CLERK_USER_ID)}>{children}</LiveFrame>
          </LiveProviders>
        </ClerkProvider>
      </Suspense>
      <PaperArrival />
      {/* Nothing in the app opens without scripts, and the launch sheet's line would say "Opening…" for ever. That
          reader is told so on the same paper, under the same mark, and shown the way back. Which language they read
          is not known without scripts, so both are set. */}
      <noscript>
        {/* The launch sheet beneath is taken out of the page, not only covered, so a screen reader does not read its "Opening…". */}
        <style>{".live-main.paper-loading{display:none!important}"}</style>
        <main className="paper-noscript">
          {/* eslint-disable-next-line @next/next/no-img-element -- the launch mark, as the launch sheet draws it */}
          <img src="/launch/mark-240.png" srcSet="/launch/mark-240.png 1x, /launch/mark-480.png 2x, /launch/mark-720.png 3x" width={240} height={240} alt="kind helps" />
          <div>
            <p>The conference rooms need JavaScript turned on to open.</p>
            <Link href="/">Back to the home page</Link>
          </div>
          <div lang="es">
            <p>Las salas de la conferencia necesitan JavaScript activado para abrirse.</p>
            <Link href="/">Volver a la página de inicio</Link>
          </div>
        </main>
      </noscript>
    </div>
  );
}
