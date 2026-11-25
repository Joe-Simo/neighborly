import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../../public/fonts/fonts.css";
import { OfflineWorker } from "@/components/offline-worker";
import { PublicTurn } from "@/components/public-turn";
import "@/components/public-turn.css";
import "@/components/cut-heads.css";
import { launchScreens } from "@/lib/launch-screens";
import { linkCardIn, linkPreview } from "@/lib/link-preview";
import { firstLanguage } from "@/lib/first-language";
import { firstTab } from "@/lib/first-tab";
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
  title: "Kind Helps · Help line, visits and books for a conference",
  description:
    "Kind Helps keeps a conference’s help line, home visits in pairs, ledger and yearly report, in English and Spanish. Free for every conference.",
  openGraph: {
    ...linkPreview,
    url: "/",
    title: "Kind Helps · Help line, visits and books for a conference",
    description: "The help line, home visits in pairs, the ledger and the yearly report, with the volunteers who do the work. Free for every conference.",
  },
  twitter: linkCardIn("en"),
  appleWebApp: {
    capable: true,
    title: "Kind Helps",
    statusBarStyle: "default",
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
        {/* iOS's launch pictures are part of the page's own head, not of its metadata: metadata is set down afresh on every
            move between pages, and these forty-odd links, laid again inside the commit that opens the workspace, were most of
            that frame's work. Here they are laid once, with the first page, and stay. */}
        {launchScreens.map(({ url, media }) => <link key={url} rel="apple-touch-startup-image" href={url} media={media} />)}
        {/* The paper's colour is in the document itself, so the page is paper from its first frame, before any stylesheet arrives. */}
        <style dangerouslySetInnerHTML={{ __html: "html{background:#f5f3ec}" }} />
        {firstFaces.map((face) => <link key={face} rel="preload" href={`/fonts/${face}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />)}
        {/* The opening is set down once a visit: a later page load in the same visit finds it already in place. */}
        <script dangerouslySetInnerHTML={{ __html: firstLanguage + ";" + firstTab }} />
        {/* A tab Safari brings back from an old visit can be an older deploy's page, whose stylesheet is no longer served, so it
            would be drawn unstyled. Once the page has loaded, if the site's stylesheet is not in force, it is asked for afresh, once. */}
        <script dangerouslySetInnerHTML={{ __html: staleCheck }} />
        {/* Real light: the shadows' sun is where it is at the visitor's hour, from the first frame (src/lib/sun.ts). */}
        <script dangerouslySetInnerHTML={{ __html: sunLight }} />
      </head>
      <body>
        <OfflineWorker />
        <PublicTurn />
        {children}
      </body>
    </html>
  );
}
