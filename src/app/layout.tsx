import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext", "vietnamese", "cyrillic"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "Neighborly: church announcements in your neighbors' languages",
  description:
    "Find the languages your church's neighbors speak from Census data, translate an announcement with AI, check every number by code, and let a fluent volunteer approve each block before it goes out.",
  metadataBase: new URL("https://neighborly-church.vercel.app"),
};

export const viewport: Viewport = { themeColor: "#faf7f1", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          Skip to the workspace
        </a>
        {children}
      </body>
    </html>
  );
}
