"use client";

import "./tools.css";
import { CalendarAddress } from "@/components/workspace/tools/calendar-address";
import { MembersImport } from "@/components/workspace/tools/members-import";

/** Calendar, print and spreadsheets: the section for the tools a group already uses. Not in the menu until Joe says yes. */
export function ToolsSection() {
  return (
    <>
      <CalendarAddress />
      <MembersImport />
    </>
  );
}
