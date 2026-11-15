"use client";

import "./tools.css";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NeighborsImport } from "@/components/workspace/tools/neighbors-import";
import { RequestsImport } from "@/components/workspace/tools/requests-import";
import { MembersImport } from "@/components/workspace/tools/members-import";
import { PayeesImport } from "@/components/workspace/tools/payees-import";
import { useWorkspace } from "@/components/workspace/context";
import { LiveState } from "@/components/workspace/states";
import { RecordsExport } from "@/components/workspace/tools/records-export";

/** Your files: bring records in, then take them with you. The calendar address and the printed week live in their own rooms. */
export function ToolsSection() {
  const { data, isOwner, words } = useWorkspace();
  // The menu shows this room to coordinators and owners only. A member who types the address is told why it is empty.
  if (!isOwner && !data.canCoordinate)
    return (
      <LiveState
        kind="private"
        title="For your coordinators."
        action={
          <Button variant="outline" asChild>
            <Link href="/app/mine">{words.states.privateAction}</Link>
          </Button>
        }
      >
        Bringing records in and taking them out is theirs to do. Your own commitments are where they always are.
      </LiveState>
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
