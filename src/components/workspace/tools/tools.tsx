"use client";

import "./tools.css";
import Link from "next/link";
import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { NeighborsImport } from "@/components/workspace/tools/neighbors-import";
import { RequestsImport } from "@/components/workspace/tools/requests-import";
import { MembersImport } from "@/components/workspace/tools/members-import";
import { PayeesImport } from "@/components/workspace/tools/payees-import";
import { useWorkspace } from "@/components/workspace/context";
import { LiveState } from "@/components/workspace/states";
import { RecordsExport } from "@/components/workspace/tools/records-export";

/** Your files: bring records in, then take them with you. The calendar address and the printed week live in their own rooms. */
/** Fetched with the room only once the room is drawn: most visits to Tools never run the check. */
/** Drawn only for an owner, never in the sample: fetched only when it is. */
const CloseConference = lazy(() => import("@/components/workspace/closing/close-conference").then((module) => ({ default: module.CloseConference })));
const RecordsCheck = lazy(() => import("@/components/workspace/tools/records-check").then((module) => ({ default: module.RecordsCheck })));

export function ToolsSection() {
  const { data, words } = useWorkspace();
  // The same people the server lets read neighbor records (convex/access.ts, mayOpenNeighborRecords): the group's owner and coordinators.
  // A team coordinator who types the address is told why it is empty, as a member is.
  const role = data.people.find((person) => person.id === data.user.id)?.role;
  if (role !== "owner" && role !== "coordinator")
    return (
      <div className="tools-private">
        <LiveState
          kind="private"
          title={words.states.privateTitle}
          action={
            <Button variant="outline" asChild>
              <Link href="/app/mine">{words.states.privateAction}</Link>
            </Button>
          }
        >
          {words.states.privateDeckTools}
        </LiveState>
      </div>
    );
  return (
    <>
      <div className="tools-leaves paper-rows">
        <NeighborsImport />
        <RequestsImport />
        <MembersImport />
        <PayeesImport />
        <RecordsExport />
        <Suspense><RecordsCheck /></Suspense>
      </div>
      {/* The last thing in the room, after the way to take everything out. It draws only for an owner, never in the sample. */}
      <Suspense><CloseConference /></Suspense>
    </>
  );
}
