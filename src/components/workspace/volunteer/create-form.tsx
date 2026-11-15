"use client";

import { useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { DateField, WhenField } from "@/components/workspace/date-field";
import { useWorkspace } from "@/components/workspace/context";
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
  const form = useWorkspace().words.actions.announcementForm;
  const suggest = useAction(api.drafts.suggestTeam);
  const [draftDescription, setDraftDescription] = useState("");
  const [teamName, setTeamName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [preparing, setPreparing] = useState(false);
  async function prepare() {
    setPreparing(true);
    setDraftNote("");
    try {
      const result = await suggest({ description: draftDescription });
      setTeamName(result.teamName);
      setDraftNote(
        (result.verification === "checked"
          ? "Draft checked with AI. "
          : "Draft prepared from your words. ") +
          "Review the team name before saving. " +
          result.notes.join(" "),
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
        <LiveField label={kind === "announcement" ? form.title : "Title"}>
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
        <LiveField label="Team">
          <NativeSelect name="teamId" required defaultValue="">
            <option value="" disabled>
              Choose a team…
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
          <LiveField label={kind === "timeOff" ? "First day" : "Starts"}>
            {kind === "timeOff" ? <DateField name="start" required /> : <WhenField name="start" required />}
          </LiveField>
          <LiveField label={kind === "timeOff" ? "Last day" : "Ends"}>
            {kind === "timeOff" ? <DateField name="end" required /> : <WhenField name="end" required />}
          </LiveField>
        </div>
      )}
      {(kind === "commitment" || kind === "meeting") && (
        <LiveField label="Where to meet">
          <Input name="location" maxLength={300} required />
        </LiveField>
      )}
      {kind === "commitment" && (
        <LiveField
          label="Preparation"
          help="What should the person know or do beforehand?"
        >
          <Textarea name="preparation" rows={4} maxLength={5000} />
        </LiveField>
      )}
      {kind === "commitment" && (
        <div className="live-form-grid">
          <LiveField label="Repeats">
            <NativeSelect name="intervalWeeks" defaultValue="1" required>
              <option value="1">Every week</option>
              <option value="2">Every 2 weeks</option>
              <option value="3">Every 3 weeks</option>
              <option value="4">Every 4 weeks</option>
            </NativeSelect>
          </LiveField>
          <LiveField
            label="How many times"
            help="1 is a single date. Up to 52 within one year."
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
              {kind === "announcement" ? form.saving : "Saving…"}
            </>
          ) : kind === "invite" ? (
            "Create invitation"
          ) : kind === "announcement" ? (
            form.save
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </form>
  );
}
