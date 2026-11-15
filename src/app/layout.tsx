import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../../public/fonts/fonts.css";
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f3ec",
  viewportFit: "cover",
};
export const metadata: Metadata = {
  metadataBase: new URL("https://kindhelps.com"),
  title: "Kind Helps — Good work, together.",
  description:
    "A place for churches and communities to organize volunteering, bring people together, and help in their own way.",
  openGraph: {
    title: "Kind Helps — Good work, together.",
    description: "Your people. Your way to help. Volunteering for churches and communities.",
    images: [{ url: "/assets/living-relief-poster.webp", width: 1440, height: 1024, alt: "The painted community and welcome guide of Kind Helps" }],
  },
  twitter: { card: "summary_large_image" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
