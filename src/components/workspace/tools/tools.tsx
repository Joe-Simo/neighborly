"use client";

import "./tools.css";
import { NeighborsImport } from "@/components/workspace/tools/neighbors-import";
import { RequestsImport } from "@/components/workspace/tools/requests-import";
import { MembersImport } from "@/components/workspace/tools/members-import";
import { PayeesImport } from "@/components/workspace/tools/payees-import";
import { useWorkspace } from "@/components/workspace/context";
import { LiveEmpty } from "@/components/workspace/primitives";
import { RecordsExport } from "@/components/workspace/tools/records-export";

/** Your files: bring records in, then take them with you. The calendar address and the printed week live in their own rooms. */
export function ToolsSection() {
  const { data, isOwner } = useWorkspace();
  // The menu shows this room to coordinators and owners only. A member who types the address is told why it is empty.
  if (!isOwner && !data.canCoordinate)
    return (
      <section className="live-section">
        <LiveEmpty title="Nothing for you to do here.">
          Bringing records in and taking them out is for your coordinators. Your own commitments are under My commitments.
        </LiveEmpty>
      </section>
    );
  return (
    <div className="tools-leaves paper-rows">
      <NeighborsImport />
      <RequestsImport />
      <MembersImport />
      <PayeesImport />
      <RecordsExport />
    </div>
  );
}
