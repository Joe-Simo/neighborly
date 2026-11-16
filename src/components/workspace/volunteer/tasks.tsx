"use client";

import "./volunteer.css";
import { useState } from "react";
import { usePaginatedQuery } from "@/components/workspace/query";
import { Check, CircleCheck, Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { NextMeeting } from "@/components/workspace/volunteer/asides";

/**
 * While a task is saved its button sleeps, and a sleeping button drops the keyboard's focus to the page.
 * Once the page has settled: after "Mark done", focus goes on to the next task still to do (the first one
 * left when this was the last in the list), or to the list's heading when none is left. A tick taken back
 * keeps focus on its own button.
 */
function keepFocus(pressed: HTMLButtonElement, done: boolean, tries = 90) {
  requestAnimationFrame(() => {
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== pressed) return;
    const open = [...document.querySelectorAll<HTMLButtonElement>('.volunteer-task button[aria-pressed="false"]')].filter((button) => button !== pressed);
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
  } = useWorkspace();
  // The task just ticked and the meeting just answered: each gets its one move.
  const [ticked, setTicked] = useState<string>();
  const [answered, setAnswered] = useState<string>();
  const [changing, setChanging] = useState<string>();
  return (
    <>
      <NextMeeting />
      <section>
        <div className="live-section-head">
          <h2 tabIndex={-1} data-tasks-head>{words.tasks.tasks}</h2>
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
                    <h3><span>{task.title}</span></h3>
                    <p>
                      <span className="volunteer-who">{personName(task.assigneeId)}</span>
                      {task.dueAt && <span className="volunteer-due"> · {words.tasks.due(format(task.dueAt))}</span>}
                    </p>
                  </div>
                  {mine ? (
                    <Button
                      variant="outline"
                      aria-pressed={task.complete}
                      // For a keyboard the done row's own button is the way back, so it says so.
                      aria-label={task.complete ? words.tasks.undoDone(task.title) : undefined}
                      disabled={pending}
                      onClick={async (event) => {
                        const pressed = event.currentTarget;
                        const saved = await perform(
                          { type: "setTaskComplete", taskId: task.id, complete: !task.complete },
                          task.complete ? words.tasks.openAgain(task.title) : words.tasks.markedDone(task.title),
                          task.complete
                            ? undefined
                            : { command: { type: "setTaskComplete", taskId: task.id, complete: false }, said: words.tasks.openAgain(task.title), returnTo: pressed },
                        );
                        if (saved) setTicked(task.complete ? undefined : task.id);
                        if (saved) keepFocus(pressed, !task.complete);
                        else keepFocus(pressed, false);
                      }}
                    >
                      {task.complete ? (
                        <>
                          <Check size={16} aria-hidden="true" /> {words.tasks.done}
                        </>
                      ) : (
                        words.tasks.markDone
                      )}
                    </Button>
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
          <LiveEmpty title={words.tasks.emptyTitle}>
            {words.tasks.emptyDetail}
          </LiveEmpty>
        )}
      </section>
      <section className="live-section">
        <div className="live-section-head">
          <h2>{words.tasks.meetings}</h2>
          {isOwner && (
            <Button variant="outline" onClick={() => open("meeting")}>
              <Plus size={15} aria-hidden="true" /> Plan meeting
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
                      <h3>{meeting.title}</h3>
                      <p className="volunteer-choice-when">{when(meeting.start, meeting.end)}</p>
                      {meeting.location && <p>{meeting.location}</p>}
                    </div>
                    {response && changing !== meeting.id ? (
                      <div className="live-row-actions">
                        <p className="volunteer-given" data-no={response === "declined" || undefined} role="status">
                          {response === "accepted" && <CircleCheck size={22} aria-hidden="true" />}
                          {response === "accepted" ? words.tasks.going : words.tasks.notGoing}
                        </p>
                        <Button
                          variant="link"
                          className="tools-quiet"
                          onClick={() => setChanging(meeting.id)}
                        >
                          {words.tasks.changeReply}
                        </Button>
                      </div>
                    ) : (
                      <div className="live-row-actions">
                        <Button disabled={pending} onClick={() => void reply("accepted")}>
                          {words.tasks.attend}
                        </Button>
                        <Button variant="outline" disabled={pending} onClick={() => void reply("declined")}>
                          {words.tasks.decline}
                        </Button>
                      </div>
                    )}
                  </div>
                  {(isOwner || meeting.fanoutStatus === "processing") && (
                    <div className="volunteer-meeting-desk">
                      {meeting.fanoutStatus === "processing" && (
                        <span className="live-status" data-state="pending">
                          Preparing invitations…
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
                              "Preparing the invitations again.",
                            )
                          }
                        >
                          Prepare the invitations again
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
          <LiveEmpty title={words.tasks.noMeetingsTitle}>
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
  return (
    <div className="volunteer-replies">
      <Button variant="link" className="tools-quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide replies" : "Show replies"}
      </Button>
      {open && (
        <>
          <div className="live-list">
            {responses.results.map((item) => (
              <div className="live-row" key={item.personId}>
                <span>{item.name}</span>
                <span className="live-status" data-state={item.response}>
                  {item.response}
                </span>
              </div>
            ))}
          </div>
          {responses.status === "Exhausted" && !responses.results.length && (
            <p>No replies yet.</p>
          )}
          {responses.status !== "Exhausted" && (
            <Button
              variant="outline"
              disabled={responses.status !== "CanLoadMore"}
              onClick={() => responses.loadMore(20)}
            >
              {responses.status === "CanLoadMore"
                ? "Load more replies"
                : "Loading replies…"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
