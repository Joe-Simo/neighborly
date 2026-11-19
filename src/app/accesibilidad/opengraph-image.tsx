import { card, contentType, size } from "@/app/og-card/card";
import { accessibilityWords } from "@/lib/accessibility-words";

export { contentType, size };
export const alt = "A hand ties a gold ribbon on a green paper gift.";

/** The accessibility page's card: its title, beside the same paper as the privacy page. */
export default function Image() {
  return card({ head: accessibilityWords.es.title, art: "assets/relief/relief-mine-1536.webp" });
}
