"use client";

import { Component, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { DateTime } from "luxon";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { HelpRoom } from "@/components/workspace/help-line/room";
import { csvFileName, reportCsv } from "@/components/workspace/reports/lines";
import {
  ReportLoading,
  ReportView,
  YearSwitch,
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
  const { data, now } = useWorkspace();
  const churchId = data.church.id;
  const onRecord = useQuery(api.reports.years, { churchId });
  const [chosen, setChosen] = useState<number>();
  const [done, setDone] = useState("");

  // The yearly report is written in the fall, so until January the year that just closed opens first.
  const today = DateTime.fromMillis(now, { zone: data.church.timeZone });
  const fall = today.month >= 10;
  const year =
    chosen ??
    (onRecord &&
      (fall && onRecord.years.includes(onRecord.current - 1) ? onRecord.current - 1 : onRecord.current));
  const report = useQuery(api.reports.year, year === undefined ? "skip" : { churchId, year });
  // The year last shown stays on screen while the next one is added up.
  const [shown, setShown] = useState(report);
  if (report && report !== shown) setShown(report);

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
      done={done}
      years={
        <YearSwitch
          years={onRecord.years}
          current={onRecord.current}
          year={year}
          onYear={(next) => {
            setDone("");
            setChosen(next);
          }}
        />
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
