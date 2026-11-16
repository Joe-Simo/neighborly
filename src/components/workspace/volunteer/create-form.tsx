"use client";

import { useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { DateField, WhenField } from "@/components/workspace/date-field";
import { useWorkspace } from "@/components/workspace/context";
import { useOpenedIntoView } from "@/components/workspace/week-note/assistant-limits";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveField } from "@/components/workspace/primitives";
import type { ActionKind } from "@/components/workspace/navigation";
import type { LiveCommand, LiveWorkspaceData } from "@/components/workspace/types";

export function LiveCreateForm({
  kind,
  data,
  pending,
  error,
  onSubmit,
}: {
  kind: ActionKind;
  data: LiveWorkspaceData;
  pending: boolean;
  error: string;
  onSubmit: (command: LiveCommand) => Promise<void>;
}) {
  // The announcement is a member's screen, so it speaks their language; the leaders' forms stay English.
  const { actions, tasks } = useWorkspace().words;
  const form = actions.announcementForm;
  // Adding a commitment opens from Commitments, a member's room, so its form speaks the reader's language too.
  const own = kind === "commitment" ? actions.commitmentForm : null;
  // The button names the act. Members' forms say it in their language; leaders' forms stay English.
  const acts = {
    commitment: actions.commitment,
    timeOff: actions.timeOff,
    task: tasks.add,
    team: "Create team",
    meeting: "Plan meeting",
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
          ? `Filled in by the assistant: “${result.teamName}”. Change it if it is not right.`
          : result.notes.includes("Please confirm the team name.")
            ? "The assistant was not sure of a name in your words, so it left the name blank. Enter it below."
            : "Your words do not name the team, so the name is blank. Enter it below.",
      );
    } catch {
      setDraftNote(
        "We couldn’t prepare a draft. You can enter the team name below.",
      );
    } finally {
      setPreparing(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? "").trim();
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
            label="Describe your team (optional)"
            help="We’ll prepare a name for you to review. Don’t include private member information."
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
            {preparing ? "Preparing…" : "Prepare a draft"}
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
                    {showSent ? "Hide what the assistant saw" : "What the assistant saw"}
                  </button>
                  {showSent && (
                    <span id="team-draft-sent" ref={sentPart} tabIndex={-1} className="paper-rise mt-3 grid scroll-my-24 gap-y-2 text-[15px] leading-snug outline-none">
                      {sent ? (
                        <>
                          <span className="block border-l-2 border-[#cfc5dc] pl-3 font-serif text-[17px]">{sent}</span>
                          <span>Your words as they were sent, with names, phones, emails and addresses taken out. The assistant writes nothing: the name is copied from your words by fixed rules, and the assistant only says whether your words support it.</span>
                        </>
                      ) : (
                        <span>Nothing was sent to the assistant. Fixed rules read your words on our own servers, and they copy a name only when a sentence states it plainly.</span>
                      )}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          <LiveField label="Team name">
            <Input
              name="name"
              required
              maxLength={100}
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />
          </LiveField>
          <LiveField label="What this team does">
            <Textarea name="description" maxLength={1500} rows={3} />
          </LiveField>
        </>
      )}
      {kind === "invite" && (
        <>
          <LiveField label="Email">
            <Input type="email" name="email" required maxLength={254} />
          </LiveField>
          <LiveField label="Role">
            <NativeSelect name="role">
              <option value="member">Member</option>
              <option value="coordinator">Coordinator</option>
            </NativeSelect>
          </LiveField>
          <div className="live-note">
            The invitation’s delivery status will be shown in People. A saved
            invitation is not a confirmed email delivery.
          </div>
        </>
      )}
      {(kind === "commitment" ||
        kind === "task" ||
        kind === "meeting" ||
        kind === "announcement") && (
        <LiveField label={kind === "announcement" ? form.title : (own?.title ?? "Title")}>
          <Input name="title" required maxLength={180} />
        </LiveField>
      )}
      {kind === "meeting" && (
        <div className="live-note">
          Everyone in the conference will be invited. Each person chooses whether
          to attend.
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
                  {team.name}
                </option>
              ))}
          </NativeSelect>
        </LiveField>
      )}
      {(kind === "commitment" || kind === "meeting" || kind === "timeOff") && (
        <div className="live-form-grid">
          <LiveField label={kind === "timeOff" ? "First day" : (own?.starts ?? "Starts")}>
            {kind === "timeOff" ? <DateField name="start" required /> : <WhenField name="start" required />}
          </LiveField>
          <LiveField label={kind === "timeOff" ? "Last day" : (own?.ends ?? "Ends")}>
            {kind === "timeOff" ? <DateField name="end" required /> : <WhenField name="end" required />}
          </LiveField>
        </div>
      )}
      {(kind === "commitment" || kind === "meeting") && (
        <LiveField label={own?.where ?? "Where to meet"}>
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
          label="Note (optional)"
          help="Only include what your coordinators need to know."
        >
          <Textarea name="note" rows={3} maxLength={1000} />
        </LiveField>
      )}
      {kind === "task" && (
        <>
          <LiveField label="Due (optional)">
            <WhenField name="dueAt" />
          </LiveField>
          <LiveField label="Owner">
            <NativeSelect name="assigneeId">
              <option value="">Unassigned</option>
              {data.people.map((person) => (
                <option value={person.id} key={person.id}>
                  {person.name}
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
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <div className="live-form-actions">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle size={16} />
              {kind === "announcement" ? form.saving : (own?.saving ?? "Saving…")}
            </>
          ) : kind === "invite" ? (
            "Create invitation"
          ) : kind === "announcement" ? (
            form.save
          ) : (
            acts[kind]
          )}
        </Button>
      </div>
    </form>
  );
}
