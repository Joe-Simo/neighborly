import { card, contentType, size } from "@/app/og-card/card";
import { privacyWords } from "@/lib/privacy-words";

export { contentType, size };
export const alt = "A hand ties a gold ribbon on a green paper gift.";

/** The privacy page's card: its first promise, beside the gift being tied. */
export default function Image() {
  return card({ head: privacyWords.en.sections[0].title, art: "assets/relief/relief-mine-1536.webp" });
}
