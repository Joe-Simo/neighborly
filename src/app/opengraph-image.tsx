import { card, contentType, size } from "@/app/og-card/card";

export { contentType, size };
export const alt = "A courtyard painted in layered paper: a bell tower, arcades hung with wisteria, and a woman setting a long table.";

/** The home page's card: its opening line beside the courtyard, the painting the home page opens its doors on, cut to its tower and its table. */
export default function Image() {
  return card({ head: <div style={{ display: "flex", flexDirection: "column", fontSize: 64, letterSpacing: -2 }}><div style={{ display: "flex" }}>Good things begin</div><div style={{ display: "flex", gap: 16 }}><span>with</span><span style={{ fontStyle: "italic" }}>an open hand.</span></div></div>, art: "assets/threshold/courtyard-fresco.webp", crop: { left: 565, top: 20, width: 660, height: 770 }, first: true });
}
