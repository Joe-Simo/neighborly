import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { NeighborlyExperience } from "@/components/neighborly-experience";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// The browser's own bars take the colour of the paper the opening is set on.
export const viewport: Viewport = { colorScheme: "light", themeColor: "#eee6d5", viewportFit: "cover" };

export default function Home() {
  // The two faces every first screen is set in arrive with the page, not after its styles are read.
  preload("/fonts/newsreader-display-regular.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/source-sans-3-latin-variable.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return <NeighborlyExperience />;
}
