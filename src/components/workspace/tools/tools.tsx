"use client";

import "./tools.css";
import { CalendarAddress } from "@/components/workspace/tools/calendar-address";
import { WeeklyRota } from "@/components/workspace/tools/weekly-rota";
import { MembersImport } from "@/components/workspace/tools/members-import";
import { PayeesImport } from "@/components/workspace/tools/payees-import";
import { RecordsExport } from "@/components/workspace/tools/records-export";

/** Calendar, print and spreadsheets: the section for the tools a group already uses. Not in the menu until Joe says yes. */
export function ToolsSection() {
  return (
    <>
      <CalendarAddress />
      <WeeklyRota />
      <MembersImport />
      <PayeesImport />
      <RecordsExport />
    </>
  );
}
