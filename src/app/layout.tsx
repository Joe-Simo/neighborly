import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../../public/fonts/fonts.css";
import { SerwistProvider } from "@serwist/turbopack/react";
import { OfflineWorker } from "@/components/offline-worker";
import { PublicTurn } from "@/components/public-turn";
import "@/components/public-turn.css";
import { CutHeads } from "@/components/cut-heads";
import "@/components/cut-heads.css";
import { launchScreens } from "@/lib/launch-screens";
import { linkCardIn, linkPreview } from "@/lib/link-preview";
import { firstLanguage } from "@/lib/first-language";
import { staleCheck } from "@/lib/stale-check";
import { sunLight } from "@/lib/sun";
export const viewport: Viewport = {
  colorScheme: "light",
  // The page is paper in either mode, so the browser's bar is paper too.
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f3ec" }, { media: "(prefers-color-scheme: dark)", color: "#f5f3ec" }],
  viewportFit: "cover",
};
export const metadata: Metadata = {
  metadataBase: new URL("https://kindhelps.com"),
  title: "Kind Helps — Good work, together.",
  description:
    "Kind Helps keeps a conference’s help line, home visits, ledger and yearly report in one place, with the volunteers who do the work. Free for every conference.",
  openGraph: {
    ...linkPreview,
    url: "/",
    title: "Kind Helps — Good work, together.",
    description: "The help line, home visits in pairs, the ledger and the yearly report, with the volunteers who do the work. Free for every conference.",
  },
  twitter: linkCardIn("en"),
  appleWebApp: {
    capable: true,
    title: "Kind Helps",
    statusBarStyle: "default",
    startupImage: launchScreens,
  },
};
// The headline's two faces are asked for with the page, so the first paint is already in them. The text face is left to the stylesheet:
// its stand-in (fonts.css) has its width and line, so its arrival moves nothing, and on a slow line it does not hold back the first picture.
// The app asks for it with its own layout.
const firstFaces = ["newsreader-display-regular", "newsreader-display-italic"];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The paper's colour is in the document itself, so the page is paper from its first frame, before any stylesheet arrives. */}
        <style dangerouslySetInnerHTML={{ __html: "html{background:#f5f3ec}" }} />
        {firstFaces.map((face) => <link key={face} rel="preload" href={`/fonts/${face}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />)}
        {/* The opening is set down once a visit: a later page load in the same visit finds it already in place. */}
        <script dangerouslySetInnerHTML={{ __html: firstLanguage }} />
        {/* A tab Safari brings back from an old visit can be an older deploy's page, whose stylesheet is no longer served, so it
            would be drawn unstyled. Once the page has loaded, if the site's stylesheet is not in force, it is asked for afresh, once. */}
        <script dangerouslySetInnerHTML={{ __html: staleCheck }} />
        {/* Real light: the shadows' sun is where it is at the visitor's hour, from the first frame (src/lib/sun.ts). */}
        <script dangerouslySetInnerHTML={{ __html: sunLight }} />
        <script dangerouslySetInnerHTML={{ __html: "try{var s=sessionStorage;if(s.getItem('arrived'))document.documentElement.dataset.arrived='';s.setItem('arrived','1')}catch(e){}" }} />
      </head>
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" register={false} reloadOnOnline={false}>
          <OfflineWorker />
          <PublicTurn />
          <CutHeads />
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
