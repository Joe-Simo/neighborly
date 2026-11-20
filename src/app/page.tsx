import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { NeighborlyExperience } from "@/components/neighborly-experience";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// The browser's own bars take the colour of the paper the opening is set on.
export const viewport: Viewport = { colorScheme: "light", themeColor: "#eee6d5", viewportFit: "cover" };

/** Who made the page and what it is, for search engines and the apps that read a shared link. */
const about = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://kindhelps.com/#org", name: "Kind Helps", url: "https://kindhelps.com/", logo: "https://kindhelps.com/icon.png", sameAs: ["https://github.com/Joe-Simo/neighborly"] },
    {
      "@type": "SoftwareApplication", name: "Kind Helps", url: "https://kindhelps.com/", applicationCategory: "BusinessApplication", operatingSystem: "Web, iOS, iPadOS",
      inLanguage: ["en", "es"], image: "https://kindhelps.com/assets/link-card.jpg", publisher: { "@id": "https://kindhelps.com/#org" },
      description: "The help line, home visits in pairs, the ledger and the yearly report, with the volunteers who do the work. Free for every conference.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default function Home() {
  // The headline's face arrives with the page. The text face is left to the stylesheet, so it does not compete with the first picture.
  preload("/fonts/newsreader-display-regular.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(about) }} />
    {/* The first picture is asked for from the head, beside the styles, so it is ready for the first paint. One of the two applies. */}
    <link rel="preload" as="image" type="image/avif" media="(max-width:700px)" imageSrcSet="/assets/living-relief-mobile-gl-390.avif 390w" imageSizes="100vw" fetchPriority="high" crossOrigin="anonymous" />
    <link rel="preload" as="image" type="image/avif" media="(min-width:700.02px)" imageSrcSet="/assets/living-relief-poster-gl-1440.avif 1440w, /assets/living-relief-poster-gl-1920.avif 1920w" imageSizes="100vw" fetchPriority="high" crossOrigin="anonymous" />
    <NeighborlyExperience />
  </>;
}
