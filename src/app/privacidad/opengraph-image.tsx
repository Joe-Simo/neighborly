import { card, contentType, size } from "@/app/og-card/card";
import { privacyWords } from "@/lib/privacy-words";

export { contentType, size };
export const alt = "Una mano ata una cinta dorada en un regalo de papel verde.";

/** The privacy page's card: its first promise, beside the gift being tied. */
export default function Image() {
  return card({ head: privacyWords.es.sections[0].title, art: "assets/relief/relief-mine-1536.webp" });
}
