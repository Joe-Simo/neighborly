"use client";

import "./reports.css";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReportBook } from "@/components/workspace/reports/report-book";
import { HelpDone, HelpEmpty } from "@/components/workspace/help-line/room";
import { LiveLoading } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate } from "@/lib/words";
import { fill } from "@/lib/words/fill";
import {
  count,
  dayLabel,
  isBlank,
  kindLabels,
  longSpanLabel,
  money,
  monthLabel,
  periodLabel,
  reportLines,
  spanLabel,
  type ReportLine,
  type YearReport,
} from "@/components/workspace/reports/lines";

const share = (part: number, of: number): CSSProperties =>
  ({ "--share": `${of > 0 ? Math.max(0, Math.round((part / of) * 1000) / 10) : 0}%` }) as CSSProperties;

const wholeDollars = (cents: number) => money(Math.round(cents / 100) * 100);

/** The year is being added up: the one quiet line every room waits with. */
export function ReportLoading() {
  return <LiveLoading />;
}

export function YearSwitch({
  years,
  current,
  year,
  onYear,
}: {
  years: number[];
  current: number;
  year: number;
  onYear: (year: number) => void;
}) {
  const w = useWorkspace().words.rooms.reports.period;
  if (years.length < 2) return null;
  return (
    <ToggleGroup
      type="single"
      className="report-years"
      aria-label={w.label}
      value={String(year)}
      onValueChange={(value) => value && onYear(Number(value))}
    >
      {/* A fiscal year runs October to September, so it is named by both calendar years it spans: "2025–26". */}
      {[...years].reverse().map((option) => (
        <ToggleGroupItem key={option} value={String(option)}>
          {option - 1}–{String(option).slice(-2)}
          {option === current && <span>{w.soFar}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** The whole year, then each quarter with its first and last month: "Oct–Dec". The months' names come from the date formatter. */
const quarters = [
  { value: "year", months: null },
  { value: "1", months: ["2000-10", "2000-12"] },
  { value: "2", months: ["2000-01", "2000-03"] },
  { value: "3", months: ["2000-04", "2000-06"] },
  { value: "4", months: ["2000-07", "2000-09"] },
] as const;
export type Quarter = 1 | 2 | 3 | 4;

/** The whole year, or one quarter of it for the council's quarterly report. */
export function QuarterSwitch({
  quarter,
  onQuarter,
}: {
  quarter: Quarter | undefined;
  onQuarter: (quarter: Quarter | undefined) => void;
}) {
  const { words } = useWorkspace();
  const w = words.rooms.reports.period;
  return (
    <ToggleGroup
      type="single"
      className="report-years report-quarters"
      aria-label={w.part}
      value={quarter ? String(quarter) : "year"}
      onValueChange={(value) => {
        const chosen = quarters.find((option) => option.value === value);
        if (chosen) onQuarter(chosen.value === "year" ? undefined : (Number(chosen.value) as Quarter));
      }}
    >
      {quarters.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.months ? `${monthLabel(option.months[0], true, words)}–${monthLabel(option.months[1], true, words)}` : w.allYear}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function ReportView({
  report,
  groupName,
  sample,
  thisMonth,
  printed,
  years,
  done,
  onPrint,
  onSpreadsheet,
  sheet,
  printNext,
}: {
  report: YearReport;
  groupName: string;
  /** A sample conference of made-up people: printed pages say so. */
  sample?: boolean;
  /** Today's month as "yyyy-MM" in the group's time zone; later months of a running year are still to come. */
  thisMonth: string;
  /** Today, for the date at the foot of the printed page. */
  printed: number;
  /** The year switch, when the group has more than one year on record. */
  years?: React.ReactNode;
  /** What just happened, said in the green line. */
  done?: string;
  onPrint: () => void;
  onSpreadsheet: () => void;
  /** What the check found: the one sheet on this screen. */
  sheet?: React.ReactNode;
  /** The check came back clear, so printing is the next step and takes the one filled button. */
  printNext?: boolean;
}) {
  const { words, sampleSaid } = useWorkspace();
  const w = words.rooms.reports;
  const kinds = kindLabels(words);
  const [everyLine, setEveryLine] = useState(false);
  // The sheets are laid once a visit: coming back to Reports in the same tab, the pile is already standing.
  const pile = useRef<HTMLSpanElement>(null);
  const laidOnce = useRef(false);
  useLayoutEffect(() => {
    if (laidOnce.current || !pile.current) return;
    laidOnce.current = true;
    try {
      if (sessionStorage.getItem("report-pile-laid")) pile.current.dataset.laid = "";
      else sessionStorage.setItem("report-pile-laid", "1");
    } catch {
      // Without storage the pile is laid each time Reports opens.
    }
  }, []);
  /** The month whose exact figures the line under the chart holds, as "yyyy-MM": a press sets it, with nothing to open. */
  const [held, setHeld] = useState<string>();
  const heldLine = useId();
  const passed = report.months.filter((line) => line.month <= thisMonth);
  const shown = passed.find((line) => line.month === held) ?? passed.at(-1);
  const soFar = !report.closed;
  const span = spanLabel(report, words);
  const blank = isBlank(report);
  const noCallBack = report.calls.taken - report.calls.returned - report.calls.waiting;
  const period = (
    <div className="report-period">
      <p>
        <span>{periodLabel(report, words)}</span>
        {longSpanLabel(report, words, soFar)}
      </p>
      {(years || !blank) && <div className="report-controls">
        {years}
        {!blank && (
          <div className="live-row-actions report-actions">
            <Button variant={printNext ? "default" : "outline"} onClick={onPrint}>
              <Printer size={17} aria-hidden="true" /> {report.quarter ? w.actions.printQuarter : w.actions.printYear}
            </Button>
            <Button variant="outline" onClick={onSpreadsheet}>
              <Download size={17} aria-hidden="true" /> {w.actions.spreadsheet}
            </Button>
          </div>
        )}
      </div>}
    </div>
  );

  if (blank)
    return (
      <div className="report">
        {period}
        <HelpEmpty
          title={w.empty.title}
          action={
            <Button variant="outline" asChild>
              <Link href="/app/help-line">{w.empty.open}</Link>
            </Button>
          }
        >
          {report.quarter ? w.empty.quarter : w.empty.year}
        </HelpEmpty>
      </div>
    );

  const moved = report.history.requests > 0;
  const largestKind = Math.max(...report.kinds.map((line) => line.paid));
  const largestMonth = Math.max(...report.months.map((line) => line.paid));
  const mostVisits = Math.max(...report.months.map((line) => line.visits));
  const serving = [
    { name: w.time.visits, detail: w.time.visitsInPairs(report.visits), hours: report.visitHours },
    ...report.time.teams.map((team) => ({
      name: sampleSaid(team.name),
      detail: `${w.time.shifts(team.shifts)} · ${w.kinds.people(team.people)}`,
      hours: team.hours,
    })),
  ];
  const mostHours = Math.max(...serving.map((line) => line.hours));
  // A request closed after money went out was paid in part, so it stands with the paid ones.
  const inPart = report.requests.closedAfterPart.requests;
  const voucherMoney = report.kinds.some((line) => line.kind === "voucher" && line.paid > 0);
  const outcomes = [
    {
      is: "paid",
      label: inPart > 0 ? w.outcomes.paidInPart(inPart) : w.outcomes.paid(report.requests.paid),
      value: report.requests.paid + inPart,
    },
    { is: "approved", label: w.outcomes.approved(report.requests.approved), value: report.requests.approved },
    { is: "open", label: w.outcomes.open(report.requests.open), value: report.requests.open },
    { is: "declined", label: w.outcomes.declined(report.requests.declined), value: report.requests.declined },
    { is: "closed", label: w.outcomes.closed(report.requests.closed - report.requests.closedAfterPart.requests), value: report.requests.closed - report.requests.closedAfterPart.requests },
  ].filter((outcome) => outcome.value > 0);
  const printedOn = formatDate(words.locale, printed, { dateStyle: "long", timeZone: report.timeZone });
  // The foot of every printed page, set in the page margin so it never covers a line.
  const quoted = (text: string) => `"${text.replace(/[\\"]/g, "\\$&").replace(/\s+/g, " ")}"`;
  const printedLine = fill(sample ? w.foot.printedSample : w.foot.printed, { date: printedOn });
  // "page 2 of 5" is one sentence in the words; the printer puts its own two counters where the places are.
  const [pageBefore = "", pageBetween = "", pageAfter = ""] = w.foot.page.split(/\{pages?\}/);
  const pageCount = `${quoted(`${printedLine} · ${pageBefore}`)} counter(page) ${quoted(pageBetween)} counter(pages)${pageAfter ? ` ${quoted(pageAfter)}` : ""}`;
  const footLine = `${groupName} · ${periodLabel(report, words)}, ${span}`;
  const pageFoot = `@media print { @page year-report { margin: 14mm 14mm 19mm; @bottom-left { content: ${quoted(footLine)}; font: 9pt "Source Sans 3", "Source Sans 3 Fallback", sans-serif; font-feature-settings: "lnum" 1, "tnum" 1; color: #000; } @bottom-right { content: ${pageCount}; font: 9pt "Source Sans 3", "Source Sans 3 Fallback", sans-serif; font-feature-settings: "lnum" 1, "tnum" 1; color: #000; } } }`;
  const sections = new Map<string, ReportLine[]>();
  for (const line of reportLines(report, words, sampleSaid))
    sections.set(line.section, [...(sections.get(line.section) ?? []), line]);

  return (
    <div className="report">
      <style>{pageFoot}</style>
      <header className="report-print-head">
        <div>
          <p>{groupName}</p>
          <h1>{w.year.title}</h1>
          <p>
            {periodLabel(report, words)}: {longSpanLabel(report, words, soFar)}
          </p>
        </div>
        <strong>kind helps</strong>
      </header>
      {period}
      {sheet}
      {done && <HelpDone>{done}</HelpDone>}

      {/* The year as one cut piece: what was paid, standing on a ledge, with the calls, requests and visits that led to it. */}
      <dl className="report-year">
        <div>
          <dt>
            <strong>{voucherMoney ? w.year.paidDirectOrVouchers : w.year.paidDirect}</strong>{w.year.neverCash}{" "}
            {report.helpPaid % 100 !== 0 && `${fill(w.year.toCent, { amount: money(report.helpPaid) })} `}
            {fill(soFar ? w.year.reachSoFar : w.year.reach, {
              households: w.year.householdsHelped(report.history.householdsInAll),
              people: w.year.peopleInAll(report.history.peopleInAll),
              span,
            })}
          </dt>
          <dd className="report-year-paid">
            {/* The year's figure stands on its months: twelve thin sheets, each as thick as that month's share of
                the help paid, laid from the first month at the back to the last at the front. */}
            <span className="report-year-pile" ref={pile} style={{ "--figure-length": money(Math.round(report.helpPaid / 100) * 100).length } as CSSProperties}>
              {/* The pile is as wide as the year's whole figure from the first frame, so nothing moves while it counts up. */}
              <span className="report-year-measure" aria-hidden="true">{money(Math.round(report.helpPaid / 100) * 100)}</span>
              <span className="report-year-figure" data-stands="">
                <span className="count-up">{money(Math.round(report.helpPaid / 100) * 100)}</span>
              </span>
              <span className="report-stack" aria-hidden="true">
                {report.months.map((line) => (
                  <i key={line.month} style={{ "--share": report.helpPaid > 0 ? line.paid / report.helpPaid : 0 } as CSSProperties} />
                ))}
              </span>
            </span>
          </dd>
        </div>
        {[
          { label: w.year.calls, value: report.calls.taken },
          { label: w.year.requests, value: report.requests.received },
          { label: w.year.visitsInPairs, value: report.visits },
        ].map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd>
              <span>
                <b data-stands="">
                  <span className="count-up">{count(figure.value)}</span>
                </b>
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {/* The bound year follows the figure it binds: the story leads, its printable pages come after. */}
      {!report.quarter && <ReportBook report={report} groupName={groupName} sample={sample} />}

      {/* On paper the year is one sheet a council can file: the year's total over four figures, then each kind of
          help as a table. Set as plain words, since a printed page does not count up. */}
      <dl className="report-sheet-figures">
        <div className="report-sheet-total">
          <dt>{w.sheet.helpGiven}</dt>
          <dd>
            {money(report.helpPaid)}
            <small>
              {fill(voucherMoney ? (soFar ? w.sheet.vouchersSoFar : w.sheet.vouchers) : soFar ? w.sheet.directSoFar : w.sheet.direct, { span })}
              {moved && ` ${fill(w.sheet.more, { amount: money(report.history.amount) })}`}
            </small>
          </dd>
        </div>
        <div>
          <dt>{w.sheet.neighbors}</dt>
          <dd>
            {count(report.history.householdsInAll)}
            <small>
              {w.sheet.households(report.history.peopleInAll)}
            </small>
          </dd>
        </div>
        <div>
          <dt>{w.sheet.visits}</dt>
          <dd>
            {count(report.visits)}
            <small>{w.sheet.pairs}</small>
          </dd>
        </div>
        <div>
          <dt>{w.sheet.calls}</dt>
          <dd>
            {count(report.calls.taken)}
            <small>{w.sheet.returned(report.calls.returned)}</small>
          </dd>
        </div>
        <div>
          <dt>{w.sheet.hours}</dt>
          <dd>
            {count(report.time.hours)}
            <small>{w.sheet.miles(report.visitMiles)}</small>
          </dd>
        </div>
      </dl>

      <div className="live-section-head">
        <h2>{w.kinds.title}</h2>
      </div>
      <ol className="help-bars">
        {report.kinds.map((line) => {
          // Vouchers with no money paid are a count: no bar and no dollar figure, since a count is not on the dollar scale.
          const counted = line.kind === "voucher" && line.paid <= 0 && report.vouchers.given > 0;
          const people = w.kinds.people(line.people);
          return (
            <li key={line.kind} data-counted={counted ? "" : undefined}>
              <div>
                <h3>{kinds[line.kind]}</h3>
                <p>
                  {counted
                    ? w.kinds.fromShelfPeople(line.people)
                    : line.kind === "voucher" && report.vouchers.given > 0
                      ? `${w.kinds.vouchersGiven(report.vouchers.given)} · ${fill(w.kinds.amountPaid, { amount: money(line.paid) })} · ${people}`
                      : line.requestsPaid > 0
                        ? `${w.kinds.requestsPaid(line.requestsPaid)} · ${people}`
                        : report.closed
                          ? report.quarter ? w.kinds.noneQuarter : w.kinds.noneYear
                          : report.quarter ? w.kinds.noneYetQuarter : w.kinds.noneYetYear}
                </p>
              </div>
              <div className="help-bar" aria-hidden="true">
                {!counted && <span style={share(line.paid, largestKind)} />}
              </div>
              <span className="help-amount">{counted ? w.kinds.vouchers(report.vouchers.given) : wholeDollars(line.paid)}</span>
            </li>
          );
        })}
      </ol>
      <table className="report-kinds-print">
        <thead>
          <tr>
            <th scope="col">{w.kinds.table.kind}</th>
            <th scope="col">{w.kinds.table.requests}</th>
            <th scope="col">{w.kinds.table.people}</th>
            <th scope="col">{w.kinds.table.amount}</th>
          </tr>
        </thead>
        <tbody>
          {report.kinds.map((line) => {
            const counted = line.kind === "voucher" && line.paid <= 0 && report.vouchers.given > 0;
            return (
              <tr key={line.kind}>
                <th scope="row">{kinds[line.kind]}</th>
                <td>{counted ? w.kinds.fromShelf : count(line.requestsPaid)}</td>
                <td>{count(line.people)}</td>
                <td>{counted ? w.kinds.vouchers(report.vouchers.given) : money(line.paid)}</td>
              </tr>
            );
          })}
          {/* The total is the table's last row, not a footer: a printed footer is a part some browsers carry over
              to a page of its own. */}
          <tr className="report-kinds-total">
            <th scope="row">{w.kinds.table.all}</th>
            <td>{count(report.kinds.reduce((all, line) => all + line.requestsPaid, 0))}</td>
            <td />
            <td>{money(report.helpPaid)}</td>
          </tr>
        </tbody>
      </table>
      {moved && (
        <p className="report-history">
          <span>{w.history.title}</span>
          {fill(w.history.line, {
            requests: w.history.requests(report.history.requests),
            households: w.history.households(report.history.households),
            amount: money(report.history.amount),
          })}
        </p>
      )}

      <section className="live-section">
        <div className="live-section-head">
          <h2>{w.months.title}</h2>
          <span className="live-count">
            <i className="report-key" aria-hidden="true" />{w.months.keyPaid} <span className="report-key-pair"><i className="report-key" data-of="visits" aria-hidden="true" />{w.months.keyVisits}</span>
          </span>
        </div>
        <ol className="report-months" data-months={report.months.length}>
          {report.months.map((line) => {
            const ahead = line.month > thisMonth;
            return (
              <li
                key={line.month}
                data-quiet={ahead || (line.paid === 0 && line.visits === 0) ? "" : undefined}
                data-ahead={ahead ? "" : undefined}
              >
                <div className="report-month-bar" aria-hidden="true">
                  {/* Two strips of cut paper: the help paid, and behind it the visits that month, each against the year's largest. */}
                  {!ahead && line.visits > 0 && <i style={share(line.visits, mostVisits)} />}
                  {!ahead && line.paid > 0 && <span style={share(line.paid, largestMonth)} />}
                </div>
                {/* A month that has passed is said once, by its button below ("May 2026: $1,630 paid, 11 visits."): the label
                    and the two figures are for the eye, so a screen reader meets one line a month, in the order it is drawn. */}
                <h3 aria-hidden={ahead ? undefined : true}>
                  {monthLabel(line.month, true, words)}
                  <span className="report-sr"> {line.month.slice(0, 4)}</span>
                </h3>
                {ahead ? (
                  <p>{w.months.toCome}</p>
                ) : (
                  <>
                    {/* Whole dollars here; the cents are in the line under the chart, the table and the ledger. */}
                    <p className="help-amount" aria-hidden="true">{wholeDollars(line.paid)}</p>
                    <p aria-hidden="true">{w.months.visits(line.visits)}</p>
                    <button
                      type="button"
                      className="report-month-open"
                      data-month={line.month}
                      aria-pressed={shown?.month === line.month}
                      aria-controls={heldLine}
                      // The month read as one sentence: "May 2026: $1,630 paid, 11 visits."
                      aria-label={fill(w.months.said, { month: monthLabel(line.month, false, words), amount: wholeDollars(line.paid), visits: w.months.visits(line.visits) })}
                      onClick={() => setHeld(line.month)}
                      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHeld(line.month); }}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ol>
        {/* The month in hand, to the cent: the latest month that has passed until another is pressed. One line, always laid, so a press moves nothing. */}
        <p className="report-month-held" id={heldLine} aria-live="polite">
          {shown && <><span className="report-tip-month">{monthLabel(shown.month, false, words)}</span> <span className="help-amount">{money(shown.paid)}</span> <span>{w.months.tip(shown.visits)}</span></>}
        </p>
      </section>

      {report.requests.received > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>{w.outcomes.title}</h2>
            <span className="live-count">
              {w.outcomes.received(report.requests.received)}
            </span>
          </div>
          <div className="report-outcomes" aria-hidden="true">
            {outcomes.map((outcome) => (
              <span key={outcome.is} data-is={outcome.is} style={{ flexGrow: outcome.value }} />
            ))}
          </div>
          <ul className="report-legend">
            {outcomes.map((outcome) => (
              <li key={outcome.is} data-is={outcome.is}>
                <strong>{count(outcome.value)}</strong> {outcome.label}
              </li>
            ))}
          </ul>
          {report.requests.paidLater.amount > 0 && (
            <p className="report-aside">
              {report.requests.paidLater.requests > 0
                ? fill(report.requests.paidLater.requests === 1 ? w.outcomes.laterOne : w.outcomes.laterMany, {
                    count: count(report.requests.paidLater.requests),
                    amount: money(report.requests.paidLater.amount),
                    day: dayLabel(report.lastDay, words),
                  })
                : fill(w.outcomes.laterAmount, { amount: money(report.requests.paidLater.amount), day: dayLabel(report.lastDay, words) })}{" "}
              {w.outcomes.laterNote}
            </p>
          )}
        </section>
      )}

      <section className="live-section report-time">
        <div className="live-section-head">
          <h2>{w.time.title}</h2>
          <span className="live-count">
            {w.time.activeMembers(report.time.activeMembers)}
          </span>
        </div>
        {/* The year's time as cut paper, as the year's help is above: all its hours stand on one sheet for each kind of
            service, each as thick as its share; the miles and the calls returned stand beside them as two slips. */}
        <div className="report-hours">
          <figure className="report-hours-pile">
            <span className="report-hours-stand">
            <span className="report-hours-figure">{count(report.time.hours)}</span>
            <span className="report-hours-sheets" aria-hidden="true">
              {serving.map((line, at) => (
                <i key={line.name} data-line={at % 3} style={{ "--share": report.time.hours > 0 ? line.hours / report.time.hours : 0 } as CSSProperties} />
              ))}
            </span>
            </span>
            <figcaption>
              <strong>{w.book.allHours}</strong>
              {": "}
              {serving
                .filter((line) => line.hours > 0)
                .map((line) => `${line.name} ${count(line.hours)}`)
                .join(" · ") || w.time.noHours}
            </figcaption>
          </figure>
          <dl className="report-hours-slips">
            <div>
              <dt>
                {w.time.miles}
                <small>{w.time.driven}</small>
              </dt>
              <dd>
                <b>{count(report.visitMiles)}</b>
              </dd>
            </div>
            <div>
              <dt>
                {w.time.returned}
                <small>
                  {w.time.ofCalls(report.calls.taken)}
                  {noCallBack > 0 && <span className="report-own-line">{w.time.noCallBack(noCallBack)}</span>}
                </small>
              </dt>
              <dd>
                <b>{count(report.calls.returned)}</b>
              </dd>
            </div>
          </dl>
        </div>
        {report.time.teams.length > 0 && (
          <ol className="report-hours-lines">
            {serving.map((line, at) => (
              <li key={line.name}>
                <div>
                  <h3>{line.name}</h3>
                  <p>{line.detail}</p>
                </div>
                <span className="report-hours-strip" data-line={at % 3} aria-hidden="true">
                  <i style={share(line.hours, mostHours)} />
                </span>
                <span className="report-hours-amount">{w.time.hoursCount(line.hours)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="live-section report-lines" data-open={everyLine ? "" : undefined}>
        <Button
          variant="outline"
          className="report-every-line"
          aria-expanded={everyLine}
          aria-controls="report-every-line"
          onClick={() => setEveryLine(!everyLine)}
        >
          {everyLine ? w.lines.hide : w.lines.show}
          <ChevronDown size={17} aria-hidden="true" />
        </Button>
        <div className="live-section-head">
          <h2>{w.lines.title}</h2>
          <span className="live-count">{report.quarter ? w.lines.quarterly : w.lines.yearly}</span>
        </div>
        <div className="report-form" id="report-every-line">
          {[...sections].map(([name, lines]) => (
            <table key={name}>
              <caption>{name}</caption>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.line} data-total={line.total ? "" : undefined}>
                    <th scope="row">{line.line}</th>
                    <td>{line.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
        {report.time.members.length > 0 && (
          <div className="report-form report-members">
            <table>
              <caption>{w.lines.memberTime}</caption>
              <tbody>
                {report.time.members.map((line) => (
                  <tr key={line.memberId}>
                    <th scope="row">
                      {sampleSaid(line.name)}
                      <small>
                        {[
                          line.visits > 0 && w.months.visits(line.visits),
                          line.shifts > 0 && w.time.shifts(line.shifts),
                          line.miles > 0 && w.time.milesCount(line.miles),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </th>
                    <td>{w.time.hoursCount(line.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="help-footnote">
        <CircleCheck size={17} aria-hidden="true" />
        <span>
          {w.footnote}
        </span>
      </p>
      <footer className="report-print-foot">
        <strong>kind helps</strong>
        <span>
          {footLine} · {printedLine}
        </span>
      </footer>
    </div>
  );
}
