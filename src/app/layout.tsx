import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../../public/fonts/fonts.css";
import { SerwistProvider } from "@serwist/turbopack/react";
import { OfflineWorker } from "@/components/offline-worker";
import { launchScreens } from "@/lib/launch-screens";
import { firstLanguage } from "@/lib/first-language";
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
    type: "website",
    siteName: "Kind Helps",
    url: "/",
    title: "Kind Helps — Good work, together.",
    description: "The help line, home visits in pairs, the ledger and the yearly report, with the volunteers who do the work. Free for every conference.",
    images: [{ url: "/assets/link-preview.jpg", width: 1200, height: 630, alt: "Two hands in layered paper relief, a small card resting in the open palm, and the words kind helps." }],
  },
  twitter: { card: "summary_large_image", images: ["/assets/link-preview.jpg"] },
  appleWebApp: {
    capable: true,
    title: "Kind Helps",
    statusBarStyle: "default",
    startupImage: launchScreens,
  },
};
// The three faces on the first screen are asked for with the page, so the first paint is already in them and nothing swaps in view.
const firstFaces = ["newsreader-display-regular", "newsreader-display-italic", "source-sans-3-latin-variable"];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {firstFaces.map((face) => <link key={face} rel="preload" href={`/fonts/${face}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />)}
        {/* The opening is set down once a visit: a later page load in the same visit finds it already in place. */}
        <script dangerouslySetInnerHTML={{ __html: firstLanguage }} />
        <script dangerouslySetInnerHTML={{ __html: "try{var s=sessionStorage;if(s.getItem('arrived'))document.documentElement.dataset.arrived='';s.setItem('arrived','1')}catch(e){}" }} />
      </head>
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" register={false} reloadOnOnline={false}>
          <OfflineWorker />
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
