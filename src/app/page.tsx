import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { NeighborlyExperience } from "@/components/neighborly-experience";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// The browser's own bars take the colour of the paper the opening is set on.
export const viewport: Viewport = { colorScheme: "light", themeColor: "#eee6d5", viewportFit: "cover" };

export default function Home() {
  // The headline's face arrives with the page. The text face is left to the stylesheet, so it does not compete with the first picture.
  preload("/fonts/newsreader-display-regular.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return <NeighborlyExperience />;
}
