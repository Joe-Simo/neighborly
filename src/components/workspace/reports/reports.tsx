"use client";

import { Component, useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { useAction } from "convex/react";
import { useHour, useQuery } from "@/components/workspace/query";
import { DateTime } from "luxon";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { readFailure, stateWords } from "@/components/workspace/failure";
import { HelpRoom } from "@/components/workspace/help-line/room";
import { LiveFailure, LiveState } from "@/components/workspace/states";
import { csvFileName, reportCsv } from "@/components/workspace/reports/lines";
import { YearCheck, YearChecking, type YearCheckResult } from "@/components/workspace/reports/year-check";
import {
  ReportLoading,
  QuarterSwitch,
  ReportView,
  YearSwitch,
  type Quarter,
} from "@/components/workspace/reports/report-view";

/** Says what happened and what to do when the year cannot be read, and leaves the rest of the workspace standing. */
class ReportBoundary extends Component<{ children: ReactNode }, { failed: string }> {
  state = { failed: "" };
  static getDerivedStateFromError(cause: unknown) {
    // The backend's own sentence when it refused (a year too large to add up), calm words otherwise.
    return { failed: readFailure(cause, "Your records are safe and nothing was changed. Check your connection, then try again.") };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <LiveState
        kind="error"
        title="The year couldn’t be added up."
        action={
          <Button variant="outline" onClick={() => this.setState({ failed: "" })}>
            {stateWords.tryAgain}
          </Button>
        }
      >
        {this.state.failed}
      </LiveState>
    );
  }
}

function Report() {
  const { data, now, setHeadAction, words } = useWorkspace();
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
  const report = useQuery(api.reports.year, year === undefined || !at ? "skip" : { churchId, at, year, quarter });
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
      setCheck({ year, failed: readFailure(cause, "The check couldn’t run just now.") });
    }
  }, [checkYear, churchId, year]);
  // The check reads a whole year, so it steps aside while a quarter is shown.
  // It does not wait for the figures: the button arrives with the heading (frame thread, on the coordinator's word).
  const canCheck = year !== undefined && !quarter && !found?.result;
  useLayoutEffect(() => {
    if (!canCheck) return;
    // Once the sheet is open the button has done its work, so it leaves the head.
    setHeadAction({ label: checking ? "Checking…" : "Check before you send", run: () => void (checking || lookOver()), quiet: checking });
    return () => setHeadAction(null);
  }, [canCheck, checking, lookOver, setHeadAction]);

  if (!onRecord || !shown || year === undefined) return <ReportLoading />;

  function saveSpreadsheet(saved: NonNullable<typeof shown>) {
    const name = csvFileName(saved, data.church.name);
    const address = URL.createObjectURL(new Blob([reportCsv(saved, data.church.name, data.church.sample)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: address, download: name });
    link.click();
    URL.revokeObjectURL(address);
    setDone(`Saved ${name} to your downloads. It opens in Excel, Numbers or Google Sheets.`);
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
          <QuarterSwitch
            quarter={quarter}
            onQuarter={(next) => {
              setDone("");
              setQuarter(next);
            }}
          />
        </div>
      }
      sheet={
        checking && !quarter ? (
          <YearChecking requests={shown.requests.received} visits={shown.visits} />
        ) : found?.failed ? (
          <LiveFailure message={found.failed} kept="The report itself is not affected. You can still print or save the year." />
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

export function ReportsSection() {
  return (
    <HelpRoom loading="Opening the reports">
      <ReportBoundary>
        <Report />
      </ReportBoundary>
    </HelpRoom>
  );
}
