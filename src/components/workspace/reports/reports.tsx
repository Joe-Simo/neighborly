"use client";

import { Component, useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { useAction } from "convex/react";
import { useHour, useQuery } from "@/components/workspace/query";
import { DateTime } from "luxon";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { sayFailure } from "@/components/workspace/failure";
import type { Words } from "@/lib/words";
import { HelpRoom } from "@/components/workspace/help-line/room";
import { LiveFailure, LiveState } from "@/components/workspace/states";
import { csvFileName, isBlank, reportCsv } from "@/components/workspace/reports/lines";
import { YearCheck, YearChecking, type YearCheckResult } from "@/components/workspace/reports/year-check";
import {
  ReportLoading,
  QuarterSwitch,
  ReportView,
  YearSwitch,
  type Quarter,
} from "@/components/workspace/reports/report-view";

/** Says what happened and what to do when the year cannot be read, and leaves the rest of the workspace standing. */
class ReportBoundary extends Component<{ words: Words; children: ReactNode }, { failed: boolean; cause: unknown }> {
  state = { failed: false, cause: undefined as unknown };
  static getDerivedStateFromError(cause: unknown) {
    return { failed: true, cause };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const { words } = this.props;
    return (
      <LiveState
        kind="error"
        title={words.rooms.reports.failed.title}
        action={
          <Button variant="outline" onClick={() => this.setState({ failed: false, cause: undefined })}>
            {words.states.tryAgain}
          </Button>
        }
      >
        {/* The backend's own sentence when it refused (a year too large to add up), calm words otherwise. */}
        {sayFailure(words.notices, this.state.cause, words.rooms.reports.failed.safe, words.states.offlineSave)}
      </LiveState>
    );
  }
}

function Report() {
  const { data, now, sampleSaid, setHeadAction, words } = useWorkspace();
  const w = words.rooms.reports;
  const churchId = data.church.id;
  const at = useHour();
  const onRecord = useQuery(api.reports.years, at ? { churchId, at } : "skip");
  const [chosen, setChosen] = useState<number>();
  const [quarter, setQuarter] = useState<Quarter>();
  const [done, setDone] = useState("");
  const checkYear = useAction(api.drafts.checkYear);
  const [check, setCheck] = useState<{ year: number; result?: YearCheckResult; at?: number; failed?: string }>();

  // The yearly report is written in the fall, so until January the year that just closed opens first.
  const today = DateTime.fromMillis(now, { zone: data.church.timeZone });
  const fall = today.month >= 10;
  const year =
    chosen ??
    (onRecord &&
      (fall && onRecord.years.includes(onRecord.current - 1) ? onRecord.current - 1 : onRecord.current));
  const report = useQuery(api.reports.year, year === undefined || !at ? "skip" : { churchId, at: settledHour(at, year, quarter, data.church.timeZone), year, quarter });
  // The year last shown stays on screen while the next one is added up.
  const [shown, setShown] = useState(report);
  if (report && report !== shown) setShown(report);

  const found = check?.year === year ? check : undefined;
  const flags = found?.result?.flags ?? [];
  const records = useQuery(
    api.reports.flagged,
    flags.length
      ? {
          churchId,
          requestIds: flags.flatMap(({ record }) => (record.table === "assistanceRequests" ? [record.id] : [])),
          visitIds: flags.flatMap(({ record }) => (record.table === "visits" ? [record.id] : [])),
        }
      : "skip",
  );
  const checking = Boolean(found && !found.result && !found.failed);
  const lookOver = useCallback(async () => {
    if (year === undefined) return;
    setDone("");
    setCheck({ year });
    try {
      setCheck({ year, result: await checkYear({ churchId, year }), at: Date.now() });
    } catch (cause) {
      setCheck({ year, failed: sayFailure(words.notices,cause, w.check.failed, words.states.offlineSave) });
    }
  }, [checkYear, churchId, year, w, words]);
  // The check reads a whole year, so it steps aside while a quarter is shown.
  // It does not wait for the figures: the button arrives with the heading (frame thread, on the coordinator's word).
  // A whole year with nothing recorded in it has nothing to check and no quarter to turn to.
  const blankYear = Boolean(shown && !shown.quarter && isBlank(shown));
  const canCheck = year !== undefined && !quarter && !found?.result && !blankYear;
  // A conference in its first year may have nothing yet: the button keeps its place unseen until the figures say.
  const maybeBlank = !shown && (onRecord?.years.length ?? 0) <= 1;
  useLayoutEffect(() => {
    if (!canCheck) return;
    // Once the sheet is open the button has done its work, so it leaves the head.
    setHeadAction({ label: checking ? w.check.checking : w.check.button, run: () => void (checking || lookOver()), quiet: checking, unsettled: maybeBlank });
    return () => setHeadAction(null);
  }, [canCheck, checking, lookOver, maybeBlank, setHeadAction, w]);

  if (!onRecord || !shown || year === undefined) return <ReportLoading />;

  function saveSpreadsheet(saved: NonNullable<typeof shown>) {
    const name = csvFileName(saved, data.church.name);
    const address = URL.createObjectURL(new Blob([reportCsv(saved, data.church.name, data.church.sample, words, sampleSaid)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: address, download: name });
    link.click();
    URL.revokeObjectURL(address);
    setDone(w.saved(name));
  }

  return (
    <ReportView
      report={shown}
      groupName={data.church.name}
      sample={data.church.sample}
      thisMonth={today.toFormat("yyyy-MM")}
      printed={now}
      done={done}
      years={
        // Over a blank year the quarters go, and with one year on record nothing is left to switch.
        (!blankYear || onRecord.years.length > 1) && (
        <div className="report-switches">
          <YearSwitch
            years={onRecord.years}
            current={onRecord.current}
            year={year}
            onYear={(next) => {
              setDone("");
              setChosen(next);
            }}
          />
          {!blankYear && (
            <QuarterSwitch
              quarter={quarter}
              onQuarter={(next) => {
                setDone("");
                setQuarter(next);
              }}
            />
          )}
        </div>
        )
      }
      sheet={
        checking && !quarter ? (
          <YearChecking words={words} requests={shown.requests.received} visits={shown.visits} />
        ) : found?.failed ? (
          <LiveFailure message={found.failed} kept={w.check.kept} />
        ) : (
          found?.result &&
          !quarter && (
            <YearCheck
              words={words}
              result={found.result}
              records={records}
              checked={{ requests: shown.requests.received, visits: shown.visits, at: found.at ?? now }}
              timeZone={data.church.timeZone}
              onClose={() => setCheck(undefined)}
            />
          )
        )
      }
      printNext={Boolean(found?.result && !found.result.flags.length && !quarter)}
      onPrint={() => window.print()}
      onSpreadsheet={() => saveSpreadsheet(shown)}
    />
  );
}

/**
 * The hour a year's report is asked about. A period over for a day adds up the same at any later hour (its last
 * shifts have ended), so it is asked about that one hour: every visitor, all day, shares one answer that Convex
 * keeps, instead of the whole year being read again each hour. A period still open is asked about the present hour.
 */
function settledHour(at: number, year: number, quarter: Quarter | undefined, zone: string) {
  const first = DateTime.fromObject({ year: year - 1, month: 10, day: 1 }, { zone }).plus({ months: quarter ? 3 * (quarter - 1) : 0 });
  const settled = first.plus({ months: quarter ? 3 : 12, days: 1 }).toMillis();
  const hour = Math.ceil(settled / 3_600_000) * 3_600_000;
  return at >= hour ? hour : at;
}

export function ReportsSection() {
  const { words } = useWorkspace();
  return (
    <HelpRoom loading={words.rooms.reports.opening}>
      <ReportBoundary words={words}>
        <Report />
      </ReportBoundary>
    </HelpRoom>
  );
}
