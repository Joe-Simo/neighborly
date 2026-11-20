import { weekWords } from "@/lib/week-words";
import { card, contentType, size } from "@/app/og-card/card";
import { accessibilityWords } from "@/lib/accessibility-words";

export { contentType, size };
export const alt = weekWords.es.days[1].alt;

/** The accessibility page's card: its title, beside the open door. */
export default function Image() {
  return card({ head: accessibilityWords.es.title, art: "assets/relief/relief-visit-1024.webp" });
}
