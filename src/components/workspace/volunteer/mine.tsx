"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { CalendarAddress } from "@/components/workspace/tools/calendar-address";
import { upcomingCommitments } from "@/lib/commitment-visibility";
import { useWorkspace } from "@/components/workspace/context";
import {
  CommitmentRows,
  IncomingRequests,
} from "@/components/workspace/volunteer/commitment-rows";
import { MyVisits } from "@/components/workspace/visits/my-visits";

export function MineSection() {
  const { data, now, words } = useWorkspace();
  const [calendar, setCalendar] = useState(false);
  const [fresh, setFresh] = useState<string>();
  const mine = upcomingCommitments(data.commitments, now).filter(
    (item) => item.assigneeId === data.user.id,
  );
  return (
    <>
      <IncomingRequests onAccepted={setFresh} />
      <MyVisits />
      <section className="live-section">
        <h2>{words.mine.accepted}</h2>
        <CommitmentRows items={mine} fresh={fresh} empty={{ title: words.mine.emptyTitle, detail: words.mine.emptyDetail }} />
        <p className="tools-quiet">
          <Button variant="link" onClick={() => setCalendar(true)}>{words.mine.addToCalendar}</Button>
        </p>
      </section>
      {calendar && (
        <LiveDialog title={words.mine.addToCalendar} onClose={() => setCalendar(false)}>
          <CalendarAddress titled={false} />
        </LiveDialog>
      )}
    </>
  );
}
