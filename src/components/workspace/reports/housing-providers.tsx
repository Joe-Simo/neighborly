"use client";

import { saveFile } from "@/lib/save-file";
import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { housingCsv, housingFileName, type HousingReport, type ReportLines } from "@/components/workspace/reports/housing-lines";
import { housingWords } from "@/components/workspace/reports/housing-words";
import { reportsWords } from "@/lib/words/rooms/reports";

/** The Housing Provider Summary under the year: closed until asked for, so nothing moves while the year loads. */
/** Reads the summary for a year, or nothing while `asked` is false; the room passes its own (reports.tsx). */
export type ReadHousing = (year: number, asked: boolean) => HousingReport | undefined;

export default function HousingSection({ year, read, lines }: { year: number; read: ReadHousing; lines: ReportLines }) {
  const { words } = useWorkspace();
  const w = housingWords(words.locale);
  const [open, setOpen] = useState(false);
  return (
    <section className="live-section housing-section" aria-labelledby="housing-title">
      <div className="live-section-head">
        <h2 id="housing-title">{w.title}</h2>
      </div>
      <Button variant="outline" aria-expanded={open} aria-controls="housing-body" onClick={() => startTransition(() => setOpen(!open))}>
        {open ? w.hide : w.show}
      </Button>
      <div id="housing-body">{open && <HousingProviders year={year} read={read} lines={lines} />}</div>
    </section>
  );
}

/** Rent paid to each landlord across the fiscal year, read only once the summary is opened. */
function HousingProviders({ year, read, lines }: { year: number; read: ReadHousing; lines: ReportLines }) {
  const { money, monthLabel } = lines;
  const { data, sampleSaid, words } = useWorkspace();
  const w = housingWords(words.locale);
  const report = read(year, true);
  const [done, setDone] = useState("");
  const language = words.locale;

  if (!report) return <p className="housing-note" role="status">{w.loading}</p>;

  function save() {
    if (!report) return;
    const name = housingFileName(report, data.church.name);
    saveFile(new Blob([housingCsv(report, data.church.name, data.church.sample, words, lines)], { type: "text/csv;charset=utf-8" }), name);
    startTransition(() => setDone(reportsWords(words).saved(name)));
  }

  if (report.landlords.length === 0) return <p className="housing-note">{w.empty}</p>;
  return (
    <div className="housing-body">
      <p className="housing-note">{w.deck}</p>
      <HousingFrame label={w.title}>
        <table className="housing-table">
          <thead>
            <tr>
              <th scope="col">{w.landlord}</th>
              {report.months.map((month) => (
                <th scope="col" key={month}>
                  <abbr title={monthLabel(month, false, words)}>{monthLabel(month, true, words)}</abbr>
                </th>
              ))}
              <th scope="col">{w.yearToDate}</th>
            </tr>
          </thead>
          <tbody>
            {report.landlords.map((line) => (
              <tr key={line.name}>
                <th scope="row">
                  {sampleSaid(line.name)}
                  <small>{w.payments(line.payments)}</small>
                </th>
                {line.months.map((cents, index) => (
                  <td key={report.months[index]}>{cents ? money(cents, language) : <span className="housing-none">–</span>}</td>
                ))}
                <td>{money(line.total, language)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{w.total}</th>
              {report.monthTotals.map((cents, index) => (
                <td key={report.months[index]}>{money(cents, language)}</td>
              ))}
              <td>{money(report.total, language)}</td>
            </tr>
          </tfoot>
        </table>
      </HousingFrame>
      <div className="live-row-actions">
        <Button variant="outline" onClick={save}>
          <Download size={17} aria-hidden="true" /> {w.download}
        </Button>
      </div>
      <p className="housing-note" role="status">{done}</p>
    </div>
  );
}

/** The table's scrolling frame. data-more is set while the last column is not wholly in view, which draws the 24px fade on the right edge; one IntersectionObserver, nothing in the scroll loop. */
export function HousingFrame({ label, children }: { label: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scroll.current;
    const last = root?.querySelector("thead th:last-child");
    if (!root || !last || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(
      ([entry]) => frame.current?.toggleAttribute("data-more", !!entry && entry.intersectionRatio < 0.98),
      { root, threshold: [0, 0.98, 1] },
    );
    watch.observe(last);
    return () => watch.disconnect();
  }, []);
  return (
    <div className="housing-frame" ref={frame}>
      <div className="housing-scroll" ref={scroll} tabIndex={0} role="region" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
