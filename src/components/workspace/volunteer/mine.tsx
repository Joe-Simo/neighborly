"use client";

import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useHour, useQuery } from "@/components/workspace/query";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { CalendarAddress } from "@/components/workspace/tools/calendar-address";
import { upcomingCommitments } from "@/lib/commitment-visibility";
import { useWorkspace } from "@/components/workspace/context";
import {
  CommitmentRows,
  IncomingRequests,
  useAcceptedArrival,
} from "@/components/workspace/volunteer/commitment-rows";
import { MyVisits } from "@/components/workspace/visits/my-visits";

export function MineSection() {
  const { data, now, words } = useWorkspace();
  const [calendar, setCalendar] = useState(false);
  const { held, fresh, requests } = useAcceptedArrival();
  const mine = upcomingCommitments(data.commitments, now).filter(
    (item) => item.assigneeId === data.user.id && item.id !== held,
  );
  // The calendar address carries accepted commitments and planned home visits: with neither there is nothing to add to a phone.
  // The visits are the same reading MyVisits keeps below, so nothing more is asked of the database.
  const at = useHour();
  const visits = useQuery(api.visits.mine, at ? { churchId: data.church.id, at } : "skip");
  const accepted =
    data.commitments.some((item) => item.assigneeId === data.user.id && item.end >= now && item.status !== "cancelled") ||
    Boolean(visits?.length);
  return (
    <>
      <IncomingRequests {...requests} place={words.mine.accepted} />
      <MyVisits />
      <section className="live-section mine-accepted">
        <h2 className={mine.length ? undefined : "sr-only"}>{words.mine.accepted}</h2>
        <CommitmentRows items={mine} fresh={fresh} empty={{ title: words.mine.emptyTitle, detail: words.mine.emptyDetail, go: "commitments" }} />
        {accepted && <p className="tools-quiet">
          <Button variant="link" onClick={() => setCalendar(true)}>{words.mine.addToCalendar}</Button>
        </p>}
      </section>
      {calendar && (
        <LiveDialog title={words.mine.addToCalendar} onClose={() => setCalendar(false)}>
          <CalendarAddress titled={false} />
        </LiveDialog>
      )}
    </>
  );
}
