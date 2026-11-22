"use client";

import { saveFile } from "@/lib/save-file";
import { useState } from "react";
import Papa from "papaparse";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { useWorkspace } from "@/components/workspace/context";
import { count, money, longSpanLabel, type YearReport } from "@/components/workspace/reports/lines";
import { notTracked, svdpForm, type FormLine } from "@/components/workspace/reports/svdp-form";
import type { Language } from "@/lib/words";
import "@/components/workspace/reports/svdp-sheet.css";

const said = {
  en: {
    open: "National annual report",
    title: (year: number) => `Conference Annual Report, fiscal year ${year}`,
    deck: "The Society’s national form, filled from your records. Lines Kind Helps does not keep say so; fill them in by hand.",
    section: "Section", line: "Line", what: "What it asks", value: "From your records", note: "Note",
    print: "Print the form", download: "Download as a spreadsheet",
    signed: "Conference president", treasurer: "Conference treasurer", date: "Date",
    stillOpen: "The year is still running: these figures are so far.",
  },
  es: {
    open: "Informe anual nacional",
    title: (year: number) => `Informe anual de la conferencia, año fiscal ${year}`,
    deck: "El formulario nacional de la Sociedad, lleno con tus registros. Las líneas que Kind Helps no guarda lo dicen; llénalas a mano.",
    section: "Sección", line: "Línea", what: "Lo que pide", value: "Según tus registros", note: "Nota",
    print: "Imprimir el formulario", download: "Descargar como hoja de cálculo",
    signed: "Presidencia de la conferencia", treasurer: "Tesorería de la conferencia", date: "Fecha",
    stillOpen: "El año sigue en curso: estas cifras son hasta ahora.",
  },
} satisfies Record<Language, unknown>;

/** The Society's national annual form for the whole fiscal year, printable and as a spreadsheet. Loaded only when Reports is open. */
export default function SvdpSheet({ report }: { report: YearReport }) {
  const { data, words } = useWorkspace();
  const locale = words.locale;
  const w = said[locale];
  const [open, setOpen] = useState(false);
  const sections = svdpForm(report, locale);
  const shown = (line: FormLine) => (line.value === null ? notTracked(locale) : "cents" in line.value ? money(line.value.cents, locale) : count(line.value.count, locale));
  const title = w.title(report.year);
  const period = longSpanLabel(report, words, !report.closed);

  function download() {
    const rows = sections.flatMap((section) => section.lines.map((line) => [section.title, line.code, line.line, line.value === null ? notTracked(locale) : "cents" in line.value ? (line.value.cents / 100).toFixed(2) : line.value.count, line.note ?? ""]));
    const text = Papa.unparse([[data.church.name, title, period], [], [w.section, w.line, w.what, w.value, w.note], ...rows]);
    saveFile(new Blob([text], { type: "text/csv;charset=utf-8" }), `svdp-annual-report-${report.year}.csv`);
  }
  function print() {
    const root = document.documentElement;
    root.dataset.print = "svdp";
    window.addEventListener("afterprint", () => delete root.dataset.print, { once: true });
    window.print();
  }

  return (
    <>
      <Button type="button" variant="outline" className="svdp-open" onClick={() => setOpen(true)}>{w.open}</Button>
      {open && (
        <LiveDialog title={title} description={w.deck} closeLabel={words.shell.close} onClose={() => setOpen(false)} className="svdp-dialog">
          <div className="svdp-form">
            <p className="svdp-head"><strong>{data.church.name}</strong> · {period}</p>
            {!report.closed && <p>{w.stillOpen}</p>}
            {sections.map((section) => (
              <table key={section.title}>
                <caption>{section.title}</caption>
                <thead>
                  <tr><th scope="col">{w.line}</th><th scope="col">{w.what}</th><th scope="col">{w.value}</th></tr>
                </thead>
                <tbody>
                  {section.lines.map((line) => (
                    <tr key={`${line.code}${line.line}`} data-untracked={line.value === null ? "" : undefined}>
                      <td>{line.code}</td>
                      <th scope="row">{line.line}{line.note && <small>{line.note}</small>}</th>
                      <td>{shown(line)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
            <div className="svdp-sign">
              <p>{w.signed} ________________________ {w.date} ________</p>
              <p>{w.treasurer} ________________________ {w.date} ________</p>
            </div>
          </div>
          <div className="live-form-actions">
            <Button type="button" variant="ghost" data-foot-aside onClick={download}><Download aria-hidden="true" />{w.download}</Button>
            <Button type="button" onClick={print}><Printer aria-hidden="true" />{w.print}</Button>
          </div>
        </LiveDialog>
      )}
    </>
  );
}
