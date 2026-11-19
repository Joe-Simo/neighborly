import { card, contentType, size } from "@/app/og-card/card";
import { weekWords } from "@/lib/week-words";

export { contentType, size };
export const alt = weekWords.es.days[1].alt;

export default function Image() {
  return card({ head: weekWords.es.title, art: "assets/relief/relief-visit-1024.webp" });
}
