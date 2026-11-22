"use client";

import { AssistantGuide } from "@/components/workspace/week-note/assistant-limits";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { WeeklyRota } from "@/components/workspace/tools/weekly-rota";
import { isBrandNew } from "@/lib/first-days";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { RoomAside, useFarScreen } from "@/components/workspace/aside";
import { StartHere } from "@/components/workspace/start-here";
import { FirstWeekSlips } from "@/components/workspace/first-week/first-week";
import { COMING_UP } from "@/components/workspace/first-week/first-week-state";
import { WeekQuilt } from "@/components/workspace/volunteer/week-quilt";
import { CardGreeting } from "@/components/workspace/volunteer/card-greeting";
import { WeekNote } from "@/components/workspace/week-note/week-note";
import { Glance } from "@/components/workspace/glance/glance";
import {
  CommitmentRows,
  IncomingRequests,
  useAcceptedArrival,
  incomingRequests,
  comingUp,
} from "@/components/workspace/volunteer/commitment-rows";

// Editing or removing an announcement is its own chunk: the week's first load does not carry it.
const AnnouncementChange = lazy(() => import("@/components/workspace/volunteer/announcement-change"));

export function WeekSection() {
  const { data, now, format, words, isOwner, sampleSaid, keepNames } = useWorkspace();
  // The owner alone, nothing made yet: one first-week state stands in for the empty lists, and the head carries "Invite someone".
  const firstDays = isBrandNew(data);
  const first = words.rooms.firstDays.week;
  const [printing, setPrinting] = useState(false);
  const [changing, setChanging] = useState<(typeof data.announcements)[number] | null>(null);
  const incoming = incomingRequests(data);
  const { held, fresh, requests } = useAcceptedArrival();
  // Once the note has been kept short for a request, it stays short for this visit: answering the last
  // request must not unfold the whole note under the person's hand.
  const [briefed, setBriefed] = useState(false);
  if (incoming.length > 0 && !briefed) setBriefed(true);
  const far = useFarScreen();
  // A choice that waits for this person comes first, right under the head, ahead of the week's figures, so it is met
  // before anything else. It is settled from the data on the first render and held for the visit: answering never moves
  // a section, and the answered card leaves in its own cut.
  const [choiceFirst] = useState(incoming.length > 0);
  const choices = <IncomingRequests {...requests} place={words.week.comingUp} />;
  const said = (
    <>
        {data.announcements.length ? (
          <div className="live-list">
            {data.announcements.map((item) => (
              <article className="live-row" key={item.id}>
                <div>
                  <h3>{keepNames(sampleSaid(item.title))}</h3>
                  <p className="live-prep">{sampleSaid(item.body)}</p>
                  <div className="live-meta">
                    {item.authorName} · {format(item.createdAt)}
                  </div>
                </div>
                {item.canChange && (
                  <div className="live-row-actions">
                    <Button variant="ghost" size="sm" data-opens="" aria-label={words.week.changeAnnouncementLabel(item.title)} onClick={() => setChanging(item)}>
                      {words.week.changeAnnouncement}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <LiveEmpty title={words.week.noAnnouncementsTitle}>
            {words.week.noAnnouncementsDetail}
          </LiveEmpty>
        )}
    </>
  );
  return (
    <>
      <CardGreeting />
      {/* Sewn onto the head's own rule, before the first thing to do. */}
      <WeekQuilt />
      {/* A visitor's first step comes before anything else to do, so it is on the first screen of a phone. */}
      <StartHere />
      {choiceFirst && choices}
      <FirstWeekSlips />
      <WeekNote brief={briefed || incoming.length > 0} />
      <Glance quiet={firstDays} />
      {!choiceFirst && choices}
      {firstDays ? (
        <LiveEmpty title={first.title}>
          {first.detail}
        </LiveEmpty>
      ) : (
      /* From 1100px what is coming up and what the group has said sit side by side, so neither waits under the other. */
      <div className="week-columns" data-far={far ? "" : undefined}>
      <section className="live-section" id={COMING_UP}>
        <div className="live-section-head">
          <h2>{words.week.comingUp}</h2>
          <span className="live-count">{words.week.nextSevenDays}</span>
          {(isOwner || data.canCoordinate) && (
            <Button variant="link" className="tools-quiet" data-opens="" onClick={() => setPrinting(true)}>{words.week.printWeek}</Button>
          )}
        </div>
        <CommitmentRows
          items={comingUp(data, now).filter((item) => item.id !== held)}
          fresh={fresh}
          empty={{ title: incoming.length ? words.week.choiceAboveTitle : words.week.quietTitle, detail: incoming.length ? words.week.choiceAboveDetail : words.week.quietDetail, go: incoming.length ? undefined : "commitments" }}
        />
      </section>
      {/* On the largest screens what the conference has said is the room's second column, under the picture;
          below that it stands beside what is coming up, or under it. */}
      {far ? (
        <RoomAside title={words.week.fromGroup}>{said}</RoomAside>
      ) : (
      <section className="live-section">
        <div className="live-section-head">
          <h2>{words.week.fromGroup}</h2>
        </div>
        {said}
      </section>
      )}
      </div>
      )}
      {/* The list above already closes on its own rule: the foot stands under it on space alone. Under an empty room
          it stands as far under what is seen: the empty state's own 32px padding plus one 24px step. */}
      <p className="!mt-14 !mb-0 [.live-empty+&]:!mt-6">
        <AssistantGuide />
      </p>
      {changing && (
        <Suspense fallback={null}>
          <AnnouncementChange item={changing} onClose={() => setChanging(null)} />
        </Suspense>
      )}
      {printing && (
        <LiveDialog title={words.week.printWeek} className="tools-rota-dialog" onClose={() => setPrinting(false)}>
          <WeeklyRota titled={false} />
        </LiveDialog>
      )}
    </>
  );
}
