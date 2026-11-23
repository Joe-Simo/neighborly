"use client";

import { numberLocales } from "@/lib/words/numbers";
import "./volunteer.css";
import { Suspense, lazy, useState } from "react";
import { takeFocus } from "@/components/workspace/volunteer/commitment-rows";
import { usePaginatedQuery } from "@/components/workspace/query";
import { Check, CircleCheck, Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { NextMeeting } from "@/components/workspace/volunteer/asides";

/** A meeting's agenda and minutes, for coordinators; its words load with it. */
const MeetingSheet = lazy(() => import("@/components/workspace/volunteer/meeting-sheet"));

/**
 * While a task is saved its button sleeps, and a sleeping button drops the keyboard's focus to the page.
 * Once the page has settled: after "Mark done", focus goes on to the next task still to do (the first one
 * left when this was the last in the list), or to the list's heading when none is left. A tick taken back
 * keeps focus on its own button.
 */
function keepFocus(pressed: HTMLButtonElement, done: boolean, tries = 90) {
  requestAnimationFrame(() => {
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== pressed) return;
    const open = [...document.querySelectorAll<HTMLButtonElement>('.volunteer-task:not([data-done]) .volunteer-task-act button')].filter((button) => button !== pressed);
    const after = open.find((button) => pressed.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
    const next = done ? (after ?? open[0] ?? document.querySelector<HTMLElement>("[data-tasks-head]")) : pressed;
    // While the save is still settling every button is off, and a button that is off cannot take focus:
    // wait for it rather than let focus fall to the page.
    if (next instanceof HTMLButtonElement && next.disabled && tries > 0) return keepFocus(pressed, done, tries - 1);
    next?.focus({ preventScroll: !done });
  });
}

export function TasksSection() {
  const {
    data,
    pending,
    isOwner,
    perform,
    format,
    when,
    personName,
    openAction: open,
    words,
    sampleSaid,
    keepNames,
  } = useWorkspace();
  // The task just ticked and the meeting just answered: each gets its one move.
  const [ticked, setTicked] = useState<string>();
  const [answered, setAnswered] = useState<string>();
  // The meeting just replied to, yes or no: its reply takes the place of the buttons, and focus with it.
  const [replied, setReplied] = useState<string>();
  const [changing, setChanging] = useState<string>();
  return (
    <>
      <NextMeeting />
      <section className="volunteer-tasks-list">
        <div className="live-section-head">
          <h2 tabIndex={-1} data-tasks-head className={data.tasks.length ? undefined : "sr-only"}>{words.tasks.tasks}</h2>
          {/* The tasks still open as paper: the figure on a cut slip. */}
          {data.tasks.length > 0 && (
            <div className="room-tally">
              <dl>
                <div>
                  <dt>{words.tasks.openNoun(data.tasks.filter((task) => !task.complete).length)}</dt>
                  <dd><b>{new Intl.NumberFormat(numberLocales[words.locale]).format(data.tasks.filter((task) => !task.complete).length)}</b></dd>
                </div>
              </dl>
            </div>
          )}
        </div>
        {data.tasks.length ? (
          <div className="live-list">
            {data.tasks.map((task) => {
              const mine = isOwner || task.assigneeId === data.user.id;
              return (
                <div
                  className={`live-row volunteer-task${task.id === ticked ? " volunteer-ticked" : ""}`}
                  data-done={task.complete || undefined}
                  key={task.id}
                >
                  <div>
                    <h3><span>{keepNames(sampleSaid(task.title))}</span></h3>
                    <p>
                      <span className="volunteer-who">{personName(task.assigneeId)}</span>
                      {task.dueAt && <span className="volunteer-due"> · {words.tasks.due(format(task.dueAt))}</span>}
                    </p>
                  </div>
                  {mine ? (
                    // A done row says so in plain words; the button beside it names the one act left, as the saved line does.
                    <div className="volunteer-task-act">
                      {task.complete && (
                        <span className="volunteer-task-done">
                          <Check size={16} aria-hidden="true" /> {words.tasks.done}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        aria-label={task.complete ? words.tasks.reopenTask(sampleSaid(task.title)) : `${words.tasks.markDone}: ${sampleSaid(task.title)}`}
                        disabled={pending}
                        onClick={async (event) => {
                          const pressed = event.currentTarget;
                          const saved = await perform(
                            { type: "setTaskComplete", taskId: task.id, complete: !task.complete },
                            task.complete ? words.tasks.openAgain(sampleSaid(task.title)) : words.tasks.markedDone(sampleSaid(task.title)),
                            task.complete
                              ? undefined
                              : { command: { type: "setTaskComplete", taskId: task.id, complete: false }, said: words.tasks.openAgain(sampleSaid(task.title)), returnTo: pressed },
                          );
                          if (saved) setTicked(task.complete ? undefined : task.id);
                          if (saved) keepFocus(pressed, !task.complete);
                          else keepFocus(pressed, false);
                        }}
                      >
                        {task.complete ? words.tasks.reopen : words.tasks.markDone}
                      </Button>
                    </div>
                  ) : (
                    <span className="live-status" data-state={task.complete ? "accepted" : "open"}>
                      {task.complete ? words.tasks.done : words.tasks.open}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <LiveEmpty title={words.tasks.emptyTitle} go={isOwner ? undefined : "mine"}>
            {words.tasks.emptyDetail}
          </LiveEmpty>
        )}
      </section>
      <section className="live-section volunteer-meetings-list">
        <div className="live-section-head">
          <h2 className={data.meetings.length ? undefined : "sr-only"}>{words.tasks.meetings}</h2>
          {/* With no meeting yet the button goes into the empty place below, as its one act, rather than stand alone. */}
          {isOwner && data.meetings.length > 0 && (
            <Button variant="outline" onClick={() => open("meeting")}>
              <Plus size={15} aria-hidden="true" /> {words.actions.meeting}
            </Button>
          )}
        </div>
        {data.meetings.length ? (
          <div className="volunteer-meetings">
            {data.meetings.map((meeting) => {
              const response = meeting.responses.find(
                (item) => item.personId === data.user.id,
              )?.response;
              const reply = async (answer: "accepted" | "declined") => {
                const saved = await perform({
                  type: "respondMeeting",
                  meetingId: meeting.id,
                  response: answer,
                });
                if (!saved) return;
                setAnswered(answer === "accepted" ? meeting.id : undefined);
                setReplied(meeting.id);
                setChanging(undefined);
              };
              // The corner: ochre while it waits for a reply, green on a yes, plain on a no.
              const corner =
                response === "accepted"
                  ? meeting.id === answered ? " paper-fold" : " volunteer-yes"
                  : response ? " paper-rest" : "";
              return (
                <article className={`help-sheet volunteer-meeting${corner}`} key={meeting.id}>
                  {!response && <p className="help-sheet-label">{words.tasks.waiting}</p>}
                  <div className="help-sheet-body">
                    <div>
                      <h3>{keepNames(sampleSaid(meeting.title))}</h3>
                      <p className="volunteer-choice-when">{when(meeting.start, meeting.end)}</p>
                      {meeting.location && <p>{sampleSaid(meeting.location)}</p>}
                    </div>
                    {response && changing !== meeting.id ? (
                      <div className="live-row-actions">
                        <p className="volunteer-given" data-no={response === "declined" || undefined} tabIndex={-1} ref={meeting.id === replied ? takeFocus : undefined}>
                          {response === "accepted" && <CircleCheck size={22} aria-hidden="true" />}
                          {response === "accepted" ? words.tasks.going : words.tasks.notGoing}
                        </p>
                        <Button
                          variant="link"
                          className="tools-quiet"
                          aria-label={`${words.tasks.changeReply}: ${sampleSaid(meeting.title)}`}
                          onClick={() => setChanging(meeting.id)}
                        >
                          {words.tasks.changeReply}
                        </Button>
                      </div>
                    ) : (
                      <div className="live-row-actions">
                        <Button disabled={pending} aria-label={`${words.tasks.attend}: ${sampleSaid(meeting.title)}`} onClick={() => void reply("accepted")}>
                          {words.tasks.attend}
                        </Button>
                        <Button variant="outline" disabled={pending} aria-label={`${words.tasks.decline}: ${sampleSaid(meeting.title)}`} onClick={() => void reply("declined")}>
                          {words.tasks.decline}
                        </Button>
                      </div>
                    )}
                  </div>
                  <Suspense fallback={null}>
                    <MeetingSheet meetingId={meeting.id} title={sampleSaid(meeting.title)} />
                  </Suspense>
                  {(isOwner || meeting.fanoutStatus === "processing") && (
                    <div className="volunteer-meeting-desk">
                      {meeting.fanoutStatus === "processing" && (
                        <span className="live-status" data-state="pending">
                          {words.tasks.preparing}
                        </span>
                      )}
                      {isOwner && meeting.fanoutStatus === "processing" && (
                        <Button
                          variant="link"
                          className="tools-quiet"
                          disabled={pending}
                          onClick={() =>
                            void perform(
                              {
                                type: "retryMeetingFanout",
                                meetingId: meeting.id,
                              },
                              words.rooms.sheets.meeting.againSaid,
                            )
                          }
                        >
                          {words.rooms.sheets.meeting.again}
                        </Button>
                      )}
                      {isOwner && (
                        <LiveMeetingResponses
                          churchId={data.church.id}
                          meetingId={meeting.id}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <LiveEmpty title={words.tasks.noMeetingsTitle} action={isOwner ? { label: words.actions.meeting, run: () => open("meeting") } : undefined}>
            {words.tasks.noMeetingsDetail}
          </LiveEmpty>
        )}
      </section>
    </>
  );
}

function LiveMeetingResponses({
  churchId,
  meetingId,
}: {
  churchId: Id<"churches">;
  meetingId: Id<"meetings">;
}) {
  const [open, setOpen] = useState(false);
  const responses = usePaginatedQuery(
    api.pages.meetingResponsesPage,
    open ? { churchId, meetingId } : "skip",
    { initialNumItems: 20 },
  );
  const text = useWorkspace().words.rooms.sheets.meeting;
  return (
    <div className="volunteer-replies">
      <Button variant="link" className="tools-quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? text.hide : text.show}
      </Button>
      {open && (
        <>
          <div className="live-list">
            {responses.results.map((item) => (
              <div className="live-row" key={item.personId}>
                <span>{item.name}</span>
                <span className="live-status" data-state={item.response}>
                  {text.replied[item.response]}
                </span>
              </div>
            ))}
          </div>
          {responses.status === "Exhausted" && !responses.results.length && (
            <p>{text.none}</p>
          )}
          {responses.status !== "Exhausted" && (
            <Button
              variant="outline"
              disabled={responses.status !== "CanLoadMore"}
              onClick={() => responses.loadMore(20)}
            >
              {responses.status === "CanLoadMore" ? text.more : text.loading}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
