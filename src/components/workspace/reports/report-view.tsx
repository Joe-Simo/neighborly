"use client";

import "./reports.css";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HelpDone, HelpEmpty } from "@/components/workspace/help-line/room";
import { CountUp, LiveLoading } from "@/components/workspace/primitives";
import {
  count,
  dayLabel,
  isBlank,
  kindLabels,
  longSpanLabel,
  money,
  monthLabel,
  periodLabel,
  periodNoun,
  plural,
  reportLines,
  spanLabel,
  type ReportLine,
  type YearReport,
} from "@/components/workspace/reports/lines";

const share = (part: number, of: number): CSSProperties =>
  ({ "--share": `${of > 0 ? Math.max(0, Math.round((part / of) * 1000) / 10) : 0}%` }) as CSSProperties;

const wholeDollars = (cents: number) => money(Math.round(cents / 100) * 100);

/**
 * One of the year's figures. Once the room is shown they count up once, 60ms apart; a change of year rolls on from there.
 * `step` is the smallest amount shown on the way (100 for money, which is kept in cents). Still under Reduce Motion.
 */
function Figure({
  value,
  order,
  step = 1,
  format = count,
}: {
  value: number;
  order: number;
  step?: number;
  format?: (amount: number) => string;
}) {
  return (
    <CountUp
      value={value}
      delay={90 + order * 60}
      format={(amount) => format(amount === value ? value : Math.max(0, Math.round(amount / step) * step))}
    />
  );
}

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
  if (years.length < 2) return null;
  return (
    <ToggleGroup
      type="single"
      className="report-years"
      aria-label="Fiscal year"
      value={String(year)}
      onValueChange={(value) => value && onYear(Number(value))}
    >
      {[...years].reverse().map((option) => (
        <ToggleGroupItem key={option} value={String(option)}>
          {option}
          {option === current && <span>so far</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const quarters = [
  { value: "year", label: "All year" },
  { value: "1", label: "Oct–Dec" },
  { value: "2", label: "Jan–Mar" },
  { value: "3", label: "Apr–Jun" },
  { value: "4", label: "Jul–Sep" },
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
  return (
    <ToggleGroup
      type="single"
      className="report-years report-quarters"
      aria-label="Part of the year"
      value={quarter ? String(quarter) : "year"}
      onValueChange={(value) => {
        const chosen = quarters.find((option) => option.value === value);
        if (chosen) onQuarter(chosen.value === "year" ? undefined : (Number(chosen.value) as Quarter));
      }}
    >
      {quarters.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
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
  /** The month whose exact figures are held up in a tip, as "yyyy-MM". */
  const [tip, setTip] = useState<string>();
  /** Months whose tip, held above them, would lie over the caption at the right of the heading: theirs is held to the left instead. */
  const [crowded, setCrowded] = useState<ReadonlySet<string>>(new Set());
  const months = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const chart = months.current;
    const caption = chart?.parentElement?.querySelector(".live-section-head .live-count");
    if (!chart || !caption) return;
    const measure = () => {
      const kept = caption.getBoundingClientRect();
      // A tip is about 240px wide and 150px tall, centred over its month.
      const found = [...chart.querySelectorAll<HTMLElement>(".report-month-open")].flatMap((month) => {
        const cell = month.getBoundingClientRect();
        const middle = cell.left + cell.width / 2;
        return cell.top - 150 < kept.bottom && middle + 128 > kept.left && month.dataset.month ? [month.dataset.month] : [];
      });
      setCrowded((before) => (before.size === found.length && found.every((month) => before.has(month)) ? before : new Set(found)));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(chart);
    return () => watch.disconnect();
  }, [report]);
  const soFar = report.closed ? "" : " so far";
  const noun = periodNoun(report);
  const blank = isBlank(report);
  const noCallBack = report.calls.taken - report.calls.returned - report.calls.waiting;
  const period = (
    <div className="report-period">
      <p>
        <span>{periodLabel(report)}</span>
        {longSpanLabel(report)}
        {soFar && ", so far"}
      </p>
      <div className="report-controls">
        {years}
        {!blank && (
          <div className="live-row-actions report-actions">
            <Button variant={printNext ? "default" : "outline"} onClick={onPrint}>
              <Printer size={17} aria-hidden="true" /> Print this {noun}
            </Button>
            <Button variant="outline" onClick={onSpreadsheet}>
              <Download size={17} aria-hidden="true" /> Download as a spreadsheet
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (blank)
    return (
      <div className="report">
        {period}
        <HelpEmpty
          title="Nothing to add up yet."
          action={
            <Button variant="outline" asChild>
              <Link href="/app/help-line">Open the help line</Link>
            </Button>
          }
        >
          As calls, visits and payments are recorded, this {noun}’s counts
          appear here on their own.
        </HelpEmpty>
      </div>
    );

  const moved = report.history.requests > 0;
  const largestKind = Math.max(...report.kinds.map((line) => line.paid));
  const largestMonth = Math.max(...report.months.map((line) => line.paid));
  const mostVisits = Math.max(...report.months.map((line) => line.visits));
  const serving = [
    { name: "Home visits", detail: `${plural(report.visits, "visit")}, always in pairs`, hours: report.visitHours },
    ...report.time.teams.map((team) => ({
      name: team.name,
      detail: `${plural(team.shifts, "shift")} · ${plural(team.people, "person", "people")}`,
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
      label: inPart > 0 ? `Paid, ${count(inPart)} of them in part` : "Paid",
      value: report.requests.paid + inPart,
    },
    { is: "approved", label: "Approved, waiting to be paid", value: report.requests.approved },
    { is: "open", label: "Waiting for a decision", value: report.requests.open },
    { is: "declined", label: "Declined", value: report.requests.declined },
    { is: "closed", label: "Closed without help", value: report.requests.closed - report.requests.closedAfterPart.requests },
  ].filter((outcome) => outcome.value > 0);
  const printedOn = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: report.timeZone }).format(printed);
  // The foot of every printed page, set in the page margin so it never covers a line.
  const quoted = (text: string) => `"${text.replace(/[\\"]/g, "\\$&").replace(/\s+/g, " ")}"`;
  const printedLine = `${sample ? "Sample · " : ""}Printed ${printedOn}`;
  const pageFoot = `@media print { @page year-report { margin: 14mm 14mm 19mm; @bottom-left { content: ${quoted(`${groupName} · ${periodLabel(report)}, ${spanLabel(report)}`)}; font: 9pt "Source Sans 3", sans-serif; color: #000; } @bottom-right { content: ${quoted(`${printedLine} · page `)} counter(page) " of " counter(pages); font: 9pt "Source Sans 3", sans-serif; color: #000; } } }`;
  const sections = new Map<string, ReportLine[]>();
  for (const line of reportLines(report))
    sections.set(line.section, [...(sections.get(line.section) ?? []), line]);

  return (
    <div className="report">
      <style>{pageFoot}</style>
      <header className="report-print-head">
        <div>
          <p>{groupName}</p>
          <h1>The year, added up.</h1>
          <p>
            {periodLabel(report)}: {longSpanLabel(report)}
            {soFar && ", so far"}
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
            <strong>{voucherMoney ? "Paid direct or given as vouchers" : "Paid direct"}</strong>, never in cash.{" "}
            {report.helpPaid % 100 !== 0 && `${money(report.helpPaid)} to the cent. `}
            {plural(report.history.householdsInAll, "household")} helped, {plural(report.history.peopleInAll, "person", "people")} in
            all, {spanLabel(report)}
            {soFar}.
          </dt>
          <dd className="report-year-paid">
            {/* The year's figure stands on its months: twelve thin sheets, each as thick as that month's share of
                the help paid, laid from the first month at the back to the last at the front. */}
            <span className="report-year-pile" ref={pile}>
              {/* The pile is as wide as the year's whole figure from the first frame, so nothing moves while it counts up. */}
              <span className="report-year-measure" aria-hidden="true">{money(Math.round(report.helpPaid / 100) * 100)}</span>
              <span className="report-year-figure">
                <Figure value={Math.round(report.helpPaid / 100) * 100} order={0} step={100} format={money} />
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
          { label: "Calls taken", value: report.calls.taken },
          { label: "Requests received", value: report.requests.received },
          { label: "Home visits, in pairs", value: report.visits },
        ].map((figure, order) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd>
              <span>
                <b>
                  <Figure value={figure.value} order={order + 1} />
                </b>
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {/* On paper the year is one sheet a council can file: the year's total over four figures, then each kind of
          help as a table. Set as plain words, since a printed page does not count up. */}
      <dl className="report-sheet-figures">
        <div className="report-sheet-total">
          <dt>Help given</dt>
          <dd>
            {money(report.helpPaid)}
            <small>
              {voucherMoney ? "Paid direct or given as vouchers, never in cash" : "Paid direct, never in cash"}, {spanLabel(report)}
              {soFar}.{moved && ` ${money(report.history.amount)} more is in ServWare history.`}
            </small>
          </dd>
        </div>
        <div>
          <dt>Neighbors helped</dt>
          <dd>
            {count(report.history.householdsInAll)}
            <small>
              Households, {plural(report.history.peopleInAll, "person", "people")} in all
            </small>
          </dd>
        </div>
        <div>
          <dt>Home visits</dt>
          <dd>
            {count(report.visits)}
            <small>Always in pairs</small>
          </dd>
        </div>
        <div>
          <dt>Calls taken</dt>
          <dd>
            {count(report.calls.taken)}
            <small>{count(report.calls.returned)} returned</small>
          </dd>
        </div>
        <div>
          <dt>Hours given</dt>
          <dd>
            {count(report.time.hours)}
            <small>{plural(report.visitMiles, "mile")} driven to visits</small>
          </dd>
        </div>
      </dl>

      <div className="live-section-head">
        <h2>By kind of help</h2>
      </div>
      <ol className="help-bars">
        {report.kinds.map((line) => {
          // Vouchers with no money paid are a count: no bar and no dollar figure, since a count is not on the dollar scale.
          const counted = line.kind === "voucher" && line.paid <= 0 && report.vouchers.given > 0;
          const people = plural(line.people, "person", "people");
          return (
            <li key={line.kind} data-counted={counted ? "" : undefined}>
              <div>
                <h3>{kindLabels[line.kind]}</h3>
                <p>
                  {counted
                    ? `Given from the shelf · ${people}`
                    : line.kind === "voucher" && report.vouchers.given > 0
                      ? `${plural(report.vouchers.given, "voucher")} given · ${money(line.paid)} paid · ${people}`
                      : line.requestsPaid > 0
                        ? `${plural(line.requestsPaid, "request")} paid · ${people}`
                        : report.closed
                          ? `None this ${noun}`
                          : `None yet this ${noun}`}
                </p>
              </div>
              <div className="help-bar" aria-hidden="true">
                {!counted && <span style={share(line.paid, largestKind)} />}
              </div>
              <span className="help-amount">{counted ? plural(report.vouchers.given, "voucher") : wholeDollars(line.paid)}</span>
            </li>
          );
        })}
      </ol>
      <table className="report-kinds-print">
        <thead>
          <tr>
            <th scope="col">Kind of help</th>
            <th scope="col">Requests paid</th>
            <th scope="col">People</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {report.kinds.map((line) => {
            const counted = line.kind === "voucher" && line.paid <= 0 && report.vouchers.given > 0;
            return (
              <tr key={line.kind}>
                <th scope="row">{kindLabels[line.kind]}</th>
                <td>{counted ? "Given from the shelf" : count(line.requestsPaid)}</td>
                <td>{count(line.people)}</td>
                <td>{counted ? plural(report.vouchers.given, "voucher") : money(line.paid)}</td>
              </tr>
            );
          })}
          {/* The total is the table's last row, not a footer: a printed footer is a part some browsers carry over
              to a page of its own. */}
          <tr className="report-kinds-total">
            <th scope="row">All help</th>
            <td>{count(report.kinds.reduce((all, line) => all + line.requestsPaid, 0))}</td>
            <td />
            <td>{money(report.helpPaid)}</td>
          </tr>
        </tbody>
      </table>
      {moved && (
        <p className="report-history">
          <span>From ServWare history</span>
          {plural(report.history.requests, "request")} for{" "}
          {plural(report.history.households, "household")}, {money(report.history.amount)} in help
          recorded before you moved here. It is counted apart from the money in your ledger.
        </p>
      )}

      <section className="live-section">
        <div className="live-section-head">
          <h2>Month by month</h2>
          <span className="live-count">
            <i className="report-key" aria-hidden="true" />Help paid, and <span className="report-key-pair"><i className="report-key" data-of="visits" aria-hidden="true" />the visits behind it</span>
          </span>
        </div>
        <ol className="report-months" data-months={report.months.length} ref={months}>
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
                <h3>
                  {monthLabel(line.month, true)}
                  <span className="report-sr"> {line.month.slice(0, 4)}</span>
                </h3>
                {ahead ? (
                  <p>Still to come</p>
                ) : (
                  <>
                    {/* Whole dollars here; the cents are in the tip, the table and the ledger. */}
                    <p className="help-amount">{wholeDollars(line.paid)}</p>
                    <p>{plural(line.visits, "visit")}</p>
                    <Popover open={tip === line.month} onOpenChange={(open) => setTip(open ? line.month : undefined)}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="report-month-open"
                          data-month={line.month}
                          // The month read as one sentence: "May 2026: $1,630 paid, 11 visits."
                          aria-label={`${monthLabel(line.month)}: ${wholeDollars(line.paid)} paid, ${plural(line.visits, "visit")}.`}
                          onFocus={(event) => {
                            if (event.currentTarget.matches(":focus-visible")) setTip(line.month);
                          }}
                          onBlur={() => setTip((shown) => (shown === line.month ? undefined : shown))}
                          // A mouse resting on the month holds the tip up; a click while it rests there must not put it away.
                          onPointerEnter={(event) => {
                            if (event.pointerType === "mouse") setTip(line.month);
                          }}
                          onPointerLeave={(event) => {
                            if (event.pointerType === "mouse" && !event.currentTarget.matches(":focus-visible"))
                              setTip((shown) => (shown === line.month ? undefined : shown));
                          }}
                          onClick={(event) => {
                            if (tip === line.month && event.currentTarget.matches(":hover") && matchMedia("(hover: hover)").matches) event.preventDefault();
                          }}
                        />
                      </PopoverTrigger>
                      <PopoverContent
                        className="report-tip"
                        side={crowded.has(line.month) ? "left" : "top"}
                        align={crowded.has(line.month) ? "start" : "center"}
                        collisionPadding={12}
                        onOpenAutoFocus={(event) => event.preventDefault()}
                        onCloseAutoFocus={(event) => event.preventDefault()}
                      >
                        <p className="report-tip-month">{monthLabel(line.month)}</p>
                        <p className="help-amount">{money(line.paid)}</p>
                        <p>
                          in help paid, {plural(line.visits, "visit")}
                        </p>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {report.requests.received > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>What became of each request</h2>
            <span className="live-count">
              {plural(report.requests.received, "request")} received
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
                ? `${count(report.requests.paidLater.requests)} of the paid requests, ${money(report.requests.paidLater.amount)} in all, ${report.requests.paidLater.requests === 1 ? "was" : "were"} paid after ${dayLabel(report.lastDay)}.`
                : `${money(report.requests.paidLater.amount)} of what was approved was paid after ${dayLabel(report.lastDay)}.`}{" "}
              That money counts in the period it was paid, so it is not in help paid here.
            </p>
          )}
        </section>
      )}

      <section className="live-section">
        <div className="live-section-head">
          <h2>Time given</h2>
          <span className="live-count">
            {plural(report.time.activeMembers, "active member")}
          </span>
        </div>
        <dl className="help-figures">
          <div>
            <dt>Hours</dt>
            <dd>
              <Figure value={report.time.hours} order={3} />
              <small>
                {serving
                  .filter((line) => line.hours > 0)
                  .map((line) => `${line.name} ${count(line.hours)}`)
                  .join(" · ") || "No hours recorded yet"}
              </small>
            </dd>
          </div>
          <div>
            <dt>Miles</dt>
            <dd>
              <Figure value={report.visitMiles} order={4} />
              <small>Driven to home visits</small>
            </dd>
          </div>
          <div>
            <dt>Calls returned</dt>
            <dd>
              <Figure value={report.calls.returned} order={5} />
              <small>
                Of {plural(report.calls.taken, "call")} taken
                {noCallBack > 0 && <span className="report-own-line">{count(noCallBack)} needed no call back</span>}
              </small>
            </dd>
          </div>
        </dl>
        {report.time.teams.length > 0 && (
          <ol className="help-bars report-teams">
            {serving.map((line) => (
              <li key={line.name}>
                <div>
                  <h3>{line.name}</h3>
                  <p>{line.detail}</p>
                </div>
                <div className="help-bar" aria-hidden="true">
                  <span style={share(line.hours, mostHours)} />
                </div>
                <span className="help-amount">{plural(line.hours, "hour")}</span>
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
          {everyLine ? "Hide the lines" : "Show every line"}
          <ChevronDown size={17} aria-hidden="true" />
        </Button>
        <div className="live-section-head">
          <h2>Line by line</h2>
          <span className="live-count">For your council’s {report.quarter ? "quarterly" : "yearly"} report</span>
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
              <caption>Each member’s time</caption>
              <tbody>
                {report.time.members.map((line) => (
                  <tr key={line.memberId}>
                    <th scope="row">
                      {line.name}
                      <small>
                        {[
                          line.visits > 0 && plural(line.visits, "visit"),
                          line.shifts > 0 && plural(line.shifts, "shift"),
                          line.miles > 0 && plural(line.miles, "mile"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </th>
                    <td>{plural(line.hours, "hour")}</td>
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
          These counts come from your own records. Nothing is typed in twice,
          and no neighbor is named. The labels are plain words, not yet the
          line names of the Society’s official form. Visits to prisons,
          hospitals and care homes, and goods given in kind, are not recorded
          here yet.
        </span>
      </p>
      <footer className="report-print-foot">
        <strong>kind helps</strong>
        <span>
          {groupName} · {periodLabel(report)}, {spanLabel(report)} · {printedLine}
        </span>
      </footer>
    </div>
  );
}
