import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { NeighborlyExperience } from "@/components/neighborly-experience";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// The browser's own bars take the colour of the paper the opening is set on.
export const viewport: Viewport = { colorScheme: "light", themeColor: "#eee6d5", viewportFit: "cover" };

export default function Home() {
  // The headline's face arrives with the page. The text face is left to the stylesheet, so it does not compete with the first picture.
  preload("/fonts/newsreader-display-regular.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return <>
    {/* The first picture is asked for from the head, beside the styles, so it is ready for the first paint. One of the two applies. */}
    <link rel="preload" as="image" type="image/avif" media="(max-width:700px)" imageSrcSet="/assets/living-relief-mobile-480.avif 480w, /assets/living-relief-mobile-780.avif 780w" imageSizes="100vw" fetchPriority="high" crossOrigin="anonymous" />
    <link rel="preload" as="image" type="image/avif" media="(min-width:700.02px)" imageSrcSet="/assets/living-relief-poster-960.avif 960w, /assets/living-relief-poster-1440.avif 1440w, /assets/living-relief-poster-2880.avif 2880w" imageSizes="100vw" fetchPriority="high" crossOrigin="anonymous" />
    <NeighborlyExperience />
  </>;
}
