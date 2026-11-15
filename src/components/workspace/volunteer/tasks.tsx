"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { Check, Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { LiveEmpty } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";

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
  } = useWorkspace();
  const taskRows = (
    <div className="live-list">
      {data.tasks.length ? (
        data.tasks.map((task) => (
          <div className="live-row" key={task.id}>
            <div>
              <h3>{task.title}</h3>
              <p>
                {personName(task.assigneeId)}
                {task.dueAt ? ` · Due ${format(task.dueAt)}` : ""}
              </p>
            </div>
            <Button
              variant={task.complete ? "secondary" : "outline"}
              size="sm"
              disabled={
                pending || (!isOwner && task.assigneeId !== data.user.id)
              }
              onClick={() =>
                void perform({
                  type: "setTaskComplete",
                  taskId: task.id,
                  complete: !task.complete,
                })
              }
            >
              {task.complete ? (
                <>
                  <Check size={16} /> Complete
                </>
              ) : (
                "Mark complete"
              )}
            </Button>
          </div>
        ))
      ) : (
        <LiveEmpty title="A clear list, for now.">
          Shared tasks will appear here with their owner and due date.
        </LiveEmpty>
      )}
    </div>
  );
  return (
    <>
      <section>
        <div className="live-section-head">
          <h2>Tasks</h2>
        </div>
        {taskRows}
      </section>
      <section className="live-section">
        <div className="live-section-head">
          <h2>Meetings</h2>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => open("meeting")}
            >
              <Plus size={15} /> Plan meeting
            </Button>
          )}
        </div>
        {data.meetings.length ? (
          <div className="live-list">
            {data.meetings.map((meeting) => {
              const response = meeting.responses.find(
                (item) => item.personId === data.user.id,
              )?.response;
              return (
                <div className="live-row" key={meeting.id}>
                  <div>
                    <h3>{meeting.title}</h3>
                    {meeting.fanoutStatus === "processing" && (
                      <span
                        className="live-status"
                        data-state="pending"
                      >
                        Preparing invitations
                      </span>
                    )}
                    {isOwner &&
                      meeting.fanoutStatus === "processing" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            void perform(
                              {
                                type: "retryMeetingFanout",
                                meetingId: meeting.id,
                              },
                              "Invitation preparation restarted.",
                            )
                          }
                        >
                          Retry preparation
                        </Button>
                      )}
                    <p>
                      {when(meeting.start, meeting.end)}
                      {meeting.location ? ` · ${meeting.location}` : ""}
                    </p>
                    {response && (
                      <span
                        className="live-status"
                        data-state={response}
                      >
                        Your reply: {response}
                      </span>
                    )}
                    {isOwner && (
                      <LiveMeetingResponses
                        churchId={data.church.id}
                        meetingId={meeting.id}
                      />
                    )}
                  </div>
                  <div className="live-row-actions">
                    <Button
                      size="sm"
                      variant={response === "accepted" ? "secondary" : "default"}
                      disabled={pending}
                      onClick={() =>
                        void perform({
                          type: "respondMeeting",
                          meetingId: meeting.id,
                          response: "accepted",
                        })
                      }
                    >
                      Attend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        void perform({
                          type: "respondMeeting",
                          meetingId: meeting.id,
                          response: "declined",
                        })
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <LiveEmpty title="No meetings planned.">
            Meeting replies are separate from task completion.
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
    <div style={{ marginTop: 12 }}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        {open ? "Hide replies" : "Review member replies"}
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
              size="sm"
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
