"use client";

import { AssistantGuide } from "@/components/workspace/week-note/assistant-limits";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { WeeklyRota } from "@/components/workspace/tools/weekly-rota";
import { upcomingCommitments, withoutIncomingRequests } from "@/lib/commitment-visibility";
import { isBrandNew } from "@/lib/first-days";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { StartHere } from "@/components/workspace/start-here";
import { CardGreeting } from "@/components/workspace/volunteer/card-greeting";
import { WeekNote } from "@/components/workspace/week-note/week-note";
import {
  CommitmentRows,
  IncomingRequests,
  useAcceptedArrival,
  incomingRequests,
} from "@/components/workspace/volunteer/commitment-rows";

export function WeekSection() {
  const { data, now, format, words, isOwner } = useWorkspace();
  // The owner alone, nothing made yet: one first-week state stands in for the empty lists, and the head carries "Invite someone".
  const firstDays = isBrandNew(data);
  const first = words.rooms.firstDays.week;
  const [printing, setPrinting] = useState(false);
  const weekEnd = now + 7 * 86400000;
  const upcoming = upcomingCommitments(data.commitments, now);
  const incoming = incomingRequests(data);
  const { held, fresh, requests } = useAcceptedArrival();
  // Once the note has been kept short for a request, it stays short for this visit: answering the last
  // request must not unfold the whole note under the person's hand.
  const [briefed, setBriefed] = useState(false);
  if (incoming.length > 0 && !briefed) setBriefed(true);
  return (
    <>
      <CardGreeting />
      <StartHere />
      <WeekNote brief={briefed || incoming.length > 0} />
      <IncomingRequests {...requests} place={words.week.comingUp} />
      {firstDays ? (
        <LiveEmpty title={first.title}>
          {first.detail}
        </LiveEmpty>
      ) : (
      /* From 1100px what is coming up and what the group has said sit side by side, so neither waits under the other. */
      <div className="min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] min-[1100px]:items-start min-[1100px]:gap-x-14">
      <section className="live-section">
        <div className="live-section-head">
          <h2>{words.week.comingUp}</h2>
          <span className="live-count">{words.week.nextSevenDays}</span>
          {(isOwner || data.canCoordinate) && (
            <Button variant="link" className="tools-quiet" data-opens="" onClick={() => setPrinting(true)}>{words.week.printWeek}</Button>
          )}
        </div>
        <CommitmentRows
          items={withoutIncomingRequests(upcoming.filter((item) => item.start <= weekEnd && item.id !== held), incoming)}
          fresh={fresh}
          empty={{ title: incoming.length ? words.week.choiceAboveTitle : words.week.quietTitle, detail: incoming.length ? words.week.choiceAboveDetail : words.week.quietDetail }}
        />
      </section>
      <section className="live-section">
        <div className="live-section-head">
          <h2>{words.week.fromGroup}</h2>
        </div>
        {data.announcements.length ? (
          <div className="live-list">
            {data.announcements.map((item) => (
              <article className="live-row" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p className="live-prep">{item.body}</p>
                  <div className="live-meta">
                    {item.authorName} · {format(item.createdAt)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <LiveEmpty title={words.week.noAnnouncementsTitle}>
            {words.week.noAnnouncementsDetail}
          </LiveEmpty>
        )}
      </section>
      </div>
      )}
      <p className="!mt-14 !mb-0 border-t border-[var(--live-line)] pt-3">
        <AssistantGuide />
      </p>
      {printing && (
        <LiveDialog title={words.week.printWeek} className="tools-rota-dialog" onClose={() => setPrinting(false)}>
          <WeeklyRota titled={false} />
        </LiveDialog>
      )}
    </>
  );
}
