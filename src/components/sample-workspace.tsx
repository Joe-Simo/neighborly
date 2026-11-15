"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  RotateCcw,
  MapPin,
  Clock3,
  BookOpen,
  Users,
  Check,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  sampleDates,
  people,
  getPhase,
  getSelectedCommitment,
  formatDate,
  type ExampleState,
  type ExampleAction,
} from "@/lib/neighborly";
import { prepareDraft } from "@/lib/draft";
import { validateDraft, type DraftFields } from "@/lib/draft-validation";
import type { Dispatch, SetStateAction } from "react";
const phaseLabel = {
  committed: "Accepted",
  unassigned: "No commitment",
  open: "Open for cover",
  pending: "Awaiting reply",
  accepted: "Noor accepted",
  declined: "Open · request declined",
};
export function Commitment({
  state,
  dispatch,
  compact = false,
  showHeading = true,
}: {
  state: ExampleState;
  dispatch: Dispatch<ExampleAction>;
  compact?: boolean;
  showHeading?: boolean;
}) {
  const [contact, setContact] = useState(false);
  const contactTrigger = useRef<HTMLButtonElement>(null);
  const commitment = getSelectedCommitment(state);
  const person = commitment.assignee ? people[commitment.assignee] : null;
  return (
    <>
      {showHeading && (
        <div className="panel-header">
          <div>
            <p className="eyebrow">Welcome team</p>
            <h3 className="panel-title" style={{ marginTop: 12 }}>
              Sunday {formatDate(state.selectedDate)}
            </h3>
          </div>
          <Badge variant={person ? "secondary" : "outline"}>
            {phaseLabel[getPhase(state)]}
          </Badge>
        </div>
      )}
      <div className="detail-line">
        <Clock3 />
        <div>
          09:30–11:00<p className="meta">America/New_York · Eastern time</p>
        </div>
      </div>
      <div className="detail-line">
        <MapPin />
        <div>
          St. Andrew’s Church
          <p className="meta">
            Meet at the main entrance, beside the welcome desk.
          </p>
        </div>
      </div>
      <div className="detail-line">
        <Users />
        <div>
          {person ? `${person.name} · Accepted commitment` : "One place open"}
          <p className="meta">Ellis · Team coordinator</p>
        </div>
      </div>
      {person && (
        <>
          <div className="detail-line">
            <BookOpen />
            <div>
              Ready to welcome
              <p className="meta">Your role guide · Preparation available</p>
            </div>
          </div>
          <ol className="steps">
            <li>Arrive at 09:20 and check in with Ellis.</li>
            <li>Put out the welcome signs and service sheets.</li>
            <li>Greet arriving people and help them find a seat.</li>
          </ol>
          <p className="meta">Accepted responsibility · Not yet completed</p>
        </>
      )}
      {!compact && (
        <div className="response-buttons">
          {commitment.assignee && (
            <Button
              variant="outline"
              onClick={() => {
                dispatch({
                  type: "set-view",
                  view: commitment.assignee === "noor" ? "noor" : "grace",
                });
                dispatch({ type: "preview-change" });
              }}
            >
              Change commitment
            </Button>
          )}
          <Button
            ref={contactTrigger}
            variant="ghost"
            onClick={() => setContact(true)}
          >
            <Mail data-icon="inline-start" />
            Contact coordinator
          </Button>
        </div>
      )}
      <Dialog open={contact} onOpenChange={setContact}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            contactTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Contact Ellis</DialogTitle>
            <DialogDescription>
              This is a synthetic team. No messages can be sent.
            </DialogDescription>
          </DialogHeader>
          <p>
            In your own team, the coordinator’s shared contact details would
            appear here. In this example, you can explore changes together
            through the coordinator view.
          </p>
          <Button
            onClick={() => {
              dispatch({ type: "set-view", view: "coordinator" });
              setContact(false);
            }}
          >
            Open coordinator view
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Responsibility({
  kind,
  state,
  dispatch,
}: {
  kind: "task" | "meeting";
  state: ExampleState;
  dispatch: Dispatch<ExampleAction>;
}) {
  return kind === "task" ? (
    <>
      <h3 style={{ marginTop: 24 }}>Prepare the entrance signs</h3>
      <p className="meta">
        Due Saturday 21 November 2026 · Ellis · Main entrance
      </p>
      <p style={{ marginTop: 20 }}>
        Check the sign stands, update the service time, and place them beside
        the front doors.
      </p>
      <Badge style={{ marginTop: 20 }} variant="secondary">
        {state.taskComplete ? "Completed" : "Not completed"}
      </Badge>
      <div style={{ marginTop: 20 }}>
        <Button onClick={() => dispatch({ type: "complete-task" })}>
          {state.taskComplete ? "Reopen task" : "Mark task complete"}
        </Button>
      </div>
    </>
  ) : (
    <>
      <h3 style={{ marginTop: 24 }}>Welcome team check-in</h3>
      <p className="meta">
        Thursday 19 November 2026 · 18:30–19:00 Eastern time
      </p>
      <p style={{ marginTop: 20 }}>Community room · Hosted by Ellis</p>
      <p>Review the entrance plan and share any preparation questions.</p>
      <p className="quiet-note">Response: {state.meetingResponse}</p>
      <div className="response-buttons">
        <Button
          onClick={() =>
            dispatch({ type: "respond-meeting", response: "accepted" })
          }
        >
          Accept invitation
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            dispatch({ type: "respond-meeting", response: "declined" })
          }
        >
          Decline
        </Button>
      </div>
    </>
  );
}
export function Workspace({
  state,
  dispatch,
  onClose,
  initialScreen = "Commitment",
}: {
  state: ExampleState;
  dispatch: Dispatch<ExampleAction>;
  onClose: () => void;
  initialScreen?: string;
}) {
  const [screen, setScreen] = useState(initialScreen);
  const actor = state.view === "noor" ? "noor" : "grace";
  const actorName = people[actor].name;
  const [activityTab, setActivityTab] = useState("task");
  const workspaceHeading = useRef<HTMLHeadingElement>(null);
  const previousScreen = useRef(screen);
  useEffect(() => {
    if (previousScreen.current === screen) return;
    previousScreen.current = screen;
    workspaceHeading.current?.focus();
  }, [screen]);
  const screens = [
    "This week",
    "Team",
    "People",
    "Commitment",
    "My commitments",
    "Time off",
    "Tasks & meetings",
  ];
  return (
    <div id="workspace" className="workspace-expanded" tabIndex={-1}>
      <div className="workspace-entry">
        <div>
          <p className="eyebrow">Your sample team</p>
          <h2>A little more together.</h2>
          <p className="meta">
            The selected date and every choice are preserved.
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Return to story
        </Button>
      </div>
      <div className="workspace">
        <div className="workspace-top">
          <div>
            <h3>St. Andrew’s</h3>
            <p className="meta">Synthetic sample team · No messages are sent</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => dispatch({ type: "reset" })}
          >
            <RotateCcw data-icon="inline-start" />
            Reset
          </Button>
        </div>
        <div className="workspace-inner">
          <nav aria-label="Sample workspace" className="workspace-nav">
            {screens.map((item) => (
              <Button
                key={item}
                variant={screen === item ? "secondary" : "ghost"}
                onClick={() => setScreen(item)}
                aria-current={screen === item ? "page" : undefined}
              >
                {item}
              </Button>
            ))}
          </nav>
          <div className="workspace-content">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">Welcome team</p>
                <h3
                  ref={workspaceHeading}
                  tabIndex={-1}
                  style={{ fontSize: 30, marginTop: 8 }}
                >
                  {screen === "Time off" ? `${actorName}’s time off` : screen}
                </h3>
              </div>
              <Badge variant="outline">Sample workspace</Badge>
            </div>
            {screen === "This week" ? (
              <>
                <p className="meta">
                  Week ending Sunday {formatDate(state.selectedDate)}
                </p>
                <div className="workspace-row">
                  <div>
                    <strong>Sunday welcome</strong>
                    <p>{formatDate(state.selectedDate)} · 09:30–11:00</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setScreen("Commitment")}
                  >
                    {phaseLabel[getPhase(state)]}
                    <ArrowUpRight data-icon="inline-end" />
                  </Button>
                </div>
                {state.selectedDate !== "2026-11-22" && (
                  <h3 className="other-work-heading">Other dated work</h3>
                )}
                <div className="workspace-row">
                  <div>
                    <strong>Prepare entrance signs</strong>
                    <p>Saturday 21 November 2026 · Ellis</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch({ type: "complete-task" })}
                  >
                    {state.taskComplete ? "Reopen task" : "Mark complete"}
                  </Button>
                </div>
                <div className="workspace-row">
                  <div>
                    <strong>Welcome team check-in</strong>
                    <p>
                      Thursday 19 November 2026 · 18:30 Eastern time · Community
                      room
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActivityTab("meeting");
                      setScreen("Tasks & meetings");
                    }}
                  >
                    View invitation
                  </Button>
                </div>
              </>
            ) : screen === "Team" ? (
              <>
                <p>Three people. One continuing team.</p>
                {Object.values(people).map((p) => (
                  <div className="workspace-row" key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <p>{p.rhythm}</p>
                    </div>
                    <Badge variant="secondary">{p.membership}</Badge>
                  </div>
                ))}
                <p className="quiet-note">
                  Membership is separate from the dates a person agrees to
                  serve.
                </p>
                <h3 style={{ marginTop: 32 }}>Dated commitments</h3>
                {sampleDates.map((date) => (
                  <div className="workspace-row" key={date}>
                    <div>
                      <strong>{formatDate(date)}</strong>
                      <p>
                        {state.commitments[date].assignee
                          ? people[state.commitments[date].assignee].name
                          : "No accepted volunteer"}{" "}
                        · {phaseLabel[getPhase(state, date)]}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        dispatch({ type: "select-date", date });
                        setScreen("Commitment");
                      }}
                    >
                      Open <ArrowUpRight data-icon="inline-end" />
                    </Button>
                  </div>
                ))}
              </>
            ) : screen === "People" ? (
              <>
                <ToggleGroup
                  type="single"
                  value={state.view === "noor" ? "noor" : "grace"}
                  aria-label="Choose a person"
                  onValueChange={(v) => {
                    if (v === "grace" || v === "noor")
                      dispatch({ type: "set-view", view: v });
                  }}
                >
                  <ToggleGroupItem value="grace">Grace</ToggleGroupItem>
                  <ToggleGroupItem value="noor">Noor</ToggleGroupItem>
                </ToggleGroup>
                <h3 style={{ marginTop: 25 }}>
                  {state.view === "noor" ? "Noor" : "Grace"}
                </h3>
                <p>Welcome team · Active member</p>
                <p className="quiet-note">
                  {state.view === "noor"
                    ? "Voluntarily shared in this synthetic example: available for occasional Sunday cover and opted into requests. Approved for this role."
                    : "Voluntarily shared in this synthetic example: prefers Sunday mornings and serves every other Sunday."}
                </p>
                <div className="workspace-row">
                  <strong>Team relationship</strong>
                  <span>Active</span>
                </div>
                <div className="workspace-row">
                  <strong>Responsibilities</strong>
                  <span>
                    {
                      Object.values(state.commitments).filter(
                        (c) =>
                          c.assignee ===
                          (state.view === "noor" ? "noor" : "grace"),
                      ).length
                    }{" "}
                    accepted dates
                  </span>
                </div>
                <h3 style={{ marginTop: 28 }}>Current commitments</h3>
                {sampleDates
                  .filter((date) => state.commitments[date].assignee === actor)
                  .map((date) => (
                    <div className="workspace-row" key={date}>
                      <div>
                        <strong>Sunday {formatDate(date)}</strong>
                        <p>Welcome team · 09:30–11:00</p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          dispatch({ type: "select-date", date });
                          setScreen("Commitment");
                        }}
                      >
                        Open commitment <ArrowUpRight data-icon="inline-end" />
                      </Button>
                    </div>
                  ))}
                {!sampleDates.some(
                  (date) => state.commitments[date].assignee === actor,
                ) && (
                  <p className="quiet-note">
                    No accepted dates. {actorName} remains an active team
                    member.
                  </p>
                )}
              </>
            ) : screen === "Commitment" ? (
              <Commitment state={state} dispatch={dispatch} />
            ) : screen === "My commitments" ? (
              <>
                <div className="actor-context">
                  <ToggleGroup
                    type="single"
                    value={actor}
                    onValueChange={(value) => {
                      if (value === "grace" || value === "noor")
                        dispatch({ type: "set-view", view: value });
                    }}
                    aria-label="Whose commitments"
                  >
                    <ToggleGroupItem value="grace">Grace</ToggleGroupItem>
                    <ToggleGroupItem value="noor">Noor</ToggleGroupItem>
                  </ToggleGroup>
                  <p className="meta">
                    {actorName} · Welcome team · Active member
                  </p>
                  <p className="quiet-note">
                    Voluntarily shared in this synthetic example:{" "}
                    {actor === "noor"
                      ? "available for occasional Sunday cover; opted into cover requests."
                      : "prefers Sunday morning responsibilities; serves every other Sunday."}
                  </p>
                </div>
                {sampleDates
                  .filter((d) => state.commitments[d].assignee === actor)
                  .map((d) => (
                    <div className="workspace-row" key={d}>
                      <div>
                        <strong>{formatDate(d)}</strong>
                        <p>Welcome team · 09:30–11:00</p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          dispatch({ type: "select-date", date: d });
                          setScreen("Commitment");
                        }}
                      >
                        Open <ArrowUpRight data-icon="inline-end" />
                      </Button>
                    </div>
                  ))}
                {!sampleDates.some(
                  (date) => state.commitments[date].assignee === actor,
                ) && (
                  <p className="quiet-note">
                    No accepted dates for {actorName}. Team membership remains
                    active.
                  </p>
                )}
                <Button
                  variant="outline"
                  style={{ marginTop: 24 }}
                  onClick={() => setScreen("Time off")}
                >
                  Take a break
                </Button>
              </>
            ) : screen === "Time off" ? (
              <>
                <p>
                  Select a Sunday to preview the exact change for {actorName}.
                  Other people’s commitments and team memberships stay
                  unchanged.
                </p>
                <FieldGroup style={{ marginTop: 20 }}>
                  <Field>
                    <FieldLabel htmlFor="timeoff">
                      {actorName}’s date away
                    </FieldLabel>
                    <NativeSelect
                      id="timeoff"
                      value={state.selectedDate}
                      onChange={(e) => {
                        const date = sampleDates.find(
                          (d) => d === e.target.value,
                        );
                        if (date) dispatch({ type: "select-date", date });
                      }}
                    >
                      {sampleDates.map((d) => (
                        <NativeSelectOption key={d} value={d}>
                          {formatDate(d)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </FieldGroup>
                <p className="quiet-note">
                  {getSelectedCommitment(state).assignee === actor
                    ? `1 accepted commitment affected: Welcome team on ${formatDate(state.selectedDate)}, 09:30–11:00. If confirmed, this date opens for cover; ${actorName} stays on the team and other dates remain unchanged. No request is sent automatically.`
                    : `No ${actorName} commitment is affected on ${formatDate(state.selectedDate)}. Nothing will change or be sent.`}
                </p>
                <Button
                  style={{ marginTop: 22 }}
                  disabled={getSelectedCommitment(state).assignee !== actor}
                  onClick={() => {
                    dispatch({ type: "set-view", view: actor });
                    dispatch({ type: "preview-change" });
                  }}
                >
                  Review change
                </Button>
              </>
            ) : (
              <Tabs value={activityTab} onValueChange={setActivityTab}>
                <TabsList>
                  <TabsTrigger value="task">Task</TabsTrigger>
                  <TabsTrigger value="meeting">Meeting</TabsTrigger>
                </TabsList>
                <TabsContent value="task">
                  <Responsibility
                    kind="task"
                    state={state}
                    dispatch={dispatch}
                  />
                </TabsContent>
                <TabsContent value="meeting">
                  <Responsibility
                    kind="meeting"
                    state={state}
                    dispatch={dispatch}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export type StartTeamState = {
  errors: Partial<Record<keyof DraftFields | "description", string>>;
  draft: boolean;
  saved: boolean;
  description: string;
  draftValues: ReturnType<typeof prepareDraft>;
  fields: DraftFields;
};

export function createStartTeamState(): StartTeamState {
  return {
    errors: {},
    draft: false,
    saved: false,
    description:
      "Our welcome team serves every other Sunday. We need two people from 9:30 to 11.",
    draftValues: prepareDraft(""),
    fields: {
      teamName: "",
      firstDate: "",
      time: "",
      recurrence: "",
      peopleCount: "",
      timeZone: "",
      role: "",
      participants: "",
    },
  };
}

export function StartTeam({
  state,
  onChange,
}: {
  state: StartTeamState;
  onChange: Dispatch<SetStateAction<StartTeamState>>;
}) {
  const { errors, draft, saved, description, draftValues } = state;
  const setErrors = (errors: StartTeamState["errors"]) =>
    onChange((current) => ({ ...current, errors }));
  const setSaved = (saved: boolean) =>
    onChange((current) => ({ ...current, saved }));
  const fieldProps = (name: keyof DraftFields) => ({
    value: state.fields[name],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const value = event.target.value;
      onChange((current) => ({
        ...current,
        saved: false,
        fields: { ...current.fields, [name]: value },
      }));
    },
  });
  const fieldError = (name: keyof DraftFields | "description") =>
    errors[name] ? (
      <FieldDescription id={`error-${name}`} className="field-error">
        {errors[name]}
      </FieldDescription>
    ) : null;
  return (
    <section id="start" className="draft-section">
      <div className="draft-inner">
        <div>
          <p className="eyebrow" style={{ marginBottom: 22 }}>
            A small beginning
          </p>
          <h2>
            Start with the
            <br />
            team you have.
          </h2>
          <p>
            No perfect plan required. Put the basics in one place, then make
            them yours.
          </p>
        </div>
        <form
          className="draft-form"
          noValidate
          onChange={() => setSaved(false)}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (!draft) {
              if (!description.trim()) {
                setErrors({ description: "Describe what your team does." });
                form
                  .querySelector<HTMLTextAreaElement>("#description")
                  ?.focus();
                return;
              }
              const prepared = prepareDraft(description);
              onChange((current) => ({
                ...current,
                errors: {},
                draftValues: prepared,
                fields: {
                  teamName: prepared.teamName,
                  firstDate: "",
                  time: prepared.time,
                  recurrence: prepared.recurrence,
                  peopleCount: String(prepared.peopleCount ?? ""),
                  timeZone: "",
                  role: "",
                  participants: "",
                },
                draft: true,
                saved: false,
              }));
              return;
            }
            const data = new FormData(form);
            const fields: DraftFields = {
              teamName: String(data.get("teamName") ?? ""),
              firstDate: String(data.get("firstDate") ?? ""),
              time: String(data.get("time") ?? ""),
              recurrence: String(data.get("recurrence") ?? ""),
              peopleCount: String(data.get("peopleCount") ?? ""),
              timeZone: String(data.get("timeZone") ?? ""),
              role: String(data.get("role") ?? ""),
              participants: String(data.get("participants") ?? ""),
            };
            const nextErrors = validateDraft(fields);
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length) {
              setSaved(false);
              const target = form.elements.namedItem(
                Object.keys(nextErrors)[0],
              );
              if (target instanceof HTMLElement) target.focus();
              return;
            }
            setSaved(true);
          }}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="description">
                What does your team do?
              </FieldLabel>
              <Textarea
                id="description"
                name="description"
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? "error-description" : undefined
                }
                value={description}
                onChange={(event) => {
                  const value = event.target.value;
                  onChange((current) => ({
                    ...current,
                    description: value,
                    draft: false,
                    saved: false,
                  }));
                }}
                required
                maxLength={1500}
              />
              <FieldDescription>
                Your words stay here in this browser session.
              </FieldDescription>
              {fieldError("description")}
            </Field>
          </FieldGroup>
          {draft && (
            <>
              <Alert>
                <AlertTitle>Your editable starting point</AlertTitle>
                <AlertDescription>
                  Explicit details from your description are copied below for
                  review. Nothing is scheduled, assigned, or sent.
                  <ul className="mt-2 list-disc pl-4">
                    {draftValues.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              <FieldGroup>
                <div className="draft-fields">
                  <Field data-invalid={Boolean(errors.teamName)}>
                    <FieldLabel htmlFor="teamname">Team name</FieldLabel>
                    <Input
                      id="teamname"
                      name="teamName"
                      aria-invalid={Boolean(errors.teamName)}
                      aria-describedby={
                        errors.teamName ? "error-teamName" : undefined
                      }
                      required
                      {...fieldProps("teamName")}
                      placeholder="Team name"
                    />
                    {fieldError("teamName")}
                  </Field>
                  <Field data-invalid={Boolean(errors.firstDate)}>
                    <FieldLabel htmlFor="firstdate">First date</FieldLabel>
                    <Input
                      id="firstdate"
                      {...fieldProps("firstDate")}
                      name="firstDate"
                      aria-invalid={Boolean(errors.firstDate)}
                      aria-describedby={
                        errors.firstDate ? "error-firstDate" : undefined
                      }
                      type="date"
                      required
                    />
                    {fieldError("firstDate")}
                  </Field>
                  <Field data-invalid={Boolean(errors.time)}>
                    <FieldLabel htmlFor="time">Service time</FieldLabel>
                    <Input
                      id="time"
                      name="time"
                      aria-invalid={Boolean(errors.time)}
                      aria-describedby={errors.time ? "error-time" : undefined}
                      {...fieldProps("time")}
                      required
                      placeholder="For example, 09:30–11:00"
                    />
                    {fieldError("time")}
                  </Field>
                  <Field data-invalid={Boolean(errors.recurrence)}>
                    <FieldLabel htmlFor="recurrence">Recurrence</FieldLabel>
                    <Input
                      id="recurrence"
                      name="recurrence"
                      aria-invalid={Boolean(errors.recurrence)}
                      aria-describedby={
                        errors.recurrence ? "error-recurrence" : undefined
                      }
                      required
                      {...fieldProps("recurrence")}
                      placeholder="When does this repeat?"
                    />
                    {fieldError("recurrence")}
                  </Field>
                  <Field data-invalid={Boolean(errors.peopleCount)}>
                    <FieldLabel htmlFor="people-count">
                      People needed
                    </FieldLabel>
                    <Input
                      id="people-count"
                      name="peopleCount"
                      aria-invalid={Boolean(errors.peopleCount)}
                      aria-describedby={
                        errors.peopleCount ? "error-peopleCount" : undefined
                      }
                      type="number"
                      min={1}
                      max={100}
                      required
                      {...fieldProps("peopleCount")}
                    />
                    {fieldError("peopleCount")}
                  </Field>
                  <Field data-invalid={Boolean(errors.timeZone)}>
                    <FieldLabel htmlFor="zone">Time zone</FieldLabel>
                    <Input
                      id="zone"
                      {...fieldProps("timeZone")}
                      name="timeZone"
                      aria-invalid={Boolean(errors.timeZone)}
                      aria-describedby={
                        errors.timeZone ? "error-timeZone" : undefined
                      }
                      required
                      placeholder="For example, America/New_York"
                    />
                    {fieldError("timeZone")}
                  </Field>
                </div>
                <Field data-invalid={Boolean(errors.role)}>
                  <FieldLabel htmlFor="role">Role description</FieldLabel>
                  <Textarea
                    id="role"
                    {...fieldProps("role")}
                    name="role"
                    aria-invalid={Boolean(errors.role)}
                    aria-describedby={errors.role ? "error-role" : undefined}
                    required
                    placeholder="What should someone know before agreeing?"
                  />
                  {fieldError("role")}
                </Field>
                <Field data-invalid={Boolean(errors.participants)}>
                  <FieldLabel htmlFor="participants">Participants</FieldLabel>
                  <Textarea
                    id="participants"
                    {...fieldProps("participants")}
                    name="participants"
                    aria-invalid={Boolean(errors.participants)}
                    aria-describedby={
                      errors.participants ? "error-participants" : undefined
                    }
                    required
                    placeholder="Add the people you want to discuss this with."
                  />
                  <FieldDescription>
                    Names are not consent or acceptance. This local draft sends
                    no invitations.
                  </FieldDescription>
                  {fieldError("participants")}
                </Field>
              </FieldGroup>
            </>
          )}
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="field-error">
              Review the highlighted fields before continuing.
            </p>
          )}
          {saved ? (
            <Alert>
              <Check />
              <AlertTitle>Draft ready to review</AlertTitle>
              <AlertDescription>
                Your draft is held in this page only. No team was created on a
                server. Keep this page open to continue editing.
              </AlertDescription>
            </Alert>
          ) : (
            <Button type="submit">
              {draft ? "Review local draft" : "Prepare an editable draft"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </form>
      </div>
    </section>
  );
}
