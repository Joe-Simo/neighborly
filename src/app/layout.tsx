import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../../public/fonts/fonts.css";
import { SerwistProvider } from "@serwist/turbopack/react";
import { launchScreens } from "@/lib/launch-screens";
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f3ec",
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
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
