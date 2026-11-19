"use client";

import { FollowingHeading } from "@/components/workspace/primitives";
import "./report-book.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { cut, seeded } from "@/components/workspace/volunteer/week-quilt";
import { placeTurn, setTurnGeometry, turnGeometry, type TurnGeometry } from "@/lib/page-turn";
import { fill } from "@/lib/words/fill";
import { count, kindLabels, longSpanLabel, money, periodLabel, type YearReport } from "@/components/workspace/reports/lines";

/** A turn by keys or arrows takes this long; a drag follows the hand. */
const TURN = 620;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const dollars = (cents: number) => money(Math.round(cents / 100) * 100);

/** What lies open: one sheet on a phone; from 1280px two facing pages, the cover alone on the right. */
type View = { left?: number; right: number };
const views = (pages: number, facing: boolean): View[] =>
  facing
    ? [{ right: 0 }, ...Array.from({ length: Math.ceil((pages - 1) / 2) }, (_, at) => ({ left: 1 + at * 2, right: Math.min(pages - 1, 2 + at * 2) }))]
    : Array.from({ length: pages }, (_, at) => ({ right: at }));

function usePages(report: YearReport, groupName: string, sample: boolean) {
  const { words, sampleSaid } = useWorkspace();
  const w = words.rooms.reports;
  const b = w.book;
  const kinds = kindLabels(words);
  const period = `${periodLabel(report, words)}: ${longSpanLabel(report, words, !report.closed)}`;
  const shownKinds = report.kinds.filter((line) => line.requests > 0 || line.paid > 0);
  const serving = [
    { name: w.time.visits, hours: report.visitHours },
    ...report.time.teams.map((team) => ({ name: sampleSaid(team.name), hours: team.hours })),
  ];
  const figures = (rows: { label: string; value: string }[]) => (
    <table className="book-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return [
    {
      key: "cover",
      body: (
        <div className="book-cover">
          <p className="book-group">{groupName}</p>
          <FollowingHeading>{b.cover}</FollowingHeading>
          <p className="book-period">{period}</p>
          <p className="book-total">{fill(b.coverTotal(report.history.householdsInAll), { amount: dollars(report.helpPaid) })}</p>
          {/* The year's mark: the quilt's own three papers, a call, a visit and a yes, laid as a small patch. */}
          <span className="book-mark" aria-hidden="true">
            {(["call", "visit", "yes"] as const).map((kind) => (
              <span key={kind} className="week-quilt-piece" data-kind={kind} style={{ "--lean": `${((seeded(`${report.year}${kind}`, 9) - 0.5) * 5).toFixed(2)}deg` } as CSSProperties}>
                <i style={{ clipPath: cut(`${report.year}${kind}`) }} />
              </span>
            ))}
          </span>
          {sample && <p className="book-sample">{b.sample}</p>}
        </div>
      ),
    },
    {
      key: "counts",
      title: b.counts,
      body: figures([
        { label: w.year.calls, value: count(report.calls.taken) },
        { label: w.year.requests, value: count(report.requests.received) },
        { label: w.sheet.visits, value: count(report.visits) },
        { label: w.sheet.helpGiven, value: dollars(report.helpPaid) },
      ]),
    },
    {
      key: "kinds",
      title: b.byKind,
      body: (
        <table className="book-table book-columns">
          <thead>
            <tr>
              <th scope="col">{b.kind}</th>
              <th scope="col">{b.requests}</th>
              <th scope="col">{b.households}</th>
              <th scope="col">{b.paid}</th>
            </tr>
          </thead>
          <TableEnd
            rows={shownKinds.map((line) => (
              <tr key={line.kind}>
                <th scope="row">{kinds[line.kind]}</th>
                <td>{count(line.requests)}</td>
                <td>{count(line.households)}</td>
                <td>{line.kind === "voucher" && line.paid === 0 ? "—" : dollars(line.paid)}</td>
              </tr>
            ))}
          >
            <tr className="book-total">
              <th scope="row">{b.total}</th>
              <td>{count(report.requests.received)}</td>
              <td>{count(report.history.householdsInAll)}</td>
              <td>{dollars(report.helpPaid)}</td>
            </tr>
            <NoteRow span={4} notes={[...(shownKinds.some((line) => line.kind === "voucher" && line.paid === 0) ? [b.vouchersNote] : []), b.householdsNote]} />
          </TableEnd>
        </table>
      ),
    },
    {
      key: "hours",
      title: b.hoursMiles,
      body: (
        <table className="book-table book-columns">
          <thead>
            <tr>
              <th scope="col">{b.given}</th>
              <th scope="col">{w.time.hours}</th>
            </tr>
          </thead>
          <TableEnd
            rows={serving.map((line) => (
              <tr key={line.name}>
                <th scope="row">{line.name}</th>
                <td>{count(line.hours)}</td>
              </tr>
            ))}
          >
            <tr className="book-total">
              <th scope="row">{b.allHours}</th>
              <td>{count(report.time.hours)}</td>
            </tr>
            {/* Miles are not hours: the row says its own unit, and is not weighted as a total of the column above it. */}
            <tr className="book-apart">
              <th scope="row">{b.miles}</th>
              <td>{w.time.milesCount(report.visitMiles)}</td>
            </tr>
            <NoteRow span={2} notes={[b.hoursNote]} />
          </TableEnd>
        </table>
      ),
    },
    {
      key: "served",
      title: b.served,
      body: figures([
        { label: b.householdsHelped, value: count(report.history.householdsInAll) },
        { label: b.peopleInAll, value: count(report.history.peopleInAll) },
      ]),
    },
  ] satisfies { key: string; title?: string; body: ReactNode }[];
}

/**
 * A table's body, with its last two rows, its totals and its notes held as one closing group: a printed page never
 * opens on a total with only the head row above it, nor on a note alone.
 */
function TableEnd({ rows, children }: { rows: ReactNode[]; children: ReactNode }) {
  return (
    <>
      {rows.length > 2 && <tbody>{rows.slice(0, -2)}</tbody>}
      {/* The total comes straight after the table's rows: its last row is the one whose rule it takes (report-book.css). */}
      <tbody className="book-end" data-before-total={Math.min(rows.length, 2) || undefined}>
        {rows.slice(-2)}
        {children}
      </tbody>
    </>
  );
}

/**
 * A table's notes are its last row, so a printed page can never part them from the rows they speak of. On screen the
 * row draws as the plain notes under the table did.
 */
function NoteRow({ span, notes }: { span: number; notes: string[] }) {
  return (
    <tr className="book-note-row">
      <td colSpan={span}>
        {notes.map((note) => <p key={note} className="book-note">{note}</p>)}
      </td>
    </tr>
  );
}

/** One sheet as it is printed: its title, its body and its number at the foot. */
function Sheet({ page, at, of, label }: { page: { title?: string; body: ReactNode }; at: number; of: number; label: string }) {
  const pageOf = useWorkspace().words.rooms.reports.book.page;
  return (
    <article className="book-sheet" aria-label={label}>
      {page.title && <h3>{page.title}</h3>}
      {page.body}
      {/* The cover carries no number: a count of screen sheets would not match the printed pages. */}
      {at > 0 && <p className="book-folio">{fill(pageOf, { page: String(at + 1), pages: String(of) })}</p>}
    </article>
  );
}

/**
 * The year's report bound as a few sheets lying on the desk: a cover, the year's counts, help by kind, hours and miles,
 * and the people served, every figure the report query's own. A page is turned from its lower right corner with the
 * shared page turn (lib/page-turn.ts), by a drag of the corner, the arrows or the arrow keys; what is lifted shows its
 * bare back. With less motion a page is simply changed. "Print these pages" prints exactly these sheets.
 */
export function ReportBook({ report, groupName, sample = false }: { report: YearReport; groupName: string; sample?: boolean }) {
  const { words } = useWorkspace();
  const b = words.rooms.reports.book;
  const pages = usePages(report, groupName, sample);
  const [facing, setFacing] = useState(false);
  useLayoutEffect(() => {
    const wide = matchMedia("(min-width: 1280px)");
    const read = () => setFacing(wide.matches);
    read();
    wide.addEventListener("change", read);
    return () => wide.removeEventListener("change", read);
  }, []);
  const open = views(pages.length, facing);
  const [at, setAt] = useState(0);
  const shown = open[Math.min(at, open.length - 1)];
  /** A page being turned: forward lifts the shown right page off the next; back lays the last one down again. */
  const [turning, setTurning] = useState<null | { to: number; leaf: number; under: number }>(null);
  const turn = useRef<HTMLDivElement>(null);
  const geometry = useRef<TurnGeometry | null>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [printing, setPrinting] = useState(false);

  const parts = () => {
    const root = turn.current;
    const part = (name: string) => root?.querySelector<HTMLElement>(`.book-turn-${name}`);
    const round = part("round"), page = part("page"), back = part("back"), roll = part("roll"), shade = part("shade");
    return root && round && page && back && roll && shade ? { root, round, page, back, roll, shade } : null;
  };
  const place = useCallback((turned: number) => {
    const found = parts();
    if (!found || !geometry.current) return;
    found.root.dataset.turned = placeTurn(geometry.current, found, turned);
  }, []);

  /** The turn's parts are laid to the leaf's size before any turn, so a turn begins by moving them and nothing else. */
  useLayoutEffect(() => {
    const root = turn.current;
    if (!root) return;
    const lay = () => {
      geometry.current = turnGeometry(root.clientWidth, root.clientHeight);
      setTurnGeometry(root, geometry.current);
      root.style.setProperty("--turn-h", `${root.clientHeight}px`);
      root.dataset.laid = "";
    };
    lay();
    const sizes = new ResizeObserver(lay);
    sizes.observe(root);
    return () => sizes.disconnect();
  }, [facing]);
  /** A turn back begins with the last page lifted right over. */
  useLayoutEffect(() => {
    if (turning && turning.to < at) place(1);
  }, [turning, at, place]);

  /** Between turns the leaf lies flat again, its parts at rest. */
  useLayoutEffect(() => {
    const found = parts();
    if (turning || !found) return;
    found.root.dataset.turned = "no";
    for (const part of [found.round, found.page, found.back, found.roll, found.shade]) part.style.transform = "";
  }, [turning, at]);

  const run = useCallback((from: number, to: number, done: () => void) => {
    let start = 0;
    const step = (time: number) => {
      if (!start) start = time;
      const t = Math.min(1, (time - start) / (TURN * Math.abs(to - from) + 1));
      place(from + (to - from) * easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  }, [place]);

  const go = (to: number) => {
    if (turning || to < 0 || to >= open.length || to === at) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setAt(to);
    const forward = to > at;
    setTurning({ to, leaf: forward ? open[at].right : open[to].right, under: forward ? open[to].right : open[at].right });
  };

  /** Once the leaf is laid, a turn by keys or arrows runs on its own; a drag is led by the hand. */
  useEffect(() => {
    if (!turning || drag.current) return;
    const forward = turning.to > at;
    run(forward ? 0 : 1, forward ? 1 : 0, () => {
      setAt(turning.to);
      setTurning(null);
    });
  }, [turning, at, run]);

  const lift = (event: PointerEvent<HTMLSpanElement>) => {
    if (turning || at >= open.length - 1 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    setTurning({ to: at + 1, leaf: open[at].right, under: open[at + 1].right });
  };
  const follow = (event: PointerEvent<HTMLSpanElement>) => {
    const held = drag.current, found = geometry.current;
    if (!held || !found) return;
    // How far the corner has been drawn back along the page's diagonal, as a share of the whole turn.
    place(clamp((((event.clientX - held.x) * found.nx + (event.clientY - held.y) * found.ny) / found.far) * 1.6));
  };
  const letGo = (event: PointerEvent<HTMLSpanElement>) => {
    const held = drag.current, found = geometry.current, target = turning;
    if (!held || !found || !target) return;
    drag.current = null;
    const reached = clamp((((event.clientX - held.x) * found.nx + (event.clientY - held.y) * found.ny) / found.far) * 1.6);
    // Past a third the page goes over; short of it, it is laid back down.
    if (reached > 1 / 3) run(reached, 1, () => { setAt(target.to); setTurning(null); });
    else run(reached, 0, () => setTurning(null));
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); go(at + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(at - 1); }
  };

  /** Prints these sheets alone, each on its own page. */
  const print = () => {
    setPrinting(true);
    requestAnimationFrame(() => {
      document.documentElement.dataset.printBook = "";
      const after = () => {
        delete document.documentElement.dataset.printBook;
        setPrinting(false);
        removeEventListener("afterprint", after);
      };
      addEventListener("afterprint", after);
      window.print();
    });
  };

  const label = (index: number) => fill(b.page, { page: String(index + 1), pages: String(pages.length) });
  const sheet = (index: number | undefined) =>
    index === undefined ? null : <Sheet key={pages[index].key} page={pages[index]} at={index} of={pages.length} label={label(index)} />;
  const left = turning && turning.to < at ? open[turning.to].left : shown.left;
  const right = turning ? turning.leaf : shown.right;

  return (
    <section className="report-book" aria-labelledby="report-book-title">
      {/* Named as a heading too, so the sheets' own headings sit under one: the page's h1, then this, then each sheet. */}
      <h2 id="report-book-title" className="sr-only">{b.label}</h2>
      <div className="book-desk" data-facing={facing ? "" : undefined} tabIndex={0} onKeyDown={keys} aria-roledescription={b.label}>
        {/* Opposite the closed cover lies the inside board with what the book holds, so the spread reads as a book. */}
        {facing && (
          <div className="book-left">
            {left === undefined ? (
              <article className="book-sheet book-contents" aria-label={b.contents}>
                <h3>{b.contents}</h3>
                <ol>{pages.slice(1).map((page) => <li key={page.key}>{page.title}</li>)}</ol>
              </article>
            ) : (
              sheet(left)
            )}
          </div>
        )}
        <div className="book-right">
          {/* Every sheet laid in one place, out of sight: the page is as tall as its longest sheet, or a letter page if
              that is taller, with no measuring (report-book.css). */}
          <div className="book-measure" aria-hidden="true" inert>{pages.map((_, index) => sheet(index))}</div>
          {/* The next page already lies beneath, so a turn only has to lift the leaf off it. */}
          <div className="book-under" aria-hidden="true">{sheet(turning ? turning.under : open[at + 1]?.right)}</div>
          <div ref={turn} className="book-turn" data-turned="no">
            <div className="book-turn-shade" aria-hidden="true" />
            <div className="book-turn-round">
              <div className="book-turn-page">
                {sheet(right)}
                <div className="book-turn-back" aria-hidden="true"><div className="book-turn-under"><div className="book-turn-roll" /></div></div>
              </div>
            </div>
          </div>
          {at < open.length - 1 && <span className="book-corner" aria-hidden="true" onPointerDown={lift} onPointerMove={follow} onPointerUp={letGo} onPointerCancel={letGo} />}
        </div>
      </div>
      <div className="book-foot">
        <Button variant="ghost" size="icon" aria-label={b.previous} disabled={at === 0} onClick={() => go(at - 1)}><ChevronLeft aria-hidden="true" /></Button>
        <span className="sr-only" aria-live="polite">{label(facing && shown.left !== undefined ? shown.left : shown.right)}</span>
        <Button variant="ghost" size="icon" aria-label={b.next} disabled={at >= open.length - 1} onClick={() => go(at + 1)}><ChevronRight aria-hidden="true" /></Button>
        <button type="button" className="book-print" onClick={print}>{b.print}</button>
      </div>
      {printing && createPortal(<div className="report-book-print" aria-hidden="true">{pages.map((_, index) => sheet(index))}</div>, document.body)}
    </section>
  );
}
