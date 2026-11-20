import { card, contentType, size, Slip } from "@/app/og-card/card";
import { weekWords } from "@/lib/week-words";

export { contentType, size };
export const alt = weekWords.en.days[0].alt;

/** The home page's card: its opening line, and Rosa's call on its slip, beside the call in paper. */
export default function Image() {
  return card({ head: "Good things begin with an open hand.", art: "assets/home/relief-call-1536.webp", aside: <Slip name="Rosa Fontaine" call="Behind on November rent, $450." /> });
}
