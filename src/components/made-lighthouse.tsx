import { madeLighthouse } from "@/lib/made-lighthouse";
import type { madeWords } from "@/lib/made-words";
import type { Language } from "@/lib/words";

type Said = (typeof madeWords)[Language]["lighthouse"];

const days = { en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }), es: new Intl.DateTimeFormat("es-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) };
const seconds = { en: new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), es: new Intl.NumberFormat("es-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) };
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/**
 * Lighthouse at the freeze, every run as it came, phone first. Nothing is averaged, rounded up or left out, and with no runs in the
 * file nothing is drawn. A score under 90 is said as it is, in ink like the rest.
 */
export function MadeLighthouse({ said, language }: { said: Said; language: Language }) {
  const { commit, runs } = madeLighthouse;
  const first = runs[0];
  if (!first) return null;
  const ordered = [...runs].sort((a, b) => (a.form === b.form ? a.at.localeCompare(b.at) : a.form === "mobile" ? -1 : 1));
  const counted = { mobile: 0, desktop: 0 };
  return <figure className="public-made-eval public-made-lighthouse">
    <table>
      <caption>{said.caption}</caption>
      <thead><tr>{said.head.map((head, column) => <th key={head} scope="col" className={column ? "is-count" : undefined}>{head}</th>)}</tr></thead>
      <tbody>{ordered.map((run) => {
        counted[run.form] += 1;
        const name = fill(said.run, { form: said.forms[run.form], n: String(counted[run.form]) });
        return <tr key={run.at}><th scope="row">{name}</th>{run.scores.map((score, column) => <td key={said.head[column + 1]} data-head={said.head[column + 1]}>{score}</td>)}<td data-head={said.head[5]}>{fill(said.seconds, { s: seconds[language].format(run.lcpMs / 1000) })}</td></tr>;
      })}</tbody>
    </table>
    <figcaption>{fill(said.source, { day: days[language].format(new Date(first.at)), commit, version: first.version, url: new URL(first.url).host })}</figcaption>
  </figure>;
}
