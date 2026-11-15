"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { WeeklyRota } from "@/components/workspace/tools/weekly-rota";
import { upcomingCommitments, withoutIncomingRequests } from "@/lib/commitment-visibility";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { WeekNote } from "@/components/workspace/week-note/week-note";
import {
  CommitmentRows,
  IncomingRequests,
  incomingRequests,
} from "@/components/workspace/volunteer/commitment-rows";

export function WeekSection() {
  const { data, now, format, words, isOwner } = useWorkspace();
  const [printing, setPrinting] = useState(false);
  const weekEnd = now + 7 * 86400000;
  const upcoming = upcomingCommitments(data.commitments, now);
  const incoming = incomingRequests(data);
  return (
    <>
      <WeekNote brief={incoming.length > 0} />
      <IncomingRequests />
      <section className="live-section">
        <div className="live-section-head">
          <h2>{words.week.comingUp}</h2>
          <span className="live-count">{words.week.nextSevenDays}</span>
          {(isOwner || data.canCoordinate) && (
            <Button variant="link" className="tools-quiet" onClick={() => setPrinting(true)}>{words.week.printWeek}</Button>
          )}
        </div>
        <CommitmentRows
          items={withoutIncomingRequests(upcoming.filter((item) => item.start <= weekEnd), incoming)}
          empty={{ title: incoming.length ? words.week.choiceAboveTitle : words.week.quietTitle, detail: incoming.length ? words.week.choiceAboveDetail : words.week.quietDetail }}
        />
      </section>
      <section className="live-section">
        <h2>{words.week.fromGroup}</h2>
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
      {printing && (
        <LiveDialog title={words.week.printWeek} className="tools-rota-dialog" onClose={() => setPrinting(false)}>
          <WeeklyRota titled={false} />
        </LiveDialog>
      )}
    </>
  );
}
