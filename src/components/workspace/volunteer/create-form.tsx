"use client";

import { keepTitle } from "@/lib/words/titles";
import { peopleWords } from "@/lib/words/rooms/people";
import { lazy, Suspense, useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SheetCancel } from "@/components/workspace/live-dialog";
import { DateField, WhenField } from "@/components/workspace/date-field";
import { useWorkspace } from "@/components/workspace/context";
import { useOpenedIntoView } from "@/components/workspace/week-note/assistant-limits";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveField, markWrong } from "@/components/workspace/primitives";
import { refusals } from "@/lib/refusals";
import { LiveWaiting, LiveFailure, SaveLabel } from "@/components/workspace/states";
import type { ActionKind } from "@/components/workspace/navigation";
import type { LiveCommand, LiveWorkspaceData } from "@/components/workspace/types";

// Where an announcement goes is asked only on an announcement: its own chunk.
const AnnouncementSend = lazy(() => import("@/components/workspace/volunteer/announcement-send"));

export function LiveCreateForm({
  kind,
  data,
  pending,
  saving,
  error,
  onSubmit,
}: {
  kind: ActionKind;
  data: LiveWorkspaceData;
  /** Some save is on its way, this form's or another: the button rests. */
  pending: boolean;
  /** This form's own save is on its way: only then does it say so. */
  saving: boolean;
  error: string;
  onSubmit: (command: LiveCommand) => Promise<void>;
}) {
  // Every form here speaks the reader's language: the members' from the shared tables, the leaders' from this room's.
  const { sampleSaid } = useWorkspace();
  const words = useWorkspace().words;
  const { actions, tasks } = words;
  const text = peopleWords(words).form;
  const form = actions.announcementForm;
  // Adding a commitment opens from Commitments, a member's room, so its form speaks the reader's language too.
  const own = kind === "commitment" ? actions.commitmentForm : null;
  // The button names the act.
  const acts = {
    commitment: actions.commitment,
    timeOff: actions.timeOff,
    task: tasks.add,
    team: text.createTeam,
    meeting: text.planMeeting,
  };
  const suggest = useAction(api.drafts.suggestTeam);
  const [draftDescription, setDraftDescription] = useState("");
  const [teamName, setTeamName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  // What the assistant was given, when it was asked: null until a draft is prepared, "" when nothing was sent.
  const [sent, setSent] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);
  const sentPart = useOpenedIntoView<HTMLSpanElement>(showSent);
  const [preparing, setPreparing] = useState(false);
  async function prepare() {
    setPreparing(true);
    setDraftNote("");
    setSent(null);
    setShowSent(false);
    try {
      const result = await suggest({ description: draftDescription });
      setTeamName(result.teamName);
      setSent(result.sent);
      // This dialog has one field to fill, so it speaks only of the name.
      setDraftNote(
        result.teamName
          ? text.team.filled(result.teamName)
          : result.notes.includes("Please confirm the team name.")
            ? text.team.unsure
            : text.team.unnamed,
      );
    } catch {
      setDraftNote(text.team.failed);
    } finally {
      setPreparing(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const value = (name: string) => String(fields.get(name) ?? "").trim();
    // An end before its start is said on the end, before anything is sent (the server refuses it the same way).
    const [start, end] = [value("start"), value("end")];
    if (start && end && (kind === "timeOff" ? end < start : (kind === "commitment" || kind === "meeting") && end <= start))
      markWrong(form, "end", kind === "timeOff" ? words.timeOffForm.orderError : (words.notices.refused[refusals.endAfterStart] ?? refusals.endAfterStart));
    if (!form.checkValidity()) return;
    let command: LiveCommand;
    switch (kind) {
      case "team":
        command = {
          type: "createTeam",
          name: value("name"),
          description: value("description"),
        };
        break;
      case "invite":
        command = {
          type: "invite",
          email: value("email"),
          role: value("role") === "coordinator" ? "coordinator" : "member",
        };
        break;
      case "commitment": {
        const team = data.teams.find((item) => item.id === value("teamId"));
        if (!team) return;
        command = {
          type: "createCommitment",
          teamId: team.id,
          title: value("title"),
          start: value("start"),
          end: value("end"),
          location: value("location"),
          preparation: value("preparation"),
          intervalWeeks: Number(value("intervalWeeks") || 1),
          count: Number(value("count") || 1),
        };
        break;
      }
      case "timeOff":
        command = {
          type: "addTimeOff",
          start: value("start"),
          end: value("end"),
          note: value("note"),
        };
        break;
      case "task":
        command = {
          type: "createTask",
          title: value("title"),
          dueAt: value("dueAt"),
          assigneeId:
            data.people.find((person) => person.id === value("assigneeId"))
              ?.id ?? "",
        };
        break;
      case "meeting":
        command = {
          type: "createMeeting",
          title: value("title"),
          start: value("start"),
          end: value("end"),
          location: value("location"),
        };
        break;
      case "announcement":
        command = {
          type: "createAnnouncement",
          title: value("title"),
          body: value("body"),
          emailEveryone: value("send") === "email",
        };
        break;
    }
    await onSubmit(command);
  }
  return (
    <form className="live-form" onSubmit={submit}>
      {kind === "team" && (
        <>
          <LiveField
            label={text.team.describe}
            help={text.team.describeHelp}
          >
            <Textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              maxLength={1000}
            />
          </LiveField>
          <Button
            type="button"
            variant="outline"
            disabled={!draftDescription.trim() || preparing}
            onClick={() => void prepare()}
          >
            {preparing ? text.team.preparing : text.team.draft}
          </Button>
          {draftNote && (
            <div className="live-note" role="status">
              {draftNote}
              {sent !== null && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 -my-2.5 text-inherit underline decoration-[#cfc5dc] underline-offset-4 hover:decoration-current"
                    aria-expanded={showSent}
                    aria-controls="team-draft-sent"
                    onClick={() => setShowSent(!showSent)}
                  >
                    {showSent ? text.team.hideSent : text.team.showSent}
                  </button>
                  {showSent && (
                    <span id="team-draft-sent" ref={sentPart} tabIndex={-1} className="paper-rise mt-3 grid scroll-my-24 gap-y-2 text-[15px] leading-snug outline-none">
                      {sent ? (
                        <>
                          <span className="block border-l-2 border-[#cfc5dc] pl-3 font-serif text-[17px]">{sent}</span>
                          <span>{text.team.sent}</span>
                        </>
                      ) : (
                        <span>{text.team.nothingSent}</span>
                      )}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          <LiveField label={text.team.name}>
            <Input
              name="name"
              required
              maxLength={100}
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />
          </LiveField>
          <LiveField label={text.team.does}>
            <Textarea name="description" maxLength={1500} rows={3} />
          </LiveField>
        </>
      )}
      {kind === "invite" && (
        <>
          <LiveField label={text.invite.email}>
            <Input type="email" name="email" required maxLength={254} />
          </LiveField>
          <LiveField label={text.invite.role}>
            <NativeSelect name="role">
              <option value="member">{text.invite.member}</option>
              <option value="coordinator">{text.invite.coordinator}</option>
            </NativeSelect>
          </LiveField>
          <div className="live-note">
            {text.invite.note}
          </div>
        </>
      )}
      {(kind === "commitment" ||
        kind === "task" ||
        kind === "meeting" ||
        kind === "announcement") && (
        <LiveField label={kind === "announcement" ? form.title : (own?.title ?? text.title)}>
          <Input name="title" required maxLength={180} />
        </LiveField>
      )}
      {kind === "meeting" && (
        <div className="live-note">
          {text.meetingNote}
        </div>
      )}
      {kind === "commitment" && (
        <LiveField label={actions.commitmentForm.team}>
          <NativeSelect name="teamId" required defaultValue="">
            <option value="" disabled>
              {actions.commitmentForm.chooseTeam}
            </option>
            {data.teams
              .filter((team) => team.canCoordinate)
              .map((team) => (
                <option value={team.id} key={team.id}>
                  {sampleSaid(team.name)}
                </option>
              ))}
          </NativeSelect>
        </LiveField>
      )}
      {(kind === "commitment" || kind === "meeting" || kind === "timeOff") && (
        <div className="live-form-grid">
          <LiveField label={kind === "timeOff" ? text.firstDay : (own?.starts ?? text.starts)}>
            {kind === "timeOff" ? <DateField short name="start" required /> : <WhenField name="start" required />}
          </LiveField>
          <LiveField label={kind === "timeOff" ? text.lastDay : (own?.ends ?? text.ends)}>
            {kind === "timeOff" ? <DateField short name="end" required /> : <WhenField name="end" required />}
          </LiveField>
        </div>
      )}
      {(kind === "commitment" || kind === "meeting") && (
        <LiveField label={own?.where ?? text.where}>
          <Input name="location" maxLength={300} required />
        </LiveField>
      )}
      {kind === "commitment" && (
        <LiveField
          label={actions.commitmentForm.preparation}
          help={actions.commitmentForm.preparationHelp}
        >
          <Textarea name="preparation" rows={4} maxLength={5000} />
        </LiveField>
      )}
      {kind === "commitment" && (
        <div className="live-form-grid">
          <LiveField label={actions.commitmentForm.repeats}>
            <NativeSelect name="intervalWeeks" defaultValue="1" required>
              <option value="1">{actions.commitmentForm.everyWeek}</option>
              {[2, 3, 4].map((weeks) => (
                <option value={weeks} key={weeks}>{actions.commitmentForm.everyWeeks(weeks)}</option>
              ))}
            </NativeSelect>
          </LiveField>
          <LiveField
            label={actions.commitmentForm.times}
            help={actions.commitmentForm.timesHelp}
          >
            <Input
              type="number"
              name="count"
              defaultValue="1"
              min={1}
              max={52}
              required
            />
          </LiveField>
        </div>
      )}
      {kind === "timeOff" && (
        <LiveField
          label={text.timeOff.note}
          help={text.timeOff.noteHelp}
        >
          <Textarea name="note" rows={3} maxLength={1000} />
        </LiveField>
      )}
      {kind === "task" && (
        <>
          <LiveField label={text.task.due}>
            <WhenField name="dueAt" />
          </LiveField>
          <LiveField label={text.task.owner}>
            <NativeSelect name="assigneeId">
              <option value="">{text.task.unassigned}</option>
              {data.people.map((person) => (
                <option value={person.id} key={person.id}>
                  {keepTitle(person.name)}
                </option>
              ))}
            </NativeSelect>
          </LiveField>
        </>
      )}
      {kind === "announcement" && (
        <LiveField label={form.message}>
          <Textarea name="body" required rows={5} maxLength={6000} />
        </LiveField>
      )}
      {kind === "announcement" && (
        <Suspense fallback={null}>
          <AnnouncementSend />
        </Suspense>
      )}
      {error && <LiveFailure message={error} />}
      {/* With the connection lost the save is held, not failed: one line says the entry is kept and will go by itself. */}
      <LiveWaiting when={saving} />
      <div className="live-form-actions">
        <SheetCancel disabled={pending} />
        <Button type="submit" disabled={pending}>
          {/* Waiting is said in words alone: nothing turns beside them. */}
          <SaveLabel
            saving={saving}
            idle={kind === "invite" ? text.createInvitation : kind === "announcement" ? form.save : acts[kind]}
            busy={kind === "announcement" ? form.saving : (own?.saving ?? text.saving)}
          />
        </Button>
      </div>
    </form>
  );
}
