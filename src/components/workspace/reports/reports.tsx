"use client";

import { Component, useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { useAction, useQuery } from "convex/react";
import { DateTime } from "luxon";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { HelpRoom } from "@/components/workspace/help-line/room";
import { csvFileName, reportCsv } from "@/components/workspace/reports/lines";
import { YearCheck, type YearCheckResult } from "@/components/workspace/reports/year-check";
import {
  ReportLoading,
  QuarterSwitch,
  ReportView,
  YearSwitch,
  type Quarter,
} from "@/components/workspace/reports/report-view";

/** Says what happened and what to do when the year cannot be read, and leaves the rest of the workspace standing. */
class ReportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="live-error report-error" role="alert">
        <p>The year couldn’t be added up just now. Your records are safe and nothing was changed.</p>
        <p className="live-error-recovery">Check your connection, then try again.</p>
        <Button variant="outline" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    );
  }
}

function Report() {
  const { data, now, setHeadAction } = useWorkspace();
  const churchId = data.church.id;
  const onRecord = useQuery(api.reports.years, { churchId });
  const [chosen, setChosen] = useState<number>();
  const [quarter, setQuarter] = useState<Quarter>();
  const [done, setDone] = useState("");
  const checkYear = useAction(api.drafts.checkYear);
  const [check, setCheck] = useState<{ year: number; result?: YearCheckResult; failed?: boolean }>();

  // The yearly report is written in the fall, so until January the year that just closed opens first.
  const today = DateTime.fromMillis(now, { zone: data.church.timeZone });
  const fall = today.month >= 10;
  const year =
    chosen ??
    (onRecord &&
      (fall && onRecord.years.includes(onRecord.current - 1) ? onRecord.current - 1 : onRecord.current));
  const report = useQuery(api.reports.year, year === undefined ? "skip" : { churchId, year, quarter });
  // The year last shown stays on screen while the next one is added up.
  const [shown, setShown] = useState(report);
  if (report && report !== shown) setShown(report);

  const found = check?.year === year ? check : undefined;
  const flaggedRequests = found?.result?.flags.flatMap(({ record }) => (record.table === "assistanceRequests" ? [record.id] : [])) ?? [];
  const homes = useQuery(api.reports.requestHomes, flaggedRequests.length ? { churchId, requestIds: flaggedRequests } : "skip");

  const checking = Boolean(found && !found.result && !found.failed);
  const lookOver = useCallback(async () => {
    if (year === undefined) return;
    setDone("");
    setCheck({ year });
    try {
      setCheck({ year, result: await checkYear({ churchId, year }) });
    } catch {
      setCheck({ year, failed: true });
    }
  }, [checkYear, churchId, year]);
  // The check reads a whole year, so it steps aside while a quarter is shown.
  const canCheck = year !== undefined && !quarter && Boolean(shown);
  useLayoutEffect(() => {
    if (!canCheck) return;
    // Filled until its sheet is open; then the sheet is the thing to read.
    setHeadAction({ label: checking ? "Checking" : "Check before you send", run: () => void (checking || lookOver()), quiet: checking || Boolean(found?.result) });
    return () => setHeadAction(null);
  }, [canCheck, checking, found?.result, lookOver, setHeadAction]);

  if (!onRecord || !shown || year === undefined) return <ReportLoading />;

  function saveSpreadsheet(saved: NonNullable<typeof shown>) {
    const name = csvFileName(saved, data.church.name);
    const address = URL.createObjectURL(new Blob([reportCsv(saved, data.church.name)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: address, download: name });
    link.click();
    URL.revokeObjectURL(address);
    setDone(`Saved ${name} to your downloads. It opens in Excel, Numbers or Google Sheets.`);
  }

  return (
    <ReportView
      report={shown}
      groupName={data.church.name}
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
        found?.failed ? (
          <div className="live-error report-error" role="alert">
            <p>The check couldn’t run just now. The report itself is not affected.</p>
            <p className="live-error-recovery">Try again in a minute. You can still print or save the year.</p>
          </div>
        ) : (
          found?.result &&
          !quarter && (
            <YearCheck
              result={found.result}
              homes={new Map(homes?.map((home) => [home.requestId, home.neighborId]))}
              onClose={() => setCheck(undefined)}
            />
          )
        )
      }
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
