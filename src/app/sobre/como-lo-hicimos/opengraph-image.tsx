import { card, contentType, size, Totals } from "@/app/og-card/card";
import { madeWords } from "@/lib/made-words";
import { sampleYear } from "@/lib/sample-year";
import { weekWords } from "@/lib/week-words";
import { words } from "@/lib/words";
import { formatCount, formatMoney } from "@/lib/words/numbers";
import { reportsWords } from "@/lib/words/rooms/reports";

export { contentType, size };
export const alt = weekWords.es.days[2].alt;

/** How it was made: the title, and the sample year's totals as the report adds them up. */
export default function Image() {
  const said = reportsWords(words("es", "vincentian"));
  return card({
    head: madeWords.es.title,
    art: "assets/home/relief-help-1536.webp",
    aside: <Totals items={[
      { value: formatCount(sampleYear.calls, "es"), label: said.year.calls },
      { value: formatCount(sampleYear.visits, "es"), label: said.year.visitsInPairs },
      { value: formatMoney(sampleYear.helpPaid / 100, "es", true), label: said.sheet.helpGiven },
    ]} />,
  });
}
