"use client";

import "./tools.css";
import { NeighborsImport } from "@/components/workspace/tools/neighbors-import";
import { RequestsImport } from "@/components/workspace/tools/requests-import";
import { MembersImport } from "@/components/workspace/tools/members-import";
import { PayeesImport } from "@/components/workspace/tools/payees-import";
import { RecordsExport } from "@/components/workspace/tools/records-export";

/** Your files: bring records in, then take them with you. The calendar address and the printed week live in their own rooms. */
export function ToolsSection() {
  return (
    <>
      <NeighborsImport />
      <RequestsImport />
      <MembersImport />
      <PayeesImport />
      <RecordsExport />
    </>
  );
}
